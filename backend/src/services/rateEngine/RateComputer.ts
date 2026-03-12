import { priceLookup } from "./PriceLookup";
import { conveyanceCalculator, ConveyanceCalculator } from "./ConveyanceCalculator";
import { locationExtrasEngine, calculateLiftCharges } from "./LocationExtrasEngine";
import {
  ComputeRateInput,
  RateComputationResult,
  LineItemBreakdown,
  RateTemplate,
} from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Core rate computation engine.
 * Follows TN PWD SOR methodology:
 *   1. Sum line items (material × coeff × (1 + wastage))
 *   2. Add conveyance for materials
 *   3. Apply location extras
 *   4. Apply lift charges
 *   5. Add overhead %
 *   6. Add profit %
 *   7. Add GST %
 */
export async function computeRate(input: ComputeRateInput): Promise<RateComputationResult> {
  const template = await priceLookup.getTemplate(input.template_id);
  if (!template) throw new Error(`Template not found: ${input.template_id}`);
  if (!template.line_items || template.line_items.length === 0) {
    throw new Error(`Template ${template.code} has no line items`);
  }

  const zone = input.location_zone_id
    ? await priceLookup.getLocationZone(input.location_zone_id)
    : null;

  const breakdown: LineItemBreakdown[] = [];
  let materialTotal = 0;
  let labourTotal = 0;
  let equipmentTotal = 0;
  let conveyanceTotal = 0;
  let worksRateTotal = 0;

  // Process each line item
  for (const item of template.line_items) {
    if (item.sub_template_id) {
      // Nested template – recursive computation
      const subResult = await computeRate({
        ...input,
        template_id: item.sub_template_id,
      });
      // Add the sub-template's final_rate as a single line item
      breakdown.push({
        line_item_id: item.id,
        resource_code: `SUB:${subResult.template_code}`,
        resource_name: subResult.template_name,
        resource_type: "sub_template",
        unit: subResult.unit,
        coefficient: item.coefficient,
        basic_rate: subResult.final_rate,
        wastage_percent: 0,
        effective_rate: subResult.final_rate,
        amount: round2(subResult.final_rate * item.coefficient),
        conveyance_amount: 0,
      });
      materialTotal += round2(subResult.material_total * item.coefficient);
      labourTotal += round2(subResult.labour_total * item.coefficient);
      continue;
    }

    if (!item.resource) continue;

    const resource = item.resource;
    const wastage = item.wastage_override ?? resource.wastage_percent;
    const effectiveRate = resource.basic_rate * (1 + wastage / 100);
    const amount = round2(effectiveRate * item.coefficient);

    // Calculate conveyance for material resources
    let conveyanceAmount = 0;
    if (resource.type === "material" && !resource.is_at_site && input.conveyance_distance_km) {
      const group = ConveyanceCalculator.mapResourceToConveyanceGroup(resource.category);
      const { rate } = await conveyanceCalculator.calculate(
        group,
        input.conveyance_distance_km,
        input.terrain || "plains"
      );
      conveyanceAmount = round2(rate * item.coefficient);
    }

    breakdown.push({
      line_item_id: item.id,
      resource_code: resource.unique_code,
      resource_name: resource.name,
      resource_type: resource.type,
      unit: resource.unit,
      coefficient: item.coefficient,
      basic_rate: resource.basic_rate,
      wastage_percent: wastage,
      effective_rate: round2(effectiveRate),
      amount,
      conveyance_amount: conveyanceAmount,
    });

    // Accumulate by type
    switch (resource.type) {
      case "material":
        materialTotal += amount;
        conveyanceTotal += conveyanceAmount;
        break;
      case "labour":
      case "head_load":
        labourTotal += amount;
        break;
      case "equipment":
        equipmentTotal += amount;
        break;
      case "work_rate":
        worksRateTotal += amount;
        break;
    }
  }

  // Location extras
  let locationExtras = null;
  if (zone) {
    locationExtras = locationExtrasEngine.calculate(
      zone,
      labourTotal,
      materialTotal,
      worksRateTotal,
      conveyanceTotal,
      0 // head load included in labour
    );
  }

  const extrasAmount = locationExtras?.total_extra || 0;

  // Direct cost
  const directCost = round2(
    materialTotal + labourTotal + equipmentTotal + conveyanceTotal + worksRateTotal + extrasAmount
  );

  // Lift charges
  const liftCharges = calculateLiftCharges(
    directCost,
    input.height_above_gl,
    input.depth_below_gl
  );

  const costAfterLift = round2(directCost + liftCharges);

  // Overhead, Profit, GST
  const overheadPercent = input.override_overhead ?? template.overhead_percent;
  const profitPercent = input.override_profit ?? template.profit_percent;
  const gstPercent = input.override_gst ?? template.gst_percent;

  const overheadAmount = round2(costAfterLift * (overheadPercent / 100));
  const profitAmount = round2((costAfterLift + overheadAmount) * (profitPercent / 100));
  const subtotalBeforeGst = round2(costAfterLift + overheadAmount + profitAmount);
  const gstAmount = round2(subtotalBeforeGst * (gstPercent / 100));
  const finalRate = round2(subtotalBeforeGst + gstAmount);

  return {
    template_id: template.id,
    template_code: template.code,
    template_name: template.name,
    unit: template.unit,
    breakdown,
    material_total: round2(materialTotal),
    labour_total: round2(labourTotal),
    equipment_total: round2(equipmentTotal),
    conveyance_total: round2(conveyanceTotal),
    works_rate_total: round2(worksRateTotal),
    location_extras: locationExtras,
    lift_charges: liftCharges,
    direct_cost: directCost,
    overhead_percent: overheadPercent,
    overhead_amount: overheadAmount,
    profit_percent: profitPercent,
    profit_amount: profitAmount,
    subtotal_before_gst: subtotalBeforeGst,
    gst_percent: gstPercent,
    gst_amount: gstAmount,
    final_rate: finalRate,
  };
}

/**
 * Batch compute rates for multiple items.
 */
export async function computeRateBatch(
  inputs: ComputeRateInput[]
): Promise<RateComputationResult[]> {
  return Promise.all(inputs.map(computeRate));
}
