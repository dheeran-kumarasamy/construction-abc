import { LocationZone, LocationExtrasBreakdown } from "./types";

/**
 * Calculate location-based percentage extras per TN PWD General Notes.
 */
export class LocationExtrasEngine {
  calculate(
    zone: LocationZone,
    labourTotal: number,
    materialTotal: number,
    worksTotal: number,
    conveyanceTotal: number,
    headLoadTotal: number
  ): LocationExtrasBreakdown {
    const labourExtra = labourTotal * (zone.labour_extra_percent / 100);
    const materialExtra = materialTotal * (zone.material_extra_percent / 100);
    const worksExtra = worksTotal * (zone.works_extra_percent / 100);
    const conveyanceExtra = conveyanceTotal * (zone.conveyance_extra_percent / 100);
    const headLoadExtra = headLoadTotal * (zone.head_load_extra_percent / 100);

    return {
      labour_extra: round2(labourExtra),
      material_extra: round2(materialExtra),
      works_extra: round2(worksExtra),
      conveyance_extra: round2(conveyanceExtra),
      head_load_extra: round2(headLoadExtra),
      total_extra: round2(labourExtra + materialExtra + worksExtra + conveyanceExtra + headLoadExtra),
      zone_name: zone.zone_name,
    };
  }
}

/**
 * Calculate lift charges per PWD rules.
 * Extra 1% per metre for heights above 3m GL, and depths below 1.5m.
 */
export function calculateLiftCharges(
  directCost: number,
  heightAboveGL?: number,
  depthBelowGL?: number
): number {
  let extraPercent = 0;

  // Lift charges for heights above first floor (~3m)
  if (heightAboveGL && heightAboveGL > 3) {
    const extraMetres = heightAboveGL - 3;
    extraPercent += extraMetres * 1; // 1% per metre above 3m
  }

  // Extra for deep excavation (below 1.5m depth)
  if (depthBelowGL && depthBelowGL > 1.5) {
    const extraMetres = depthBelowGL - 1.5;
    extraPercent += extraMetres * 1.5; // 1.5% per metre below 1.5m
  }

  return round2(directCost * (extraPercent / 100));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const locationExtrasEngine = new LocationExtrasEngine();
