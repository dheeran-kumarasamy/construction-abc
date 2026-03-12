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

export async function listTemplates(filters: {
  category?: string;
  search?: string;
}) {
  let query = `SELECT id, code, name, category, sub_category, unit, overhead_percent, profit_percent, gst_percent, is_system FROM rate_templates WHERE is_active = true`;
  const params: any[] = [];
  let idx = 1;

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

export async function getTemplateDetail(templateId: string) {
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
  // Get max sort order
  const { rows: [maxRow] } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM template_line_items WHERE template_id = $1`,
    [templateId]
  );
  const { rows } = await pool.query(
    `INSERT INTO template_line_items (template_id, resource_id, sub_template_id, coefficient, wastage_percent, remarks, sort_order)
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

export async function listProjects(userId: string) {
  const { rows } = await pool.query(`
    SELECT p.*,
      (SELECT COUNT(*) FROM boq_items bi WHERE bi.project_id = p.id) as item_count,
      (SELECT COALESCE(SUM(bi.computed_amount), 0) FROM boq_items bi WHERE bi.project_id = p.id) as total_amount
    FROM boq_projects p
    WHERE p.user_id = $1
    ORDER BY p.updated_at DESC
  `, [userId]);
  return rows;
}

export async function getProject(projectId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM boq_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return rows[0] || null;
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

export async function listSections(projectId: string) {
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

export async function listItems(projectId: string, sectionId?: string) {
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
