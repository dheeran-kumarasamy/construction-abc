import { pool } from "../../config/db";

export async function fetchComparison(projectId: string) {
  const res = await pool.query(
    `SELECT
       er.*,
       b.name as builder_name
     FROM estimate_revisions er
     JOIN builders b ON er.builder_id = b.id
     WHERE er.project_id = $1
     ORDER BY er.grand_total ASC`,
    [projectId]
  );

  return res.rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export async function createAward(
  projectId: string,
  estimateRevisionId: string,
  userId: string | null
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure award not already created
    const existing = await client.query(
      `SELECT id FROM awards WHERE project_id = $1`,
      [projectId]
    );

    if (existing.rows.length) {
      throw new Error("Project already awarded");
    }

    // Insert award
    const awardRes = await client.query(
      `INSERT INTO awards (project_id, estimate_revision_id, approved_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [projectId, estimateRevisionId, userId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'PROJECT_AWARDED', $3)`,
      [projectId, userId, JSON.stringify({ estimateRevisionId })]
    );

    await client.query("COMMIT");

    return { awardId: awardRes.rows[0].id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}