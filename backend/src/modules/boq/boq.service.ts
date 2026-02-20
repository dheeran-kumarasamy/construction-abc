import pool from "../../db/pool";
import { unlink } from "fs/promises";

export async function saveOrUpdateBOQ(
  projectId: string,
  userId: string,
  file: Express.Multer.File
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if BOQ already exists for this project
    const existingBOQ = await client.query(
      "SELECT * FROM boqs WHERE project_id = $1",
      [projectId]
    );

    if (existingBOQ.rows.length > 0) {
      // Delete old file
      try {
        await unlink(existingBOQ.rows[0].file_path);
      } catch (err) {
        console.error("Error deleting old file:", err);
      }

      // Update existing BOQ
      const result = await client.query(
        `UPDATE boqs 
         SET file_name = $1, file_path = $2, file_type = $3, 
             file_size = $4, uploaded_at = CURRENT_TIMESTAMP
         WHERE project_id = $5
         RETURNING *`,
        [file.originalname, file.path, file.mimetype, file.size, projectId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } else {
      // Insert new BOQ
      const result = await client.query(
        `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [projectId, userId, file.originalname, file.path, file.mimetype, file.size]
      );

      // Update project with boq_id
      await client.query(
        "UPDATE projects SET boq_id = $1 WHERE id = $2",
        [result.rows[0].id, projectId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    }
  } catch (err) {
    await client.query("ROLLBACK");
    // Delete uploaded file if transaction fails
    try {
      await unlink(file.path);
    } catch (unlinkErr) {
      console.error("Error deleting file:", unlinkErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getBOQByProject(projectId: string) {
  const result = await pool.query(
    `SELECT b.*, u.name as uploaded_by_name 
     FROM boqs b
     JOIN users u ON b.uploaded_by = u.id
     WHERE b.project_id = $1`,
    [projectId]
  );
  return result.rows[0];
}

export async function deleteBOQ(projectId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const boq = await client.query(
      "SELECT * FROM boqs WHERE project_id = $1",
      [projectId]
    );

    if (boq.rows.length === 0) {
      throw new Error("BOQ not found");
    }

    // Delete file
    try {
      await unlink(boq.rows[0].file_path);
    } catch (err) {
      console.error("Error deleting file:", err);
    }

    // Update project
    await client.query(
      "UPDATE projects SET boq_id = NULL WHERE id = $1",
      [projectId]
    );

    // Delete BOQ record
    await client.query("DELETE FROM boqs WHERE project_id = $1", [projectId]);

    await client.query("COMMIT");
    return { message: "BOQ deleted successfully" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function uploadBOQ(projectId: string, userId: string, file: Express.Multer.File) {
  // Implement your logic here, e.g., save file info to DB, move file, etc.
  // Example:
  return {
    message: "BOQ uploaded successfully",
    projectId,
    userId,
    fileName: file.originalname,
    filePath: file.path,
  };
}