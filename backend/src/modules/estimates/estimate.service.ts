import { pool } from "../../config/db";
import { sendSmsNotification } from "../../services/alerts/sms.service";

type ReviewStatus = "commented" | "changes_requested" | "approved";

const REVIEW_ACTION_TO_STATUS: Record<string, ReviewStatus> = {
  ESTIMATE_REVIEW_COMMENT: "commented",
  ESTIMATE_RESUBMISSION_REQUEST: "changes_requested",
  ESTIMATE_REVIEW_APPROVED: "approved",
};

function getReviewAction(status: ReviewStatus) {
  if (status === "approved") return "ESTIMATE_REVIEW_APPROVED";
  if (status === "changes_requested") return "ESTIMATE_RESUBMISSION_REQUEST";
  return "ESTIMATE_REVIEW_COMMENT";
}

type ReviewerProjectAccess = {
  actorOrgRole: "head" | "member" | null;
  actorEmail: string;
  actorOrganizationId: string | null;
  projectName: string;
  headUserId: string | null;
  headEmail: string | null;
  headPhoneNumber: string | null;
};

async function assertArchitectReviewerForProject(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  projectId: string,
  userId: string
) : Promise<ReviewerProjectAccess> {
  const access = await client.query(
    `SELECT
       actor.org_role AS actor_org_role,
       actor.email AS actor_email,
       actor.organization_id AS actor_organization_id,
       p.name AS project_name,
       head.id AS head_user_id,
       head.email AS head_email,
       head.phone_number AS head_phone_number
     FROM projects p
     JOIN users project_architect ON project_architect.id = p.architect_id
     JOIN users actor ON actor.id = $2
     LEFT JOIN users head
       ON head.organization_id = project_architect.organization_id
      AND head.role = 'architect'
      AND head.org_role = 'head'
     WHERE p.id = $1
       AND actor.role = 'architect'
       AND (
         actor.id = p.architect_id
         OR (
           actor.organization_id IS NOT NULL
           AND actor.organization_id = project_architect.organization_id
         )
       )
     LIMIT 1`,
    [projectId, userId]
  );

  if (!access.rows.length) {
    throw new Error("Only architect users in this organization can review and approve estimates");
  }

  const row = access.rows[0];
  const actorOrgRoleRaw = String(row.actor_org_role || "").toLowerCase();
  const actorOrgRole = actorOrgRoleRaw === "head" || actorOrgRoleRaw === "member"
    ? (actorOrgRoleRaw as "head" | "member")
    : null;

  return {
    actorOrgRole,
    actorEmail: String(row.actor_email || ""),
    actorOrganizationId: row.actor_organization_id || null,
    projectName: String(row.project_name || "Project"),
    headUserId: row.head_user_id || null,
    headEmail: row.head_email || null,
    headPhoneNumber: row.head_phone_number || null,
  };
}

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
       er.submitted_at,
       rev_stats.revision_count,
       review.action AS latest_review_action,
       review.metadata AS latest_review_metadata,
       review.created_at AS latest_review_at
     FROM estimates e
     JOIN organizations o ON o.id = e.builder_org_id
     LEFT JOIN LATERAL (
       SELECT id, revision_number, pricing_snapshot, grand_total, notes, submitted_at, margin_config
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS revision_count
       FROM estimate_revisions x
       WHERE x.estimate_id = e.id
     ) rev_stats ON true
     LEFT JOIN LATERAL (
       SELECT action, metadata, created_at
       FROM audit_logs al
       WHERE al.project_id = e.project_id
         AND al.action IN ('ESTIMATE_REVIEW_COMMENT','ESTIMATE_RESUBMISSION_REQUEST','ESTIMATE_REVIEW_APPROVED')
         AND (al.metadata->>'estimateId') = e.id::text
       ORDER BY al.created_at DESC
       LIMIT 1
     ) review ON true
     WHERE e.project_id = $1
       AND e.status = 'submitted'
     ORDER BY er.submitted_at DESC NULLS LAST, e.created_at DESC`,
    [projectId]
  );

  return res.rows.map((row) => {
    const metadata = row.latest_review_metadata || null;
    const latestReviewStatus = REVIEW_ACTION_TO_STATUS[String(row.latest_review_action || "")] || null;
    return {
      ...row,
      basic_material_cost: row.margin_config?.basicMaterialCost ?? null,
      latest_review_status: latestReviewStatus,
      latest_review_comment: metadata?.comment || null,
    };
  });
}

export async function addReviewComment(
  projectId: string,
  estimateId: string,
  architectUserId: string,
  status: ReviewStatus,
  comment: string,
  revisionId?: string | null
) {
  const client = await pool.connect();
  let notifyContext: {
    projectId: string;
    estimateId: string;
    actorUserId: string;
    actorEmail: string;
    projectName: string;
    headUserId: string | null;
    headPhoneNumber: string | null;
  } | null = null;

  try {
    await client.query("BEGIN");

    let reviewerAccess: ReviewerProjectAccess | null = null;

    if (status === "approved") {
      reviewerAccess = await assertArchitectReviewerForProject(client, projectId, architectUserId);
    }

    const estimateRes = await client.query(
      `SELECT id, project_id, builder_org_id, status
       FROM estimates
       WHERE id = $1 AND project_id = $2
       LIMIT 1`,
      [estimateId, projectId]
    );

    if (!estimateRes.rows.length) {
      throw new Error("Estimate not found for this project");
    }

    const estimate = estimateRes.rows[0];
    const reviewAction = getReviewAction(status);
    const cleanedComment = String(comment || "").trim();

    if ((status === "changes_requested" || status === "commented") && !cleanedComment) {
      throw new Error("Comment is required for review feedback");
    }

    const metadata = {
      estimateId,
      revisionId: revisionId || null,
      status,
      comment: cleanedComment || null,
      reviewerOrgRole: reviewerAccess?.actorOrgRole || null,
    };

    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [projectId, architectUserId, reviewAction, JSON.stringify(metadata)]
    );

    if (status === "approved") {
      await client.query(`UPDATE estimates SET status = 'awarded' WHERE id = $1`, [estimateId]);

      if (
        reviewerAccess &&
        reviewerAccess.actorOrgRole === "member" &&
        reviewerAccess.headUserId &&
        reviewerAccess.headUserId !== architectUserId
      ) {
        notifyContext = {
          projectId,
          estimateId,
          actorUserId: architectUserId,
          actorEmail: reviewerAccess.actorEmail,
          projectName: reviewerAccess.projectName,
          headUserId: reviewerAccess.headUserId,
          headPhoneNumber: reviewerAccess.headPhoneNumber,
        };
      }
    } else {
      await client.query(`UPDATE estimates SET status = 'submitted' WHERE id = $1`, [estimateId]);
    }

    await client.query("COMMIT");

    if (notifyContext) {
      const smsMessage = `Team member ${notifyContext.actorEmail} approved estimate ${notifyContext.estimateId} for project ${notifyContext.projectName}.`;
      const smsResult = await sendSmsNotification({
        to: notifyContext.headPhoneNumber,
        message: smsMessage,
        metadata: {
          projectId: notifyContext.projectId,
          estimateId: notifyContext.estimateId,
          actorUserId: notifyContext.actorUserId,
          headUserId: notifyContext.headUserId,
        },
      });

      await pool.query(
        `INSERT INTO audit_logs (project_id, user_id, action, metadata)
         VALUES ($1, $2, 'ESTIMATE_APPROVAL_HEAD_NOTIFY', $3)`,
        [
          notifyContext.projectId,
          notifyContext.actorUserId,
          JSON.stringify({
            estimateId: notifyContext.estimateId,
            headUserId: notifyContext.headUserId,
            smsSent: smsResult.sent,
            smsProvider: smsResult.provider,
            smsReason: smsResult.reason || null,
          }),
        ]
      );
    }

    return {
      ok: true,
      estimateId,
      projectId,
      status,
      comment: cleanedComment || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getTeamApprovalLog(headUserId: string, projectId?: string) {
  const requesterRes = await pool.query(
    `SELECT id, role, org_role, organization_id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [headUserId]
  );

  const requester = requesterRes.rows[0];
  if (!requester) {
    throw new Error("Requester not found");
  }

  const isArchitectHead =
    String(requester.role || "").toLowerCase() === "architect" &&
    String(requester.org_role || "").toLowerCase() === "head";

  if (!isArchitectHead || !requester.organization_id) {
    throw new Error("Only architect head can view team approval logs");
  }

  const result = await pool.query(
    `SELECT
       al.id,
       al.project_id,
       p.name AS project_name,
       (al.metadata->>'estimateId') AS estimate_id,
       COALESCE(al.metadata->>'comment', '') AS comment,
       reviewer.id AS reviewer_user_id,
       reviewer.email AS reviewer_email,
       COALESCE(reviewer.org_role, 'member') AS reviewer_org_role,
       al.created_at AS approved_at,
       COALESCE((notify.metadata->>'smsSent')::boolean, false) AS head_sms_sent,
       notify.metadata->>'smsReason' AS head_sms_reason
     FROM audit_logs al
     JOIN users reviewer ON reviewer.id = al.user_id
     JOIN projects p ON p.id = al.project_id
     JOIN users project_architect ON project_architect.id = p.architect_id
     LEFT JOIN LATERAL (
       SELECT metadata
       FROM audit_logs n
       WHERE n.project_id = al.project_id
         AND n.user_id = al.user_id
         AND n.action = 'ESTIMATE_APPROVAL_HEAD_NOTIFY'
         AND (n.metadata->>'estimateId') = (al.metadata->>'estimateId')
       ORDER BY n.created_at DESC
       LIMIT 1
     ) notify ON true
     WHERE al.action = 'ESTIMATE_REVIEW_APPROVED'
       AND reviewer.role = 'architect'
       AND reviewer.organization_id = $1
       AND reviewer.id <> $2
       AND project_architect.organization_id = $1
       AND ($3::uuid IS NULL OR al.project_id = $3::uuid)
     ORDER BY al.created_at DESC`,
    [requester.organization_id, headUserId, projectId || null]
  );

  return result.rows;
}

export async function getEstimateHistory(projectId: string, estimateId: string) {
  const estimateRes = await pool.query(
    `SELECT e.id AS estimate_id, e.project_id, e.builder_org_id, e.status, o.name AS builder_name
     FROM estimates e
     JOIN organizations o ON o.id = e.builder_org_id
     WHERE e.id = $1 AND e.project_id = $2
     LIMIT 1`,
    [estimateId, projectId]
  );

  if (!estimateRes.rows.length) {
    throw new Error("Estimate not found");
  }

  const revisionsRes = await pool.query(
    `SELECT
       id AS revision_id,
       revision_number,
       source,
       pricing_snapshot,
       margin_config,
       grand_total,
       notes,
       submitted_at
     FROM estimate_revisions
     WHERE estimate_id = $1
     ORDER BY revision_number ASC`,
    [estimateId]
  );

  const reviewsRes = await pool.query(
    `SELECT
       al.id,
       al.action,
       al.metadata,
       al.created_at,
       COALESCE(u.email, '') AS reviewer_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.project_id = $1
       AND al.action IN ('ESTIMATE_REVIEW_COMMENT','ESTIMATE_RESUBMISSION_REQUEST','ESTIMATE_REVIEW_APPROVED')
       AND (al.metadata->>'estimateId') = $2
     ORDER BY al.created_at ASC`,
    [projectId, estimateId]
  );

  const revisions = revisionsRes.rows.map((row: any) => ({
    ...row,
    basic_material_cost: row.margin_config?.basicMaterialCost ?? null,
    submitted_at: row.submitted_at,
  }));

  const reviews = reviewsRes.rows.map((row: any) => {
    const metadata = row.metadata || {};
    const status = REVIEW_ACTION_TO_STATUS[String(row.action)] || "commented";
    return {
      id: row.id,
      action: row.action,
      status,
      comment: metadata?.comment || null,
      revision_id: metadata?.revisionId || null,
      reviewer_email: row.reviewer_email || "",
      created_at: row.created_at,
    };
  });

  return {
    estimate: estimateRes.rows[0],
    revisionCount: revisions.length,
    revisions,
    reviews,
  };
}