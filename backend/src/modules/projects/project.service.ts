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
     WHERE ($1::uuid IS NULL OR p.architect_id = $1)
     ORDER BY p.created_at DESC`,
    [architectId]
  );

  return res.rows;
}