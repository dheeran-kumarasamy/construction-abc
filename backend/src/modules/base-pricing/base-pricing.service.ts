import XLSX from "xlsx";
import pool from "../../db/pool";

let DEFAULT_RATES_FROM_CALCULATOR: Record<string, number> | undefined;
try {
  const calculatorModule = require("./boq-base.calculator") as {
    DEFAULT_RATES?: Record<string, number>;
  };
  DEFAULT_RATES_FROM_CALCULATOR = calculatorModule?.DEFAULT_RATES;
} catch {
  DEFAULT_RATES_FROM_CALCULATOR = undefined;
}

const FALLBACK_BOQ_RATE_TEMPLATE: Record<string, number> = {
  excavationUpTo5ft: 12,
  excavationAbove5ft: 14,
  backFilling: 8,
  rampFormation: 44,
  bringEarthFromOutside: 44,
  pcc148: 183,
  msandCushion: 82,
  surkhi: 150,
  screedFlooring: 85,
  rccFooting: 196,
  rccColumn_GF: 230,
  rccColumn_FF: 244,
  rccColumn_SF: 259,
  rccColumn_TF: 275,
  rccColumn_Terrace: 292,
  rccPlinthBeam: 207,
  rccRoofBeam_GF: 207,
  rccRoofSlab_GF: 207,
  rccStaircase_GF: 230,
  centeringFooting: 70,
  centeringColumn_GF: 70,
  centeringRoofBeam: 75,
  centeringRoofSlab: 75,
  steelRate_GF: 90000,
  steelRate_FF: 93000,
  steelRate_SF: 95000,
  steelRate_TF: 97000,
  steelRate_Terrace: 99000,
  brickWork9inch: 326.5,
  brickWork4_5inch: 154,
  brickOnEdge: 120,
  rrMasonry: 153,
  exteriorPlaster: 67,
  interiorPlaster: 58,
  ceilingPlaster: 54.5,
  beamColumnPlaster: 72,
  antiTermiteTreatment: 10,
  vitrifiedTiles: 220,
  antiSkidTiles: 180,
  granite: 280,
  whiteWash: 6,
  texturePutty: 50,
  interiorEmulsion: 35,
  exteriorApex: 25,
  terraceWaterproofing: 60,
  bathroomWaterproofing: 75,
  sumpWaterproofing: 90,
  msGrill: 175,
  msGate: 175,
  balconyHandrail: 1800,
  staircaseRailing: 1500,
  mainDoor: 35000,
  internalDoor: 12000,
  windows: 450,
  electricalPerPoint: 2500,
  electricalLumpSumGF: 322080,
  plumbingPerFixture: 15000,
  plumbingLumpSumGF: 248880,
  pestControl: 10,
  elevationCladding: 120,
  elevationWorksPerFloor: 5000,
  frpManholecover2x2: 5200,
};

interface PwdStageMaterialFactor {
  material: string;
  uom: string;
  factor: number;
}

interface PwdStageFactor {
  stageId: string;
  label: string;
  match: string[];
  materials: PwdStageMaterialFactor[];
}

const PWD_STAGE_FACTORS: PwdStageFactor[] = [
  {
    stageId: "land_preparation",
    label: "Land Preparation",
    match: ["excavation", "earthwork", "filling", "land levelling", "site clearing"],
    materials: [
      { material: "Earthwork / Filling", uom: "cum", factor: 1 },
      { material: "Gravel / Soling", uom: "cum", factor: 0.2 },
    ],
  },
  {
    stageId: "foundation",
    label: "Foundation",
    match: ["foundation", "footing", "pcc", "rcc footing", "pedestal"],
    materials: [
      { material: "Cement", uom: "bags", factor: 6 },
      { material: "Sand", uom: "cum", factor: 0.45 },
      { material: "Aggregate", uom: "cum", factor: 0.9 },
      { material: "Steel", uom: "kg", factor: 12 },
    ],
  },
  {
    stageId: "superstructure",
    label: "Superstructure (RCC Frame)",
    match: ["column", "beam", "slab", "rcc", "lintel", "stair"],
    materials: [
      { material: "Cement", uom: "bags", factor: 7 },
      { material: "Sand", uom: "cum", factor: 0.5 },
      { material: "Aggregate", uom: "cum", factor: 1 },
      { material: "Steel", uom: "kg", factor: 16 },
    ],
  },
  {
    stageId: "masonry_plaster",
    label: "Masonry & Plaster",
    match: ["brick", "block", "masonry", "plaster", "pointing"],
    materials: [
      { material: "Bricks / Blocks", uom: "nos", factor: 55 },
      { material: "Cement", uom: "bags", factor: 1.8 },
      { material: "Sand", uom: "cum", factor: 0.24 },
    ],
  },
  {
    stageId: "joinery_flooring",
    label: "Doors, Windows & Flooring",
    match: ["door", "window", "joinery", "tile", "flooring", "granite", "marble", "dado"],
    materials: [
      { material: "Doors / Windows Units", uom: "nos", factor: 1 },
      { material: "Tiles / Stone", uom: "sqm", factor: 1 },
      { material: "Tile Adhesive", uom: "bags", factor: 0.18 },
    ],
  },
  {
    stageId: "painting_finishing",
    label: "Painting & Final Finishing",
    match: ["paint", "primer", "putty", "distemper", "polish", "texture", "finishing"],
    materials: [
      { material: "Wall Putty", uom: "kg", factor: 0.2 },
      { material: "Primer", uom: "ltr", factor: 0.1 },
      { material: "Paint", uom: "ltr", factor: 0.12 },
    ],
  },
];

interface ColumnMapping {
  item: string;
  rate: string;
  uom?: string;
  category?: string;
}

interface ParsedItem {
  item: string;
  rate: number;
  uom: string;
  category: string;
}

interface ParseDiagnostics {
  totalRows: number;
  nonEmptyRows: number;
  importedRows: number;
  invalidRows: number;
  missingItemRows: number;
  missingRateRows: number;
  zeroOrNegativeRateRows: number;
  duplicateMerged: number;
}

interface StarterTemplateRow extends ParsedItem {
  sourceKey: string;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function parseRate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const cleaned = raw
    .replace(/,/g, "")
    .replace(/[₹$€£]/g, "")
    .replace(/\(([^)]+)\)/g, "-$1")
    .replace(/[^0-9.-]/g, "");

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(4));
}

function toTitleCase(input: string) {
  const withSpaces = input
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return withSpaces
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function normalizeUom(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return "unit";
  }

  const uomMap: Record<string, string> = {
    nos: "nos",
    no: "nos",
    number: "nos",
    numbers: "nos",
    pcs: "pcs",
    pc: "pcs",
    piece: "pcs",
    pieces: "pcs",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    m: "m",
    meter: "m",
    metre: "m",
    meters: "m",
    metres: "m",
    rft: "rft",
    "running feet": "rft",
    sqm: "sqm",
    "sq m": "sqm",
    "m2": "sqm",
    sqft: "sqft",
    "sq ft": "sqft",
    "ft2": "sqft",
    cum: "cum",
    "m3": "cum",
    ltr: "ltr",
    litre: "ltr",
    liter: "ltr",
    day: "day",
    hr: "hr",
    hour: "hr",
    mt: "mt",
    tons: "mt",
    tonne: "mt",
    tonnes: "mt",
  };

  return uomMap[raw] || raw;
}

function normalizeCategory(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return "Material";
  }

  if (/labor|labour|manpower|worker|wages/.test(raw)) {
    return "Labor";
  }

  if (/mach|equipment|plant|tool|rental/.test(raw)) {
    return "Machinery";
  }

  if (/other|overhead|misc|transport|freight|tax|elevation|waterproof|electrical|plumbing/.test(raw)) {
    return "Other";
  }

  return "Material";
}

function inferCategoryFromRateKey(key: string): ParsedItem["category"] {
  if (/^electrical|^plumbing|waterproof|elevation|pest|manhole|antiTermite/.test(key)) {
    return "Other";
  }
  if (/^centering|rampFormation/.test(key)) {
    return "Labor";
  }
  if (/msGrill|msGate|balconyHandrail|staircaseRailing/.test(key)) {
    return "Machinery";
  }
  return "Material";
}

function inferUomFromRateKey(key: string): string {
  if (/steelRate/.test(key)) return "mt";
  if (/msGate/.test(key)) return "kg";
  if (/balconyHandrail|staircaseRailing|brickOnEdge|pipeLength/.test(key)) return "rft";
  if (/mainDoor|internalDoor|frpManhole|electricalPerPoint|plumbingPerFixture/.test(key)) return "nos";
  if (/electricalLumpSum|plumbingLumpSum/.test(key)) return "lumpsum";
  if (/excavation|backFilling|bringEarth|rampFormation|pcc|msandCushion|surkhi|rcc|rrMasonry/.test(key)) return "cft";
  if (/centering|Plaster|Tiles|granite|whiteWash|texturePutty|interiorEmulsion|exteriorApex|waterproofing|msGrill|windows|antiTermite|pestControl|elevationCladding|elevationWorks|screedFlooring|surchargeScreed/i.test(key)) return "sft";
  return "unit";
}

function buildStarterTemplateRows(): StarterTemplateRow[] {
  const sourceRates =
    DEFAULT_RATES_FROM_CALCULATOR && Object.keys(DEFAULT_RATES_FROM_CALCULATOR).length > 0
      ? DEFAULT_RATES_FROM_CALCULATOR
      : FALLBACK_BOQ_RATE_TEMPLATE;

  const rows = Object.entries(sourceRates).map(([key, value]) => {
    const item = toTitleCase(key);
    return {
      sourceKey: key,
      item,
      rate: Number(value),
      uom: inferUomFromRateKey(key),
      category: inferCategoryFromRateKey(key),
    };
  });

  rows.sort((a, b) => a.item.localeCompare(b.item));
  return rows;
}

function toCsv(rows: StarterTemplateRow[]) {
  const header = ["Item Name", "Rate", "UOM", "Category"];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const values = [row.item, String(row.rate), row.uom, row.category].map((value) =>
      `"${String(value).replace(/"/g, '""')}"`
    );
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

function getSheetData(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (data.length === 0) {
    throw new Error("File is empty");
  }

  const keywordPattern = /item|description|material|name|rate|price|cost|uom|unit|category|type/i;
  let headerRowIndex = 0;
  let bestScore = -1;

  const scanLimit = Math.min(data.length, 20);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = data[rowIndex] || [];
    const populated = row.filter((cell) => normalizeCell(cell)).length;
    if (populated < 2) continue;

    const score = row.reduce((sum, cell) => {
      const text = normalizeCell(cell);
      return sum + (keywordPattern.test(text) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = rowIndex;
    }
  }

  const headers = (data[headerRowIndex] || []).map((h: any, idx: number) => {
    const value = normalizeCell(h);
    return value || `Column ${idx + 1}`;
  });

  const rows = data
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell: any) => normalizeCell(cell)));

  return {
    headers,
    rows,
    headerRowIndex,
  };
}

export function getBasePricingStarterTemplate() {
  const rows = buildStarterTemplateRows();
  return {
    columns: ["Item Name", "Rate", "UOM", "Category", "Source Key"],
    rows,
    csv: toCsv(rows),
  };
}

export function getPwdStageFactorTemplate() {
  return {
    stages: PWD_STAGE_FACTORS,
  };
}

export async function parseBasePricingFile(filePath: string) {
  const { headers, rows, headerRowIndex } = getSheetData(filePath);

  // Auto-detect column mapping
  const suggestedMapping = detectColumnMapping(headers);

  // Preview data
  const preview = rows.slice(0, 15).map((row) => {
    const obj: any = {};
    headers.forEach((header, idx) => {
      obj[header] = normalizeCell(row[idx]);
    });
    return obj;
  });

  const itemIdx = headers.indexOf(suggestedMapping.item);
  const rateIdx = headers.indexOf(suggestedMapping.rate);

  let missingItemRows = 0;
  let missingRateRows = 0;
  let zeroOrNegativeRateRows = 0;

  rows.forEach((row) => {
    const item = itemIdx >= 0 ? normalizeCell(row[itemIdx]) : "";
    const rate = rateIdx >= 0 ? parseRate(row[rateIdx]) : null;

    if (!item) {
      missingItemRows += 1;
    }

    if (rate === null) {
      missingRateRows += 1;
      return;
    }

    if (rate <= 0) {
      zeroOrNegativeRateRows += 1;
    }
  });

  return {
    columns: headers,
    preview,
    suggestedMapping,
    diagnostics: {
      detectedHeaderRow: headerRowIndex + 1,
      totalRows: rows.length,
      missingItemRows,
      missingRateRows,
      zeroOrNegativeRateRows,
    },
  };
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const itemRegex = /item|item\s*name|material|description|product|name|spec/i;
  const rateRegex = /rate|unit\s*rate|price|cost|amount|basic\s*rate|value/i;
  const uomRegex = /uom|unit|measure|measurement|unit\s*of\s*measure/i;
  const categoryRegex = /category|type|class|group|cost\s*type/i;

  return {
    item: headers.find((h) => itemRegex.test(h)) || "",
    rate: headers.find((h) => rateRegex.test(h)) || "",
    uom: headers.find((h) => uomRegex.test(h)) || "",
    category: headers.find((h) => categoryRegex.test(h)) || "",
  };
}

export async function uploadBasePricing(
  filePath: string,
  builderOrgId: string,
  columnMapping: ColumnMapping
) {
  const { headers, rows } = getSheetData(filePath);

  const itemIdx = headers.indexOf(columnMapping.item);
  const rateIdx = headers.indexOf(columnMapping.rate);
  const uomIdx = columnMapping.uom ? headers.indexOf(columnMapping.uom) : -1;
  const categoryIdx = columnMapping.category
    ? headers.indexOf(columnMapping.category)
    : -1;

  if (itemIdx === -1 || rateIdx === -1) {
    throw new Error("Invalid column mapping");
  }

  const diagnostics: ParseDiagnostics = {
    totalRows: rows.length,
    nonEmptyRows: 0,
    importedRows: 0,
    invalidRows: 0,
    missingItemRows: 0,
    missingRateRows: 0,
    zeroOrNegativeRateRows: 0,
    duplicateMerged: 0,
  };

  const itemMap = new Map<string, ParsedItem>();

  for (const row of rows) {
    const hasAnyValue = row.some((cell: any) => normalizeCell(cell));
    if (!hasAnyValue) {
      continue;
    }

    diagnostics.nonEmptyRows += 1;

    const item = normalizeCell(row[itemIdx]);
    const rate = parseRate(row[rateIdx]);
    const uom = uomIdx >= 0 ? normalizeUom(row[uomIdx]) : "unit";
    const category = categoryIdx >= 0 ? normalizeCategory(row[categoryIdx]) : "Material";

    if (!item) {
      diagnostics.missingItemRows += 1;
      diagnostics.invalidRows += 1;
      continue;
    }

    if (rate === null) {
      diagnostics.missingRateRows += 1;
      diagnostics.invalidRows += 1;
      continue;
    }

    if (rate <= 0) {
      diagnostics.zeroOrNegativeRateRows += 1;
      diagnostics.invalidRows += 1;
      continue;
    }

    const dedupeKey = `${normalizeText(item)}|${normalizeText(uom)}`;
    if (itemMap.has(dedupeKey)) {
      diagnostics.duplicateMerged += 1;
    }
    itemMap.set(dedupeKey, { item, rate, uom, category });
  }

  const items = Array.from(itemMap.values());
  diagnostics.importedRows = items.length;

  if (items.length > 0) {
    const placeholders: string[] = [];
    const params: Array<string | number> = [];

    items.forEach((item, index) => {
      const offset = index * 5;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      params.push(builderOrgId, item.item, item.uom, item.category, item.rate);
    });

    await pool.query(
      `
      INSERT INTO base_pricing (builder_org_id, item_name, uom, category, rate)
      VALUES ${placeholders.join(", ")}
    `,
      params
    );
  }

  return {
    count: items.length,
    items,
    diagnostics,
  };
}

export async function bulkLookupPricesService(items: Array<{ item: string; uom: string; rate?: number; category?: string }>) {
  const template = getBasePricingStarterTemplate();
  const templateMap = new Map<string, { rate: number; category: string }>();

  // Build lookup map from template
  template.rows.forEach((row: any) => {
    const key = `${normalizeText(row.item)}|${normalizeText(row.uom)}`;
    templateMap.set(key, { rate: row.rate, category: row.category });
  });

  // Look up prices for each item
  const result = items.map((item) => {
    const key = `${normalizeText(item.item)}|${normalizeText(item.uom)}`;
    const templateMatch = templateMap.get(key);

    return {
      item: item.item,
      uom: item.uom,
      rate: templateMatch ? templateMatch.rate : (item.rate ?? 0),
      category: item.category ?? templateMatch?.category ?? "Material",
    };
  });

  return result;
}
