type DbQueryClient = { query: (text: string, params?: any[]) => Promise<any> };

let templateLineItemColumnsCache: { wastageColumn: string; remarksColumn: string } | null = null;

async function resolveTemplateLineItemColumns(client: DbQueryClient = pool) {
  if (templateLineItemColumnsCache) {
    return templateLineItemColumnsCache;
  }

  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'template_line_items'`
  );

  const columns = new Set((result.rows || []).map((row: any) => String(row.column_name || "").toLowerCase()));

  const wastageColumn = columns.has("wastage_percent") ? "wastage_percent" : "wastage_override";
  const remarksColumn = columns.has("remarks") ? "remarks" : "notes";

  templateLineItemColumnsCache = { wastageColumn, remarksColumn };
  return templateLineItemColumnsCache;
}
import pool from "../../db/pool";
import { computeRate, computeRateBatch, priceLookup } from "../../services/rateEngine";
import { ComputeRateInput } from "../../services/rateEngine/types";

// ─────────────────────────────────────────────────
// SOR Reference Data
// ─────────────────────────────────────────────────

export async function listResources(filters: {
  type?: string;
  category?: string;
  annexure?: string;
  search?: string;
}) {
  let query = `SELECT * FROM resources WHERE is_active = true`;
  const params: any[] = [];
  let idx = 1;

  if (filters.type) {
    query += ` AND type = $${idx++}`;
    params.push(filters.type);
  }
  if (filters.category) {
    query += ` AND category = $${idx++}`;
    params.push(filters.category);
  }
  if (filters.annexure) {
    query += ` AND annexure = $${idx++}`;
    params.push(filters.annexure);
  }
  if (filters.search) {
    query += ` AND (name ILIKE $${idx} OR unique_code ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  query += ` ORDER BY unique_code`;
  const { rows } = await pool.query(query, params);
  return rows;
}

async function getUserContext(userId?: string) {
  if (!userId) {
    return { role: "", organizationId: null as string | null };
  }

  const { rows } = await pool.query(
    `SELECT role, organization_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  return {
    role: String(rows[0]?.role || "").toLowerCase(),
    organizationId: (rows[0]?.organization_id as string | null) || null,
  };
}

export async function listTemplates(filters: {
  category?: string;
  search?: string;
}, userId?: string) {
  const user = await getUserContext(userId);
  const isAdmin = user.role === "admin";
  const canSeeOrgTemplates = user.role === "architect" && !!user.organizationId;

  let query = `SELECT id, code, name, category, sub_category, unit, overhead_percent, profit_percent, gst_percent, is_system,
      owner_organization_id, approval_status, submitted_for_global
    FROM rate_templates
    WHERE is_active = true`;
  const params: any[] = [];
  let idx = 1;

  if (isAdmin) {
    // Admin can see all templates, including pending items.
  } else if (canSeeOrgTemplates) {
    query += ` AND (
      (owner_organization_id IS NULL AND approval_status = 'approved')
      OR owner_organization_id = $${idx++}
    )`;
    params.push(user.organizationId);
  } else {
    query += ` AND owner_organization_id IS NULL AND approval_status = 'approved'`;
  }

  if (filters.category) {
    query += ` AND category = $${idx++}`;
    params.push(filters.category);
  }
  if (filters.search) {
    query += ` AND (name ILIKE $${idx} OR code ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  query += ` ORDER BY code`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getTemplateDetail(templateId: string, userId?: string) {
  const user = await getUserContext(userId);
  const isAdmin = user.role === "admin";

  const templateRes = await pool.query(
    `SELECT id, owner_organization_id, approval_status, is_active
     FROM rate_templates
     WHERE id = $1
     LIMIT 1`,
    [templateId]
  );

  const templateRow = templateRes.rows[0];
  if (!templateRow || !templateRow.is_active) {
    return null;
  }

  if (!isAdmin) {
    const ownerOrgId = templateRow.owner_organization_id as string | null;
    const approvalStatus = String(templateRow.approval_status || "");

    if (ownerOrgId) {
      if (!(user.role === "architect" && user.organizationId && user.organizationId === ownerOrgId)) {
        return null;
      }
    } else if (approvalStatus !== "approved") {
      return null;
    }
  }

  return priceLookup.getTemplate(templateId);
}

// ── Template CRUD ───────────────────────────────

export async function createTemplate(data: {
  code: string;
  name: string;
  category: string;
  sub_category?: string;
  unit: string;
  overhead_percent?: number;
  profit_percent?: number;
  gst_percent?: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO rate_templates (code, name, category, sub_category, unit, overhead_percent, profit_percent, gst_percent, is_system)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, false)
     RETURNING *`,
    [data.code, data.name, data.category, data.sub_category || null, data.unit,
     data.overhead_percent ?? 15, data.profit_percent ?? 15, data.gst_percent ?? 18]
  );
  priceLookup.invalidateCache();
  return rows[0];
}

export async function createCustomLineItemTemplateRequest(
  userId: string,
  data: {
    code?: string;
    name: string;
    category: string;
    sub_category?: string;
    unit: string;
    overhead_percent?: number;
    profit_percent?: number;
    gst_percent?: number;
    resource_id: string;
    coefficient: number;
    wastage_percent?: number;
    remarks?: string;
  }
) {
  const user = await getUserContext(userId);
  if (user.role !== "architect") {
    throw new Error("Only architects can submit custom line item requests");
  }

  if (!user.organizationId) {
    throw new Error("Architect must belong to an organization");
  }

  const code = String(data.code || `ORG-${Date.now().toString().slice(-8)}`).trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const createdTemplate = await client.query(
      `INSERT INTO rate_templates (
        code, name, category, sub_category, unit,
        overhead_percent, profit_percent, gst_percent,
        is_system, created_by, owner_organization_id,
        approval_status, submitted_for_global
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,'pending',true)
      RETURNING *`,
      [
        code,
        data.name,
        data.category,
        data.sub_category || null,
        data.unit,
        data.overhead_percent ?? 15,
        data.profit_percent ?? 15,
        data.gst_percent ?? 18,
        userId,
        user.organizationId,
      ]
    );

    const template = createdTemplate.rows[0];
    const { wastageColumn, remarksColumn } = await resolveTemplateLineItemColumns(client);

    await client.query(
      `INSERT INTO template_line_items (
        template_id, resource_id, sub_template_id,
        coefficient, ${wastageColumn}, ${remarksColumn}, sort_order
      )
      VALUES ($1,$2,NULL,$3,$4,$5,1)`,
      [
        template.id,
        data.resource_id,
        data.coefficient,
        data.wastage_percent ?? 0,
        data.remarks || null,
      ]
    );

    await client.query("COMMIT");
    priceLookup.invalidateCache();
    return template;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPendingTemplateApprovals() {
  const { wastageColumn, remarksColumn } = await resolveTemplateLineItemColumns();
  const { rows } = await pool.query(
    `SELECT rt.id, rt.code, rt.name, rt.category, rt.sub_category, rt.unit,
            rt.overhead_percent, rt.profit_percent, rt.gst_percent,
            rt.approval_status, rt.submitted_for_global, rt.created_at,
            rt.owner_organization_id,
            o.name AS organization_name,
            u.email AS created_by_email,
            tli.id AS line_item_id,
            tli.resource_id,
            tli.coefficient,
            tli.wastage_percent,
            tli.${wastageColumn} AS wastage_percent,
            tli.${remarksColumn} AS remarks,
            r.name AS resource_name,
            r.unique_code AS resource_code
     FROM rate_templates rt
     LEFT JOIN organizations o ON o.id = rt.owner_organization_id
     LEFT JOIN users u ON u.id = rt.created_by
     LEFT JOIN LATERAL (
       SELECT *
       FROM template_line_items
       WHERE template_id = rt.id
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 1
     ) tli ON true
     LEFT JOIN resources r ON r.id = tli.resource_id
     WHERE rt.is_active = true
       AND rt.owner_organization_id IS NOT NULL
       AND rt.submitted_for_global = true
       AND rt.approval_status = 'pending'
     ORDER BY rt.created_at DESC`
  );

  return rows;
}

export async function adminEditPendingTemplate(
  templateId: string,
  payload: {
    name?: string;
    category?: string;
    sub_category?: string;
    unit?: string;
    overhead_percent?: number;
    profit_percent?: number;
    gst_percent?: number;
    resource_id?: string;
    coefficient?: number;
    wastage_percent?: number;
    remarks?: string;
  }
) {
  const updatedTemplate = await updateTemplate(templateId, payload);
  if (!updatedTemplate) {
    return null;
  }

  const firstLineItem = await pool.query(
    `SELECT id FROM template_line_items WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
    [templateId]
  );

  const lineItemId = firstLineItem.rows[0]?.id as string | undefined;
  if (lineItemId) {
    const lineUpdatePayload: Record<string, any> = {};
    if (payload.resource_id !== undefined) lineUpdatePayload.resource_id = payload.resource_id;
    if (payload.coefficient !== undefined) lineUpdatePayload.coefficient = payload.coefficient;
    if (payload.wastage_percent !== undefined) lineUpdatePayload.wastage_percent = payload.wastage_percent;
    if (payload.remarks !== undefined) lineUpdatePayload.remarks = payload.remarks;

    if (Object.keys(lineUpdatePayload).length) {
      await updateLineItem(lineItemId, lineUpdatePayload);
    }
  }

  return getTemplateDetail(templateId);
}

export async function approvePendingTemplateForGlobal(templateId: string, adminUserId: string) {
  const { rows } = await pool.query(
    `UPDATE rate_templates
     SET owner_organization_id = NULL,
         approval_status = 'approved',
         submitted_for_global = false,
         approved_by = $2,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND is_active = true
       AND approval_status = 'pending'
     RETURNING *`,
    [templateId, adminUserId]
  );

  priceLookup.invalidateCache();
  return rows[0] || null;
}

export async function updateTemplate(templateId: string, data: {
  name?: string;
  category?: string;
  sub_category?: string;
  unit?: string;
  overhead_percent?: number;
  profit_percent?: number;
  gst_percent?: number;
}) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (!fields.length) throw new Error("No fields to update");
  params.push(templateId);
  const { rows } = await pool.query(
    `UPDATE rate_templates SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    params
  );
  priceLookup.invalidateCache();
  return rows[0] || null;
}

export async function deleteTemplate(templateId: string) {
  await pool.query(
    `UPDATE rate_templates SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [templateId]
  );
  priceLookup.invalidateCache();
}

// ── Template Line Items CRUD ────────────────────

export async function addLineItem(templateId: string, data: {
  resource_id?: string;
  sub_template_id?: string;
  coefficient: number;
  wastage_percent?: number;
  remarks?: string;
}) {
  const { wastageColumn, remarksColumn } = await resolveTemplateLineItemColumns();

  // Get max sort order
  const { rows: [maxRow] } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM template_line_items WHERE template_id = $1`,
    [templateId]
  );
  const { rows } = await pool.query(
    `INSERT INTO template_line_items (template_id, resource_id, sub_template_id, coefficient, ${wastageColumn}, ${remarksColumn}, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [templateId, data.resource_id || null, data.sub_template_id || null,
     data.coefficient, data.wastage_percent ?? 0, data.remarks || null, maxRow.next]
  );
  priceLookup.invalidateCache();
  return rows[0];
}

export async function updateLineItem(lineItemId: string, data: {
  resource_id?: string;
  sub_template_id?: string;
  coefficient?: number;
  wastage_percent?: number;
  remarks?: string;
  sort_order?: number;
}) {
  const { wastageColumn, remarksColumn } = await resolveTemplateLineItemColumns();

  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [rawKey, val] of Object.entries(data)) {
    if (val !== undefined) {
      const key = rawKey === "wastage_percent" ? wastageColumn : rawKey === "remarks" ? remarksColumn : rawKey;
      fields.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (!fields.length) throw new Error("No fields to update");
  params.push(lineItemId);
  const { rows } = await pool.query(
    `UPDATE template_line_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  priceLookup.invalidateCache();
  return rows[0] || null;
}

export async function deleteLineItem(lineItemId: string) {
  await pool.query(`DELETE FROM template_line_items WHERE id = $1`, [lineItemId]);
  priceLookup.invalidateCache();
}

export async function listLocationZones() {
  const { rows } = await pool.query(
    `SELECT * FROM location_zones WHERE is_active = true ORDER BY zone_name`
  );
  return rows;
}

export async function listConveyanceSlabs(terrain?: string) {
  let query = `SELECT * FROM conveyance_rate_slabs`;
  const params: any[] = [];
  if (terrain) {
    query += ` WHERE terrain = $1`;
    params.push(terrain);
  }
  query += ` ORDER BY terrain, material_group`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function listPlinthAreaRates() {
  const { rows } = await pool.query(
    `SELECT * FROM plinth_area_rates ORDER BY class_code, floor`
  );
  return rows;
}

// ─────────────────────────────────────────────────
// Rate Computation
// ─────────────────────────────────────────────────

export async function computeSingleRate(input: ComputeRateInput) {
  return computeRate(input);
}

export async function computeBatchRates(inputs: ComputeRateInput[]) {
  return computeRateBatch(inputs);
}

// ─────────────────────────────────────────────────
// BOQ Projects
// ─────────────────────────────────────────────────

export async function createProject(userId: string, data: {
  name: string;
  client_name?: string;
  project_location?: string;
  district_id?: string;
  location_zone_id?: string;
  description?: string;
  global_overhead_percent?: number;
  global_profit_percent?: number;
  global_gst_percent?: number;
  default_conveyance_distance_km?: number;
  terrain?: string;
}) {
  const { rows } = await pool.query(`
    INSERT INTO boq_projects (user_id, name, client_name, project_location, district_id, location_zone_id, description, global_overhead_percent, global_profit_percent, global_gst_percent, default_conveyance_distance_km, terrain)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    userId, data.name, data.client_name || null, data.project_location || null,
    data.district_id || null, data.location_zone_id || null, data.description || null,
    data.global_overhead_percent || null, data.global_profit_percent || null,
    data.global_gst_percent || null, data.default_conveyance_distance_km || null,
    data.terrain || "plains",
  ]);
  return rows[0];
}

let hasBoqSourceProjectIdColumnCache: boolean | null = null;
let hasProjectRevisionBuildingTypeColumnCache: boolean | null = null;

async function hasBoqSourceProjectIdColumn() {
  if (hasBoqSourceProjectIdColumnCache !== null) {
    return hasBoqSourceProjectIdColumnCache;
  }

  const { rowCount } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'boq_projects'
       AND column_name = 'source_project_id'
     LIMIT 1`
  );

  hasBoqSourceProjectIdColumnCache = (rowCount ?? 0) > 0;
  return hasBoqSourceProjectIdColumnCache;
}

async function hasProjectRevisionBuildingTypeColumn() {
  if (hasProjectRevisionBuildingTypeColumnCache !== null) {
    return hasProjectRevisionBuildingTypeColumnCache;
  }

  const { rowCount } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'project_revisions'
       AND column_name = 'building_type'
     LIMIT 1`
  );

  hasProjectRevisionBuildingTypeColumnCache = (rowCount ?? 0) > 0;
  return hasProjectRevisionBuildingTypeColumnCache;
}

export async function listProjects(userId: string) {
  const userRes = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  const role = String(userRes.rows[0]?.role || "");
  const hasSourceProjectIdColumn = await hasBoqSourceProjectIdColumn();
  const hasBuildingTypeColumn = await hasProjectRevisionBuildingTypeColumn();

  if (role === "architect") {
    const architectProjects = await pool.query(
      `SELECT p.id, p.name, p.description,
              pr.site_address AS project_location
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT site_address
         FROM project_revisions
         WHERE project_id = p.id
         ORDER BY revision_number DESC
         LIMIT 1
       ) pr ON true
       WHERE p.architect_id = $1`,
      [userId]
    );

    for (const project of architectProjects.rows) {
      const marker = `source_project_id:${project.id}`;
      const existing = await pool.query(
        hasSourceProjectIdColumn
          ? `SELECT id, source_project_id FROM boq_projects WHERE user_id = $1 AND notes = $2 LIMIT 1`
          : `SELECT id, NULL AS source_project_id FROM boq_projects WHERE user_id = $1 AND notes = $2 LIMIT 1`,
        [userId, marker]
      );

      if (!existing.rows.length) {
        try {
          await pool.query(
            `INSERT INTO boq_projects (
               user_id, name, description, status, terrain, notes, project_location, source_project_id
             )
             VALUES ($1, $2, $3, 'in_progress', 'plains', $4, $5, $6)`,
            [
              userId,
              project.name,
              project.description || null,
              marker,
              project.project_location || null,
              project.id,
            ]
          );
        } catch (insertErr: any) {
          if (insertErr?.code !== "42703") throw insertErr;
          await pool.query(
            `INSERT INTO boq_projects (
               user_id, name, description, status, terrain, notes, project_location
             )
             VALUES ($1, $2, $3, 'in_progress', 'plains', $4, $5)`,
            [
              userId,
              project.name,
              project.description || null,
              marker,
              project.project_location || null,
            ]
          );
        }
      } else if (hasSourceProjectIdColumn && !existing.rows[0].source_project_id) {
        await pool.query(
          `UPDATE boq_projects
           SET source_project_id = $1
           WHERE id = $2
             AND source_project_id IS NULL`,
          [project.id, existing.rows[0].id]
        );
      }
    }
  }

  const sourceFilter = role === "builder" ? `AND (p.notes IS NULL OR p.notes NOT LIKE 'source_project_id:%')` : "";
  const projectListQuery = hasSourceProjectIdColumn
    ? `
    SELECT p.*,
      (SELECT COUNT(*) FROM boq_items bi WHERE bi.project_id = p.id) as item_count,
      (SELECT COALESCE(SUM(bi.computed_amount), 0) FROM boq_items bi WHERE bi.project_id = p.id) as total_amount,
      pr.boq_id,
      source_pr.building_type,
      COALESCE(
        p.source_project_id,
        CASE
          WHEN p.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
          THEN substring(p.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
          ELSE NULL
        END
      ) AS resolved_source_project_id
    FROM boq_projects p
    LEFT JOIN projects pr ON pr.id = COALESCE(
      p.source_project_id,
      CASE
        WHEN p.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
        THEN substring(p.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
        ELSE NULL
      END
    )
    LEFT JOIN LATERAL (
      ${hasBuildingTypeColumn
        ? `SELECT building_type
      FROM project_revisions
      WHERE project_id = pr.id
      ORDER BY revision_number DESC
      LIMIT 1`
        : `SELECT NULL::text AS building_type`}
    ) source_pr ON true
    WHERE p.user_id = $1
      ${sourceFilter}
    ORDER BY p.updated_at DESC
  `
    : `
    SELECT p.*,
      (SELECT COUNT(*) FROM boq_items bi WHERE bi.project_id = p.id) as item_count,
      (SELECT COALESCE(SUM(bi.computed_amount), 0) FROM boq_items bi WHERE bi.project_id = p.id) as total_amount,
      pr.boq_id,
      source_pr.building_type,
      CASE
        WHEN p.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
        THEN substring(p.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
        ELSE NULL
      END AS resolved_source_project_id
    FROM boq_projects p
    LEFT JOIN projects pr ON pr.id = CASE
      WHEN p.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
      THEN substring(p.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
      ELSE NULL
    END
    LEFT JOIN LATERAL (
      ${hasBuildingTypeColumn
        ? `SELECT building_type
      FROM project_revisions
      WHERE project_id = pr.id
      ORDER BY revision_number DESC
      LIMIT 1`
        : `SELECT NULL::text AS building_type`}
    ) source_pr ON true
    WHERE p.user_id = $1
      ${sourceFilter}
    ORDER BY p.updated_at DESC
  `;

  try {
    const { rows } = await pool.query(projectListQuery, [userId]);
    return rows;
  } catch (error: any) {
    // Safety net for partially migrated environments (e.g., missing optional
    // columns in joined tables). Keep list endpoint functional.
    if (String(error?.code || "") !== "42703") {
      throw error;
    }

    const fallbackQuery = `
      SELECT p.*,
        (SELECT COUNT(*) FROM boq_items bi WHERE bi.project_id = p.id) as item_count,
        (SELECT COALESCE(SUM(bi.computed_amount), 0) FROM boq_items bi WHERE bi.project_id = p.id) as total_amount,
        NULL::uuid AS boq_id,
        NULL::text AS building_type,
        CASE
          WHEN p.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
          THEN substring(p.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
          ELSE NULL
        END AS resolved_source_project_id
      FROM boq_projects p
      WHERE p.user_id = $1
        ${sourceFilter}
      ORDER BY p.updated_at DESC
    `;

    const fallback = await pool.query(fallbackQuery, [userId]);
    return fallback.rows;
  }
}

export async function listInvitedProjects(userId: string) {
  const userRes = await pool.query(
    `SELECT organization_id, email, role FROM users WHERE id = $1`,
    [userId]
  );
  if (!userRes.rows.length) return [];
  if (String(userRes.rows[0].role || "") !== "builder") return [];
  const organizationId = userRes.rows[0].organization_id;
  const userEmail = userRes.rows[0].email;

  const invitedProjectsRes = await pool.query(`
    SELECT DISTINCT p.id, p.name, p.description, p.created_at,
      CASE
        WHEN ui.accepted_at IS NOT NULL THEN 'accepted'
        ELSE 'pending'
      END AS invitation_status
    FROM projects p
    JOIN user_invites ui ON p.id = ui.project_id
    WHERE ui.role = 'builder'
      AND ui.project_id IS NOT NULL
      AND (
        ui.user_id = $1
        OR LOWER(TRIM(ui.email)) = LOWER(TRIM($2))
        OR (ui.organization_id IS NOT NULL AND ui.organization_id = $3)
      )
      AND (ui.accepted_at IS NOT NULL OR ui.expires_at > NOW())

    UNION

    SELECT DISTINCT p.id, p.name, p.description, p.created_at, bi.status AS invitation_status
    FROM projects p
    JOIN builder_invitations bi ON p.id = bi.project_id
    WHERE bi.builder_org_id = $3
      AND bi.status IN ('pending', 'accepted')

    ORDER BY created_at DESC
  `, [userId, userEmail, organizationId]);

  if (!invitedProjectsRes.rows.length) {
    return [];
  }

  const statusBySourceProject = new Map<string, string>();
  for (const invited of invitedProjectsRes.rows) {
    const existingStatus = statusBySourceProject.get(invited.id);
    if (existingStatus === "accepted") continue;
    statusBySourceProject.set(invited.id, invited.invitation_status || "pending");
  }

  for (const invited of invitedProjectsRes.rows) {
    const marker = `source_project_id:${invited.id}`;
    const existing = await pool.query(
      `SELECT id FROM boq_projects WHERE user_id = $1 AND notes = $2 LIMIT 1`,
      [userId, marker]
    );

    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO boq_projects (
          user_id, name, description, status, terrain, notes, client_name, project_location
        )
        VALUES ($1, $2, $3, 'in_progress', 'plains', $4, NULL, NULL)
      `, [
        userId,
        invited.name,
        invited.description || null,
        marker,
      ]);
    }
  }

  const markers = Array.from(statusBySourceProject.keys()).map(
    (id: string) => `source_project_id:${id}`
  );

  const { rows } = await pool.query(`
    SELECT bp.*,
      (SELECT COUNT(*) FROM boq_items i WHERE i.project_id = bp.id) AS item_count,
      (SELECT COALESCE(SUM(i.computed_amount), 0) FROM boq_items i WHERE i.project_id = bp.id) AS total_amount
    FROM boq_projects bp
    WHERE bp.user_id = $1
      AND bp.notes = ANY($2::text[])
    ORDER BY bp.updated_at DESC
  `, [userId, markers]);

  return rows.map((row: any) => {
    const sourceProjectId = String(row.notes || "").replace("source_project_id:", "");
    return {
      ...row,
      invitation_status: statusBySourceProject.get(sourceProjectId) || "pending",
    };
  });
}

export async function getProject(projectId: string, userId: string) {
  const hasSourceProjectIdColumn = await hasBoqSourceProjectIdColumn();

  // 1) Direct lookup by boq_projects.id
  const directRes = await pool.query(
    `SELECT * FROM boq_projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, userId]
  );

  if (directRes.rows[0]) {
    await ensureInvitedProjectSeeded(directRes.rows[0].id, userId);
    return directRes.rows[0];
  }

  // 2) Resolve source project ID -> boq_projects row
  const sourceMarker = `source_project_id:${projectId}`;
  const sourceRes = await pool.query(
    hasSourceProjectIdColumn
      ? `SELECT *
         FROM boq_projects
         WHERE user_id = $1
           AND (
             source_project_id = $2
             OR notes = $3
           )
         ORDER BY updated_at DESC
         LIMIT 1`
      : `SELECT *
         FROM boq_projects
         WHERE user_id = $1
           AND notes = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
    hasSourceProjectIdColumn ? [userId, projectId, sourceMarker] : [userId, sourceMarker]
  );

  if (sourceRes.rows[0]) {
    await ensureInvitedProjectSeeded(sourceRes.rows[0].id, userId);
    return sourceRes.rows[0];
  }

  // 3) Source project fallback: if caller passed projects.id, seed boq_projects row on demand.
  // Supports architect-owned projects and builder-invited projects.
  const sourceProjectRes = await pool.query(
    `SELECT p.id, p.name, p.description,
            pr.site_address AS project_location
     FROM projects p
     JOIN users requester ON requester.id = $2
     JOIN users project_architect ON project_architect.id = p.architect_id
     LEFT JOIN LATERAL (
       SELECT site_address
       FROM project_revisions
       WHERE project_id = p.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) pr ON true
     LEFT JOIN user_invites ui
       ON ui.project_id = p.id
      AND ui.role = 'builder'
      AND (
        ui.user_id = requester.id
        OR LOWER(TRIM(ui.email)) = LOWER(TRIM(requester.email))
        OR (
          ui.organization_id IS NOT NULL
          AND ui.organization_id = requester.organization_id
        )
      )
      AND (
        ui.accepted_at IS NOT NULL
        OR ui.expires_at IS NULL
        OR ui.expires_at > NOW()
      )
     LEFT JOIN builder_invitations bi
       ON bi.project_id = p.id
      AND bi.builder_org_id = requester.organization_id
      AND bi.status IN ('pending', 'accepted')
     LEFT JOIN estimates est
       ON est.project_id = p.id
      AND est.builder_org_id = requester.organization_id
     WHERE p.id = $1
       AND (
         (
           requester.role = 'architect'
           AND (
             p.architect_id = requester.id
             OR (
               requester.organization_id IS NOT NULL
               AND requester.organization_id = project_architect.organization_id
             )
           )
         )
         OR (
           requester.role = 'builder'
           AND (ui.id IS NOT NULL OR bi.id IS NOT NULL OR est.id IS NOT NULL)
         )
       )
     LIMIT 1`,
    [projectId, userId]
  );

  const sourceProject = sourceProjectRes.rows[0];
  if (!sourceProject) {
    return null;
  }

  let insertedRow: any;
  try {
    const inserted = await pool.query(
      `INSERT INTO boq_projects (
         user_id, name, description, status, terrain, notes, project_location, source_project_id
       )
       VALUES ($1, $2, $3, 'in_progress', 'plains', $4, $5, $6)
       RETURNING *`,
      [
        userId,
        sourceProject.name,
        sourceProject.description || null,
        sourceMarker,
        sourceProject.project_location || null,
        sourceProject.id,
      ]
    );
    insertedRow = inserted.rows[0];
  } catch (seedErr: any) {
    if (seedErr?.code !== "42703") {
      throw seedErr;
    }

    const insertedFallback = await pool.query(
      `INSERT INTO boq_projects (
         user_id, name, description, status, terrain, notes, project_location
       )
       VALUES ($1, $2, $3, 'in_progress', 'plains', $4, $5)
       RETURNING *`,
      [
        userId,
        sourceProject.name,
        sourceProject.description || null,
        sourceMarker,
        sourceProject.project_location || null,
      ]
    );
    insertedRow = insertedFallback.rows[0];
  }

  if (insertedRow?.id) {
    await ensureInvitedProjectSeeded(insertedRow.id, userId);
  }

  return insertedRow || null;
}

function parseNumeric(value: unknown, fallback = 1): number {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBoqRows(raw: any): Array<{ description: string; quantity: number; unit: string }> {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.rows)
        ? raw.rows
        : [];

  return rows
    .map((r: any) => {
      const description = String(
        r?.item ?? r?.description ?? r?.item_description ?? r?.name ?? ""
      ).trim();
      const quantity = parseNumeric(r?.qty ?? r?.quantity ?? r?.required_qty ?? r?.requiredQuantity, 1);
      const unit = String(r?.uom ?? r?.unit ?? r?.units ?? "Nos").trim() || "Nos";
      return { description, quantity, unit };
    })
    .filter((r: { description: string }) => r.description.length > 0);
}

async function ensureInvitedProjectSeeded(projectId: string, userId: string) {
  const projectRes = await pool.query(
    `SELECT id, user_id, notes FROM boq_projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, userId]
  );
  const project = projectRes.rows[0];
  if (!project) return;

  const notes = String(project.notes || "");
  if (!notes.startsWith("source_project_id:")) return;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM boq_items WHERE project_id = $1`,
    [projectId]
  );
  if ((countRes.rows[0]?.count || 0) > 0) return;

  const sourceProjectId = notes.replace("source_project_id:", "").trim();
  if (!sourceProjectId) return;

  // Prefer parsed_data from boqs, fallback to parsed_json from boq_revisions.
  const boqRes = await pool.query(
    `SELECT parsed_data
     FROM boqs
     WHERE project_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [sourceProjectId]
  );

  let normalizedRows = normalizeBoqRows(boqRes.rows[0]?.parsed_data);

  if (normalizedRows.length === 0) {
    const revisionRes = await pool.query(
      `SELECT parsed_json
       FROM boq_revisions
       WHERE project_id = $1
       ORDER BY issued_at DESC
       LIMIT 1`,
      [sourceProjectId]
    );
    normalizedRows = normalizeBoqRows(revisionRes.rows[0]?.parsed_json);
  }

  if (normalizedRows.length === 0) return;

  const existingSectionRes = await pool.query(
    `SELECT id
     FROM boq_sections
     WHERE project_id = $1 AND name = 'Imported Architect BOQ'
     ORDER BY sort_order ASC, created_at ASC
     LIMIT 1`,
    [projectId]
  );

  let sectionId = existingSectionRes.rows[0]?.id as string | undefined;

  if (!sectionId) {
    const sectionRes = await pool.query(
      `INSERT INTO boq_sections (project_id, name, sort_order)
       VALUES ($1, 'Imported Architect BOQ', 0)
       RETURNING id`,
      [projectId]
    );
    sectionId = sectionRes.rows[0].id;
  }

  if (!sectionId) return;

  for (let i = 0; i < normalizedRows.length; i += 1) {
    const row = normalizedRows[i];
    await pool.query(
      `INSERT INTO boq_items (section_id, project_id, item_number, description, quantity, unit, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sectionId, projectId, `1.${i + 1}`, row.description, row.quantity, row.unit, i]
    );
  }
}

export async function updateProject(projectId: string, userId: string, data: Record<string, any>) {
  const allowed = [
    "name", "client_name", "project_location", "district_id", "location_zone_id",
    "description", "status", "global_overhead_percent", "global_profit_percent",
    "global_gst_percent", "default_conveyance_distance_km", "terrain", "notes",
  ];
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }
  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  params.push(projectId, userId);

  const { rows } = await pool.query(`
    UPDATE boq_projects SET ${sets.join(", ")}
    WHERE id = $${idx++} AND user_id = $${idx}
    RETURNING *
  `, params);
  return rows[0] || null;
}

export async function deleteProject(projectId: string, userId: string) {
  const { rowCount } = await pool.query(
    `DELETE FROM boq_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return (rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────────
// BOQ Sections
// ─────────────────────────────────────────────────

export async function createSection(projectId: string, userId: string, data: { name: string; sort_order?: number }) {
  // Verify ownership
  const project = await getProject(projectId, userId);
  if (!project) return null;

  const { rows } = await pool.query(`
    INSERT INTO boq_sections (project_id, name, sort_order)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [projectId, data.name, data.sort_order ?? 0]);
  return rows[0];
}

export async function listSections(projectId: string, userId?: string) {
  if (userId) {
    await ensureInvitedProjectSeeded(projectId, userId);
  }
  const { rows } = await pool.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM boq_items bi WHERE bi.section_id = s.id) as item_count
    FROM boq_sections s
    WHERE s.project_id = $1
    ORDER BY s.sort_order, s.created_at
  `, [projectId]);
  return rows;
}

export async function updateSection(sectionId: string, data: { name?: string; sort_order?: number }) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(data.sort_order); }
  if (sets.length === 0) return null;
  params.push(sectionId);
  const { rows } = await pool.query(
    `UPDATE boq_sections SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function deleteSection(sectionId: string) {
  const { rowCount } = await pool.query(`DELETE FROM boq_sections WHERE id = $1`, [sectionId]);
  return (rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────────
// BOQ Items
// ─────────────────────────────────────────────────

export async function createItem(data: {
  section_id: string;
  project_id: string;
  item_number?: string;
  description: string;
  template_id?: string;
  quantity: number;
  unit: string;
  floor_level?: string;
  height_above_gl?: number;
  depth_below_gl?: number;
  sort_order?: number;
}) {
  const { rows } = await pool.query(`
    INSERT INTO boq_items (section_id, project_id, item_number, description, template_id, quantity, unit, floor_level, height_above_gl, depth_below_gl, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    data.section_id, data.project_id, data.item_number || null, data.description,
    data.template_id || null, data.quantity, data.unit,
    data.floor_level || null, data.height_above_gl || null, data.depth_below_gl || null,
    data.sort_order ?? 0,
  ]);
  return rows[0];
}

export async function listItems(projectId: string, sectionId?: string, userId?: string) {
  if (userId) {
    await ensureInvitedProjectSeeded(projectId, userId);
  }
  let query = `
    SELECT bi.*, rt.code as template_code, rt.name as template_name
    FROM boq_items bi
    LEFT JOIN rate_templates rt ON bi.template_id = rt.id
    WHERE bi.project_id = $1
  `;
  const params: any[] = [projectId];
  if (sectionId) {
    query += ` AND bi.section_id = $2`;
    params.push(sectionId);
  }
  query += ` ORDER BY bi.sort_order, bi.created_at`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function updateItem(itemId: string, data: Record<string, any>) {
  const allowed = [
    "item_number", "description", "template_id", "quantity", "unit",
    "computed_rate", "computed_amount", "rate_override",
    "floor_level", "height_above_gl", "depth_below_gl", "notes", "sort_order",
  ];
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }
  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  params.push(itemId);
  const { rows } = await pool.query(
    `UPDATE boq_items SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function deleteItem(itemId: string) {
  const { rowCount } = await pool.query(`DELETE FROM boq_items WHERE id = $1`, [itemId]);
  return (rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────────
// Compute All Items in a Project
// ─────────────────────────────────────────────────

export async function computeAllProjectItems(projectId: string, userId: string) {
  const project = await getProject(projectId, userId);
  if (!project) return null;

  const items = await listItems(projectId);
  const results = [];

  for (const item of items) {
    if (!item.template_id) {
      results.push({ item_id: item.id, skipped: true, reason: "no template" });
      continue;
    }

    const computation = await computeRate({
      template_id: item.template_id,
      location_zone_id: project.location_zone_id || undefined,
      conveyance_distance_km: project.default_conveyance_distance_km
        ? parseFloat(project.default_conveyance_distance_km) : undefined,
      terrain: project.terrain || "plains",
      floor_level: item.floor_level || undefined,
      height_above_gl: item.height_above_gl ? parseFloat(item.height_above_gl) : undefined,
      depth_below_gl: item.depth_below_gl ? parseFloat(item.depth_below_gl) : undefined,
      override_overhead: project.global_overhead_percent
        ? parseFloat(project.global_overhead_percent) : undefined,
      override_profit: project.global_profit_percent
        ? parseFloat(project.global_profit_percent) : undefined,
      override_gst: project.global_gst_percent
        ? parseFloat(project.global_gst_percent) : undefined,
    });

    const effectiveRate = item.rate_override
      ? parseFloat(item.rate_override)
      : computation.final_rate;
    const amount = Math.round(effectiveRate * parseFloat(item.quantity) * 100) / 100;

    // Update the BOQ item
    await pool.query(`
      UPDATE boq_items SET computed_rate = $1, computed_amount = $2, updated_at = NOW()
      WHERE id = $3
    `, [computation.final_rate, amount, item.id]);

    // Store computation log
    await pool.query(`
      INSERT INTO rate_computations (boq_item_id, project_id, template_id, location_zone_id, breakdown, material_total, labour_total, equipment_total, conveyance_total, works_rate_total, location_extras, lift_charges, direct_cost, overhead_amount, profit_amount, subtotal_before_gst, gst_amount, final_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      item.id, projectId, item.template_id, project.location_zone_id || null,
      JSON.stringify(computation.breakdown),
      computation.material_total, computation.labour_total, computation.equipment_total,
      computation.conveyance_total, computation.works_rate_total,
      computation.location_extras ? JSON.stringify(computation.location_extras) : null,
      computation.lift_charges, computation.direct_cost,
      computation.overhead_amount, computation.profit_amount,
      computation.subtotal_before_gst, computation.gst_amount, computation.final_rate,
    ]);

    results.push({
      item_id: item.id,
      computed_rate: computation.final_rate,
      amount,
      computation,
    });
  }

  // Update project timestamp
  await pool.query(
    `UPDATE boq_projects SET updated_at = NOW() WHERE id = $1`,
    [projectId]
  );

  return results;
}

// ─────────────────────────────────────────────────
// Project Summary
// ─────────────────────────────────────────────────

export async function getProjectSummary(projectId: string, userId: string) {
  const project = await getProject(projectId, userId);
  if (!project) return null;

  const sections = await listSections(projectId);
  const items = await listItems(projectId);

  const sectionSummaries = sections.map(s => {
    const sectionItems = items.filter(i => i.section_id === s.id);
    const total = sectionItems.reduce((sum, i) => sum + (parseFloat(i.computed_amount) || 0), 0);
    return { ...s, items: sectionItems, total: Math.round(total * 100) / 100 };
  });

  const grandTotal = sectionSummaries.reduce((sum, s) => sum + s.total, 0);

  return {
    project,
    sections: sectionSummaries,
    grand_total: Math.round(grandTotal * 100) / 100,
    item_count: items.length,
    computed_count: items.filter(i => i.computed_rate).length,
  };
}

// ─────────────────────────────────────────────────
// Plinth Area Validation
// ─────────────────────────────────────────────────

export async function validatePlinthArea(projectId: string, userId: string, input: {
  plinth_area_sqm: number;
  building_class: string;
  num_floors: number;
}) {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Project not found");

  const items = await listItems(projectId);
  const grandTotal = items.reduce((sum, i) => sum + (parseFloat(i.computed_amount) || 0), 0);
  const totalArea = input.plinth_area_sqm * input.num_floors;

  // Fetch matching plinth area rate
  const { rows: plinthRates } = await pool.query(
    `SELECT * FROM plinth_area_rates WHERE class_code = $1 ORDER BY floor`,
    [input.building_class]
  );

  if (plinthRates.length === 0) {
    return {
      status: "no_benchmark",
      message: `No plinth area rate found for class "${input.building_class}"`,
      project_total: Math.round(grandTotal * 100) / 100,
      plinth_area_sqm: input.plinth_area_sqm,
      num_floors: input.num_floors,
      total_area: totalArea,
      benchmark_rate: null,
      benchmark_total: null,
      deviation_percent: null,
      flags: [],
    };
  }

  // Use ground floor rate for first floor, upper floor rate if available
  const groundRate = plinthRates.find(r => r.floor === "ground") || plinthRates[0];
  const upperRate = plinthRates.find(r => r.floor === "upper");

  // Calculate benchmark: ground floor area at ground rate + upper floors at upper rate
  const groundFloorCost = input.plinth_area_sqm * parseFloat(groundRate.rate_per_sqm);
  const upperFloorCount = Math.max(0, input.num_floors - 1);
  const upperFloorCost = upperRate
    ? input.plinth_area_sqm * upperFloorCount * parseFloat(upperRate.rate_per_sqm)
    : input.plinth_area_sqm * upperFloorCount * parseFloat(groundRate.rate_per_sqm);
  const benchmarkTotal = groundFloorCost + upperFloorCost;
  const avgBenchmarkRate = totalArea > 0 ? benchmarkTotal / totalArea : 0;

  const deviationPercent = benchmarkTotal > 0
    ? ((grandTotal - benchmarkTotal) / benchmarkTotal) * 100
    : 0;

  const flags: string[] = [];
  if (deviationPercent > 30) {
    flags.push("OVER_ESTIMATE: Project cost exceeds plinth area benchmark by more than 30%. Review rates and quantities.");
  } else if (deviationPercent > 15) {
    flags.push("HIGH: Project cost is 15-30% above plinth area benchmark. May need justification.");
  } else if (deviationPercent < -30) {
    flags.push("UNDER_ESTIMATE: Project cost is more than 30% below benchmark. Verify all items are included.");
  } else if (deviationPercent < -15) {
    flags.push("LOW: Project cost is 15-30% below benchmark. Some items may be missing.");
  }

  // Also check cost per sqft
  const costPerSqft = totalArea > 0 ? grandTotal / (totalArea * 10.764) : 0;
  if (costPerSqft > 3000) {
    flags.push(`HIGH_SQFT_COST: Cost per sq.ft (₹${Math.round(costPerSqft)}) appears high for this building class.`);
  } else if (costPerSqft < 800 && totalArea > 0) {
    flags.push(`LOW_SQFT_COST: Cost per sq.ft (₹${Math.round(costPerSqft)}) appears low. Verify estimate completeness.`);
  }

  return {
    status: Math.abs(deviationPercent) <= 15 ? "pass" : Math.abs(deviationPercent) <= 30 ? "warning" : "fail",
    message: Math.abs(deviationPercent) <= 15
      ? "Estimate is within acceptable range of plinth area benchmark"
      : `Estimate deviates ${Math.abs(deviationPercent).toFixed(1)}% from plinth area benchmark`,
    project_total: Math.round(grandTotal * 100) / 100,
    plinth_area_sqm: input.plinth_area_sqm,
    num_floors: input.num_floors,
    total_area: totalArea,
    benchmark_rate_per_sqm: Math.round(avgBenchmarkRate * 100) / 100,
    benchmark_total: Math.round(benchmarkTotal * 100) / 100,
    cost_per_sqft: Math.round(costPerSqft * 100) / 100,
    deviation_percent: Math.round(deviationPercent * 100) / 100,
    flags,
  };
}

type FingerInAirInput = {
  building_class?: string;
  roof_type?: string;
  plinth_area_sqm?: number;
  num_floors?: number;
  location_zone?: "normal" | "urban" | "metro" | "rural";
  quality_grade?: "economy" | "standard" | "premium";
  include_services?: boolean;
  include_external_works?: boolean;
  contingency_percent?: number;
  escalation_percent?: number;
};

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toPercentNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBuildingClass(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  const classAliasMap: Record<string, string> = {
    A1: "I-A",
    A2: "I-B",
    B1: "II-A",
    B2: "II-B",
    C: "III-A",
  };
  return classAliasMap[raw] || raw;
}

function normalizeRoofType(value: unknown): string {
  const raw = String(value || "").trim();
  const roofAliasMap: Record<string, string> = {
    rcc: "RCC Slab",
    tiled: "Mangalore Tile",
    "madras terrace": "Mangalore Tile",
  };
  const mapped = roofAliasMap[raw.toLowerCase()];
  return mapped || raw;
}

export async function getFingerInAirEstimate(input: FingerInAirInput) {
  const defaults = {
    building_class: "I-A",
    roof_type: "RCC Slab",
    plinth_area_sqm: 111.48, // ~1200 sq.ft
    num_floors: 2,
    location_zone: "normal" as const,
    quality_grade: "standard" as const,
    include_services: true,
    include_external_works: true,
    contingency_percent: 5,
    escalation_percent: 0,
  };

  const normalized = {
    building_class: normalizeBuildingClass(input.building_class || defaults.building_class),
    roof_type: normalizeRoofType(input.roof_type || defaults.roof_type),
    plinth_area_sqm: toPositiveNumber(input.plinth_area_sqm, defaults.plinth_area_sqm),
    num_floors: Math.max(1, Math.round(toPositiveNumber(input.num_floors, defaults.num_floors))),
    location_zone: ["normal", "urban", "metro", "rural"].includes(String(input.location_zone || ""))
      ? (input.location_zone as "normal" | "urban" | "metro" | "rural")
      : defaults.location_zone,
    quality_grade: ["economy", "standard", "premium"].includes(String(input.quality_grade || ""))
      ? (input.quality_grade as "economy" | "standard" | "premium")
      : defaults.quality_grade,
    include_services:
      typeof input.include_services === "boolean" ? input.include_services : defaults.include_services,
    include_external_works:
      typeof input.include_external_works === "boolean"
        ? input.include_external_works
        : defaults.include_external_works,
    contingency_percent: toPercentNumber(input.contingency_percent, defaults.contingency_percent),
    escalation_percent: toPercentNumber(input.escalation_percent, defaults.escalation_percent),
  };

  const loadPlinthRates = async (classCode: string, roofType?: string | null) => {
    const { rows } = await pool.query(
      `SELECT *
       FROM plinth_area_rates
       WHERE class_code = $1
         AND ($2::text IS NULL OR roof_type ILIKE $2)
       ORDER BY
         CASE
           WHEN floor ILIKE '%ground%' THEN 0
           WHEN floor ILIKE '%first%' OR floor ILIKE '%upper%' THEN 1
           ELSE 2
         END,
         floor`,
      [classCode, roofType || null]
    );
    return rows;
  };

  let plinthRates = await loadPlinthRates(normalized.building_class, normalized.roof_type);
  let appliedClass = normalized.building_class;
  let appliedRoof = normalized.roof_type;

  if (!plinthRates.length) {
    plinthRates = await loadPlinthRates(normalized.building_class, null);
    appliedRoof = plinthRates.length ? "ANY" : appliedRoof;
  }

  if (!plinthRates.length) {
    plinthRates = await loadPlinthRates(defaults.building_class, defaults.roof_type);
    appliedClass = plinthRates.length ? defaults.building_class : appliedClass;
    appliedRoof = plinthRates.length ? defaults.roof_type : appliedRoof;
  }

  if (!plinthRates.length) {
    plinthRates = await loadPlinthRates(defaults.building_class, null);
    appliedClass = plinthRates.length ? defaults.building_class : appliedClass;
    appliedRoof = plinthRates.length ? "ANY" : appliedRoof;
  }

  if (!plinthRates.length) {
    return {
      status: "no_benchmark",
      message: `No PWD plinth rate found for class ${normalized.building_class}`,
      inputs: normalized,
      per_sqft_rate: null,
      per_sqm_rate: null,
      total_project_cost: null,
      breakup: null,
    };
  }

  const groundRate =
    plinthRates.find((r: any) => String(r.floor || "").toLowerCase().includes("ground")) ||
    plinthRates[0];
  const upperRate =
    plinthRates.find(
      (r: any) =>
        String(r.floor || "").toLowerCase().includes("upper") ||
        String(r.floor || "").toLowerCase().includes("first")
    ) ||
    plinthRates.find((r: any) => r.additional_floor_rate != null) ||
    groundRate;

  const groundRatePerSqm = Number(groundRate.rate_per_sqm || groundRate.rate || 0);
  const upperRatePerSqm = Number(
    upperRate.rate_per_sqm || upperRate.additional_floor_rate || upperRate.rate || groundRatePerSqm
  );

  const areaPerFloor = normalized.plinth_area_sqm;
  const upperFloorCount = Math.max(0, normalized.num_floors - 1);

  const baseCost =
    areaPerFloor * groundRatePerSqm + areaPerFloor * upperFloorCount * upperRatePerSqm;

  const locationMultiplierMap = {
    normal: 1,
    urban: 1.08,
    metro: 1.15,
    rural: 0.94,
  } as const;

  const qualityMultiplierMap = {
    economy: 0.9,
    standard: 1,
    premium: 1.18,
  } as const;

  const adjustedBase =
    baseCost * locationMultiplierMap[normalized.location_zone] * qualityMultiplierMap[normalized.quality_grade];

  const servicesAmount = normalized.include_services ? adjustedBase * 0.12 : 0;
  const externalWorksAmount = normalized.include_external_works ? adjustedBase * 0.08 : 0;
  const contingencyAmount = (adjustedBase + servicesAmount + externalWorksAmount) * (normalized.contingency_percent / 100);
  const escalationAmount =
    (adjustedBase + servicesAmount + externalWorksAmount + contingencyAmount) *
    (normalized.escalation_percent / 100);

  const total = adjustedBase + servicesAmount + externalWorksAmount + contingencyAmount + escalationAmount;
  const totalAreaSqm = areaPerFloor * normalized.num_floors;
  const totalAreaSqft = totalAreaSqm * 10.7639;

  const perSqm = totalAreaSqm > 0 ? total / totalAreaSqm : 0;
  const perSqft = totalAreaSqft > 0 ? total / totalAreaSqft : 0;

  const usedFallback = appliedClass !== normalized.building_class || appliedRoof !== normalized.roof_type;
  const roofLabel = appliedRoof === "ANY" ? "any available roof type" : appliedRoof;

  return {
    status: "ok",
    message: usedFallback
      ? `Quick estimate computed using fallback PWD plinth rates (${appliedClass}, ${roofLabel})`
      : "Quick estimate computed using PWD plinth area norms",
    inputs: normalized,
    applied_pwd_reference: {
      building_class: appliedClass,
      roof_type: appliedRoof,
      ground_floor_rate_per_sqm: Math.round(groundRatePerSqm * 100) / 100,
      upper_floor_rate_per_sqm: Math.round(upperRatePerSqm * 100) / 100,
    },
    total_area_sqm: Math.round(totalAreaSqm * 100) / 100,
    total_area_sqft: Math.round(totalAreaSqft * 100) / 100,
    per_sqm_rate: Math.round(perSqm * 100) / 100,
    per_sqft_rate: Math.round(perSqft * 100) / 100,
    total_project_cost: Math.round(total * 100) / 100,
    breakup: {
      base_cost: Math.round(adjustedBase * 100) / 100,
      services_amount: Math.round(servicesAmount * 100) / 100,
      external_works_amount: Math.round(externalWorksAmount * 100) / 100,
      contingency_amount: Math.round(contingencyAmount * 100) / 100,
      escalation_amount: Math.round(escalationAmount * 100) / 100,
    },
  };
}
