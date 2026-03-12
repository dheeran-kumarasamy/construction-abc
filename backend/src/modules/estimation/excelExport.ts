import ExcelJS from "exceljs";
import { Response } from "express";
import pool from "../../db/pool";
import { computeRate } from "../../services/rateEngine";
import type { RateComputationResult } from "../../services/rateEngine/types";

interface ExportProject {
  id: string;
  name: string;
  client_name?: string;
  project_location?: string;
  location_zone_id?: string;
  default_conveyance_distance_km?: number;
  terrain: string;
  global_overhead_percent?: number;
  global_profit_percent?: number;
  global_gst_percent?: number;
}

export async function exportProjectExcel(projectId: string, userId: string, res: Response) {
  // Load project
  const { rows: [project] } = await pool.query(
    `SELECT * FROM boq_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  ) as { rows: ExportProject[] };
  if (!project) throw new Error("Project not found");

  // Load sections & items
  const { rows: sections } = await pool.query(
    `SELECT * FROM boq_sections WHERE project_id = $1 ORDER BY sort_order`,
    [projectId]
  );
  const { rows: items } = await pool.query(`
    SELECT bi.*, rt.code as template_code, rt.name as template_name
    FROM boq_items bi
    LEFT JOIN rate_templates rt ON bi.template_id = rt.id
    WHERE bi.project_id = $1
    ORDER BY bi.sort_order
  `, [projectId]);

  // Compute rates for items with templates
  const computations: Map<string, RateComputationResult> = new Map();
  for (const item of items) {
    if (!item.template_id) continue;
    try {
      const result = await computeRate({
        template_id: item.template_id,
        location_zone_id: project.location_zone_id || undefined,
        conveyance_distance_km: project.default_conveyance_distance_km
          ? parseFloat(project.default_conveyance_distance_km as any) : undefined,
        terrain: (project.terrain || "plains") as any,
        floor_level: item.floor_level || undefined,
        height_above_gl: item.height_above_gl ? parseFloat(item.height_above_gl) : undefined,
        depth_below_gl: item.depth_below_gl ? parseFloat(item.depth_below_gl) : undefined,
        override_overhead: project.global_overhead_percent ? parseFloat(project.global_overhead_percent as any) : undefined,
        override_profit: project.global_profit_percent ? parseFloat(project.global_profit_percent as any) : undefined,
        override_gst: project.global_gst_percent ? parseFloat(project.global_gst_percent as any) : undefined,
      });
      computations.set(item.id, result);
    } catch {
      // Skip items that fail
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Construction ABC – TN PWD Rate Engine";
  wb.created = new Date();

  const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const totalFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
  const currencyFmt = "₹#,##0.00";

  // ── Sheet 1: BOQ Summary ─────────────────────
  const boqSheet = wb.addWorksheet("BOQ Summary");
  boqSheet.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Item No", key: "item_number", width: 10 },
    { header: "Description", key: "description", width: 45 },
    { header: "Template", key: "template_code", width: 14 },
    { header: "Qty", key: "quantity", width: 10 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Rate (₹)", key: "rate", width: 14 },
    { header: "Amount (₹)", key: "amount", width: 16 },
  ];
  styleHeaderRow(boqSheet, headerFill, headerFont);

  let sno = 1;
  let grandTotal = 0;
  for (const section of sections) {
    // Section header row
    const secRow = boqSheet.addRow([null, null, section.name, null, null, null, null, null]);
    secRow.font = { bold: true, size: 12 };
    secRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    boqSheet.mergeCells(secRow.number, 1, secRow.number, 8);
    secRow.getCell(1).value = section.name;
    secRow.getCell(1).font = { bold: true, size: 12 };

    const sectionItems = items.filter(i => i.section_id === section.id);
    let sectionTotal = 0;

    for (const item of sectionItems) {
      const rate = item.rate_override ? parseFloat(item.rate_override) : (item.computed_rate ? parseFloat(item.computed_rate) : 0);
      const amount = rate * parseFloat(item.quantity);
      sectionTotal += amount;

      const row = boqSheet.addRow({
        sno: sno++,
        item_number: item.item_number || "",
        description: item.description,
        template_code: item.template_code || "",
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        rate,
        amount,
      });
      row.getCell("rate").numFmt = currencyFmt;
      row.getCell("amount").numFmt = currencyFmt;
    }

    // Section total
    const totalRow = boqSheet.addRow([null, null, `Total – ${section.name}`, null, null, null, null, sectionTotal]);
    totalRow.font = { bold: true };
    totalRow.fill = totalFill;
    totalRow.getCell(8).numFmt = currencyFmt;
    grandTotal += sectionTotal;
  }

  // Grand total
  const gtRow = boqSheet.addRow([null, null, "GRAND TOTAL", null, null, null, null, grandTotal]);
  gtRow.font = { bold: true, size: 13 };
  gtRow.fill = headerFill;
  gtRow.font = { ...gtRow.font, color: { argb: "FFFFFFFF" } };
  gtRow.getCell(8).numFmt = currencyFmt;

  // ── Sheet 2: Rate Analysis ───────────────────
  const raSheet = wb.addWorksheet("Rate Analysis");
  raSheet.columns = [
    { header: "Item", key: "item", width: 14 },
    { header: "Resource Code", key: "code", width: 14 },
    { header: "Resource Name", key: "name", width: 40 },
    { header: "Type", key: "type", width: 12 },
    { header: "Coefficient", key: "coeff", width: 12 },
    { header: "Basic Rate", key: "basic_rate", width: 14 },
    { header: "Eff. Rate", key: "eff_rate", width: 14 },
    { header: "Amount (₹)", key: "amount", width: 14 },
  ];
  styleHeaderRow(raSheet, headerFill, headerFont);

  for (const item of items) {
    const comp = computations.get(item.id);
    if (!comp) continue;

    // Item header
    const iRow = raSheet.addRow([`${item.item_number}: ${item.description}`, null, null, null, null, null, null, null]);
    iRow.font = { bold: true };
    raSheet.mergeCells(iRow.number, 1, iRow.number, 8);

    for (const line of comp.breakdown) {
      const row = raSheet.addRow({
        item: "",
        code: line.resource_code,
        name: line.resource_name,
        type: line.resource_type,
        coeff: line.coefficient,
        basic_rate: line.basic_rate,
        eff_rate: line.effective_rate,
        amount: line.amount,
      });
      row.getCell("basic_rate").numFmt = currencyFmt;
      row.getCell("eff_rate").numFmt = currencyFmt;
      row.getCell("amount").numFmt = currencyFmt;
    }

    // Summary rows
    const summaryData = [
      ["Material Total", comp.material_total],
      ["Labour Total", comp.labour_total],
      ["Direct Cost", comp.direct_cost],
      [`Overhead (${comp.overhead_percent}%)`, comp.overhead_amount],
      [`Profit (${comp.profit_percent}%)`, comp.profit_amount],
      [`GST (${comp.gst_percent}%)`, comp.gst_amount],
      ["FINAL RATE per " + comp.unit, comp.final_rate],
    ];
    for (const [label, val] of summaryData) {
      const sRow = raSheet.addRow([null, null, null, null, null, null, label, val]);
      sRow.getCell(8).numFmt = currencyFmt;
      if (label.toString().startsWith("FINAL")) {
        sRow.font = { bold: true };
        sRow.fill = totalFill;
      }
    }
    raSheet.addRow([]); // spacer
  }

  // ── Sheet 3: Cost Summary ────────────────────
  const csSheet = wb.addWorksheet("Cost Summary");
  csSheet.columns = [
    { header: "Category", key: "category", width: 30 },
    { header: "Amount (₹)", key: "amount", width: 20 },
    { header: "% of Total", key: "percent", width: 15 },
  ];
  styleHeaderRow(csSheet, headerFill, headerFont);

  let totalMaterial = 0, totalLabour = 0, totalEquipment = 0, totalConveyance = 0, totalOverhead = 0, totalProfit = 0, totalGst = 0;
  for (const comp of computations.values()) {
    totalMaterial += comp.material_total;
    totalLabour += comp.labour_total;
    totalEquipment += comp.equipment_total;
    totalConveyance += comp.conveyance_total;
    totalOverhead += comp.overhead_amount;
    totalProfit += comp.profit_amount;
    totalGst += comp.gst_amount;
  }
  const totalAll = totalMaterial + totalLabour + totalEquipment + totalConveyance + totalOverhead + totalProfit + totalGst;
  const pct = (n: number) => totalAll > 0 ? `${((n / totalAll) * 100).toFixed(1)}%` : "0%";

  const costRows = [
    ["Material Cost", totalMaterial],
    ["Labour Cost", totalLabour],
    ["Equipment Cost", totalEquipment],
    ["Conveyance Cost", totalConveyance],
    ["Overhead", totalOverhead],
    ["Profit", totalProfit],
    ["GST", totalGst],
  ];
  for (const [cat, amt] of costRows) {
    const row = csSheet.addRow({ category: cat, amount: amt, percent: pct(amt as number) });
    row.getCell("amount").numFmt = currencyFmt;
  }
  const csTotRow = csSheet.addRow({ category: "TOTAL", amount: totalAll, percent: "100%" });
  csTotRow.font = { bold: true };
  csTotRow.fill = totalFill;
  csTotRow.getCell("amount").numFmt = currencyFmt;

  // ── Sheet 4: Resource Summary ────────────────
  const rsSheet = wb.addWorksheet("Resource Summary");
  rsSheet.columns = [
    { header: "Resource Code", key: "code", width: 14 },
    { header: "Resource Name", key: "name", width: 40 },
    { header: "Type", key: "type", width: 12 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Total Qty Used", key: "qty", width: 14 },
    { header: "Basic Rate (₹)", key: "rate", width: 14 },
    { header: "Total Cost (₹)", key: "cost", width: 16 },
  ];
  styleHeaderRow(rsSheet, headerFill, headerFont);

  // Aggregate resource usage
  const resourceUsage = new Map<string, { code: string; name: string; type: string; unit: string; qty: number; rate: number; cost: number }>();
  for (const [itemId, comp] of computations.entries()) {
    const item = items.find(i => i.id === itemId);
    const itemQty = item ? parseFloat(item.quantity) : 1;
    for (const line of comp.breakdown) {
      const existing = resourceUsage.get(line.resource_code);
      if (existing) {
        existing.qty += line.coefficient * itemQty;
        existing.cost += line.amount * itemQty;
      } else {
        resourceUsage.set(line.resource_code, {
          code: line.resource_code,
          name: line.resource_name,
          type: line.resource_type,
          unit: line.unit,
          qty: line.coefficient * itemQty,
          rate: line.basic_rate,
          cost: line.amount * itemQty,
        });
      }
    }
  }
  for (const r of [...resourceUsage.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const row = rsSheet.addRow({ code: r.code, name: r.name, type: r.type, unit: r.unit, qty: Math.round(r.qty * 100) / 100, rate: r.rate, cost: Math.round(r.cost * 100) / 100 });
    row.getCell("rate").numFmt = currencyFmt;
    row.getCell("cost").numFmt = currencyFmt;
  }

  // ── Sheet 5: Abstract of Estimate ────────────
  const aeSheet = wb.addWorksheet("Abstract of Estimate");
  aeSheet.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Head of Account", key: "head", width: 45 },
    { header: "Amount (₹)", key: "amount", width: 20 },
  ];
  styleHeaderRow(aeSheet, headerFill, headerFont);

  let aeSno = 1;
  for (const section of sections) {
    const sectionItems = items.filter(i => i.section_id === section.id);
    const sectionTotal = sectionItems.reduce((sum, i) => {
      const rate = i.rate_override ? parseFloat(i.rate_override) : (i.computed_rate ? parseFloat(i.computed_rate) : 0);
      return sum + rate * parseFloat(i.quantity);
    }, 0);
    const row = aeSheet.addRow({ sno: aeSno++, head: section.name, amount: sectionTotal });
    row.getCell("amount").numFmt = currencyFmt;
  }

  const aeGtRow = aeSheet.addRow({ sno: null, head: "TOTAL ESTIMATED COST", amount: grandTotal });
  aeGtRow.font = { bold: true, size: 13 };
  aeGtRow.fill = headerFill;
  aeGtRow.font = { ...aeGtRow.font, color: { argb: "FFFFFFFF" } };
  aeGtRow.getCell("amount").numFmt = currencyFmt;

  // Project info at top
  aeSheet.insertRow(1, []);
  aeSheet.insertRow(1, [`Abstract of Estimate – ${project.name}`]);
  aeSheet.insertRow(2, [`Client: ${project.client_name || "N/A"} | Location: ${project.project_location || "N/A"}`]);
  aeSheet.insertRow(3, [`Based on TN PWD Schedule of Rates 2025-2026`]);
  aeSheet.insertRow(4, []);
  aeSheet.getRow(1).font = { bold: true, size: 14 };
  aeSheet.getRow(3).font = { italic: true, size: 10, color: { argb: "FF6B7280" } };

  // Write to response
  const sanitizedName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="BOQ_${sanitizedName}.xlsx"`);

  await wb.xlsx.write(res);
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, fill: ExcelJS.FillPattern, font: Partial<ExcelJS.Font>) {
  const row = sheet.getRow(1);
  row.fill = fill;
  row.font = font;
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 28;
}
