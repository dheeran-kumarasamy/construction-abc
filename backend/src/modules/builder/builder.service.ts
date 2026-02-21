import { pool } from "../../config/db";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

export async function getAvailableProjects(userId: string) {
  // Get projects where this specific builder has accepted an invite
  const result = await pool.query(
    `SELECT 
       p.id,
       p.name,
       p.description,
       p.created_at,
       pr.site_address,
       pr.tentative_start_date,
       pr.duration_months,
       b.id as boq_id,
       b.uploaded_at as boq_uploaded_at,
       e.id as estimate_id,
       e.status as estimate_status
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT site_address, tentative_start_date, duration_months
       FROM project_revisions
       WHERE project_id = p.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) pr ON true
     LEFT JOIN boqs b ON p.id = b.project_id
     LEFT JOIN estimates e ON p.id = e.project_id
     JOIN user_invites ui ON ui.project_id = p.id
     WHERE b.id IS NOT NULL
       AND ui.user_id = $1
       AND ui.role = 'builder'
       AND ui.accepted_at IS NOT NULL
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function assertBuilderProjectAccess(userId: string, projectId: string) {
  const access = await pool.query(
    `SELECT 1
     FROM user_invites ui
     WHERE ui.project_id = $1
       AND ui.user_id = $2
       AND ui.accepted_at IS NOT NULL
     LIMIT 1`,
    [projectId, userId]
  );

  if (!access.rows.length) {
    throw new Error("You are not invited to this project");
  }
}

export async function getProjectBOQItems(projectId: string, userId: string) {
  await assertBuilderProjectAccess(userId, projectId);

  // Get BOQ file and parse it
  const boqResult = await pool.query(
    `SELECT b.file_path, b.column_mapping
     FROM boqs b
     WHERE b.project_id = $1`,
    [projectId]
  );

  if (boqResult.rows.length === 0) {
    return [];
  }

  const { file_path, column_mapping } = boqResult.rows[0];
  
  // Resolve the file path to absolute
  const absolutePath = path.isAbsolute(file_path) 
    ? file_path 
    : path.join(process.cwd(), file_path);
  
  // Parse the BOQ file
  try {
    const workbook = XLSX.readFile(absolutePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
      return [];
    }

    const headers = data[0].map((h: any) => String(h).trim());
    const rows = data.slice(1).filter((row) => row.some((cell) => cell));

    // column_mapping is already an object from JSONB, don't parse it
    const mapping = column_mapping || {};
    const itemCol = mapping.item || headers.find((h: string) => /item|description|name/i.test(h)) || headers[0];
    const qtyCol = mapping.qty || headers.find((h: string) => /qty|quantity/i.test(h)) || headers[1];
    const uomCol = mapping.uom || headers.find((h: string) => /uom|unit/i.test(h)) || headers[2];

    const itemIdx = headers.indexOf(itemCol);
    const qtyIdx = headers.indexOf(qtyCol);
    const uomIdx = headers.indexOf(uomCol);

    const items = rows.map((row, index) => {
      const item = itemIdx >= 0 ? String(row[itemIdx] || "").trim() : "";
      const qtyStr = qtyIdx >= 0 ? String(row[qtyIdx] || "0") : "0";
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, "")) || 0;
      const uom = uomIdx >= 0 ? String(row[uomIdx] || "").trim() : "";

      return {
        id: index + 1,
        item,
        qty,
        uom,
        rate: 0,
        total: 0,
      };
    }).filter((item) => item.item && item.qty > 0);

    return items;
  } catch (error: any) {
    console.error("Error parsing BOQ file:", error.message);
    throw error;
  }
}

export async function getBuilderBasePricing(builderOrgId: string) {
  const result = await pool.query(
    `SELECT item_name, rate, uom, category
     FROM base_pricing
     WHERE builder_org_id = $1
     ORDER BY item_name`,
    [builderOrgId]
  );

  return result.rows.map((row) => ({
    item: row.item_name,
    rate: parseFloat(row.rate),
    uom: row.uom,
    category: row.category,
  }));
}

export async function createOrUpdateEstimate(
  projectId: string,
  userId: string,
  builderOrgId: string,
  pricedItems: any[],
  marginConfig: {
    overallMargin: number;
    laborUplift: number;
    machineryUplift: number;
  } = { overallMargin: 10, laborUplift: 5, machineryUplift: 5 },
  notes?: string
) {
  await assertBuilderProjectAccess(userId, projectId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if estimate already exists
    const existingEstimate = await client.query(
      `SELECT id FROM estimates WHERE project_id = $1 AND builder_org_id = $2`,
      [projectId, builderOrgId]
    );

    let estimateId: string;

    if (existingEstimate.rows.length > 0) {
      estimateId = existingEstimate.rows[0].id;
      
      // Update status back to draft if it was previously submitted
      await client.query(
        `UPDATE estimates SET status = 'draft' WHERE id = $1`,
        [estimateId]
      );
    } else {
      // Create new estimate
      const newEstimate = await client.query(
        `INSERT INTO estimates (project_id, builder_org_id, status)
         VALUES ($1, $2, 'draft')
         RETURNING id`,
        [projectId, builderOrgId]
      );
      estimateId = newEstimate.rows[0].id;
    }

    // Calculate totals with category-specific uplifts
    let materialTotal = 0;
    let laborTotal = 0;
    let machineryTotal = 0;
    let otherTotal = 0;

    pricedItems.forEach((item) => {
      const category = String(item.category || "Material").toLowerCase();
      const total = item.total || 0;

      if (category.includes("labor") || category.includes("labour")) {
        laborTotal += total;
      } else if (category.includes("mach")) {
        machineryTotal += total;
      } else if (category.includes("other")) {
        otherTotal += total;
      } else {
        materialTotal += total;
      }
    });

    // Apply uplifts to labor and machinery
    const laborWithUplift = laborTotal * (1 + (marginConfig.laborUplift || 0) / 100);
    const machineryWithUplift = machineryTotal * (1 + (marginConfig.machineryUplift || 0) / 100);

    const subtotalWithUplifts = materialTotal + laborWithUplift + machineryWithUplift + otherTotal;
    const grandTotal = subtotalWithUplifts * (1 + (marginConfig.overallMargin || 0) / 100);

    // Get next revision number
    const revResult = await client.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_rev
       FROM estimate_revisions
       WHERE estimate_id = $1`,
      [estimateId]
    );
    const revisionNumber = revResult.rows[0].next_rev;

    // Get latest BOQ revision
    const boqResult = await client.query(
      `SELECT id FROM boq_revisions WHERE project_id = $1 ORDER BY revision_number DESC LIMIT 1`,
      [projectId]
    );

    // Create estimate revision
    await client.query(
      `INSERT INTO estimate_revisions (
         estimate_id,
         revision_number,
         source,
         boq_revision_id,
         pricing_snapshot,
         margin_config,
         grand_total,
         notes
       ) VALUES ($1, $2, 'builder', $3, $4, $5, $6, $7)`,
      [
        estimateId,
        revisionNumber,
        boqResult.rows[0]?.id || null,
        JSON.stringify(pricedItems),
        JSON.stringify(marginConfig),
        grandTotal,
        notes || null,
      ]
    );

    // Update estimate to submitted status
    await client.query(
      `UPDATE estimates SET status = 'submitted' WHERE id = $1`,
      [estimateId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'ESTIMATE_SUBMITTED', $3)`,
      [projectId, userId, JSON.stringify({ estimateId, revisionNumber })]
    );

    await client.query("COMMIT");

    return {
      estimateId,
      revisionNumber,
      subtotalWithUplifts,
      grandTotal,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSubmittedEstimates(builderOrgId: string) {
  const result = await pool.query(
    `SELECT
       e.id AS estimate_id,
       e.project_id,
       p.name AS project_name,
       er.id AS revision_id,
       er.revision_number,
       er.grand_total,
       er.submitted_at,
       er.notes,
       COALESCE(
         (er.margin_config->>'overallMargin')::numeric,
         (er.margin_config->>'marginPercent')::numeric,
         0
       ) AS margin_percent
     FROM estimates e
     JOIN projects p ON p.id = e.project_id
     JOIN LATERAL (
       SELECT id, revision_number, grand_total, submitted_at, notes, margin_config
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     WHERE e.builder_org_id = $1
       AND e.status = 'submitted'
     ORDER BY er.submitted_at DESC NULLS LAST, e.created_at DESC`,
    [builderOrgId]
  );

  return result.rows;
}
