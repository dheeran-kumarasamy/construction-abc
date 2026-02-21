import { pool } from "../../config/db";

export async function createDraft(projectId: string, userId: string | null) {
  if (!userId) {
    throw new Error("Unauthorized: builder organization id required");
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT * FROM estimates WHERE project_id = $1 AND builder_org_id = $2`,
      [projectId, userId]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const res = await client.query(
      `INSERT INTO estimates (project_id, builder_org_id, status) VALUES ($1, $2, 'draft') RETURNING *`,
      [projectId, userId]
    );

    return res.rows[0];
  } finally {
    client.release();
  }
}

export async function submitRevision(
  estimateId: string,
  userId: string | null,
  marginPercent: number = 0,
  notes?: string
) {
  if (!userId) {
    throw new Error("Unauthorized: builder organization id required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Load estimate to get project_id
    const estRes = await client.query(
      `SELECT * FROM estimates WHERE id = $1 FOR UPDATE`,
      [estimateId]
    );
    const estimate = estRes.rows[0];
    if (!estimate) {
      throw new Error("Estimate not found");
    }

    const projectId = estimate.project_id;

    // Get latest BOQ revision for the project
    const boqRes = await client.query(
      `SELECT id, parsed_json FROM boq_revisions WHERE project_id = $1 ORDER BY revision_number DESC LIMIT 1`,
      [projectId]
    );
    const latestBoq = boqRes.rows[0];
    const boqItems = latestBoq?.parsed_json || [];

    let subtotal = 0;
    for (const item of boqItems) {
      const qty = Number(item.Qty ?? item.qty ?? 0);
      const rate = Number(item.Rate ?? item.rate ?? 0);
      subtotal += qty * rate;
    }
    const grandTotal = subtotal * (1 + (marginPercent || 0) / 100);

    // Determine next revision number for this estimate
    const revRes = await client.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_rev FROM estimate_revisions WHERE estimate_id = $1`,
      [estimateId]
    );
    const revisionNumber = revRes.rows[0].next_rev;

    // Insert estimate revision
    await client.query(
      `INSERT INTO estimate_revisions (
         estimate_id,
         revision_number,
         source,
         project_revision_id,
         boq_revision_id,
         pricing_snapshot,
         margin_config,
         grand_total,
         notes
       ) VALUES ($1, $2, 'builder', $3, $4, $5, $6, $7, $8)`,
      [
        estimateId,
        revisionNumber,
        null,
        latestBoq?.id || null,
        JSON.stringify(boqItems),
        JSON.stringify({ marginPercent }),
        grandTotal,
        notes || null,
      ]
    );

    // Update estimate status
    await client.query(`UPDATE estimates SET status = 'submitted' WHERE id = $1`, [
      estimateId,
    ]);

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata) VALUES ($1, $2, 'ESTIMATE_SUBMITTED', $3)`,
      [projectId, userId, JSON.stringify({ revisionNumber })]
    );

    await client.query("COMMIT");

    return { revisionNumber, grandTotal };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getBuilderEstimate(projectId: string, userId: string | null) {
  const res = await pool.query(
    `SELECT * FROM estimates WHERE project_id = $1 AND builder_org_id = $2`,
    [projectId, userId]
  );

  return res.rows[0] || null;
}

export async function getAllProjectEstimates(projectId: string) {
  const res = await pool.query(
    `SELECT
       e.id AS estimate_id,
       e.project_id,
       e.builder_org_id,
       e.status,
       o.name AS builder_name,
       er.id AS revision_id,
       er.revision_number,
       er.pricing_snapshot,
       er.margin_config,
       er.grand_total,
       er.notes,
       er.submitted_at
     FROM estimates e
     JOIN organizations o ON o.id = e.builder_org_id
     LEFT JOIN LATERAL (
       SELECT id, revision_number, pricing_snapshot, margin_config, grand_total, notes, submitted_at
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     WHERE e.project_id = $1
       AND e.status = 'submitted'
     ORDER BY er.submitted_at DESC NULLS LAST, e.created_at DESC`,
    [projectId]
  );

  return res.rows;
}