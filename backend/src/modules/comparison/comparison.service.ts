import { pool } from "../../config/db";

async function assertArchitectHeadForProject(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  projectId: string,
  userId: string | null
) {
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const access = await client.query(
    `SELECT p.id
     FROM projects p
     JOIN users requester ON requester.id = $2
     JOIN users project_architect ON project_architect.id = p.architect_id
     WHERE p.id = $1
       AND requester.role = 'architect'
       AND requester.org_role = 'head'
       AND requester.organization_id IS NOT NULL
       AND requester.organization_id = project_architect.organization_id
     LIMIT 1`,
    [projectId, userId]
  );

  if (!access.rows.length) {
    throw new Error("Only the head architect of this organization can approve or select a builder");
  }
}

export async function fetchComparison(projectId: string) {
  const res = await pool.query(
    `SELECT
       e.builder_org_id,
       e.id AS estimate_id,
       e.status AS estimate_status,
       o.name AS builder_name,
       er.id AS revision_id,
       er.revision_number,
       COALESCE(
         (er.margin_config->>'overallMargin')::numeric,
         (er.margin_config->>'marginPercent')::numeric,
         0
       ) AS margin_percent,
       er.grand_total,
       er.submitted_at,
       award.id AS award_id,
       award.estimate_revision_id AS awarded_revision_id,
       award.approved_at AS awarded_at
     FROM estimates e
     JOIN organizations o ON o.id = e.builder_org_id
     JOIN LATERAL (
       SELECT id, revision_number, margin_config, grand_total, submitted_at
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     LEFT JOIN LATERAL (
       SELECT id, estimate_revision_id, approved_at
       FROM awards
       WHERE project_id = e.project_id
       LIMIT 1
     ) award ON true
     WHERE e.project_id = $1
       AND e.status IN ('submitted', 'awarded')
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

    await assertArchitectHeadForProject(client, projectId, userId);

    // Ensure selected revision belongs to the target project and resolve owning estimate
    const revisionRes = await client.query(
      `SELECT er.id, er.estimate_id
       FROM estimate_revisions er
       JOIN estimates e ON e.id = er.estimate_id
       WHERE er.id = $1
         AND e.project_id = $2
       LIMIT 1`,
      [estimateRevisionId, projectId]
    );

    if (!revisionRes.rows.length) {
      throw new Error("Selected estimate revision does not belong to this project");
    }

    const selectedEstimateId = String(revisionRes.rows[0].estimate_id);

    const existing = await client.query(
      `SELECT a.id, a.estimate_revision_id, er.estimate_id AS existing_estimate_id
       FROM awards a
       LEFT JOIN estimate_revisions er ON er.id = a.estimate_revision_id
       WHERE a.project_id = $1
       LIMIT 1`,
      [projectId]
    );

    let awardId: string;
    let previousRevisionId: string | null = null;
    let previousEstimateId: string | null = null;
    let action = 'PROJECT_AWARDED';

    if (existing.rows.length) {
      previousRevisionId = existing.rows[0].estimate_revision_id || null;
      previousEstimateId = existing.rows[0].existing_estimate_id || null;

      if (previousRevisionId === estimateRevisionId) {
        awardId = existing.rows[0].id;
      } else {
        const updated = await client.query(
          `UPDATE awards
           SET estimate_revision_id = $2,
               approved_by = $3,
               approved_at = now()
           WHERE id = $1
           RETURNING id`,
          [existing.rows[0].id, estimateRevisionId, userId]
        );
        awardId = updated.rows[0].id;
        action = 'PROJECT_AWARD_CHANGED';
      }
    } else {
      const awardRes = await client.query(
        `INSERT INTO awards (project_id, estimate_revision_id, approved_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [projectId, estimateRevisionId, userId]
      );
      awardId = awardRes.rows[0].id;
    }

    if (previousEstimateId && previousEstimateId !== selectedEstimateId) {
      await client.query(`UPDATE estimates SET status = 'submitted' WHERE id = $1`, [previousEstimateId]);
    }

    await client.query(`UPDATE estimates SET status = 'awarded' WHERE id = $1`, [selectedEstimateId]);

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        projectId,
        userId,
        action,
        JSON.stringify({ estimateRevisionId, previousEstimateRevisionId: previousRevisionId }),
      ]
    );

    await client.query("COMMIT");

    return { awardId, replaced: action === 'PROJECT_AWARD_CHANGED' };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}