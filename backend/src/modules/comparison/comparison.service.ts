import { pool } from "../../config/db";

export async function fetchComparison(projectId: string) {
  const res = await pool.query(
    `SELECT
       e.builder_org_id,
       o.name AS builder_name,
       er.id AS revision_id,
       er.revision_number,
       COALESCE(
         (er.margin_config->>'overallMargin')::numeric,
         (er.margin_config->>'marginPercent')::numeric,
         0
       ) AS margin_percent,
       er.grand_total,
       er.submitted_at
     FROM estimates e
     JOIN organizations o ON o.id = e.builder_org_id
     JOIN LATERAL (
       SELECT id, revision_number, margin_config, grand_total, submitted_at
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     WHERE e.project_id = $1
       AND e.status = 'submitted'
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