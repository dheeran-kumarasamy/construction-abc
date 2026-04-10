import { pool } from "../../config/db";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

interface OptimizationInputItem {
  id: number;
  item: string;
  qty: number;
  uom: string;
  rate: number;
  total: number;
  category?: string;
}

interface MarginConfig {
  overallMargin: number;
  laborUplift: number;
  machineryUplift: number;
}

interface OptimizationSuggestion {
  suggestionId: string;
  boqItemId: number;
  itemDescription: string;
  priority: "zero_rate_fill" | "location_pricing" | "target_alignment";
  type: "brand_swap" | "finish_change" | "spec_variant" | "vendor_switch";
  reason: string;
  oldRate: number;
  newRate: number;
  rateDelta: number;
  totalDelta: number;
  confidence: number;
  blocked: boolean;
  blockReason?: string;
  qualityValidation?: string;
  alternatives?: string[];
  source?: "llm" | "heuristic";
}

interface LlmSuggestion {
  boqItemId: number;
  type: OptimizationSuggestion["type"];
  priority?: OptimizationSuggestion["priority"];
  suggestedRate: number;
  reason: string;
  confidence: number;
  qualityValidation: string;
  alternatives?: string[];
}

interface LlmGenerationResult {
  suggestions: LlmSuggestion[];
  attempted: boolean;
  configured: boolean;
  model: string;
  failureReason?: string;
}

interface OptimizationProjectContext {
  siteAddress?: string;
  city?: string;
}

interface ExpenseRecommendation {
  head: "labor" | "machinery";
  suggestedAmount: number;
  reason: string;
  confidence: number;
  source: "llm" | "heuristic";
}

interface RevisionDiffSummary {
  changedRateCount: number;
  newlyPricedCount: number;
  addedItemCount: number;
  removedItemCount: number;
  previousGrandTotal: number;
  currentGrandTotal: number;
  grandTotalDelta: number;
  topChanges: Array<{
    item: string;
    previousRate: number;
    currentRate: number;
    qty: number;
    totalDelta: number;
  }>;
}

interface MarketPriceBenchmark {
  material_id: string;
  material_name: string;
  market_unit: string | null;
  avg_market_price: number;
}

interface DeviationAlertItem {
  boqItemId: number;
  boqItemName: string;
  boqItemUom: string;
  matchedMaterialName: string;
  matchedMaterialUom: string | null;
  builderRate: number;
  marketRate: number;
  deviationPercent: number;
  deviationPercentSigned: number;
  deviationDirection: "above_market" | "below_market";
  quantity: number;
  estimatedExcess: number;
}

interface PreviousProjectRateIncreaseItem {
  boqItemId: number;
  boqItemName: string;
  boqItemUom: string;
  currentRate: number;
  previousRate: number;
  increasePercent: number;
}

function getConfiguredLlmModel() {
  const raw = String(process.env.LLM_MODEL || "").trim();
  if (!raw) {
    return "gemini-3.1-pro-preview";
  }

  if (/^gpt-|^o\d/i.test(raw)) {
    return "gemini-3.1-pro-preview";
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, "-");

  if (normalized === "gemini-3.1-pro" || normalized === "gemini-3-pro") {
    return "gemini-3.1-pro-preview";
  }

  return normalized;
}

function getConfiguredLlmApiKey() {
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.LLM_API_KEY ||
    "";
  return String(raw).trim().replace(/^['"]+|['"]+$/g, "");
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDeviationThresholdPercent() {
  const raw = Number(process.env.BUILDER_MARKET_DEVIATION_THRESHOLD_PERCENT || 20);
  if (!Number.isFinite(raw)) return 20;
  return Math.max(0, raw);
}

function resolvePreviousProjectIncreaseThresholdPercent() {
  const raw = Number(process.env.BUILDER_PREVIOUS_PROJECT_DEVIATION_THRESHOLD_PERCENT || 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.max(0, raw);
}

function isMaterialCategory(category: string | undefined) {
  const normalized = String(category || "material").toLowerCase();
  if (normalized.includes("labor") || normalized.includes("labour")) return false;
  if (normalized.includes("mach")) return false;
  if (normalized.includes("other")) return false;
  return true;
}

function findBestMarketBenchmark(
  itemName: string,
  itemUom: string,
  benchmarks: MarketPriceBenchmark[]
) {
  const targetName = normalizeComparableText(itemName);
  const targetUom = normalizeComparableText(itemUom);
  if (!targetName) return null;

  let match = benchmarks.find((entry) => {
    const benchmarkName = normalizeComparableText(entry.material_name);
    const benchmarkUom = normalizeComparableText(entry.market_unit || "");
    return benchmarkName === targetName && (!targetUom || benchmarkUom === targetUom);
  });

  if (!match) {
    match = benchmarks.find((entry) => normalizeComparableText(entry.material_name) === targetName);
  }

  if (!match) {
    match = benchmarks.find((entry) => {
      const benchmarkName = normalizeComparableText(entry.material_name);
      return targetName.includes(benchmarkName) || benchmarkName.includes(targetName);
    });
  }

  return match || null;
}

async function detectMarketDeviations(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  pricedItems: any[],
  thresholdPercent: number
): Promise<DeviationAlertItem[]> {
  const benchmarkResult = await client.query(
    `WITH latest AS (
       SELECT DISTINCT ON (pr.material_id, pr.district_id)
         pr.material_id,
         pr.district_id,
         pr.price,
         pr.scraped_at
       FROM price_records pr
       WHERE pr.price > 0
       ORDER BY pr.material_id, pr.district_id, pr.scraped_at DESC
     )
     SELECT
       m.id AS material_id,
       m.name AS material_name,
       m.unit AS market_unit,
       AVG(latest.price)::numeric(12,2) AS avg_market_price
     FROM latest
     JOIN materials m ON m.id = latest.material_id
     GROUP BY m.id, m.name, m.unit`
  );

  const benchmarks: MarketPriceBenchmark[] = (benchmarkResult.rows || []).map((row: any) => ({
    material_id: String(row.material_id || ""),
    material_name: String(row.material_name || ""),
    market_unit: row.market_unit || null,
    avg_market_price: Number(row.avg_market_price || 0),
  })).filter((row: MarketPriceBenchmark) => Number.isFinite(row.avg_market_price) && row.avg_market_price > 0);

  if (!benchmarks.length) return [];

  const deviations: DeviationAlertItem[] = [];
  for (const item of pricedItems || []) {
    if (!isMaterialCategory(item?.category)) continue;

    const boqRate = Number(item?.rate || 0);
    if (!Number.isFinite(boqRate) || boqRate <= 0) continue;

    const boqName = String(item?.item || "").trim();
    const boqUom = String(item?.uom || "").trim();
    if (!boqName) continue;

    const benchmark = findBestMarketBenchmark(boqName, boqUom, benchmarks);
    if (!benchmark) continue;

    const marketRate = Number(benchmark.avg_market_price || 0);
    if (!Number.isFinite(marketRate) || marketRate <= 0) continue;

    const deviationPercentSigned = Number((((boqRate - marketRate) / marketRate) * 100).toFixed(2));
    const deviationPercent = Number(Math.abs(deviationPercentSigned).toFixed(2));
    if (!Number.isFinite(deviationPercent) || deviationPercent < thresholdPercent) continue;

    const qty = Number(item?.qty || 0);
    const estimatedExcess = Number(((boqRate - marketRate) * (Number.isFinite(qty) ? qty : 0)).toFixed(2));
    const deviationDirection: "above_market" | "below_market" =
      deviationPercentSigned >= 0 ? "above_market" : "below_market";

    deviations.push({
      boqItemId: Number(item?.id || 0),
      boqItemName: boqName,
      boqItemUom: boqUom,
      matchedMaterialName: benchmark.material_name,
      matchedMaterialUom: benchmark.market_unit,
      builderRate: boqRate,
      marketRate,
      deviationPercent,
      deviationPercentSigned,
      deviationDirection,
      quantity: Number.isFinite(qty) ? qty : 0,
      estimatedExcess,
    });
  }

  return deviations.sort((a, b) => b.deviationPercent - a.deviationPercent);
}

function buildComparableRateIndex(items: any[]) {
  const map = new Map<string, number>();
  for (const item of items || []) {
    if (!isMaterialCategory(item?.category)) continue;

    const name = normalizeComparableText(item?.item || "");
    const uom = normalizeComparableText(item?.uom || "");
    const rate = Number(item?.rate || 0);
    if (!name || !Number.isFinite(rate) || rate <= 0) continue;

    if (uom) {
      map.set(`${name}::${uom}`, rate);
    }
    if (!map.has(name)) {
      map.set(name, rate);
    }
  }

  return map;
}

async function detectPreviousProjectRateIncreases(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  builderOrgId: string,
  currentProjectId: string,
  pricedItems: any[],
  thresholdPercent: number
): Promise<{
  previousProjectId: string;
  previousProjectName: string;
  items: PreviousProjectRateIncreaseItem[];
}> {
  const previousResult = await client.query(
    `SELECT
       e.project_id,
       p.name AS project_name,
       er.pricing_snapshot
     FROM estimate_revisions er
     JOIN estimates e ON e.id = er.estimate_id
     JOIN projects p ON p.id = e.project_id
     WHERE e.builder_org_id = $1
       AND e.project_id <> $2
       AND er.submitted_at IS NOT NULL
       AND er.pricing_snapshot IS NOT NULL
     ORDER BY er.submitted_at DESC
     LIMIT 1`,
    [builderOrgId, currentProjectId]
  );

  if (!previousResult.rows.length) {
    return { previousProjectId: "", previousProjectName: "", items: [] };
  }

  const previousRow = previousResult.rows[0];
  const previousSnapshot = Array.isArray(previousRow.pricing_snapshot)
    ? previousRow.pricing_snapshot
    : [];
  if (!previousSnapshot.length) {
    return {
      previousProjectId: String(previousRow.project_id || ""),
      previousProjectName: String(previousRow.project_name || ""),
      items: [],
    };
  }

  const previousRateIndex = buildComparableRateIndex(previousSnapshot);
  if (!previousRateIndex.size) {
    return {
      previousProjectId: String(previousRow.project_id || ""),
      previousProjectName: String(previousRow.project_name || ""),
      items: [],
    };
  }

  const increases: PreviousProjectRateIncreaseItem[] = [];
  for (const item of pricedItems || []) {
    if (!isMaterialCategory(item?.category)) continue;

    const currentRate = Number(item?.rate || 0);
    if (!Number.isFinite(currentRate) || currentRate <= 0) continue;

    const normalizedName = normalizeComparableText(item?.item || "");
    const normalizedUom = normalizeComparableText(item?.uom || "");
    if (!normalizedName) continue;

    const matchedPreviousRate =
      (normalizedUom ? previousRateIndex.get(`${normalizedName}::${normalizedUom}`) : undefined) ??
      previousRateIndex.get(normalizedName);
    const previousRate = Number(matchedPreviousRate || 0);
    if (!Number.isFinite(previousRate) || previousRate <= 0) continue;

    const increasePercent = Number((((currentRate - previousRate) / previousRate) * 100).toFixed(2));
    if (!Number.isFinite(increasePercent) || increasePercent <= thresholdPercent) continue;

    increases.push({
      boqItemId: Number(item?.id || 0),
      boqItemName: String(item?.item || "").trim() || "item",
      boqItemUom: String(item?.uom || "").trim(),
      currentRate,
      previousRate,
      increasePercent,
    });
  }

  return {
    previousProjectId: String(previousRow.project_id || ""),
    previousProjectName: String(previousRow.project_name || ""),
    items: increases.sort((a, b) => b.increasePercent - a.increasePercent),
  };
}

function normalizeMarginConfig(input?: Partial<MarginConfig>): MarginConfig {
  const overallMargin = Number(input?.overallMargin);
  const laborUplift = Number(input?.laborUplift);
  const machineryUplift = Number(input?.machineryUplift);

  return {
    overallMargin: Number.isFinite(overallMargin) ? Math.max(overallMargin, 0) : 10,
    laborUplift: Number.isFinite(laborUplift) ? Math.max(laborUplift, 0) : 5,
    machineryUplift: Number.isFinite(machineryUplift) ? Math.max(machineryUplift, 0) : 5,
  };
}

function getGrandImpactMultiplier(item: OptimizationInputItem, marginConfig: MarginConfig) {
  const category = String(item.category || "material").toLowerCase();
  const marginFactor = 1 + marginConfig.overallMargin / 100;

  if (category.includes("labor") || category.includes("labour")) {
    return (1 + marginConfig.laborUplift / 100) * marginFactor;
  }

  if (category.includes("mach")) {
    return (1 + marginConfig.machineryUplift / 100) * marginFactor;
  }

  return marginFactor;
}

function calculateGrandTotal(pricedItems: OptimizationInputItem[], marginConfig: MarginConfig) {
  let materialTotal = 0;
  let laborTotal = 0;
  let machineryTotal = 0;
  let otherTotal = 0;

  pricedItems.forEach((item) => {
    const category = String(item.category || "material").toLowerCase();
    const total = Number(item.total || 0);

    if (category.includes("labor") || category.includes("labour")) {
      laborTotal += total;
      return;
    }

    if (category.includes("mach")) {
      machineryTotal += total;
      return;
    }

    if (category.includes("other")) {
      otherTotal += total;
      return;
    }

    materialTotal += total;
  });

  const laborWithUplift = laborTotal * (1 + marginConfig.laborUplift / 100);
  const machineryWithUplift = machineryTotal * (1 + marginConfig.machineryUplift / 100);
  const subtotalWithUplifts = materialTotal + laborWithUplift + machineryWithUplift + otherTotal;

  return subtotalWithUplifts * (1 + marginConfig.overallMargin / 100);
}

function calculateCategoryTotals(pricedItems: OptimizationInputItem[]) {
  let materialTotal = 0;
  let laborTotal = 0;
  let machineryTotal = 0;
  let otherTotal = 0;

  pricedItems.forEach((item) => {
    const category = String(item.category || "material").toLowerCase();
    const total = Number(item.total || 0);

    if (category.includes("labor") || category.includes("labour")) {
      laborTotal += total;
      return;
    }

    if (category.includes("mach")) {
      machineryTotal += total;
      return;
    }

    if (category.includes("other")) {
      otherTotal += total;
      return;
    }

    materialTotal += total;
  });

  return { materialTotal, laborTotal, machineryTotal, otherTotal };
}

function inferCity(siteAddress?: string) {
  const value = String(siteAddress || "").trim();
  if (!value) {
    return "";
  }

  const parts = value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts[Math.max(parts.length - 2, 0)] || parts[parts.length - 1] || "";
}

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
     JOIN users u ON u.id = $1
     LEFT JOIN LATERAL (
       SELECT site_address, tentative_start_date, duration_months
       FROM project_revisions
       WHERE project_id = p.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) pr ON true
     LEFT JOIN boqs b ON p.id = b.project_id
     LEFT JOIN estimates e ON p.id = e.project_id
       AND (u.organization_id IS NOT NULL AND e.builder_org_id = u.organization_id)
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

export async function markEstimateInProgress(projectId: string, userId: string, builderOrgId: string) {
  await assertBuilderProjectAccess(userId, projectId);

  const existingEstimate = await pool.query(
    `SELECT id FROM estimates WHERE project_id = $1 AND builder_org_id = $2 LIMIT 1`,
    [projectId, builderOrgId]
  );

  if (existingEstimate.rows.length === 0) {
    await pool.query(
      `INSERT INTO estimates (project_id, builder_org_id, status)
       VALUES ($1, $2, 'draft')`,
      [projectId, builderOrgId]
    );
    return { status: "draft" };
  }

  await pool.query(
    `UPDATE estimates
     SET status = 'draft'
     WHERE id = $1`,
    [existingEstimate.rows[0].id]
  );

  return { status: "draft" };
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

  // Get BOQ data - prefer parsed_data for serverless compatibility
  // but gracefully support DBs where parsed_data column is not yet migrated.
  let boqResult;
  try {
    boqResult = await pool.query(
      `SELECT b.file_path, b.column_mapping, b.parsed_data
       FROM boqs b
       WHERE b.project_id = $1`,
      [projectId]
    );
  } catch (error: any) {
    if (error?.code !== "42703") {
      throw error;
    }

    boqResult = await pool.query(
      `SELECT b.file_path, b.column_mapping
       FROM boqs b
       WHERE b.project_id = $1`,
      [projectId]
    );
  }

  if (boqResult.rows.length === 0) {
    return [];
  }

  const row = boqResult.rows[0] as {
    file_path: string;
    column_mapping: Record<string, string> | null;
    parsed_data?: any[];
  };
  const { file_path, column_mapping, parsed_data } = row;
  
  // If parsed_data exists, use it (for serverless/Vercel)
  if (parsed_data && Array.isArray(parsed_data)) {
    return parsed_data.map((item: any, index: number) => {
      const qtyStr = String(item.qty || "0");
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, "")) || 0;
      const rawSource = String(item.source || "architect_standard").trim().toLowerCase();
      const lineItemOrigin = rawSource === "architect_additional" ? "architect_additional" : "architect_standard";
      
      return {
        id: index + 1,
        item: String(item.item || "").trim(),
        qty,
        uom: String(item.uom || "").trim(),
        rate: 0,
        total: 0,
        line_item_origin: lineItemOrigin,
      };
    }).filter((item: any) => item.item && item.qty > 0);
  }
  
  // Fallback to file parsing (for local development with old data)
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

async function persistBuilderAddedItemsToBasePricing(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  builderOrgId: string,
  pricedItems: any[]
) {
  const builderAddedRows = pricedItems
    .filter((item) => String(item?.lineItemOrigin || "").toLowerCase() === "builder_added")
    .map((item) => ({
      itemName: String(item?.item || "").trim(),
      uom: String(item?.uom || "unit").trim() || "unit",
      category: String(item?.category || "Material").trim() || "Material",
      rate: Number(item?.rate || 0),
    }))
    .filter((item) => item.itemName && Number.isFinite(item.rate) && item.rate > 0);

  const dedupe = new Map<string, { itemName: string; uom: string; category: string; rate: number }>();
  builderAddedRows.forEach((row) => {
    const key = `${row.itemName.toLowerCase()}|${row.uom.toLowerCase()}`;
    dedupe.set(key, row);
  });

  for (const row of dedupe.values()) {
    const existing = await client.query(
      `SELECT id
       FROM base_pricing
       WHERE builder_org_id = $1
         AND LOWER(item_name) = LOWER($2)
         AND LOWER(uom) = LOWER($3)
       LIMIT 1`,
      [builderOrgId, row.itemName, row.uom]
    );

    if (existing.rows.length > 0) {
      continue;
    }

    await client.query(
      `INSERT INTO base_pricing (builder_org_id, item_name, uom, category, rate)
       VALUES ($1, $2, $3, $4, $5)`,
      [builderOrgId, row.itemName, row.uom, row.category, row.rate]
    );
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

function isArchitectLockedByText(itemName: string) {
  const lockedPattern = /as per architect|architect specified|mandatory|must use|required by architect|do not change|non[-\s]?negotiable/i;
  return lockedPattern.test(itemName);
}

function isQualityCritical(itemName: string) {
  const qualityPattern = /structural|steel|rebar|cement|concrete|fire|waterproof|electrical safety|load bearing|grade\s*[a-z0-9]+|fe\s*500|isi|iso/i;
  return qualityPattern.test(itemName);
}

function inferSuggestionType(itemName: string): OptimizationSuggestion["type"] {
  const value = itemName.toLowerCase();
  if (/paint|finish|coating|texture|polish/.test(value)) {
    return "finish_change";
  }
  if (/brand|cement|steel|tile|sanitary|fixture/.test(value)) {
    return "brand_swap";
  }
  if (/supplier|vendor|transport|freight|delivery/.test(value)) {
    return "vendor_switch";
  }
  return "spec_variant";
}

function inferSuggestionPriority(
  item: OptimizationInputItem,
  reason: string,
  llmPriority?: string
): OptimizationSuggestion["priority"] {
  if (llmPriority === "zero_rate_fill" || llmPriority === "location_pricing" || llmPriority === "target_alignment") {
    return llmPriority;
  }

  if (Number(item.rate || 0) <= 0) {
    return "zero_rate_fill";
  }

  const text = String(reason || "").toLowerCase();
  if (/city|location|regional|market rate|local market|site location/.test(text)) {
    return "location_pricing";
  }

  return "target_alignment";
}

function getMaxReductionPct(item: OptimizationInputItem) {
  const itemName = String(item.item || "");
  if (isQualityCritical(itemName)) {
    return 0.04;
  }

  const category = String(item.category || "material").toLowerCase();
  if (category.includes("labor") || category.includes("labour")) {
    return 0.06;
  }
  if (category.includes("mach")) {
    return 0.08;
  }
  if (category.includes("other")) {
    return 0.05;
  }
  return 0.1;
}

function extractJsonPayload(raw: string) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return null;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
  }

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = candidate.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
    }
  }

  return null;
}

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSnapshotItems(items: any[]): OptimizationInputItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: any, idx: number) => {
    const qty = toNumber(item?.qty ?? item?.Qty);
    const rate = toNumber(item?.rate ?? item?.Rate);
    return {
      id: toNumber(item?.id) || idx + 1,
      item: String(item?.item ?? item?.Item ?? item?.description ?? "").trim(),
      qty,
      uom: String(item?.uom ?? item?.UOM ?? item?.unit ?? "").trim(),
      rate,
      total: toNumber(item?.total ?? qty * rate),
      category: String(item?.category ?? "material").trim(),
    };
  });
}

function itemKey(item: OptimizationInputItem) {
  return `${String(item.item || "").trim().toLowerCase()}::${String(item.uom || "").trim().toLowerCase()}`;
}

function computeRevisionDiffSummary(
  previousItemsRaw: any[],
  currentItemsRaw: any[],
  previousGrandTotal: number,
  currentGrandTotal: number
): RevisionDiffSummary {
  const previousItems = normalizeSnapshotItems(previousItemsRaw);
  const currentItems = normalizeSnapshotItems(currentItemsRaw);

  const previousByKey = new Map<string, OptimizationInputItem>();
  previousItems.forEach((item) => previousByKey.set(itemKey(item), item));

  const currentByKey = new Map<string, OptimizationInputItem>();
  currentItems.forEach((item) => currentByKey.set(itemKey(item), item));

  let changedRateCount = 0;
  let newlyPricedCount = 0;
  let addedItemCount = 0;
  let removedItemCount = 0;
  const topChanges: RevisionDiffSummary["topChanges"] = [];

  currentItems.forEach((current) => {
    const key = itemKey(current);
    const previous = previousByKey.get(key);

    if (!previous) {
      addedItemCount += 1;
      if (current.rate > 0) {
        topChanges.push({
          item: current.item,
          previousRate: 0,
          currentRate: current.rate,
          qty: current.qty,
          totalDelta: current.qty * current.rate,
        });
      }
      return;
    }

    const prevRate = toNumber(previous.rate);
    const currRate = toNumber(current.rate);
    if (Math.abs(currRate - prevRate) > 0.0001) {
      changedRateCount += 1;
      if (prevRate <= 0 && currRate > 0) {
        newlyPricedCount += 1;
      }
      topChanges.push({
        item: current.item,
        previousRate: prevRate,
        currentRate: currRate,
        qty: toNumber(current.qty),
        totalDelta: toNumber(current.qty) * (currRate - prevRate),
      });
    }
  });

  previousItems.forEach((previous) => {
    if (!currentByKey.has(itemKey(previous))) {
      removedItemCount += 1;
    }
  });

  topChanges.sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta));

  return {
    changedRateCount,
    newlyPricedCount,
    addedItemCount,
    removedItemCount,
    previousGrandTotal: toNumber(previousGrandTotal),
    currentGrandTotal: toNumber(currentGrandTotal),
    grandTotalDelta: toNumber(currentGrandTotal) - toNumber(previousGrandTotal),
    topChanges: topChanges.slice(0, 5),
  };
}

function buildDeterministicRevisionNote(revisionNumber: number, summary: RevisionDiffSummary) {
  const delta = summary.grandTotalDelta;
  const deltaLabel =
    delta > 0
      ? `increased by ₹${Math.abs(delta).toFixed(2)}`
      : delta < 0
        ? `reduced by ₹${Math.abs(delta).toFixed(2)}`
        : "kept unchanged";

  const header = `Revision ${revisionNumber}: ${summary.changedRateCount} item rates updated, ${summary.newlyPricedCount} zero-rate items priced; total ${deltaLabel}.`;

  if (!summary.topChanges.length) {
    return header;
  }

  const top = summary.topChanges
    .slice(0, 3)
    .map((change) => `${change.item} (${change.previousRate.toFixed(2)}→${change.currentRate.toFixed(2)})`)
    .join("; ");

  return `${header} Major updates: ${top}.`;
}

async function generateRevisionNoteWithLlm(
  revisionNumber: number,
  summary: RevisionDiffSummary,
  marginConfig: MarginConfig
) {
  const apiKey = getConfiguredLlmApiKey();
  if (!apiKey) return null;

  const primaryModel = getConfiguredLlmModel();
  const modelCandidates = Array.from(
    new Set([
      primaryModel,
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ])
  );

  const promptPayload = {
    task: "Generate concise builder revision notes",
    constraints: [
      "Return plain text only.",
      "Max 2 short sentences.",
      "Focus only on what changed vs previous revision.",
      "Mention if zero-rate items were filled.",
      "Mention total impact direction (increased/reduced/unchanged).",
      "Do not mention margin percent explicitly.",
    ],
    revisionNumber,
    marginConfig,
    diffSummary: summary,
  };

  for (const model of modelCandidates) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 140,
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "You write concise construction estimate revision notes." },
                { text: JSON.stringify(promptPayload) },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const lower = body.toLowerCase();
        if (response.status === 404 || lower.includes("model")) {
          continue;
        }
        return null;
      }

      const data = await response.json();
      const text = String(
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => String(part?.text || ""))
          .join("\n") || ""
      ).trim();

      if (text) {
        return text.replace(/\s+/g, " ").slice(0, 420);
      }
    } catch {
      return null;
    }
  }

  return null;
}

async function buildAutoRevisionNotes(
  revisionNumber: number,
  previousItemsRaw: any[] | null,
  currentItemsRaw: any[],
  previousGrandTotal: number,
  currentGrandTotal: number,
  marginConfig: MarginConfig
) {
  const previousItems = Array.isArray(previousItemsRaw) ? previousItemsRaw : [];

  if (revisionNumber <= 1 || previousItems.length === 0) {
    return `Revision ${revisionNumber}: Initial submission prepared with ${Array.isArray(currentItemsRaw) ? currentItemsRaw.length : 0} priced BOQ items. Grand total set to ₹${toNumber(currentGrandTotal).toFixed(2)}.`;
  }

  const summary = computeRevisionDiffSummary(previousItems, currentItemsRaw, previousGrandTotal, currentGrandTotal);
  const llmNote = await generateRevisionNoteWithLlm(revisionNumber, summary, marginConfig);
  if (llmNote) return llmNote;

  return buildDeterministicRevisionNote(revisionNumber, summary);
}

async function generateLlmSuggestions(
  targetTotal: number,
  currentTotal: number,
  candidateItems: OptimizationInputItem[],
  selectedGuardrails: string[],
  projectContext?: OptimizationProjectContext,
  options?: { zeroRateOnly?: boolean }
): Promise<LlmGenerationResult> {
  const apiKey = getConfiguredLlmApiKey();
  const primaryModel = getConfiguredLlmModel();
  const modelCandidates = Array.from(
    new Set([
      primaryModel,
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ])
  );

  if (!apiKey || candidateItems.length === 0) {
    return {
      suggestions: [],
      attempted: false,
      configured: Boolean(apiKey),
      model: primaryModel,
      failureReason: !apiKey ? "missing_api_key" : "no_actionable_items",
    };
  }

  try {
    const promptPayload = {
      targetTotal,
      currentTotal,
      projectLocation: {
        city: String(projectContext?.city || "").trim() || inferCity(projectContext?.siteAddress),
        siteAddress: String(projectContext?.siteAddress || "").trim(),
      },
      selectedGuardrails,
      priorityOrder: [
        "1) Fill rates for all BOQ items currently at 0 price",
        "2) Suggest city/location-correct pricing for BOQ items",
        "3) Suggest revisions to align final estimate with target total",
        "4) Respect all selected builder guardrails strictly",
      ],
      zeroRateOnlyMode: Boolean(options?.zeroRateOnly),
      requiredZeroRateItemIds: options?.zeroRateOnly
        ? candidateItems
            .filter((item) => Number(item.rate || 0) <= 0)
            .map((item) => item.id)
        : [],
      objective:
        "Reduce overall estimate toward target by suggesting revised unit rates for specific BOQ items using equivalent alternatives.",
      pricingGuidelines: [
        "If current item is a premium brand/spec, suggest equivalent mainstream alternative when quality remains compliant.",
        "Example style: Tata Steel @80/kg -> JSW Steel @75/kg when grade/spec remains equivalent.",
        "Do not suggest any rate increase.",
        "Keep suggestions practical and procurement-friendly.",
      ],
      outputRules: [
        "Return strict JSON only with shape: { suggestions: [...] }.",
        "Return suggestions only for provided boqItemId values.",
        "For items with currentRate > 0, suggestedRate must be > 0 and <= currentRate unless city-specific correction is clearly justified.",
        "For items with currentRate = 0, suggestedRate must be > 0 and realistic for the provided city/site context.",
        "If zeroRateOnlyMode is true, return one suggestion for every requiredZeroRateItemIds entry.",
        "Confidence must be between 0 and 1.",
        "Include short qualityValidation proving no quality compromise.",
        "Provide 1-3 alternatives as plain text.",
        "Set priority as one of: zero_rate_fill, location_pricing, target_alignment.",
      ],
      items: candidateItems.map((item) => ({
        boqItemId: item.id,
        item: item.item,
        qty: item.qty,
        uom: item.uom,
        category: item.category || "material",
        currentRate: item.rate,
        currentTotal: item.total,
      })),
    };

    let selectedModel = primaryModel;
    let data: any = null;
    let lastFailureReason: string | undefined;

    for (const model of modelCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "You are a construction cost optimization assistant. Suggest lower-cost but compliant alternatives. Never compromise safety, quality, statutory code compliance, or architect-mandated specs.",
                },
                { text: JSON.stringify(promptPayload) },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const normalized = errorBody.toLowerCase();
        let failureReason = "request_exception";

        if (response.status === 401 || response.status === 403 || normalized.includes("api key")) {
          failureReason = "auth_error";
        } else if (response.status === 404 || normalized.includes("model")) {
          failureReason = "model_error";
        } else if (response.status === 429 || normalized.includes("quota") || normalized.includes("rate")) {
          failureReason = "rate_limit";
        } else if (response.status === 400) {
          failureReason = "bad_request";
        }

        lastFailureReason = failureReason;

        if (failureReason === "model_error") {
          continue;
        }

        return {
          suggestions: [],
          attempted: true,
          configured: true,
          model,
          failureReason,
        };
      }

      selectedModel = model;
      data = (await response.json()) as any;
      break;
    }

    if (!data) {
      return {
        suggestions: [],
        attempted: true,
        configured: true,
        model: primaryModel,
        failureReason: lastFailureReason || "request_exception",
      };
    }
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => String(part?.text || ""))
      .join("\n");
    if (!content) {
      console.error("LLM suggestion API error: empty completion content");
      return {
        suggestions: [],
        attempted: true,
        configured: true,
        model: selectedModel,
        failureReason: "empty_completion_content",
      };
    }

    const parsed = extractJsonPayload(String(content || ""));
    const suggestions: any[] = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const normalized = suggestions
      .map((s: any) => ({
        boqItemId: Number(s?.boqItemId),
        type: String(s?.type || "spec_variant") as OptimizationSuggestion["type"],
        priority: String(s?.priority || "") as OptimizationSuggestion["priority"],
        suggestedRate: Number(s?.suggestedRate),
        reason: String(s?.reason || "Suggested equivalent option to reduce cost"),
        confidence: Number(s?.confidence),
        qualityValidation: String(s?.qualityValidation || "Validated as quality-compliant alternative"),
        alternatives: Array.isArray(s?.alternatives)
          ? s.alternatives.map((x: any) => String(x)).slice(0, 3)
          : [],
      }))
      .filter(
        (s: LlmSuggestion) =>
          Number.isFinite(s.boqItemId) &&
          Number.isFinite(s.suggestedRate) &&
          s.suggestedRate > 0 &&
          Number.isFinite(s.confidence) &&
          s.confidence >= 0 &&
          s.confidence <= 1 &&
          ["brand_swap", "finish_change", "spec_variant", "vendor_switch"].includes(s.type)
      );

    return {
      suggestions: normalized,
      attempted: true,
      configured: true,
      model: selectedModel,
      failureReason: normalized.length === 0 ? "empty_or_invalid_llm_output" : undefined,
    };
  } catch (error) {
    console.error("LLM suggestion parse/generation failed:", error);
    return {
      suggestions: [],
      attempted: true,
      configured: true,
      model: getConfiguredLlmModel(),
      failureReason: "request_exception",
    };
  }
}

async function generateExpenseRecommendations(
  pricedItems: OptimizationInputItem[],
  projectContext?: OptimizationProjectContext
): Promise<ExpenseRecommendation[]> {
  const totals = calculateCategoryTotals(pricedItems);
  const materialTotal = Number(totals.materialTotal || 0);
  const fallbackLabor = Math.max(Number((materialTotal * 0.15).toFixed(2)), 0);
  const fallbackMachinery = Math.max(Number((materialTotal * 0.05).toFixed(2)), 0);

  const fallback: ExpenseRecommendation[] = [
    {
      head: "labor",
      suggestedAmount: fallbackLabor,
      reason: "Suggested labour provision based on BOQ material and activity mix",
      confidence: 0.72,
      source: "heuristic",
    },
    {
      head: "machinery",
      suggestedAmount: fallbackMachinery,
      reason: "Suggested machinery/tooling provision based on BOQ execution scope",
      confidence: 0.68,
      source: "heuristic",
    },
  ];

  const apiKey = getConfiguredLlmApiKey();
  const primaryModel = getConfiguredLlmModel();
  if (!apiKey) return fallback;

  const modelCandidates = Array.from(
    new Set([
      primaryModel,
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ])
  );

  const payload = {
    task: "Suggest labour and machinery expense provisions for BOQ estimate",
    outputRules: [
      "Return strict JSON: { recommendations: [{ head: 'labor'|'machinery', suggestedAmount: number, reason: string, confidence: number }] }",
      "Provide exactly 2 entries: one for labor, one for machinery",
      "suggestedAmount must be positive",
      "confidence between 0 and 1",
    ],
    projectContext: {
      city: String(projectContext?.city || "").trim() || inferCity(projectContext?.siteAddress),
      siteAddress: String(projectContext?.siteAddress || "").trim(),
    },
    boqSummary: {
      itemCount: pricedItems.length,
      totals,
      sampleItems: pricedItems.slice(0, 50).map((item) => ({
        item: item.item,
        qty: item.qty,
        uom: item.uom,
        category: item.category || "material",
        total: item.total,
      })),
    },
  };

  try {
    for (const model of modelCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "You are a construction costing assistant." },
                { text: JSON.stringify(payload) },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        if (response.status === 404 || body.toLowerCase().includes("model")) {
          continue;
        }
        return fallback;
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => String(part?.text || ""))
        .join("\n");

      const parsed = extractJsonPayload(String(content || ""));
      const recommendations = Array.isArray(parsed?.recommendations)
        ? parsed.recommendations
        : [];

      const normalized = recommendations
        .map((row: any) => ({
          head: String(row?.head || "").toLowerCase() as "labor" | "machinery",
          suggestedAmount: Number(row?.suggestedAmount),
          reason: String(row?.reason || "").trim() || "Recommended from BOQ scope",
          confidence: Number(row?.confidence),
          source: "llm" as const,
        }))
        .filter(
          (row: ExpenseRecommendation) =>
            (row.head === "labor" || row.head === "machinery") &&
            Number.isFinite(row.suggestedAmount) &&
            row.suggestedAmount > 0 &&
            Number.isFinite(row.confidence) &&
            row.confidence >= 0 &&
            row.confidence <= 1
        );

      const byHead = new Map<"labor" | "machinery", ExpenseRecommendation>();
      normalized.forEach((row: ExpenseRecommendation) => byHead.set(row.head, row));

      const merged: ExpenseRecommendation[] = [
        byHead.get("labor") || fallback[0],
        byHead.get("machinery") || fallback[1],
      ];

      return merged;
    }
  } catch (error) {
    console.error("LLM expense recommendation failed:", error);
  }

  return fallback;
}

export async function suggestTargetOptimizations(
  projectId: string,
  userId: string,
  targetTotal: number,
  pricedItems: OptimizationInputItem[],
  marginConfigInput?: Partial<MarginConfig>,
  hardFailInput?: boolean,
  selectedGuardrails: string[] = [],
  projectContext?: OptimizationProjectContext
) {
  await assertBuilderProjectAccess(userId, projectId);

  const marginConfig = normalizeMarginConfig(marginConfigInput);
  const envHardFail = String(process.env.LLM_HARD_FAIL || "").toLowerCase() === "true";
  const hardFail = typeof hardFailInput === "boolean" ? hardFailInput : envHardFail;

  if (!Number.isFinite(targetTotal) || targetTotal <= 0) {
    throw new Error("Target total must be a positive number");
  }

  const currentTotal = calculateGrandTotal(pricedItems, marginConfig);
  const gapToClose = currentTotal - targetTotal;

  const validItems = pricedItems.filter((item) => Number(item.qty || 0) > 0);

  const blockedSuggestions: OptimizationSuggestion[] = validItems
    .filter((item) => {
      const itemName = String(item.item || "");
      const architectLocked = isArchitectLockedByText(itemName);
      return architectLocked;
    })
    .map((item) => {
      const itemName = String(item.item || "");
      const architectLocked = isArchitectLockedByText(itemName);

      return {
        suggestionId: `opt-${item.id}-blocked`,
        boqItemId: item.id,
        itemDescription: itemName,
        priority: "target_alignment",
        type: inferSuggestionType(itemName),
        reason: "No pricing tweak proposed due to architect non-negotiable requirement",
        oldRate: Number(item.rate || 0),
        newRate: Number(item.rate || 0),
        rateDelta: 0,
        totalDelta: 0,
        confidence: 0.96,
        blocked: true,
        blockReason: architectLocked
          ? "Architect explicit requirement detected"
          : "Architect requirement detected",
        qualityValidation: "Retained current specification to avoid quality/safety compromise",
        source: "heuristic",
      };
    });

  const actionableItems = validItems.filter((item) => {
    const itemName = String(item.item || "");
    return !isArchitectLockedByText(itemName);
  });

  const llmCandidates = actionableItems
    .sort((a, b) => {
      const aZero = Number(a.rate || 0) <= 0;
      const bZero = Number(b.rate || 0) <= 0;
      if (aZero !== bZero) {
        return aZero ? -1 : 1;
      }
      return Number(b.total || 0) - Number(a.total || 0);
    })
    .slice(0, 20);

  const llmResult = await generateLlmSuggestions(
    targetTotal,
    currentTotal,
    llmCandidates,
    selectedGuardrails,
    projectContext
  );
  let llmSuggestions = llmResult.suggestions;

  const zeroRateItems = actionableItems.filter((item) => Number(item.rate || 0) <= 0);
  const getMissingZeroRateItems = () => {
    const covered = new Set(
      llmSuggestions
        .filter((suggestion) => Number.isFinite(suggestion.suggestedRate) && suggestion.suggestedRate > 0)
        .map((suggestion) => suggestion.boqItemId)
    );
    return zeroRateItems.filter((item) => !covered.has(item.id));
  };

  let missingZeroRateItems = getMissingZeroRateItems();
  if (missingZeroRateItems.length > 0) {
    const zeroRateRetry = await generateLlmSuggestions(
      targetTotal,
      currentTotal,
      missingZeroRateItems,
      selectedGuardrails,
      projectContext,
      { zeroRateOnly: true }
    );

    if (zeroRateRetry.suggestions.length > 0) {
      llmSuggestions = [...llmSuggestions, ...zeroRateRetry.suggestions];
    }

    missingZeroRateItems = getMissingZeroRateItems();
  }

  if (hardFail && actionableItems.length > 0) {
    if (!llmResult.configured) {
      throw new Error("Hard fail enabled: GEMINI_API_KEY / GOOGLE_AI_API_KEY is missing; cannot run LLM optimization");
    }

    if (!llmResult.attempted) {
      throw new Error("Hard fail enabled: LLM optimization was not attempted");
    }

    if (llmSuggestions.length === 0) {
      throw new Error(
        `Hard fail enabled: LLM returned no valid optimization suggestions (${llmResult.failureReason || "unknown_error"})`
      );
    }

    if (missingZeroRateItems.length > 0) {
      throw new Error(
        `Hard fail enabled: LLM did not return prescribed rates for zero-priced BOQ items (${missingZeroRateItems
          .map((item) => item.id)
          .join(",")})`
      );
    }
  }

  const llmByItem = new Map<number, LlmSuggestion[]>();
  llmSuggestions.forEach((suggestion) => {
    const existing = llmByItem.get(suggestion.boqItemId) || [];
    existing.push(suggestion);
    llmByItem.set(suggestion.boqItemId, existing);
  });

  const actionableSuggestions: OptimizationSuggestion[] = actionableItems.flatMap((item): OptimizationSuggestion[] => {
    const itemName = String(item.item || "");
    const llmOptions = llmByItem.get(item.id) || [];

    if (llmOptions.length > 0) {
      return llmOptions.slice(0, 2).map((option, index) => {
        const currentRate = Number(item.rate || 0);
        const maxReductionPct = getMaxReductionPct(item);
        const suggestedRate = Number(option.suggestedRate || currentRate);
        const normalizedNewRate = currentRate > 0
          ? Number(
              Math.min(currentRate, Math.max(currentRate * (1 - maxReductionPct), suggestedRate)).toFixed(2)
            )
          : Number(Math.max(0, suggestedRate).toFixed(2));
        const rateDelta = Number((normalizedNewRate - currentRate).toFixed(2));
        const baseTotalDelta = rateDelta * Number(item.qty || 0);
        const totalDelta = Number((baseTotalDelta * getGrandImpactMultiplier(item, marginConfig)).toFixed(2));

        return {
          suggestionId: `opt-${item.id}-llm-${index + 1}`,
          boqItemId: item.id,
          itemDescription: itemName,
          priority: inferSuggestionPriority(item, option.reason, option.priority),
          type: option.type,
          reason: option.reason,
          oldRate: currentRate,
          newRate: normalizedNewRate,
          rateDelta,
          totalDelta,
          confidence: Number.isFinite(option.confidence)
            ? Math.max(0.5, Math.min(0.95, Number(option.confidence)))
            : 0.74,
          blocked: false,
          qualityValidation: option.qualityValidation,
          alternatives: option.alternatives || [],
          source: "llm",
        };
      });
    }

    if (hardFail) {
      throw new Error(`Hard fail enabled: missing LLM suggestion for BOQ item ${item.id}`);
    }

    if (Number(item.rate || 0) <= 0) {
      return [{
        suggestionId: `opt-${item.id}-missing-rate`,
        boqItemId: item.id,
        itemDescription: itemName,
        priority: "zero_rate_fill",
        type: inferSuggestionType(itemName),
        reason: "No LLM rate available for this zero-priced BOQ item. Please provide local market/base rate manually.",
        oldRate: 0,
        newRate: 0,
        rateDelta: 0,
        totalDelta: 0,
        confidence: 0.6,
        blocked: true,
        blockReason: "LLM did not return a valid rate for this item",
        qualityValidation: "Manual validation required before submission",
        alternatives: [],
        source: "heuristic",
      }];
    }

      const maxReductionPct = getMaxReductionPct(item);
      const currentRate = Number(item.rate || 0);
      const newRate = Number((currentRate * (1 - maxReductionPct)).toFixed(2));
      const rateDelta = Number((newRate - currentRate).toFixed(2));
      const baseTotalDelta = rateDelta * Number(item.qty || 0);
      const totalDelta = Number((baseTotalDelta * getGrandImpactMultiplier(item, marginConfig)).toFixed(2));

      return [{
        suggestionId: `opt-${item.id}-heuristic`,
        boqItemId: item.id,
        itemDescription: itemName,
        priority: inferSuggestionPriority(item, "location and target alignment heuristic"),
        type: inferSuggestionType(itemName),
        reason:
          "Consider equivalent compliant alternative to reduce cost without changing mandatory quality requirements",
        oldRate: currentRate,
        newRate,
        rateDelta,
        totalDelta,
        confidence: 0.72,
        blocked: false,
        qualityValidation: "Rule-based check passed; verify brand/spec compliance before acceptance",
        alternatives: [],
        source: "heuristic",
      }];
    });

  const actionable = actionableSuggestions
    .filter((s) => !s.blocked && s.totalDelta < 0 && s.oldRate > 0)
    .sort((a, b) => a.totalDelta - b.totalDelta);

  const zeroRateFillSuggestions = actionableSuggestions
    .filter((s) => !s.blocked && s.oldRate <= 0 && s.newRate > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const selected: OptimizationSuggestion[] = [];
  const zeroFilled = new Set<number>();
  zeroRateFillSuggestions.forEach((suggestion) => {
    if (zeroFilled.has(suggestion.boqItemId)) {
      return;
    }
    selected.push(suggestion);
    zeroFilled.add(suggestion.boqItemId);
  });

  let accumulatedSavings = 0;
  const neededSavings = Math.max(gapToClose, 0);

  for (const suggestion of actionable) {
    selected.push(suggestion);
    accumulatedSavings += Math.abs(suggestion.totalDelta);

    if (neededSavings > 0 && accumulatedSavings >= neededSavings) {
      break;
    }
  }

  const minimumSuggestionsNeededForZeroRateCoverage = selected.filter(
    (suggestion) => suggestion.priority === "zero_rate_fill"
  ).length;
  const maxSuggestions = Math.max(12, minimumSuggestionsNeededForZeroRateCoverage);
  const finalSuggestions = [
    ...selected,
    ...blockedSuggestions.slice(0, Math.max(0, maxSuggestions - selected.length)),
  ].slice(0, maxSuggestions);

  const llmUsed = finalSuggestions.some((suggestion) => suggestion.source === "llm");
  const expenseRecommendations = await generateExpenseRecommendations(pricedItems, projectContext);

  return {
    currentTotal,
    targetTotal,
    gapToClose,
    potentialSavings: actionable.reduce((sum, s) => sum + Math.abs(s.totalDelta), 0),
    suggestionEngine: llmUsed ? "llm" : "heuristic",
    llmUsed,
    llmAttempted: llmResult.attempted,
    llmConfigured: llmResult.configured,
    llmCandidateCount: llmCandidates.length,
    llmSuggestionCount: llmSuggestions.length,
    llmFailureReason: llmResult.failureReason || null,
    llmModel: llmResult.model,
    hardFail,
    marginConfig,
    suggestions: finalSuggestions,
    expenseRecommendations,
  };
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
  notes?: string,
  basicMaterialCost?: number | null
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

    // Get latest revision snapshot for change tracking
    const latestRevisionResult = await client.query(
      `SELECT revision_number, pricing_snapshot, grand_total
       FROM estimate_revisions
       WHERE estimate_id = $1
       ORDER BY revision_number DESC
       LIMIT 1`,
      [estimateId]
    );
    const latestRevision = latestRevisionResult.rows[0] || null;

    // Get next revision number
    const revResult = await client.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_rev
       FROM estimate_revisions
       WHERE estimate_id = $1`,
      [estimateId]
    );
    const revisionNumber = revResult.rows[0].next_rev;

    const normalizedMarginConfig = normalizeMarginConfig(marginConfig);
    const normalizedBasicMaterialCost = Number(basicMaterialCost);
    const persistedBasicMaterialCost = Number.isFinite(normalizedBasicMaterialCost)
      ? Math.max(0, normalizedBasicMaterialCost)
      : null;
    const persistedMarginConfig = {
      ...marginConfig,
      basicMaterialCost: persistedBasicMaterialCost,
    };
    const cleanedNotes = String(notes || "").trim();
    const finalNotes = cleanedNotes
      ? cleanedNotes
      : await buildAutoRevisionNotes(
          revisionNumber,
          latestRevision?.pricing_snapshot || null,
          pricedItems,
          toNumber(latestRevision?.grand_total),
          toNumber(grandTotal),
          normalizedMarginConfig
        );

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
        JSON.stringify(persistedMarginConfig),
        grandTotal,
        finalNotes || null,
      ]
    );

    // Update estimate to submitted status
    await client.query(
      `UPDATE estimates SET status = 'submitted' WHERE id = $1`,
      [estimateId]
    );

    const informationalAlerts: Array<{
      type: "previous_project_unit_price_increase";
      title: string;
      message: string;
      thresholdPercent: number;
      itemCount: number;
      previousProjectId: string;
      previousProjectName: string;
      maxIncreasePercent: number;
      items: PreviousProjectRateIncreaseItem[];
    }> = [];

    // Audit log
    const deviationThresholdPercent = resolveDeviationThresholdPercent();
    const deviationItems = await detectMarketDeviations(client, pricedItems, deviationThresholdPercent);

    const previousProjectIncreaseThresholdPercent = resolvePreviousProjectIncreaseThresholdPercent();
    const previousProjectIncreases = await detectPreviousProjectRateIncreases(
      client,
      builderOrgId,
      projectId,
      pricedItems,
      previousProjectIncreaseThresholdPercent
    );

    if (previousProjectIncreases.items.length > 0) {
      const maxIncreasePercent = Math.max(
        ...previousProjectIncreases.items.map((item) => Number(item.increasePercent || 0))
      );
      const previousProjectName = previousProjectIncreases.previousProjectName || "previous project";
      const infoMessage = `${previousProjectIncreases.items.length} material unit rate(s) increased by more than ${previousProjectIncreaseThresholdPercent}% compared to ${previousProjectName}. This is informational only.`;

      informationalAlerts.push({
        type: "previous_project_unit_price_increase",
        title: "Informational Price Increase Alert",
        message: infoMessage,
        thresholdPercent: previousProjectIncreaseThresholdPercent,
        itemCount: previousProjectIncreases.items.length,
        previousProjectId: previousProjectIncreases.previousProjectId,
        previousProjectName,
        maxIncreasePercent,
        items: previousProjectIncreases.items.slice(0, 25),
      });

      try {
        await client.query(
          `INSERT INTO notifications (user_id, message, metadata)
           VALUES ($1, $2, $3::jsonb)`,
          [
            userId,
            infoMessage,
            JSON.stringify({
              type: "builder_previous_project_price_increase_info",
              canIgnore: true,
              thresholdPercent: previousProjectIncreaseThresholdPercent,
              projectId,
              estimateId,
              revisionNumber,
              previousProjectId: previousProjectIncreases.previousProjectId,
              previousProjectName,
              maxIncreasePercent,
              itemCount: previousProjectIncreases.items.length,
              items: previousProjectIncreases.items.slice(0, 25),
            }),
          ]
        );
      } catch (notifyError: any) {
        if (notifyError?.code !== "42P01") {
          throw notifyError;
        }
      }

      await client.query(
        `INSERT INTO audit_logs (project_id, user_id, action, metadata)
         VALUES ($1, $2, 'BUILDER_PREVIOUS_PROJECT_PRICE_INCREASE_INFO', $3::jsonb)`,
        [
          projectId,
          userId,
          JSON.stringify({
            estimateId,
            revisionNumber,
            thresholdPercent: previousProjectIncreaseThresholdPercent,
            previousProjectId: previousProjectIncreases.previousProjectId,
            previousProjectName,
            itemCount: previousProjectIncreases.items.length,
            maxIncreasePercent,
          }),
        ]
      );
    }

    if (deviationItems.length > 0) {
      const projectRes = await client.query(
        `SELECT name FROM projects WHERE id = $1 LIMIT 1`,
        [projectId]
      );
      const projectName = String(projectRes.rows[0]?.name || "Project");
      const maxDeviationPercent = Math.max(...deviationItems.map((item) => Number(item.deviationPercent || 0)));
      const maxAboveDeviationPercent = Math.max(
        0,
        ...deviationItems
          .filter((item) => item.deviationDirection === "above_market")
          .map((item) => Number(item.deviationPercent || 0))
      );
      const maxBelowDeviationPercent = Math.max(
        0,
        ...deviationItems
          .filter((item) => item.deviationDirection === "below_market")
          .map((item) => Number(item.deviationPercent || 0))
      );
      const aboveMarketCount = deviationItems.filter((item) => item.deviationDirection === "above_market").length;
      const belowMarketCount = deviationItems.filter((item) => item.deviationDirection === "below_market").length;
      const deviationDirection =
        aboveMarketCount > 0 && belowMarketCount > 0
          ? "mixed"
          : belowMarketCount > 0
            ? "below_market"
            : "above_market";

      const deviationMetadata = {
        projectId,
        projectName,
        estimateId,
        revisionNumber,
        builderOrgId,
        thresholdPercent: deviationThresholdPercent,
        deviationCount: deviationItems.length,
        maxDeviationPercent,
        maxAboveDeviationPercent,
        maxBelowDeviationPercent,
        aboveMarketCount,
        belowMarketCount,
        deviationDirection,
        items: deviationItems.slice(0, 25),
      };

      await client.query(
        `INSERT INTO audit_logs (project_id, user_id, action, metadata)
         VALUES ($1, $2, 'ESTIMATE_MARKET_DEVIATION_ALERT', $3)`,
        [projectId, userId, JSON.stringify(deviationMetadata)]
      );

      try {
        const admins = await client.query(
          `SELECT id
           FROM users
           WHERE role = 'admin'
             AND COALESCE(is_active, true) = true`
        );

        const directionMessage =
          deviationDirection === "below_market"
            ? "below"
            : deviationDirection === "mixed"
              ? "above/below"
              : "above";
        const message = `Market deviation alert: ${deviationItems.length} item(s) deviated ${directionMessage} market benchmark by >= ${deviationThresholdPercent}% for ${projectName}.`;
        for (const row of admins.rows || []) {
          await client.query(
            `INSERT INTO notifications (user_id, message, metadata)
             VALUES ($1, $2, $3::jsonb)`,
            [row.id, message, JSON.stringify({
              type: "estimate_market_deviation",
              projectId,
              estimateId,
              revisionNumber,
              deviationCount: deviationItems.length,
              maxDeviationPercent,
              maxAboveDeviationPercent,
              maxBelowDeviationPercent,
              aboveMarketCount,
              belowMarketCount,
              deviationDirection,
            })]
          );
        }
      } catch (notifyError: any) {
        // If notifications table/module is unavailable, keep submission successful.
        if (notifyError?.code !== "42P01") {
          throw notifyError;
        }
      }
    }

    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'ESTIMATE_SUBMITTED', $3)`,
      [projectId, userId, JSON.stringify({ estimateId, revisionNumber })]
    );

    await persistBuilderAddedItemsToBasePricing(client, builderOrgId, pricedItems);

    await client.query("COMMIT");

    return {
      estimateId,
      revisionNumber,
      subtotalWithUplifts,
      grandTotal,
      informationalAlerts,
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
       ao.name AS architect_designer_org_name,
       er.id AS revision_id,
       er.revision_number,
       rev_stats.revision_count,
       er.grand_total,
       er.submitted_at,
       er.notes,
       review.action AS latest_review_action,
       review.metadata AS latest_review_metadata,
       review.created_at AS latest_review_at,
       COALESCE(
         (er.margin_config->>'overallMargin')::numeric,
         (er.margin_config->>'marginPercent')::numeric,
         0
       ) AS margin_percent
     FROM estimates e
     JOIN projects p ON p.id = e.project_id
     LEFT JOIN users architect_user ON architect_user.id = p.architect_id
     LEFT JOIN organizations ao ON ao.id = architect_user.organization_id
     JOIN LATERAL (
       SELECT id, revision_number, grand_total, submitted_at, notes, margin_config
       FROM estimate_revisions
       WHERE estimate_id = e.id
       ORDER BY revision_number DESC
       LIMIT 1
     ) er ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS revision_count
       FROM estimate_revisions rr
       WHERE rr.estimate_id = e.id
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
     WHERE e.builder_org_id = $1
       AND e.status = 'submitted'
     ORDER BY er.submitted_at DESC NULLS LAST, e.created_at DESC`,
    [builderOrgId]
  );

  return result.rows.map((row: any) => {
    const metadata = row.latest_review_metadata || {};
    let reviewStatus: string | null = null;
    if (row.latest_review_action === "ESTIMATE_RESUBMISSION_REQUEST") {
      reviewStatus = "changes_requested";
    } else if (row.latest_review_action === "ESTIMATE_REVIEW_APPROVED") {
      reviewStatus = "approved";
    } else if (row.latest_review_action === "ESTIMATE_REVIEW_COMMENT") {
      reviewStatus = "commented";
    }

    return {
      ...row,
      latest_review_status: reviewStatus,
      latest_review_comment: metadata?.comment || null,
      latest_review_revision_id: metadata?.revisionId || null,
    };
  });
}

export async function getBuilderEstimateHistory(builderOrgId: string, estimateId: string) {
  const estimateRes = await pool.query(
    `SELECT e.id AS estimate_id, e.project_id, e.status, p.name AS project_name
     FROM estimates e
     JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1 AND e.builder_org_id = $2
     LIMIT 1`,
    [estimateId, builderOrgId]
  );

  if (!estimateRes.rows.length) {
    throw new Error("Estimate not found");
  }

  const estimate = estimateRes.rows[0];

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
    `SELECT id, action, metadata, created_at
     FROM audit_logs
     WHERE project_id = $1
       AND action IN ('ESTIMATE_REVIEW_COMMENT','ESTIMATE_RESUBMISSION_REQUEST','ESTIMATE_REVIEW_APPROVED')
       AND (metadata->>'estimateId') = $2
     ORDER BY created_at ASC`,
    [estimate.project_id, estimateId]
  );

  const reviews = reviewsRes.rows.map((row: any) => ({
    id: row.id,
    action: row.action,
    status:
      row.action === "ESTIMATE_RESUBMISSION_REQUEST"
        ? "changes_requested"
        : row.action === "ESTIMATE_REVIEW_APPROVED"
          ? "approved"
          : "commented",
    comment: row.metadata?.comment || null,
    revision_id: row.metadata?.revisionId || null,
    created_at: row.created_at,
  }));

  return {
    estimate,
    revisionCount: revisionsRes.rows.length,
    revisions: revisionsRes.rows,
    reviews,
  };
}

// ─────────────────────────────────────────────────
// BUILDER PROFILE
// ─────────────────────────────────────────────────

export interface BuilderProfileData {
  companyName?: string | null;
  contactPhone?: string | null;
  serviceLocations?: string | null;
  specialties?: string | null;
  pastProjects?: string | null;
  portfolioLinks?: string | null;
  portfolioPhotos?: string[] | null;
  teamSize?: number | null;
  minProjectBudget?: number | null;
  isVisibleToArchitects?: boolean;
}

function isProfileComplete(row: any): boolean {
  return Boolean(
    row &&
    String(row.company_name || "").trim() &&
    String(row.contact_phone || "").trim() &&
    String(row.service_locations || "").trim() &&
    String(row.specialties || "").trim()
  );
}

export async function getBuilderProfile(userId: string) {
  const res = await pool.query(
    `SELECT * FROM builder_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const row = res.rows[0] || null;
  return row
    ? {
        id: row.id,
        userId: row.user_id,
        companyName: row.company_name,
        contactPhone: row.contact_phone,
        serviceLocations: row.service_locations,
        specialties: row.specialties,
        pastProjects: row.past_projects,
        portfolioLinks: row.portfolio_links,
        portfolioPhotos: Array.isArray(row.portfolio_photos) ? row.portfolio_photos : [],
        teamSize: row.team_size,
        minProjectBudget: row.min_project_budget,
        isVisibleToArchitects: row.is_visible_to_architects,
        profileComplete: isProfileComplete(row),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export async function upsertBuilderProfile(userId: string, data: BuilderProfileData) {
  const existing = await pool.query(
    `SELECT id FROM builder_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  let row: any;

  if (existing.rows.length === 0) {
    const res = await pool.query(
      `INSERT INTO builder_profiles
         (user_id, company_name, contact_phone, service_locations, specialties,
          past_projects, portfolio_links, portfolio_photos, team_size, min_project_budget, is_visible_to_architects)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        userId,
        data.companyName ?? null,
        data.contactPhone ?? null,
        data.serviceLocations ?? null,
        data.specialties ?? null,
        data.pastProjects ?? null,
        data.portfolioLinks ?? null,
        data.portfolioPhotos ?? [],
        data.teamSize ?? null,
        data.minProjectBudget ?? null,
        data.isVisibleToArchitects ?? false,
      ]
    );
    row = res.rows[0];
  } else {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const mapping: Array<[keyof BuilderProfileData, string]> = [
      ["companyName", "company_name"],
      ["contactPhone", "contact_phone"],
      ["serviceLocations", "service_locations"],
      ["specialties", "specialties"],
      ["pastProjects", "past_projects"],
      ["portfolioLinks", "portfolio_links"],
      ["portfolioPhotos", "portfolio_photos"],
      ["teamSize", "team_size"],
      ["minProjectBudget", "min_project_budget"],
      ["isVisibleToArchitects", "is_visible_to_architects"],
    ];

    for (const [key, col] of mapping) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        params.push(data[key] ?? null);
      }
    }

    if (fields.length === 0) {
      const unchanged = await pool.query(
        `SELECT * FROM builder_profiles WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      row = unchanged.rows[0];
    } else {
      fields.push(`updated_at = NOW()`);
      params.push(userId);
      const res = await pool.query(
        `UPDATE builder_profiles SET ${fields.join(", ")} WHERE user_id = $${idx} RETURNING *`,
        params
      );
      row = res.rows[0];
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    contactPhone: row.contact_phone,
    serviceLocations: row.service_locations,
    specialties: row.specialties,
    pastProjects: row.past_projects,
    portfolioLinks: row.portfolio_links,
    portfolioPhotos: Array.isArray(row.portfolio_photos) ? row.portfolio_photos : [],
    teamSize: row.team_size,
    minProjectBudget: row.min_project_budget,
    isVisibleToArchitects: row.is_visible_to_architects,
    profileComplete: isProfileComplete(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists builder profiles visible to an architect's organization.
 * Returns builders who have is_visible_to_architects = true and belong to
 * organizations that have an accepted invite relationship to the architect's org.
 */
export async function listBuilderProfilesForOrg(architectOrgId: string) {
  const res = await pool.query(
    `SELECT
       u.id AS user_id,
       u.email,
       bp.id,
       bp.company_name,
       bp.contact_phone,
       bp.service_locations,
       bp.specialties,
       bp.past_projects,
       bp.portfolio_links,
      bp.portfolio_photos,
       bp.team_size,
       bp.min_project_budget,
       bp.updated_at
     FROM builder_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.is_visible_to_architects = true
       AND (
         -- builders who accepted an invite from this organization
         u.id IN (
           SELECT ui.user_id
           FROM user_invites ui
           WHERE ui.organization_id = $1
             AND ui.role = 'builder'
             AND ui.accepted_at IS NOT NULL
             AND ui.user_id IS NOT NULL
         )
         OR
         -- builders whose org was invited via builder_invitations
         u.organization_id IN (
           SELECT bi.builder_org_id
           FROM builder_invitations bi
           WHERE bi.status = 'accepted'
             AND bi.project_id IN (
               SELECT id FROM projects WHERE architect_id IN (
                 SELECT id FROM users WHERE organization_id = $1 AND role = 'architect'
               )
             )
         )
       )
     ORDER BY bp.updated_at DESC`,
    [architectOrgId]
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    companyName: row.company_name,
    contactPhone: row.contact_phone,
    serviceLocations: row.service_locations,
    specialties: row.specialties,
    pastProjects: row.past_projects,
    portfolioLinks: row.portfolio_links,
    portfolioPhotos: Array.isArray(row.portfolio_photos) ? row.portfolio_photos : [],
    teamSize: row.team_size,
    minProjectBudget: row.min_project_budget,
    updatedAt: row.updated_at,
  }));
}
