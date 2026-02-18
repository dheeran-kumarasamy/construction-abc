import { pool } from "../../config/db";
import * as XLSX from "xlsx";

interface BoqUploadInput {
  projectId: string;
  filePath: string;
  userId: string | null;
}

export async function processBoqUpload(input: BoqUploadInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Read Excel
    const workbook = XLSX.readFile(input.filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Determine next revision number
    const revRes = await client.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_rev
       FROM boq_revisions WHERE project_id = $1`,
      [input.projectId]
    );

    const revisionNumber = revRes.rows[0].next_rev;

    // Insert BOQ revision
    const boqRes = await client.query(
      `INSERT INTO boq_revisions (
        project_id,
        revision_number,
        file_url,
        parsed_json,
        issued_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        input.projectId,
        revisionNumber,
        input.filePath,
        JSON.stringify(jsonData),
        input.userId,
      ]
    );

    const boqRevisionId = boqRes.rows[0].id;

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'BOQ_UPLOADED', $3)`,
      [input.projectId, input.userId, JSON.stringify({ revisionNumber })]
    );

    await client.query("COMMIT");

    return { boqRevisionId, revisionNumber };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}