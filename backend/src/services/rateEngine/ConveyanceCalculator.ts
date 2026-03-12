import { ConveyanceSlab } from "./types";
import { priceLookup } from "./PriceLookup";

/**
 * Calculate conveyance charges based on TN PWD Annexure-V slab rates.
 * Rate = slab_rate × coefficient + loading + unloading
 */
export class ConveyanceCalculator {
  /**
   * Get conveyance rate for a material group at a given distance and terrain.
   */
  async calculate(
    materialGroup: string,
    distanceKm: number,
    terrain: "plains" | "hills" = "plains"
  ): Promise<{ rate: number; slab: ConveyanceSlab | null }> {
    if (distanceKm <= 0) return { rate: 0, slab: null };

    const slabs = await priceLookup.getConveyanceSlabs(terrain);
    const slab = this.findBestSlab(slabs, materialGroup);
    if (!slab) return { rate: 0, slab: null };

    const baseRate = this.getSlabRate(slab, distanceKm);
    const totalRate = (baseRate * slab.coefficient) + slab.loading_charges + slab.unloading_charges;

    return { rate: Math.round(totalRate * 100) / 100, slab };
  }

  private findBestSlab(slabs: ConveyanceSlab[], materialGroup: string): ConveyanceSlab | null {
    // Exact match first
    let match = slabs.find(s =>
      s.material_group.toLowerCase() === materialGroup.toLowerCase()
    );
    if (match) return match;

    // Partial match
    match = slabs.find(s =>
      materialGroup.toLowerCase().includes(s.material_group.toLowerCase()) ||
      s.material_group.toLowerCase().includes(materialGroup.toLowerCase())
    );
    if (match) return match;

    // Fallback to "Miscellaneous / General"
    return slabs.find(s => s.material_group.includes("Miscellaneous")) || null;
  }

  private getSlabRate(slab: ConveyanceSlab, distanceKm: number): number {
    if (distanceKm <= 10) return slab.rate_0_10km;
    if (distanceKm <= 20) return slab.rate_10_20km;
    if (distanceKm <= 40) return slab.rate_20_40km;
    if (distanceKm <= 80) return slab.rate_40_80km;
    return slab.rate_above_80km;
  }

  /**
   * Map a resource category to a conveyance material group.
   */
  static mapResourceToConveyanceGroup(resourceCategory: string): string {
    const cat = resourceCategory.toLowerCase();
    if (cat.includes("cement")) return "Cement (Bags)";
    if (cat.includes("steel") || cat.includes("iron")) return "Steel / Iron";
    if (cat.includes("brick") || cat.includes("block")) return "Bricks";
    if (cat.includes("sand") || cat.includes("aggregate") || cat.includes("earth")) return "Sand / Earth / Gravel";
    if (cat.includes("aggregate") || cat.includes("stone")) return "Stone Aggregate (20mm/40mm)";
    if (cat.includes("timber") || cat.includes("wood") || cat.includes("plywood")) return "Timber / Wood";
    if (cat.includes("pipe")) return "Pipes (PVC/GI/CI)";
    if (cat.includes("tile") || cat.includes("granite") || cat.includes("marble")) return "Tiles / Granite / Marble";
    return "Miscellaneous / General";
  }
}

export const conveyanceCalculator = new ConveyanceCalculator();
