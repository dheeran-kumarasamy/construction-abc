

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import * as api from "./estimation.api";
import type { BOQProject, RateTemplate } from "./types";
import { useAuth } from "../../auth/AuthContext";
import { formatINR } from "../../services/currency";
import { formatDate } from "../../services/dateTime";

const RESIDENTIAL_TEMPLATE_URL = new URL("../../data/boq-residential.json", import.meta.url).href;
const COMMERCIAL_TEMPLATE_URL = new URL("../../data/boq-commercial.json", import.meta.url).href;
const INDUSTRIAL_TEMPLATE_URL = new URL("../../data/boq-Industrial.json", import.meta.url).href;
const BOQ_DRAFT_STORAGE_PREFIX = "boq_workspace_draft:";

type BoqTemplateKind = "residential" | "commercial" | "industrial";

type BOQDraft = {
  rows: BOQRow[];
  savedAt: number;
};

function getDraftStorageKey(projectId: string) {
  return `${BOQ_DRAFT_STORAGE_PREFIX}${projectId}`;
}

function hasMeaningfulDraftRows(rows: BOQRow[]) {
  return rows.some((row) => {
    const quantity = String(row.quantity || "").trim();
    if ("customId" in row) {
      const name = String(row.customName || "").trim();
      return Boolean(name || quantity);
    }

    return Boolean(quantity);
  });
}

function readDraft(projectId: string): BOQDraft | null {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BOQDraft>;
    if (!Array.isArray(parsed.rows) || typeof parsed.savedAt !== "number") return null;
    return { rows: parsed.rows as BOQRow[], savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeDraft(projectId: string, rows: BOQRow[]) {
  const payload: BOQDraft = {
    rows,
    savedAt: Date.now(),
  };
  localStorage.setItem(getDraftStorageKey(projectId), JSON.stringify(payload));
}

function clearDraft(projectId: string) {
  localStorage.removeItem(getDraftStorageKey(projectId));
}


type BOQRow =
  | { template: RateTemplate; quantity: string; uom: string; rate?: number; amount?: number }
  | {
      customId: string;
      customName: string;
      stageName?: string;
      source?: "architect_standard" | "architect_additional";
      quantity: string;
      uom: string;
      rate?: number;
      amount?: number;
    };

function resolveBoqApiProjectId(
  routeProjectId: string | undefined,
  project: BOQProject | null
) {
  if (!routeProjectId) return "";

  const projectAny = project as BOQProject & { source_project_id?: string | null };
  const sourceProjectId = String(projectAny?.source_project_id || "").trim();
  if (sourceProjectId) return sourceProjectId;

  const notes = String(project?.notes || "");
  const marker = notes.match(/source_project_id:([0-9a-fA-F-]{36})/);
  if (marker?.[1]) return marker[1];

  // If route id already points to a source project (legacy path), keep using it.
  // If route id equals the BOQ workspace id and no source mapping exists, do not
  // call /api/boq with an unmapped ID (it will always 403).
  if (project?.id && project.id !== routeProjectId) {
    return routeProjectId;
  }

  return "";
}

// Residential project stage sequence
const RESIDENTIAL_STAGE_SEQUENCE = [
  "Basement",
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Terrace",
  "OHT",
  "Compound",
  "Finishing & Misc",
] as const;

// Commercial project stage sequence
const COMMERCIAL_STAGE_SEQUENCE = [
  "Basement",
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "UG Sump",
  "Septic Tank",
  "Overhead Tank",
  "Elevator",
] as const;

// Define floor stage info per project type
interface FloorStageConfig {
  named: readonly string[]; // Named floor stages in order (e.g., ["Ground Floor", "First Floor", ...])
  basement?: string; // Optional basement stage
  templateStage: string; // Stage to clone for floors > length(named)
  nonFloorStages: readonly string[]; // Stages that come after all floors
}

const FLOOR_STAGE_CONFIG: Record<BoqTemplateKind, FloorStageConfig> = {
  residential: {
    named: ["Ground Floor", "First Floor", "Second Floor", "Third Floor"],
    basement: "Basement",
    templateStage: "Third Floor",
    nonFloorStages: ["Terrace", "OHT", "Compound", "Finishing & Misc"],
  },
  commercial: {
    named: ["Ground Floor", "First Floor", "Second Floor", "Third Floor"],
    basement: "Basement",
    templateStage: "Third Floor",
    nonFloorStages: ["UG Sump", "Septic Tank", "Overhead Tank", "Elevator"],
  },
  industrial: {
    named: ["Ground Floor Civil Works - Note: Rates are without GST"],
    templateStage: "", // No cloning for industrial (single floor)
    nonFloorStages: [],
  },
};

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 0 ? rounded : null;
}

/**
 * Generate ordinal suffix for floor numbers >= 5
 * e.g., 5 → "4th", 6 → "5th", 21 → "21st", 22 → "22nd", 23 → "23rd", 24 → "24th"
 */
function getOrdinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  if (n % 10 === 1) return "st";
  if (n % 10 === 2) return "nd";
  if (n % 10 === 3) return "rd";
  return "th";
}

/**
 * Substitute the template floor name in a description string with the new floor name.
 * For floors > 4, replaces "Third floor" prefix with e.g., "4th Floor"
 */
function substituteFloorName(description: string, templateStageName: string, newFloorName: string): string {
  // Replace known floor prefixes: "Third floor", "Third Floor", "3rd floor", etc.
  const pattern = new RegExp(`^${templateStageName.replace(/\s+/g, "\\s+")}\\s+`, "i");
  if (pattern.test(description)) {
    return description.replace(pattern, `${newFloorName} `);
  }
  return description;
}

function filterTemplateRowsByProjectFloors(
  rows: BOQRow[],
  project: BOQProject | null,
  templateKind: BoqTemplateKind
): BOQRow[] {
  const aboveGround = toPositiveInteger(project?.floors_above_ground);
  const belowGround = toPositiveInteger(project?.floors_below_ground);

  // No floor metadata - return rows untouched
  if (aboveGround == null && belowGround == null) return rows;

  const config = FLOOR_STAGE_CONFIG[templateKind];
  const allFloorStages = new Set<string>();
  
  if (config.basement && (belowGround ?? 0) > 0) {
    allFloorStages.add(config.basement);
  }

  config.named.forEach((stage) => allFloorStages.add(stage));

  // 1. Filter rows to keep only the allowed floor stages (gate based on project floor count)
  const base = rows.filter((row) => {
    if (!("customId" in row)) return true;
    const stageName = String(row.stageName || "").trim();
    if (!allFloorStages.has(stageName)) return true;

    // For above-ground floors, only include up to the project's floor count
    if (config.basement && stageName === config.basement) {
      return (belowGround ?? 0) > 0;
    }

    // Check which named-floor index this is (0-based)
    const floorIdx = config.named.indexOf(stageName);
    if (floorIdx === -1) return true;
    // Keep this floor stage if floor number (floorIdx + 1) <= total above-ground floors
    return (floorIdx + 1) <= Math.max(1, aboveGround ?? 1);
  });

  // 2. Generate extra floors (> length of named floors above ground)
  const namedFloorCount = config.named.length;
  const totalAboveGround = Math.max(1, aboveGround ?? 1);

  if (totalAboveGround <= namedFloorCount || !config.templateStage) {
    // No extra floors needed, or can't clone for this project type
    return base;
  }

  // Find rows for the template stage to use for cloning
  const templateRows = base.filter(
    (row) =>
      "customId" in row &&
      String((row as any).stageName || "").trim() === config.templateStage
  );

  if (templateRows.length === 0) return base;

  const extra: BOQRow[] = [];

  // For floors beyond the named set: floors (namedFloorCount+1) through totalAboveGround
  for (let floorNum = namedFloorCount + 1; floorNum <= totalAboveGround; floorNum += 1) {
    // Generate stage name like "4th Floor", "5th Floor", etc.
    const ordinalNum = floorNum - 1; // e.g., floor 5 above ground = "4th Floor"
    const suffix = getOrdinalSuffix(ordinalNum);
    const stageName = `${ordinalNum}${suffix} Floor`;

    templateRows.forEach((sourceRow, idx) => {
      const src = sourceRow as {
        customId: string;
        customName: string;
        stageName?: string;
        source?: string;
        quantity: string;
        uom: string;
      };
      extra.push({
        customId: `extra-floor-${floorNum}-${idx}`,
        customName: substituteFloorName(src.customName, config.templateStage, stageName),
        stageName,
        source: "architect_standard",
        quantity: "",
        uom: src.uom,
        rate: undefined,
        amount: undefined,
      });
    });
  }

  // 3. Insert extra floors after the last named floor, before non-floor stages
  const nonFloorPivot = base.findIndex(
    (row) =>
      "customId" in row &&
      config.nonFloorStages.includes(String((row as any).stageName || ""))
  );

  if (nonFloorPivot === -1) {
    // No non-floor stages found, append extra floors at end
    return [...base, ...extra];
  }

  // Insert extra floors before the first non-floor stage
  return [
    ...base.slice(0, nonFloorPivot),
    ...extra,
    ...base.slice(nonFloorPivot),
  ];
}

function classifyResidentialStage(description: string) {
  const text = String(description || "").toLowerCase();

  if (/oht|overhead\s*tank|over\s*head\s*tank/.test(text)) {
    return "OHT";
  }

  if (/third\s*floor|3rd\s*floor/.test(text)) {
    return "Third Floor";
  }

  if (/second\s*floor|2nd\s*floor/.test(text)) {
    return "Second Floor";
  }

  if (/first\s*floor|1st\s*floor/.test(text)) {
    return "First Floor";
  }

  if (/terrace|roof|oht|waterproof/.test(text)) {
    return "Terrace";
  }

  if (/compound|gate|fenc|boundary|pavement|driveway/.test(text)) {
    return "Compound";
  }

  if (/basement|excavat|earth filling|footing|plinth|retaining/.test(text)) {
    return "Basement";
  }

  if (/electrical|plumbing|drain|sanitary|conduit|wiring|switch|fixture/.test(text)) {
    return "Electrical & Plumbing";
  }

  if (/plaster|paint|floor|tile|finishing|joinery|wood|door|window/.test(text)) {
    return "Finishing & Misc";
  }

  return "Ground Floor";
}

function normalizeBoqLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeBoqLabel(value: string) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "into", "over", "under", "per", "all", "work", "works", "item",
    "floor", "inch", "in", "of", "to", "at", "on", "or", "by", "a", "an",
  ]);

  return normalizeBoqLabel(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function computeTemplateMatchScore(sourceName: string, templateName: string) {
  const source = normalizeBoqLabel(sourceName);
  const target = normalizeBoqLabel(templateName);
  if (!source || !target) return 0;
  if (source === target) return 1;
  if (source.includes(target) || target.includes(source)) return 0.9;

  const sourceTokens = tokenizeBoqLabel(sourceName);
  const targetTokens = tokenizeBoqLabel(templateName);
  if (!sourceTokens.length || !targetTokens.length) return 0;

  const targetSet = new Set(targetTokens);
  const sourceSet = new Set(sourceTokens);

  let overlap = 0;
  sourceSet.forEach((token) => {
    if (targetSet.has(token)) overlap += 1;
  });

  if (!overlap) return 0;
  const precision = overlap / sourceSet.size;
  const recall = overlap / targetSet.size;
  return Number((0.6 * precision + 0.4 * recall).toFixed(4));
}

function findBestTemplateForItemName(itemName: string, templates: RateTemplate[]) {
  let best: RateTemplate | null = null;
  let bestScore = 0;

  for (const template of templates) {
    const score = computeTemplateMatchScore(itemName, template.name);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return bestScore >= 0.45 ? best : null;
}

function mapSubmittedItemsToRows(items: api.SubmittedBOQItem[], templates: RateTemplate[]): BOQRow[] {
  const templatesByName = new Map(templates.map((template) => [normalizeBoqLabel(template.name), template]));

  return items.map((item, index) => {
    const matchedTemplate = templatesByName.get(normalizeBoqLabel(item.item));
    if (matchedTemplate) {
      return {
        template: matchedTemplate,
        quantity: String(item.qty ?? ""),
        uom: item.uom || matchedTemplate.unit || "Nos",
        rate: undefined,
        amount: undefined,
      };
    }

    return {
      customId: `existing-${index}`,
      customName: item.item,
      source: item.source === "architect_standard" ? "architect_standard" : "architect_additional",
      quantity: String(item.qty ?? ""),
      uom: item.uom || "Nos",
      rate: undefined,
      amount: undefined,
    };
  });
}

function toSubmittedItem(row: BOQRow): api.SubmittedBOQItem | null {
  const quantity = String(row.quantity || "").trim();
  if (!quantity || Number.isNaN(Number(quantity))) {
    return null;
  }

  if ("customId" in row) {
    const item = String(row.customName || "").trim();
    return item
      ? {
          item,
          qty: quantity,
          uom: row.uom,
          source: row.source === "architect_standard" ? "architect_standard" : "architect_additional",
        }
      : null;
  }

  return {
    item: row.template.name,
    qty: quantity,
    uom: row.uom,
    source: "architect_standard",
  };
}

function isAuthMissingError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");
  return /missing or invalid authorization header|unauthorized|invalid token/i.test(message);
}

function resolveTemplateKind(
  searchTemplate: string | null,
  project: BOQProject | null
): BoqTemplateKind | null {
  const normalizedTemplate = String(searchTemplate || "").trim().toLowerCase();
  if (
    normalizedTemplate === "residential" ||
    normalizedTemplate === "commercial" ||
    normalizedTemplate === "industrial"
  ) {
    return normalizedTemplate as BoqTemplateKind;
  }

  const buildingType = String(project?.building_type || "")
    .trim()
    .toLowerCase();

  if (buildingType === "commercial") return "commercial";
  if (buildingType === "industrial") return "industrial";
  if (buildingType === "residential") return "residential";
  return null;
}

function formatProjectType(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function getTemplateUrl(kind: BoqTemplateKind) {
  if (kind === "commercial") return COMMERCIAL_TEMPLATE_URL;
  if (kind === "industrial") return INDUSTRIAL_TEMPLATE_URL;
  return RESIDENTIAL_TEMPLATE_URL;
}

function getTemplateLabel(kind: BoqTemplateKind) {
  if (kind === "commercial") return "commercial";
  if (kind === "industrial") return "industrial";
  return "residential";
}

async function loadBoqRowsFromTemplate(kind: BoqTemplateKind, project: BOQProject | null): Promise<BOQRow[]> {
  const response = await fetch(getTemplateUrl(kind));
  if (!response.ok) {
    throw new Error(`Failed to load ${getTemplateLabel(kind)} BOQ template`);
  }

  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`${getTemplateLabel(kind)} BOQ template file is empty`);
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`${getTemplateLabel(kind)} BOQ template JSON is invalid`);
  }
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const lineItems = rows
    .filter((row: any) => String(row?.type || "") === "line_item")
    .map((row: any, index: number) => ({
      id: index + 1,
      description: String(row?.description || "").trim(),
      unit: String(row?.unit || "Nos").trim() || "Nos",
      stage: String(row?.stage || "").trim(),
    }))
    .filter((row: { description: string }) => row.description.length > 0);

  const output: BOQRow[] = [];
  
  if (kind === "residential") {
    // For residential, group by stage and order using RESIDENTIAL_STAGE_SEQUENCE
    const grouped = new Map<string, Array<{ id: number; description: string; unit: string }>>();
    for (const stageName of RESIDENTIAL_STAGE_SEQUENCE) {
      grouped.set(stageName, []);
    }

    for (const item of lineItems) {
      const stage = item.stage || classifyResidentialStage(item.description);
      if (!grouped.has(stage)) grouped.set(stage, []);
      grouped.get(stage)!.push(item);
    }

    for (const stageName of RESIDENTIAL_STAGE_SEQUENCE) {
      const stageItems = grouped.get(stageName) || [];
      if (!stageItems.length) continue;

      for (const item of stageItems) {
        output.push({
          customId: `${kind}-${item.id}`,
          customName: item.description,
          stageName,
          source: "architect_standard",
          quantity: "",
          uom: item.unit,
          rate: undefined,
          amount: undefined,
        });
      }
    }
  } else if (kind === "commercial") {
    // For commercial, group by stage and order using COMMERCIAL_STAGE_SEQUENCE
    const grouped = new Map<string, Array<{ id: number; description: string; unit: string }>>();
    for (const stageName of COMMERCIAL_STAGE_SEQUENCE) {
      grouped.set(stageName, []);
    }

    for (const item of lineItems) {
      const stage = item.stage || "General";
      if (!grouped.has(stage)) grouped.set(stage, []);
      grouped.get(stage)!.push(item);
    }

    // Order: first use COMMERCIAL_STAGE_SEQUENCE, then any remaining stages
    for (const stageName of COMMERCIAL_STAGE_SEQUENCE) {
      const stageItems = grouped.get(stageName) || [];
      if (!stageItems.length) continue;

      for (const item of stageItems) {
        output.push({
          customId: `${kind}-${item.id}`,
          customName: item.description,
          stageName,
          source: "architect_standard",
          quantity: "",
          uom: item.unit,
          rate: undefined,
          amount: undefined,
        });
      }
    }

    // Add any other stages not in COMMERCIAL_STAGE_SEQUENCE
    for (const [stageName, items] of grouped) {
      if (!COMMERCIAL_STAGE_SEQUENCE.includes(stageName as any)) {
        for (const item of items) {
          output.push({
            customId: `${kind}-${item.id}`,
            customName: item.description,
            stageName,
            source: "architect_standard",
            quantity: "",
            uom: item.unit,
            rate: undefined,
            amount: undefined,
          });
        }
      }
    }
  } else {
    // For industrial and any others, preserve stages as-is
    for (const item of lineItems) {
      output.push({
        customId: `${kind}-${item.id}`,
        customName: item.description,
        stageName: item.stage || "General",
        source: "architect_standard",
        quantity: "",
        uom: item.unit,
        rate: undefined,
        amount: undefined,
      });
    }
  }

  return filterTemplateRowsByProjectFloors(output, project, kind);
}




export default function BOQWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";
  const searchTemplate = searchParams.get("template");
  const { user } = useAuth();
  const isArchitectFlow = user?.role === "architect";
  const isGenericEstimationRoute = location.pathname.startsWith("/estimation/");
  const [project, setProject] = useState<BOQProject | null>(null);
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [boqRows, setBoqRows] = useState<BOQRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingEstimate, setCheckingEstimate] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [boqError, setBoqError] = useState<string>("");
  const [hasExistingBoq, setHasExistingBoq] = useState<boolean>(false);
  const [isEditingBoq, setIsEditingBoq] = useState<boolean>(!isViewMode);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [restoredFromAutoSave, setRestoredFromAutoSave] = useState<boolean>(false);
  const [marketDistricts, setMarketDistricts] = useState<api.MarketDistrict[]>([]);
  const [marketCategories, setMarketCategories] = useState<api.MarketCategory[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [marketRates, setMarketRates] = useState<api.MarketPriceRow[]>([]);
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const boqApiProjectId = resolveBoqApiProjectId(projectId, project);
  const UOM_OPTIONS = ["Cu.m", "Sq.m", "Rmt", "Nos", "Tonne", "Kg", "KL", "Bag", "Day", "LS"];
  const projectViewPath = projectId ? `/architect/project/${projectId}` : "/architect/projects";
  const showRateColumns = isEditingBoq;
  const isReadOnlyView = isViewMode && !isEditingBoq;
  let lastInsertedStageName = "";
  const tableRows = boqRows.reduce<Array<
    | { type: "stage"; stageName: string }
    | { type: "item"; row: BOQRow; originalIndex: number; serial: number }
  >>((acc, row, originalIndex) => {
    const currentItemCount = acc.filter((entry) => entry.type === "item").length;
    const nextSerial = currentItemCount + 1;

    if ("customId" in row) {
      const stageName = String(row.stageName || "General").trim() || "General";
      if (lastInsertedStageName !== stageName) {
        acc.push({ type: "stage", stageName });
        lastInsertedStageName = stageName;
      }
    }

    acc.push({ type: "item", row, originalIndex, serial: nextSerial });
    return acc;
  }, []);

  const backPath = isGenericEstimationRoute
    ? "/architect"
    : isArchitectFlow
    ? projectViewPath
    : user?.role === "builder"
    ? "/builder"
    : "/estimation";
  const projectTypeValue =
    project?.building_type ||
    String((project as BOQProject & { buildingType?: string | null })?.buildingType || "");

  const projectDetails = [
    { label: "Project", value: project?.name || "-" },
    { label: "Client", value: project?.client_name || "-" },
    { label: "Project Type", value: formatProjectType(projectTypeValue) },
    { label: "Location", value: project?.project_location || "-" },
    { label: "Terrain", value: project?.terrain ? project.terrain.charAt(0).toUpperCase() + project.terrain.slice(1) : "-" },
    { label: "Status", value: project?.status ? project.status.replace(/_/g, " ") : "-" },
    { label: "Created", value: project?.created_at ? formatDate(project.created_at) : "-" },
    { label: "Updated", value: project?.updated_at ? formatDate(project.updated_at) : "-" },
  ];

  const insertCustomRowAfter = (afterIndex: number, stageName?: string) => {
    const newRow: BOQRow = {
      customId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customName: "",
      stageName,
      source: "architect_additional",
      quantity: "",
      uom: "Nos",
      rate: undefined,
      amount: undefined,
    };

    setBoqRows((prev) => [
      ...prev.slice(0, afterIndex + 1),
      newRow,
      ...prev.slice(afterIndex + 1),
    ]);
  };

  const removeRowAt = (indexToRemove: number) => {
    setBoqRows((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    setIsEditingBoq(!isViewMode);
    setEstimate(null);
    setRestoredFromAutoSave(false);
    setLastAutoSavedAt(null);
  }, [isViewMode, projectId]);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      setLoading(true);
      setBoqError("");
      try {
        const [proj, tmpls] = await Promise.all([api.fetchProject(projectId), api.fetchTemplates()]);
        setProject(proj);
        setTemplates(tmpls);

        if (isViewMode) {
          const resolvedApiProjectId = resolveBoqApiProjectId(projectId, proj);
          if (!resolvedApiProjectId) {
            setBoqError("This estimation workspace is not linked to a source project BOQ.");
            setHasExistingBoq(false);
            setBoqRows([]);
            return;
          }

          const submitted = await api.fetchSubmittedBOQ(resolvedApiProjectId);
          const submittedItems = Array.isArray(submitted.items) ? submitted.items : [];
          setHasExistingBoq(submittedItems.length > 0);
          setBoqRows(mapSubmittedItemsToRows(submittedItems, tmpls));
          if (!submittedItems.length) {
            setBoqError("No submitted BOQ is available for this project.");
          }
        } else {
          setHasExistingBoq(false);
          const defaultRows: BOQRow[] = tmpls.map((t) => ({
            template: t,
            quantity: "",
            uom: t.unit || UOM_OPTIONS[0],
            rate: undefined,
            amount: undefined,
          }));

          const draft = projectId ? readDraft(projectId) : null;
          if (draft?.rows?.length) {
            setBoqRows(draft.rows);
            setRestoredFromAutoSave(true);
            setLastAutoSavedAt(draft.savedAt);
          } else {
            const templateKind = resolveTemplateKind(searchTemplate, proj);
            if (templateKind) {
              try {
                const templateRows = await loadBoqRowsFromTemplate(templateKind, proj);
                if (templateRows.length > 0) {
                  setBoqRows(templateRows);
                } else {
                  setBoqRows(defaultRows);
                }
              } catch (templateErr) {
                console.error(`Failed to load ${templateKind} template rows:`, templateErr);
                setBoqRows(defaultRows);
              }
            } else {
              setBoqRows(defaultRows);
            }
          }
        }
      } catch (err) {
        if (!isAuthMissingError(err)) {
          console.error("Failed to load project/templates:", err);
        }
        if (isViewMode) {
          setBoqError("Unable to load the submitted BOQ for this project.");
          setBoqRows([]);
          setHasExistingBoq(false);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, isViewMode, searchTemplate]);

  useEffect(() => {
    if (!isArchitectFlow) {
      setMarketDistricts([]);
      setMarketCategories([]);
      setMarketRates([]);
      return;
    }

    async function loadRateFilters() {
      try {
        const [districts, categories] = await Promise.all([
          api.fetchMarketDistricts(),
          api.fetchMarketCategories(),
        ]);

        setMarketDistricts(districts);
        setMarketCategories(categories);

        const byLocation = (project?.project_location || "").toLowerCase();
        const matchedDistrict =
          districts.find((d) => byLocation.includes(String(d.name || "").toLowerCase())) || districts[0];

        if (matchedDistrict?.id) {
          setSelectedDistrictId(matchedDistrict.id);
        }

        if (categories[0]?.name) {
          setSelectedCategoryName(categories[0].name);
        }
      } catch (err) {
        if (!isAuthMissingError(err)) {
          console.error("Failed to load market rate filters:", err);
        }
      }
    }

    loadRateFilters();
  }, [isArchitectFlow, project?.project_location]);

  useEffect(() => {
    if (!isArchitectFlow || !selectedDistrictId || !selectedCategoryName) {
      setMarketRates([]);
      return;
    }

    async function loadMarketRates() {
      setLoadingRates(true);
      try {
        const rows = await api.fetchMarketDistrictCategoryPrices(selectedDistrictId, selectedCategoryName);
        setMarketRates(rows);
      } catch (err) {
        if (!isAuthMissingError(err)) {
          console.error("Failed to load market rates:", err);
        }
        setMarketRates([]);
      } finally {
        setLoadingRates(false);
      }
    }

    loadMarketRates();
  }, [isArchitectFlow, selectedDistrictId, selectedCategoryName]);

  useEffect(() => {
    if (!projectId || isViewMode || !isEditingBoq) return;

    const persistDraft = () => {
      if (!hasMeaningfulDraftRows(boqRows)) return;
      writeDraft(projectId, boqRows);
      setLastAutoSavedAt(Date.now());
    };

    const intervalId = window.setInterval(persistDraft, 30_000);
    const onBeforeUnload = () => persistDraft();

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [projectId, isViewMode, isEditingBoq, boqRows]);

  if (loading) {
    return (
      <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 32 }}>
        <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 32 }}>
        <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
          <p style={{ textAlign: "center", color: "#dc2626", padding: 40 }}>Project not found</p>
          <button style={pageStyles.primaryBtn} onClick={() => navigate(backPath)}>Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 24 }}>
      <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
        <div style={{ ...pageStyles.header, display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <button style={{ ...pageStyles.secondaryBtn, height: 32, padding: "0 10px", fontSize: 13 }} onClick={() => navigate(backPath)}>← Back</button>
            {isReadOnlyView && hasExistingBoq ? (
              <button
                style={{ ...pageStyles.primaryBtn, fontSize: 14 }}
                onClick={() => setIsEditingBoq(true)}
              >
                Update BOQ
              </button>
            ) : (
              <div style={{ width: 104 }} />
            )}
          </div>
          <h1 style={{ ...pageStyles.title, fontSize: 22, textAlign: "center", margin: 0 }}>
            Bill of Quantity(BOQ)
          </h1>
          {project?.client_name && (
            <p style={{ ...pageStyles.subtitle, margin: "6px 0 0", textAlign: "center" }}>
              {project.client_name} — {project.project_location || "No location"}
            </p>
          )}
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "#f8fafc",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {projectDetails.map((detail) => (
            <div key={detail.label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {detail.label}
              </div>
              <div style={{ marginTop: 4, color: "#0f172a", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>
        {boqError && <div style={{ ...pageStyles.error, marginTop: 12 }}>{boqError}</div>}
        {!isViewMode && isEditingBoq && lastAutoSavedAt ? (
          <div style={{ marginTop: 10, color: restoredFromAutoSave ? "#0f766e" : "#64748b", fontSize: 12, fontWeight: restoredFromAutoSave ? 600 : 500 }}>
            {restoredFromAutoSave
              ? `Restored auto-saved BOQ draft from ${formatDate(new Date(lastAutoSavedAt))} | `
              : ""}
            Auto-saved every 30 seconds. Last saved at {formatDate(new Date(lastAutoSavedAt))}
          </div>
        ) : null}
        <div style={{ margin: "24px 0" }}>
          <TableWrapper>
            <table style={{ ...pageStyles.table, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...pageStyles.th, width: 50 }}>#</th>
                <th style={pageStyles.th}>Item Name</th>
                <th style={{ ...pageStyles.th, width: 80 }}>Qty</th>
                <th style={{ ...pageStyles.th, width: 80 }}>UOM</th>
                {showRateColumns && <th style={{ ...pageStyles.th, width: 100 }}>Rate</th>}
                {showRateColumns && <th style={{ ...pageStyles.th, width: 110 }}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {boqRows.length === 0 && (
                <tr>
                  <td colSpan={showRateColumns ? 6 : 4} style={pageStyles.empty}>
                    {isViewMode ? "No submitted BOQ rows to display." : "No BOQ rows available."}
                  </td>
                </tr>
              )}
              {tableRows.map((entry) => {
                if (entry.type === "stage") {
                  return (
                    <tr key={`stage-${entry.stageName}`}>
                      <td
                        colSpan={showRateColumns ? 6 : 4}
                        style={{
                          ...pageStyles.td,
                          background: "#f8fafc",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {entry.stageName}
                      </td>
                    </tr>
                  );
                }

                const { row, originalIndex, serial } = entry;
                if ("customId" in row) {
                  return (
                    <tr key={row.customId}>
                        <td style={{ ...pageStyles.td, textAlign: "center", fontSize: 12 }}>{serial}</td>
                        <td style={{ ...pageStyles.td }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              {isEditingBoq ? (
                                <input
                                  type="text"
                                  placeholder="Custom BOQ item"
                                  style={{ ...pageStyles.input, width: "100%", fontSize: 13 }}
                                  value={row.customName}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBoqRows(prev => prev.map((r, i) => i === originalIndex ? { ...r, customName: val } : r));
                                  }}
                                />
                              ) : (
                                row.customName
                              )}
                            </div>
                            {isArchitectFlow && isEditingBoq ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <button
                                  type="button"
                                  aria-label="Remove BOQ item"
                                  style={{ ...pageStyles.secondaryBtn, minWidth: 28, width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: 1 }}
                                  onClick={() => removeRowAt(originalIndex)}
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  aria-label="Insert BOQ item"
                                  style={{ ...pageStyles.secondaryBtn, minWidth: 28, width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: 1 }}
                                  onClick={() => insertCustomRowAfter(originalIndex, row.stageName)}
                                >
                                  +
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ ...pageStyles.td }}>
                          {isEditingBoq ? (
                            <input
                              type="number"
                              min="0"
                              style={{ ...pageStyles.input, width: 80, fontSize: 13 }}
                              value={row.quantity}
                              onChange={e => {
                                const val = e.target.value;
                                setBoqRows(prev => prev.map((r, i) => i === originalIndex ? { ...r, quantity: val } : r));
                              }}
                            />
                          ) : (
                            <span>{row.quantity || "-"}</span>
                          )}
                        </td>
                        <td style={{ ...pageStyles.td }}>
                          {isEditingBoq ? (
                            <select
                              style={{ ...pageStyles.select, width: 80, fontSize: 13 }}
                              value={row.uom}
                              onChange={e => {
                                const val = e.target.value;
                                setBoqRows(prev => prev.map((r, i) => i === originalIndex ? { ...r, uom: val } : r));
                              }}
                            >
                              {[row.uom, ...UOM_OPTIONS.filter(u => u !== row.uom)].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{row.uom || "-"}</span>
                          )}
                        </td>
                        {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>{row.rate != null ? formatINR(row.rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>}
                        {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{row.amount != null ? formatINR(row.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>}
                      </tr>
                  );
                } else {
                  return (
                    <tr key={row.template.id}>
                        <td style={{ ...pageStyles.td, textAlign: "center", fontSize: 12 }}>{serial}</td>
                        <td style={{ ...pageStyles.td }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}>{row.template.name}</div>
                            {isArchitectFlow && isEditingBoq ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <button
                                  type="button"
                                  aria-label="Remove BOQ item"
                                  style={{ ...pageStyles.secondaryBtn, minWidth: 28, width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: 1 }}
                                  onClick={() => removeRowAt(originalIndex)}
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  aria-label="Insert BOQ item"
                                  style={{ ...pageStyles.secondaryBtn, minWidth: 28, width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: 1 }}
                                  onClick={() => insertCustomRowAfter(originalIndex)}
                                >
                                  +
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ ...pageStyles.td }}>
                          {isEditingBoq ? (
                            <input
                              type="number"
                              min="0"
                              style={{ ...pageStyles.input, width: 80, fontSize: 13 }}
                              value={row.quantity}
                              onChange={e => {
                                const val = e.target.value;
                                setBoqRows(prev => prev.map((r, i) => i === originalIndex ? { ...r, quantity: val } : r));
                              }}
                            />
                          ) : (
                            <span>{row.quantity || "-"}</span>
                          )}
                        </td>
                        <td style={{ ...pageStyles.td }}>
                          {isEditingBoq ? (
                            <select
                              style={{ ...pageStyles.select, width: 80, fontSize: 13 }}
                              value={row.uom}
                              onChange={e => {
                                const val = e.target.value;
                                setBoqRows(prev => prev.map((r, i) => i === originalIndex ? { ...r, uom: val } : r));
                              }}
                            >
                              {[row.uom, ...UOM_OPTIONS.filter(u => u !== row.uom)].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{row.uom || "-"}</span>
                          )}
                        </td>
                        {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>{row.rate != null ? formatINR(row.rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>}
                        {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{row.amount != null ? formatINR(row.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>}
                      </tr>
                  );
                }
              })}
            </tbody>
          </table>
          </TableWrapper>
          {isEditingBoq && (
          <div style={{ marginTop: 12 }}>
            <button
              style={{ ...pageStyles.secondaryBtn, fontSize: 14 }}
              onClick={() =>
                navigate(
                  `/architect/estimation/templates?mode=custom-line-item&projectId=${encodeURIComponent(
                    projectId || ""
                  )}`
                )
              }
            >
              + Add Custom Line Item
            </button>
          </div>
          )}
        </div>
        {isEditingBoq && (
        <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
          <button
            style={{ ...pageStyles.primaryBtn, fontSize: 15 }}
            onClick={async () => {
              setCheckingEstimate(true);
              try {
                const templatesByName = new Map(
                  templates.map((template) => [normalizeBoqLabel(template.name), template])
                );

                const updatedRows = await Promise.all(boqRows.map(async (row) => {
                  const qty = parseFloat(row.quantity);
                  if (!qty || isNaN(qty)) return { ...row, rate: undefined, amount: undefined };

                  if ('customId' in row) {
                    const matchedTemplate =
                      templatesByName.get(normalizeBoqLabel(row.customName)) ||
                      findBestTemplateForItemName(row.customName, templates);
                    if (!matchedTemplate) {
                      return { ...row, rate: undefined, amount: undefined };
                    }

                    try {
                      const computed = await api.computeRate({
                        template_id: matchedTemplate.id,
                        location_zone_id: project.location_zone_id,
                        conveyance_distance_km: project.default_conveyance_distance_km,
                        terrain: project.terrain,
                      });
                      const rate = Number(computed.final_rate);
                      return {
                        ...row,
                        rate: Number.isFinite(rate) ? rate : undefined,
                        amount: Number.isFinite(rate) ? rate * qty : undefined,
                      };
                    } catch (err) {
                      console.error("Failed to compute PWD rate for custom item:", row.customName, err);
                      return { ...row, rate: undefined, amount: undefined };
                    }
                  }

                  // Fetch computed PWD/SOR rate from backend rate engine.
                  try {
                    const computed = await api.computeRate({
                      template_id: row.template.id,
                      location_zone_id: project.location_zone_id,
                      conveyance_distance_km: project.default_conveyance_distance_km,
                      terrain: project.terrain,
                    });
                    const rate = Number(computed.final_rate);
                    return {
                      ...row,
                      rate: Number.isFinite(rate) ? rate : undefined,
                      amount: Number.isFinite(rate) ? rate * qty : undefined,
                    };
                  } catch (err) {
                    console.error("Failed to compute PWD rate for template:", row.template.id, err);
                    return { ...row, rate: undefined, amount: undefined };
                  }
                }));
                setBoqRows(updatedRows);
                setEstimate(updatedRows.reduce((sum, r) => sum + (r.amount || 0), 0));
              } finally {
                setCheckingEstimate(false);
              }
            }}
            disabled={loading || checkingEstimate}
          >
            {checkingEstimate ? "Checking..." : "Check Estimate"}
          </button>
          <button
            style={{ ...pageStyles.secondaryBtn, fontSize: 15 }}
            onClick={async () => {
              setSubmitting(true);
              try {
                if (isViewMode && projectId) {
                  const items = boqRows.map(toSubmittedItem).filter((row): row is api.SubmittedBOQItem => Boolean(row));
                  await api.updateSubmittedBOQ(boqApiProjectId, items);
                  clearDraft(projectId);
                  alert("BOQ updated successfully!");
                  setHasExistingBoq(items.length > 0);
                  setBoqRows(mapSubmittedItemsToRows(items, templates));
                  setIsEditingBoq(false);
                  setEstimate(null);
                  return;
                }

                if (!projectId) {
                  alert("No project selected.");
                  return;
                }

                if (!boqApiProjectId) {
                  alert("Unable to resolve project for BOQ submission.");
                  return;
                }

                const items = boqRows
                  .map(toSubmittedItem)
                  .filter((row): row is api.SubmittedBOQItem => Boolean(row));

                if (!items.length) {
                  alert("Please fill in at least one item quantity before saving.");
                  return;
                }

                await api.submitNewBOQ(boqApiProjectId, items);
                clearDraft(projectId);
                alert("BOQ saved successfully!");
                navigate(backPath);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || loading}
          >
            {isViewMode ? "Save Updated BOQ" : "Save BOQ"}
          </button>
        </div>
        )}
        {showRateColumns && estimate != null && (
          <div style={{ marginTop: 24, fontWeight: 600, fontSize: 18, color: "#0f766e" }}>
            Total Estimate: {formatINR(estimate, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
        )}
        {isArchitectFlow && (
          <div style={{ marginTop: 24, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 12px",
                background: "#f8fafc",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "#0f172a" }}>Basic Material Cost List (Market Rates)</strong>
              <span style={{ color: "#475569", fontSize: 13 }}>
                Rates sourced from scraped Prices module data; visible only to architects.
              </span>
            </div>

            <div style={{ ...pageStyles.formRow, padding: 12, borderBottom: "1px solid var(--border)" }}>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                style={pageStyles.select}
              >
                {marketDistricts.length === 0 ? (
                  <option value="">No Districts</option>
                ) : (
                  marketDistricts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))
                )}
              </select>

              <select
                value={selectedCategoryName}
                onChange={(e) => setSelectedCategoryName(e.target.value)}
                style={pageStyles.select}
              >
                {marketCategories.length === 0 ? (
                  <option value="">No Categories</option>
                ) : (
                  marketCategories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <TableWrapper>
              <table style={{ ...pageStyles.table, margin: 0, border: "none" }}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Material</th>
                    <th style={pageStyles.th}>Brand</th>
                    <th style={pageStyles.th}>Market Rate</th>
                    <th style={pageStyles.th}>UOM</th>
                    <th style={pageStyles.th}>Source</th>
                    <th style={pageStyles.th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRates ? (
                    <tr>
                      <td colSpan={6} style={pageStyles.empty}>Loading market rates...</td>
                    </tr>
                  ) : marketRates.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={pageStyles.empty}>No scraped market rates available for this selection.</td>
                    </tr>
                  ) : (
                    marketRates.slice(0, 60).map((row, idx) => (
                      <tr key={row.materialPriceId || `${row.materialId}:${row.brandName || "generic"}`} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{row.materialName}</td>
                        <td style={pageStyles.td}>{row.brandName || "-"}</td>
                        <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>
                          {formatINR(Number(row.price || 0), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td style={pageStyles.td}>{row.unit || "-"}</td>
                        <td style={pageStyles.td}>{row.source || "scraped"}</td>
                        <td style={pageStyles.td}>
                          {row.lastUpdated ? formatDate(row.lastUpdated) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableWrapper>
          </div>
        )}
      </div>
    </div>
  );
}
