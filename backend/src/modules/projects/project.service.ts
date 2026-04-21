import { pool } from "../../config/db";

let hasBuildingMetadataColumnsCache: boolean | null = null;
let hasCurrencyCodeColumnCache: boolean | null = null;

async function hasBuildingMetadataColumns() {
  if (hasBuildingMetadataColumnsCache !== null) {
    return hasBuildingMetadataColumnsCache;
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'project_revisions'
       AND column_name IN ('building_type', 'floors_above_ground', 'floors_below_ground')`
  );

  hasBuildingMetadataColumnsCache = Number(rows[0]?.count || 0) >= 3;
  return hasBuildingMetadataColumnsCache;
}

async function hasCurrencyCodeColumn() {
  if (hasCurrencyCodeColumnCache !== null) {
    return hasCurrencyCodeColumnCache;
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'project_revisions'
       AND column_name = 'currency_code'`
  );

  hasCurrencyCodeColumnCache = Number(rows[0]?.count || 0) >= 1;
  return hasCurrencyCodeColumnCache;
}

interface CreateProjectInput {
  name: string;
  description?: string;
  siteAddress: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  durationMonths: number;
  buildingType: string;
  floorsAboveGround: number;
  floorsBelowGround: number;
  currencyCode: string;
  userId: string | null;
}

export async function createProjectWithRevision(input: CreateProjectInput) {
  const client = await pool.connect();
  const hasBuildingMetadata = await hasBuildingMetadataColumns();
  const hasCurrencyCode = await hasCurrencyCodeColumn();

  try {
    await client.query("BEGIN");

    const projectRes = await client.query(
      `INSERT INTO projects (name, description, architect_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.name, input.description || null, input.userId]
    );

    const projectId = projectRes.rows[0].id;

    if (hasBuildingMetadata && hasCurrencyCode) {
      await client.query(
        `INSERT INTO project_revisions (
          project_id,
          revision_number,
          site_address,
          latitude,
          longitude,
          tentative_start_date,
          duration_months,
          building_type,
          floors_above_ground,
          floors_below_ground,
          currency_code,
          issued_by
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          projectId,
          input.siteAddress,
          input.latitude || null,
          input.longitude || null,
          input.startDate,
          input.durationMonths,
          input.buildingType,
          input.floorsAboveGround,
          input.floorsBelowGround,
          input.currencyCode,
          input.userId,
        ]
      );
    } else if (hasBuildingMetadata) {
      await client.query(
        `INSERT INTO project_revisions (
          project_id,
          revision_number,
          site_address,
          latitude,
          longitude,
          tentative_start_date,
          duration_months,
          building_type,
          floors_above_ground,
          floors_below_ground,
          issued_by
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          projectId,
          input.siteAddress,
          input.latitude || null,
          input.longitude || null,
          input.startDate,
          input.durationMonths,
          input.buildingType,
          input.floorsAboveGround,
          input.floorsBelowGround,
          input.userId,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO project_revisions (
          project_id,
          revision_number,
          site_address,
          latitude,
          longitude,
          tentative_start_date,
          duration_months,
          issued_by
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7)`,
        [
          projectId,
          input.siteAddress,
          input.latitude || null,
          input.longitude || null,
          input.startDate,
          input.durationMonths,
          input.userId,
        ]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'PROJECT_CREATED', $3)`,
      [projectId, input.userId, JSON.stringify({ name: input.name })]
    );

    await client.query("COMMIT");

    return { projectId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getProjects(architectId: string | null) {
  const hasBuildingMetadata = await hasBuildingMetadataColumns();

  const buildingProjection = hasBuildingMetadata
    ? `pr.building_type,
           pr.floors_above_ground,
           pr.floors_below_ground`
    : `NULL::text AS building_type,
           NULL::int AS floors_above_ground,
           NULL::int AS floors_below_ground`;

  const revisionProjection = hasBuildingMetadata
    ? `SELECT site_address, tentative_start_date, duration_months, building_type, floors_above_ground, floors_below_ground
           FROM project_revisions
           WHERE project_id = p.id
           ORDER BY revision_number DESC
           LIMIT 1`
    : `SELECT site_address, tentative_start_date, duration_months,
              NULL::text AS building_type,
              NULL::int AS floors_above_ground,
              NULL::int AS floors_below_ground
           FROM project_revisions
           WHERE project_id = p.id
           ORDER BY revision_number DESC
           LIMIT 1`;

  if (!architectId) {
    return [];
  }

  const requesterRes = await pool.query(
    `SELECT id, role, organization_id, org_role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [architectId]
  );

  const requester = requesterRes.rows[0];
  if (!requester) {
    return [];
  }

  if (String(requester.role || "").toLowerCase() === "architect" && !requester.organization_id) {
    const fallbackInviteRes = await pool.query(
      `SELECT organization_id
       FROM user_invites
       WHERE user_id = $1
         AND role = 'architect'
         AND accepted_at IS NOT NULL
         AND organization_id IS NOT NULL
       ORDER BY accepted_at DESC
       LIMIT 1`,
      [architectId]
    );

    const inferredOrgId = fallbackInviteRes.rows[0]?.organization_id || null;

    if (inferredOrgId) {
      await pool.query(
        `UPDATE users
         SET organization_id = $1,
             org_role = COALESCE(org_role, 'member')
         WHERE id = $2
           AND organization_id IS NULL`,
        [inferredOrgId, architectId]
      );

      requester.organization_id = inferredOrgId;
      requester.org_role = 'member';
    }
  }

  if (String(requester.role || "").toLowerCase() === "architect" && requester.organization_id) {
    const isHead = String(requester.org_role || "").toLowerCase() === "head";
    
    // If architect head: show all org projects
    // If architect member: show only assigned projects + own created projects
    if (isHead) {
      const orgRes = await pool.query(
        `SELECT
           p.id,
           p.name,
           p.description,
           p.created_at,
           p.architect_id,
           p.boq_id,
           pr.site_address,
           pr.tentative_start_date,
           pr.duration_months,
           ${buildingProjection}
         FROM projects p
         JOIN users project_architect ON project_architect.id = p.architect_id
         LEFT JOIN LATERAL (
           ${revisionProjection}
         ) pr ON true
         WHERE project_architect.organization_id = $1
            OR p.architect_id = $2
         ORDER BY p.created_at DESC`,
        [requester.organization_id, architectId]
      );

      return orgRes.rows;
    } else {
      // Member: show only projects they've been assigned to via invites + own created projects
      const memberRes = await pool.query(
        `SELECT DISTINCT
           p.id,
           p.name,
           p.description,
           p.created_at,
           p.architect_id,
           p.boq_id,
           pr.site_address,
           pr.tentative_start_date,
           pr.duration_months,
           ${buildingProjection}
         FROM projects p
         LEFT JOIN LATERAL (
           ${revisionProjection}
         ) pr ON true
         WHERE (
           -- Project they created
           p.architect_id = $1
           OR
           -- Project explicitly assigned to them via invite
           EXISTS (
             SELECT 1
             FROM user_invites ui
             WHERE ui.project_id = p.id
               AND ui.user_id = $1
               AND ui.role = 'architect'
               AND ui.accepted_at IS NOT NULL
           )
         )
         ORDER BY p.created_at DESC`,
        [architectId]
      );

      return memberRes.rows;
    }
  }

  const res = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.created_at,
       p.architect_id,
       p.boq_id,
       pr.site_address,
       pr.tentative_start_date,
       pr.duration_months,
       ${buildingProjection}
     FROM projects p
     LEFT JOIN LATERAL (
       ${revisionProjection}
     ) pr ON true
     WHERE p.architect_id = $1
     ORDER BY p.created_at DESC`,
    [architectId]
  );

  return res.rows;
}