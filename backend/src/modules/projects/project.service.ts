import { pool } from "../../config/db";

interface CreateProjectInput {
  name: string;
  description?: string;
  siteAddress: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  durationMonths: number;
  userId: string | null;
}

export async function createProjectWithRevision(input: CreateProjectInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectRes = await client.query(
      `INSERT INTO projects (name, description, architect_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.name, input.description || null, input.userId]
    );

    const projectId = projectRes.rows[0].id;

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
  if (!architectId) {
    return [];
  }

  const requesterRes = await pool.query(
    `SELECT id, role, organization_id
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
    }
  }

  if (String(requester.role || "").toLowerCase() === "architect" && requester.organization_id) {
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
         pr.duration_months
       FROM projects p
       JOIN users project_architect ON project_architect.id = p.architect_id
       LEFT JOIN LATERAL (
         SELECT site_address, tentative_start_date, duration_months
         FROM project_revisions
         WHERE project_id = p.id
         ORDER BY revision_number DESC
         LIMIT 1
       ) pr ON true
       WHERE project_architect.organization_id = $1
          OR p.architect_id = $2
       ORDER BY p.created_at DESC`,
      [requester.organization_id, architectId]
    );

    return orgRes.rows;
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
       pr.duration_months
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT site_address, tentative_start_date, duration_months
       FROM project_revisions
       WHERE project_id = p.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) pr ON true
     WHERE p.architect_id = $1
     ORDER BY p.created_at DESC`,
    [architectId]
  );

  return res.rows;
}