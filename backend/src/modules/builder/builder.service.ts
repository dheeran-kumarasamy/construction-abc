import { pool } from "../../config/db";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

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

function getConfiguredLlmModel() {
  return process.env.LLM_MODEL || "gpt-4o-mini";
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
      
      return {
        id: index + 1,
        item: String(item.item || "").trim(),
        qty,
        uom: String(item.uom || "").trim(),
        rate: 0,
        total: 0,
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

function getMaxReductionPct(item: OptimizationInputItem) {
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

async function generateLlmSuggestions(
  targetTotal: number,
  currentTotal: number,
  candidateItems: OptimizationInputItem[]
): Promise<LlmGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const model = getConfiguredLlmModel();

  if (!apiKey || candidateItems.length === 0) {
    return {
      suggestions: [],
      attempted: false,
      configured: Boolean(apiKey),
      model,
      failureReason: !apiKey ? "missing_api_key" : "no_actionable_items",
    };
  }

  try {
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      temperature: 0.15,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "boq_optimization_suggestions",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    boqItemId: { type: "number" },
                    type: {
                      type: "string",
                      enum: ["brand_swap", "finish_change", "spec_variant", "vendor_switch"],
                    },
                    suggestedRate: { type: "number" },
                    reason: { type: "string" },
                    confidence: { type: "number" },
                    qualityValidation: { type: "string" },
                    alternatives: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "boqItemId",
                    "type",
                    "suggestedRate",
                    "reason",
                    "confidence",
                    "qualityValidation",
                    "alternatives",
                  ],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a construction cost optimization assistant. Suggest lower-cost but compliant alternatives. Never compromise safety, quality, statutory code compliance, or architect-mandated specs. Prefer realistic brand/vendor/finish alternatives with revised rates.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetTotal,
            currentTotal,
            objective:
              "Reduce overall estimate toward target by suggesting revised unit rates for specific BOQ items using equivalent alternatives.",
            pricingGuidelines: [
              "If current item is a premium brand/spec, suggest equivalent mainstream alternative when quality remains compliant.",
              "Example style: Tata Steel @80/kg -> JSW Steel @75/kg when grade/spec remains equivalent.",
              "Do not suggest any rate increase.",
              "Keep suggestions practical and procurement-friendly.",
            ],
            outputRules: [
              "Return suggestions only for provided boqItemId values.",
              "Each suggestedRate must be > 0 and <= currentRate.",
              "Confidence must be between 0 and 1.",
              "Include short qualityValidation proving no quality compromise.",
              "Provide 1-3 alternatives as plain text.",
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
          }),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.error("LLM suggestion API error: empty completion content");
      return {
        suggestions: [],
        attempted: true,
        configured: true,
        model,
        failureReason: "empty_completion_content",
      };
    }

    const parsed = extractJsonPayload(String(content || ""));
    const suggestions: any[] = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const normalized = suggestions
      .map((s: any) => ({
        boqItemId: Number(s?.boqItemId),
        type: String(s?.type || "spec_variant") as OptimizationSuggestion["type"],
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
      model,
      failureReason: normalized.length === 0 ? "empty_or_invalid_llm_output" : undefined,
    };
  } catch (error) {
    console.error("LLM suggestion parse/generation failed:", error);
    return {
      suggestions: [],
      attempted: true,
      configured: true,
      model,
      failureReason: "request_exception",
    };
  }
}

export async function suggestTargetOptimizations(
  projectId: string,
  userId: string,
  targetTotal: number,
  pricedItems: OptimizationInputItem[],
  marginConfigInput?: Partial<MarginConfig>,
  hardFailInput?: boolean
) {
  await assertBuilderProjectAccess(userId, projectId);

  const marginConfig = normalizeMarginConfig(marginConfigInput);
  const hardFail =
    hardFailInput === true || String(process.env.LLM_HARD_FAIL || "").toLowerCase() === "true";

  if (!Number.isFinite(targetTotal) || targetTotal <= 0) {
    throw new Error("Target total must be a positive number");
  }

  const currentTotal = calculateGrandTotal(pricedItems, marginConfig);
  const gapToClose = currentTotal - targetTotal;

  const validItems = pricedItems.filter((item) => Number(item.qty || 0) > 0 && Number(item.rate || 0) > 0);

  const blockedSuggestions: OptimizationSuggestion[] = validItems
    .filter((item) => {
      const itemName = String(item.item || "");
      const architectLocked = isArchitectLockedByText(itemName);
      const qualityCritical = isQualityCritical(itemName);
      return architectLocked || qualityCritical;
    })
    .map((item) => {
      const itemName = String(item.item || "");
      const architectLocked = isArchitectLockedByText(itemName);

      return {
        suggestionId: `opt-${item.id}-blocked`,
        boqItemId: item.id,
        type: inferSuggestionType(itemName),
        reason: "No pricing tweak proposed due to quality/architect guardrails",
        oldRate: Number(item.rate || 0),
        newRate: Number(item.rate || 0),
        rateDelta: 0,
        totalDelta: 0,
        confidence: 0.96,
        blocked: true,
        blockReason: architectLocked
          ? "Architect explicit requirement detected"
          : "Quality-critical item protected by guardrail",
        qualityValidation: "Retained current specification to avoid quality/safety compromise",
        source: "heuristic",
      };
    });

  const actionableItems = validItems.filter((item) => {
    const itemName = String(item.item || "");
    return !isArchitectLockedByText(itemName) && !isQualityCritical(itemName);
  });

  const llmCandidates = actionableItems
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .slice(0, 10);

  const llmResult = await generateLlmSuggestions(targetTotal, currentTotal, llmCandidates);
  const llmSuggestions = llmResult.suggestions;

  if (hardFail && actionableItems.length > 0) {
    if (!llmResult.configured) {
      throw new Error("Hard fail enabled: OPENAI_API_KEY is missing; cannot run LLM optimization");
    }

    if (!llmResult.attempted) {
      throw new Error("Hard fail enabled: LLM optimization was not attempted");
    }

    if (llmSuggestions.length === 0) {
      throw new Error(
        `Hard fail enabled: LLM returned no valid optimization suggestions (${llmResult.failureReason || "unknown_error"})`
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
        const minimumAllowedRate = currentRate * (1 - maxReductionPct);
        const normalizedNewRate = Number(
          Math.min(currentRate, Math.max(minimumAllowedRate, Number(option.suggestedRate || currentRate))).toFixed(2)
        );
        const rateDelta = Number((normalizedNewRate - currentRate).toFixed(2));
        const baseTotalDelta = rateDelta * Number(item.qty || 0);
        const totalDelta = Number((baseTotalDelta * getGrandImpactMultiplier(item, marginConfig)).toFixed(2));

        return {
          suggestionId: `opt-${item.id}-llm-${index + 1}`,
          boqItemId: item.id,
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

      const maxReductionPct = getMaxReductionPct(item);
      const currentRate = Number(item.rate || 0);
      const newRate = Number((currentRate * (1 - maxReductionPct)).toFixed(2));
      const rateDelta = Number((newRate - currentRate).toFixed(2));
      const baseTotalDelta = rateDelta * Number(item.qty || 0);
      const totalDelta = Number((baseTotalDelta * getGrandImpactMultiplier(item, marginConfig)).toFixed(2));

      return [{
        suggestionId: `opt-${item.id}-heuristic`,
        boqItemId: item.id,
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
    .filter((s) => !s.blocked && s.totalDelta < 0)
    .sort((a, b) => a.totalDelta - b.totalDelta);

  const selected: OptimizationSuggestion[] = [];
  let accumulatedSavings = 0;
  const neededSavings = Math.max(gapToClose, 0);

  for (const suggestion of actionable) {
    selected.push(suggestion);
    accumulatedSavings += Math.abs(suggestion.totalDelta);

    if (neededSavings > 0 && accumulatedSavings >= neededSavings) {
      break;
    }
  }

  const maxSuggestions = 12;
  const finalSuggestions = [
    ...selected,
    ...blockedSuggestions.slice(0, Math.max(0, maxSuggestions - selected.length)),
  ].slice(0, maxSuggestions);

  const llmUsed = finalSuggestions.some((suggestion) => suggestion.source === "llm");

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
