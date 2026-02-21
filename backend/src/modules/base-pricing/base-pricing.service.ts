import XLSX from "xlsx";
import pool from "../../db/pool";
import path from "path";
import fs from "fs";

interface ColumnMapping {
  item: string;
  rate: string;
  uom: string;
  category?: string;
}

interface ParsedItem {
  item: string;
  rate: number;
  uom: string;
  category: string;
}

export async function parseBasePricingFile(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (data.length === 0) {
    throw new Error("File is empty");
  }

  const headers = data[0].map((h: any) => String(h).trim());
  const rows = data.slice(1).filter((row) => row.some((cell) => cell));

  // Auto-detect column mapping
  const suggestedMapping = detectColumnMapping(headers);

  // Preview data (first 10 rows)
  const preview = rows.slice(0, 10).map((row) => {
    const obj: any = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || "";
    });
    return obj;
  });

  return {
    columns: headers,
    preview,
    suggestedMapping,
  };
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const itemRegex = /item|name|material|description/i;
  const rateRegex = /rate|price|cost|amount/i;
  const uomRegex = /uom|unit|measure|measurement/i;
  const categoryRegex = /category|type|class/i;

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
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const headers = data[0].map((h: any) => String(h).trim());
  const rows = data.slice(1).filter((row) => row.some((cell) => cell));

  const itemIdx = headers.indexOf(columnMapping.item);
  const rateIdx = headers.indexOf(columnMapping.rate);
  const uomIdx = headers.indexOf(columnMapping.uom);
  const categoryIdx = columnMapping.category
    ? headers.indexOf(columnMapping.category)
    : -1;

  if (itemIdx === -1 || rateIdx === -1 || uomIdx === -1) {
    throw new Error("Invalid column mapping");
  }

  const items: ParsedItem[] = [];

  for (const row of rows) {
    const item = String(row[itemIdx] || "").trim();
    const rateStr = String(row[rateIdx] || "0").replace(/[^0-9.]/g, "");
    const rate = parseFloat(rateStr) || 0;
    const uom = String(row[uomIdx] || "").trim();

    let category = "Material";
    if (categoryIdx !== -1) {
      const catValue = String(row[categoryIdx] || "").trim();
      if (["Material", "Labor", "Machinery", "Other"].includes(catValue)) {
        category = catValue;
      }
    }

    if (item && rate > 0 && uom) {
      items.push({ item, rate, uom, category });
    }
  }

  // Insert into database
  const values = items.map(
    (item) =>
      `('${builderOrgId}', '${item.item.replace(/'/g, "''")}', '${item.uom.replace(/'/g, "''")}', '${
        item.category
      }', ${item.rate})`
  );

  if (values.length > 0) {
    await pool.query(`
      INSERT INTO base_pricing (builder_org_id, item_name, uom, category, rate)
      VALUES ${values.join(", ")}
    `);
  }

  return { count: items.length, items };
}
