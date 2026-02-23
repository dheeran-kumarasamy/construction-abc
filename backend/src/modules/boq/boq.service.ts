import { pool } from "../../config/db";
import { unlink } from "fs/promises";
import XLSX from "xlsx";
import path from "path";

export async function saveOrUpdateBOQ(
  projectId: string,
  userId: string,
  file: Express.Multer.File,
  columnMapping?: Record<string, string>
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Parse the file to extract data for database storage
    const fs = require("fs");
    const buffer = fs.readFileSync(file.path);
    const parsed = await parseBOQFile(buffer, file.mimetype, columnMapping);

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
             file_size = $4, column_mapping = $5, parsed_data = $6, uploaded_at = CURRENT_TIMESTAMP
         WHERE project_id = $7
         RETURNING *`,
        [file.originalname, file.path, file.mimetype, file.size, 
         JSON.stringify(parsed.mapping), JSON.stringify(parsed.items), projectId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } else {
      // Insert new BOQ
      const result = await client.query(
        `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size, column_mapping, parsed_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [projectId, userId, file.originalname, file.path, file.mimetype, file.size,
         JSON.stringify(parsed.mapping), JSON.stringify(parsed.items)]
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
    `SELECT b.id, b.project_id, b.file_name, b.file_path, b.file_type, 
            b.file_size, b.column_mapping, b.uploaded_at,
            COALESCE(u.email, '') as uploaded_by_name
     FROM boqs b
     LEFT JOIN users u ON b.uploaded_by = u.id
     WHERE b.project_id = $1`,
    [projectId]
  );
  return result.rows[0];
}

export async function checkExistingBOQ(projectId: string) {
  const result = await pool.query(
    "SELECT id, file_name FROM boqs WHERE project_id = $1",
    [projectId]
  );
  return result.rows[0] || null;
}

export async function parseStoredBOQFile(filePath: string, columnMapping: Record<string, string>) {
  try {
    const fs = require("fs");
    const buffer = fs.readFileSync(filePath);
    const mimetype = filePath.endsWith(".xlsx") || filePath.endsWith(".xls") 
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";
    
    return parseBOQFile(buffer, mimetype, columnMapping);
  } catch (err) {
    console.error("Error parsing stored BOQ:", err);
    return { columns: [], mapping: columnMapping, items: [], preview: [] };
  }
}

export async function invalidatePendingInvites(projectId: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE user_invites 
       SET expires_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND accepted_at IS NULL`,
      [projectId]
    );
  } finally {
    client.release();
  }
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

export async function uploadBOQ(
  projectId: string, 
  userId: string, 
  file: Express.Multer.File,
  columnMapping?: Record<string, string>
) {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const resolvedPath = file?.path ||
    (file?.destination && file?.filename
      ? path.join(file.destination, file.filename)
      : "");

  if (!resolvedPath) {
    throw new Error("Uploaded file path is missing");
  }

  const normalizedFile = {
    ...file,
    path: resolvedPath,
  } as Express.Multer.File;

  const boq = await saveOrUpdateBOQ(projectId, userId, normalizedFile, columnMapping);
  
  // Invalidate pending invites for this project
  await invalidatePendingInvites(projectId);

  return {
    message: "BOQ uploaded successfully",
    boq,
  };
}

export async function parseBOQFile(buffer: Buffer, mimetype: string, overrideMapping?: Record<string, string>) {
  const detectColumnMapping = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    
    for (const header of headers) {
      const normalized = header.toLowerCase();
      if (/item|description|work/i.test(normalized) && !mapping.item) {
        mapping.item = header;
      } else if (/qty|quantity|amount/i.test(normalized) && !mapping.qty) {
        mapping.qty = header;
      } else if (/uom|unit|measure/i.test(normalized) && !mapping.uom) {
        mapping.uom = header;
      }
    }
    
    return mapping;
  };

  // Use override mapping if provided, otherwise auto-detect
  const useMapping = (headers: string[]) => {
    if (overrideMapping && Object.keys(overrideMapping).length > 0) {
      return overrideMapping;
    }
    return detectColumnMapping(headers);
  };

  const normalizeRow = (row: Record<string, any>, mapping: Record<string, string>) => {
    return {
      item: mapping.item ? String(row[mapping.item] ?? "").trim() : "",
      qty: mapping.qty ? String(row[mapping.qty] ?? "").trim() : "",
      uom: mapping.uom ? String(row[mapping.uom] ?? "").trim() : "",
    };
  };

  const isExcel =
    mimetype === "application/vnd.ms-excel" ||
    mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (isExcel) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return { columns: [], mapping: {}, items: [], preview: [] };

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    
    if (rows.length === 0) return { columns: [], mapping: {}, items: [], preview: [] };
    
    const columns = Object.keys(rows[0]);
    const mapping = useMapping(columns);
    const items = rows
      .map(row => normalizeRow(row, mapping))
      .filter(r => r.item || r.qty || r.uom);
    
    return {
      columns,
      mapping,
      items,
      preview: items.slice(0, 5), // First 5 rows for preview
    };
  }

  const csv = buffer.toString();
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { columns: [], mapping: {}, items: [], preview: [] };

  const headers = lines[0].split(",").map(h => h.trim());
  const mapping = useMapping(headers);
  
  const rows = lines.slice(1).map(line => {
    const cols = line.split(",");
    const rawRow: Record<string, string> = {};
    headers.forEach((header, index) => {
      rawRow[header] = cols[index]?.trim() || "";
    });
    return normalizeRow(rawRow, mapping);
  });

  const items = rows.filter(r => r.item || r.qty || r.uom);

  return {
    columns: headers,
    mapping,
    items,
    preview: items.slice(0, 5), // First 5 rows for preview
  };
}

