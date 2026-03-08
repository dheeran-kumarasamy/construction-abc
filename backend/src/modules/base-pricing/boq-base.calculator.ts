/**
 * BOQ (Bill of Quantities) Calculation Engine
 *
 * This file encodes all calculation logic from the estimation sheet so a builder
 * can feed in a new BOQ (quantities from an architect) and get a precise estimate.
 *
 * STRUCTURE:
 *  1. Types & Interfaces
 *  2. Steel weight constants (BBS)
 *  3. Rate cards (unit rates per work type)
 *  4. Calculation functions per work category
 *  5. Floor-level estimator
 *  6. Full project estimator
 *  7. Summary / report generator
 */

// ─────────────────────────────────────────────────────────────
// 1. TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

/** Supported floor / zone names */
export type FloorZone =
  | 'GroundFloor'
  | 'FirstFloor'
  | 'SecondFloor'
  | 'ThirdFloor'
  | 'Terrace'
  | 'OHT'
  | 'CompoundWall'
  | 'OuterFormation'
  | 'SepticTank'
  | 'Sump'
  | 'Elevation';

/** RCC element types */
export interface RCCQuantities {
  /** Footing volume in Cft (Ground floor only) */
  footing?: number;
  /** Column volume in Cft */
  column?: number;
  /** Plinth beam volume in Cft */
  plinthBeam?: number;
  /** Sill & lintel volume in Cft */
  sillLintel?: number;
  /** Roof beam volume in Cft */
  roofBeam?: number;
  /** Roof slab volume in Cft */
  roofSlab?: number;
  /** Staircase volume in Cft */
  staircase?: number;
  /** Base slab (Sump/Septic) in Cft */
  baseSlab?: number;
  /** RC Wall (Sump/Septic) in Cft */
  rcWall?: number;
  /** Cover slab (Sump/Septic) in Cft */
  coverSlab?: number;
}

/** Centering (shuttering) quantities in Sft */
export interface CenteringQuantities {
  footing?: number;
  column?: number;
  plinthBeam?: number;
  sillLintel?: number;
  roofBeam?: number;
  roofSlab?: number;
  staircase?: number;
  baseSlab?: number;
  rcWall?: number;
  coverSlab?: number;
}

/** Steel (BBS) per diameter in Metres (converted to MT internally) */
export interface SteelByDiameter {
  dia8?: number;   // metres
  dia10?: number;
  dia12?: number;
  dia16?: number;
  dia20?: number;
  dia25?: number;
  dia32?: number;
}

/** Masonry quantities */
export interface MasonryQuantities {
  /** 9-inch brick wall in Cft */
  nineInch?: number;
  /** 4.5-inch brick wall in Sft */
  fourPointFiveInch?: number;
  /** Brick-on-edge (compound) in Rft */
  brickOnEdge?: number;
}

/** Plastering quantities in Sft */
export interface PlasterQuantities {
  exteriorWalls?: number;
  interiorWalls?: number;
  ceiling?: number;
  beamColumn?: number;   // exposed beams/columns (terrace, OHT)
}

/** Flooring quantities in Sft */
export interface FlooringQuantities {
  /** Vitrified tiles or equivalent */
  vitrifiedTiles?: number;
  /** Anti-skid tiles (bathrooms, utility) */
  antiSkidTiles?: number;
  /** Granite / natural stone */
  granite?: number;
  /** Screed flooring (outer formation, terraces) */
  screed?: number;
}

/** Painting / finishing quantities in Sft */
export interface PaintingQuantities {
  /** White wash (2 coats) */
  whiteWash?: number;
  /** Texture putty */
  texturePutty?: number;
  /** Interior emulsion (2 primer + 2 finish) */
  interiorEmulsion?: number;
  /** Exterior apex ultima grade */
  exteriorApex?: number;
}

/** Waterproofing quantities in Sft */
export interface WaterproofingQuantities {
  /** Terrace/roof slab waterproofing */
  terraceWaterproofing?: number;
  /** Bathroom / wet area waterproofing */
  bathroomWaterproofing?: number;
  /** Sump waterproofing */
  sumpWaterproofing?: number;
}

/** Fabrication (MS Grill / Gate / Railing) quantities */
export interface FabricationQuantities {
  /** MS grill in Sft */
  msGrill?: number;
  /** MS gate in Kgs */
  msGate?: number;
  /** SS / MS Balcony handrail in Rft */
  balconyHandrail?: number;
  /** Staircase railing in Rft */
  staircaseRailing?: number;
}

/** Joinery (doors & windows) quantities */
export interface JoineryQuantities {
  /** Main door (teak / engineered wood) in Nos */
  mainDoor?: number;
  /** Internal flush door in Nos */
  internalDoor?: number;
  /** UPVC / aluminium windows in Sft */
  windows?: number;
}

/** Electrical quantities */
export interface ElectricalQuantities {
  /** Wiring points (light, fan, plug) — total Nos */
  totalPoints?: number;
  /** DB boxes — Nos */
  dbBoxes?: number;
  /** Cable trays, conduit, earthing — Lump sum amount */
  lumpSum?: number;
}

/** Plumbing quantities */
export interface PlumbingQuantities {
  /** Total fixtures (WC, basin, shower, tap) — Nos */
  totalFixtures?: number;
  /** Pipe length in Rft (CPVC / UPVC) */
  pipeLength?: number;
  /** Lump sum for complete package */
  lumpSum?: number;
}

/** Complete input for one floor / zone */
export interface FloorBOQ {
  zone: FloorZone;
  /** Built-up area of this floor in Sft */
  builtUpArea: number;
  /** Excavation quantities */
  excavation?: {
    upTo5ft: number;   // Cft
    above5ft?: number; // Cft
  };
  /** PCC (Plain Cement Concrete) volume in Cft */
  pcc?: number;
  /** MSand cushion volume in Cft */
  msandCushion?: number;
  /** RCC structural quantities */
  rcc?: RCCQuantities;
  /** Centering quantities */
  centering?: CenteringQuantities;
  /** Steel bar bending schedule — total metres per dia */
  steel?: SteelByDiameter;
  /** Masonry */
  masonry?: MasonryQuantities;
  /** Anti-termite treatment area in Sft */
  antiTermite?: number;
  /** Back fill volume in Cft */
  backFill?: number;
  /** Plaster */
  plaster?: PlasterQuantities;
  /** Surkhi / brick-bat coba in Cft (terraces) */
  surkhi?: number;
  /** Flooring */
  flooring?: FlooringQuantities;
  /** Painting */
  painting?: PaintingQuantities;
  /** Waterproofing */
  waterproofing?: WaterproofingQuantities;
  /** Fabrication */
  fabrication?: FabricationQuantities;
  /** Joinery */
  joinery?: JoineryQuantities;
  /** Electrical (pass-through amount or detailed) */
  electrical?: ElectricalQuantities;
  /** Plumbing (pass-through amount or detailed) */
  plumbing?: PlumbingQuantities;
  /** River sand escalation for plastering (GF only, lump sum) */
  riverSandEscalation?: number;
  /** RR masonry for compound wall in Cft */
  rrMasonry?: number;
  /** Ramp formation in Cft */
  rampFormation?: number;
  /** Ramp PCC in Cft */
  rampPCC?: number;
  /** Elevation cladding / texture in Sft */
  elevationCladding?: number;
  /** Balcony handrail elevation works per floor (Sft) */
  elevationWorks?: number;
  /** Pest control Sft */
  pestControl?: number;
  /** Manhole covers (Nos) */
  manholeCovers?: number;
  /** FRP manhole unit cost override (default from rate card) */
  manholeUnitCost?: number;
}

/** Project-level input */
export interface ProjectBOQ {
  projectName: string;
  clientName: string;
  contractor: string;
  architect?: string;
  date: string;
  /** Total built-up area in Sft (sum of all floors) */
  totalBuiltUpArea: number;
  floors: FloorBOQ[];
}

/** Line item in the estimate */
export interface LineItem {
  sno: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

/** Estimate per floor / zone */
export interface FloorEstimate {
  zone: FloorZone;
  builtUpArea: number;
  civil: LineItem[];
  centering: LineItem[];
  steel: LineItem[];
  masonry: LineItem[];
  plaster: LineItem[];
  flooring: LineItem[];
  painting: LineItem[];
  waterproofing: LineItem[];
  fabrication: LineItem[];
  joinery: LineItem[];
  electrical: LineItem[];
  plumbing: LineItem[];
  misc: LineItem[];
  subtotalCivil: number;
  subtotalFlooring: number;
  subtotalPainting: number;
  subtotalFabrication: number;
  subtotalJoineries: number;
  subtotalElectrical: number;
  subtotalPlumbing: number;
  subtotalWaterproofing: number;
  subtotalMisc: number;
  floorTotal: number;
}

/** Final project estimate output */
export interface ProjectEstimate {
  projectName: string;
  clientName: string;
  contractor: string;
  date: string;
  totalBuiltUpArea: number;
  floorEstimates: FloorEstimate[];
  /** Part A — structural & finishing inside building */
  partA: {
    civil: number;
    flooring: number;
    painting: number;     // white wash
    fabrication: number;  // grills
    joineries: number;
    electrical: number;
    plumbing: number;
    riverSandEscalation: number;
    total: number;
    ratePerSft: number;
  };
  /** Part B — optional / external finishing */
  partB: {
    painting: number;     // emulsion / apex
    fabrication: number;  // handrails
    waterproofing: number;
    balconyHandrails: number;
    elevationWorks: number;
    total: number;
    ratePerSft: number;
  };
  /** Part C — external works */
  partC: {
    civil: number;        // compound, sump, septic, outer formation
    elevation: number;
    fabrication: number;  // gate
    waterproofing: number;
    total: number;
  };
  grandTotal: number;
  grandTotalRatePerSft: number;
}

// ─────────────────────────────────────────────────────────────
// 2. STEEL WEIGHT CONSTANTS (kg per metre, per IS standards)
// ─────────────────────────────────────────────────────────────

/** kg per linear metre for each bar diameter */
export const STEEL_UNIT_WEIGHT_KG_PER_M: Record<keyof SteelByDiameter, number> = {
  dia8:  0.395,
  dia10: 0.617,
  dia12: 0.888,
  dia16: 1.580,
  dia20: 2.469,
  dia25: 3.854,
  dia32: 6.313,
};

/**
 * Convert BBS metres per diameter to total weight in MT (metric tonnes).
 * Formula: Σ (length_in_m × unit_weight_kg_per_m) / 1000
 */
export function calcSteelWeightMT(steel: SteelByDiameter): number {
  let totalKg = 0;
  for (const [dia, metres] of Object.entries(steel) as [keyof SteelByDiameter, number][]) {
    if (metres && STEEL_UNIT_WEIGHT_KG_PER_M[dia]) {
      totalKg += metres * STEEL_UNIT_WEIGHT_KG_PER_M[dia];
    }
  }
  return totalKg / 1000;
}

// ─────────────────────────────────────────────────────────────
// 3. RATE CARDS
// All rates in INR. Adjust to current market prices.
// ─────────────────────────────────────────────────────────────

export interface RateCard {
  // Civil – Earthwork
  excavationUpTo5ft: number;      // per Cft
  excavationAbove5ft: number;     // per Cft
  backFilling: number;            // per Cft
  rampFormation: number;          // per Cft
  bringEarthFromOutside: number;  // per Cft

  // Civil – PCC & Concrete
  pcc148: number;                 // plain cement concrete 1:4:8 per Cft
  msandCushion: number;           // per Cft
  surkhi: number;                 // brick bat coba per Cft
  screedFlooring: number;         // 3" screed per Sft

  // Civil – RCC (concrete only, excluding steel & shuttering)
  rccFooting: number;             // per Cft
  rccColumn_GF: number;           // Ground floor
  rccColumn_FF: number;           // First floor (height factor applied)
  rccColumn_SF: number;
  rccColumn_TF: number;
  rccColumn_Terrace: number;
  rccColumn_OHT: number;
  rccColumn_Compound: number;     // compound wall columns
  rccPlinthBeam: number;          // per Cft
  rccSillLintel_GF: number;
  rccSillLintel_FF: number;
  rccSillLintel_SF: number;
  rccSillLintel_TF: number;
  rccSillLintel_Terrace: number;
  rccRoofBeam_GF: number;
  rccRoofBeam_FF: number;
  rccRoofBeam_SF: number;
  rccRoofBeam_TF: number;
  rccRoofBeam_Terrace: number;
  rccRoofSlab_GF: number;
  rccRoofSlab_FF: number;
  rccRoofSlab_SF: number;
  rccRoofSlab_TF: number;
  rccRoofSlab_Terrace: number;
  rccStaircase_GF: number;
  rccStaircase_FF: number;
  rccStaircase_SF: number;
  rccStaircase_TF: number;
  rccBaseSlab: number;            // sump / septic
  rccRCWall: number;
  rccCoverSlab: number;

  // Civil – Centering (shuttering)
  centeringFooting: number;       // per Sft
  centeringColumn_GF: number;
  centeringColumn_FF: number;
  centeringColumn_SF: number;
  centeringColumn_TF: number;
  centeringColumn_Terrace: number;
  centeringPlinthBeam: number;
  centeringSillLintel: number;
  centeringRoofBeam: number;
  centeringRoofSlab: number;
  centeringStaircase: number;
  centeringBaseSlab: number;
  centeringRCWall: number;
  centeringCoverSlab: number;

  // Steel – TOR Fe-500
  steelRate_GF: number;           // per MT
  steelRate_FF: number;
  steelRate_SF: number;
  steelRate_TF: number;
  steelRate_Terrace: number;
  steelRate_Compound: number;
  steelRate_SumpSeptic: number;
  steelRate_Elevation: number;

  // Masonry
  brickWork9inch: number;         // per Cft
  brickWork4_5inch: number;       // per Sft
  brickOnEdge: number;            // per Rft (compound)
  rrMasonry: number;              // Random Rubble per Cft (compound footing)

  // Plaster
  exteriorPlaster: number;        // per Sft (20mm CM 1:5 ext)
  interiorPlaster: number;        // per Sft (20mm CM 1:5 int)
  ceilingPlaster: number;         // per Sft
  beamColumnPlaster: number;      // exposed beams & columns

  // Anti-termite
  antiTermiteTreatment: number;   // per Sft

  // Flooring
  vitrifiedTiles: number;         // per Sft (supply + fix)
  antiSkidTiles: number;
  granite: number;
  surchargeScreed: number;        // extra if required

  // Painting
  whiteWash: number;              // per Sft (2 coats)
  texturePutty: number;           // per Sft
  interiorEmulsion: number;       // per Sft (2 primer + 2 coats)
  exteriorApex: number;           // per Sft

  // Waterproofing
  terraceWaterproofing: number;   // per Sft
  bathroomWaterproofing: number;  // per Sft
  sumpWaterproofing: number;      // per Sft

  // Fabrication
  msGrill: number;                // per Sft
  msGate: number;                 // per Kg
  balconyHandrail: number;        // per Rft
  staircaseRailing: number;       // per Rft

  // Joinery (approximate lump-sum per unit; refine with actual BOQ)
  mainDoor: number;               // per Nos
  internalDoor: number;           // per Nos
  windows: number;                // per Sft

  // Electrical (lump sum per floor or per point)
  electricalPerPoint: number;     // per point (wiring only)
  electricalLumpSumGF: number;    // if using lump sum override

  // Plumbing
  plumbingPerFixture: number;
  plumbingLumpSumGF: number;

  // Pest control
  pestControl: number;            // per Sft

  // Elevation / façade
  elevationCladding: number;      // per Sft (texture / stone cladding)
  elevationWorksPerFloor: number; // Per Sft projected area

  // Manhole
  frpManholecover2x2: number;     // per Nos
}

/**
 * DEFAULT RATE CARD
 * Extracted from the reference BOQ (Abi Residence, Dec 2025).
 * Override any rate for market-adjusted estimates.
 */
export const DEFAULT_RATES: RateCard = {
  // Earthwork
  excavationUpTo5ft:      12,
  excavationAbove5ft:     14,
  backFilling:             8,
  rampFormation:          44,
  bringEarthFromOutside:  44,

  // PCC & Misc concrete
  pcc148:                183,
  msandCushion:           82,
  surkhi:                150,
  screedFlooring:         85,

  // RCC – Concrete (excl. steel & centering)
  rccFooting:            196,
  rccColumn_GF:          230,
  rccColumn_FF:          244,
  rccColumn_SF:          259,
  rccColumn_TF:          275,
  rccColumn_Terrace:     292,
  rccColumn_OHT:         292,
  rccColumn_Compound:    230,
  rccPlinthBeam:         207,
  rccSillLintel_GF:      230,
  rccSillLintel_FF:      244,
  rccSillLintel_SF:      259,
  rccSillLintel_TF:      275,
  rccSillLintel_Terrace: 292,
  rccRoofBeam_GF:        207,
  rccRoofBeam_FF:        219.5,
  rccRoofBeam_SF:        233,
  rccRoofBeam_TF:        247,
  rccRoofBeam_Terrace:   262,
  rccRoofSlab_GF:        207,
  rccRoofSlab_FF:        219.5,
  rccRoofSlab_SF:        233,
  rccRoofSlab_TF:        247,
  rccRoofSlab_Terrace:   262,
  rccStaircase_GF:       230,
  rccStaircase_FF:       244,
  rccStaircase_SF:       259,
  rccStaircase_TF:       275,
  rccBaseSlab:           196,
  rccRCWall:             230,
  rccCoverSlab:          207,

  // Centering
  centeringFooting:        70,
  centeringColumn_GF:      70,
  centeringColumn_FF:      75,
  centeringColumn_SF:      80,
  centeringColumn_TF:      85,
  centeringColumn_Terrace: 90,
  centeringPlinthBeam:     70,
  centeringSillLintel:     75,
  centeringRoofBeam:       75,
  centeringRoofSlab:       75,
  centeringStaircase:     105,
  centeringBaseSlab:       70,
  centeringRCWall:         70,
  centeringCoverSlab:      70,

  // Steel – rates increase floor-by-floor (material + handling)
  steelRate_GF:        90000,
  steelRate_FF:        93000,
  steelRate_SF:        95000,
  steelRate_TF:        97000,
  steelRate_Terrace:   99000,
  steelRate_Compound:  91000,
  steelRate_SumpSeptic:91000,
  steelRate_Elevation: 93000,

  // Masonry
  brickWork9inch:    326.5,
  brickWork4_5inch:  154,
  brickOnEdge:       120,    // estimated; not in reference BOQ
  rrMasonry:         153,

  // Plaster
  exteriorPlaster:  67,
  interiorPlaster:  58,
  ceilingPlaster:   54.5,
  beamColumnPlaster:72,

  // Anti-termite
  antiTermiteTreatment: 10,

  // Flooring
  vitrifiedTiles:   220,
  antiSkidTiles:    180,
  granite:          280,
  surchargeScreed:  85,

  // Painting
  whiteWash:         6,
  texturePutty:     50,
  interiorEmulsion: 35,
  exteriorApex:     25,

  // Waterproofing
  terraceWaterproofing:   60,
  bathroomWaterproofing:  75,
  sumpWaterproofing:      90,

  // Fabrication
  msGrill:           175,
  msGate:            175,
  balconyHandrail:  1800,   // per Rft (SS/MS fabricated)
  staircaseRailing: 1500,

  // Joinery
  mainDoor:        35000,
  internalDoor:    12000,
  windows:           450,  // per Sft of opening

  // Electrical
  electricalPerPoint:  2500,
  electricalLumpSumGF: 322080,

  // Plumbing
  plumbingPerFixture:  15000,
  plumbingLumpSumGF:   248880,

  // Misc
  pestControl:                 10,
  elevationCladding:          120,
  elevationWorksPerFloor:    5000,
  frpManholecover2x2:        5200,
};

// ─────────────────────────────────────────────────────────────
// 4. HELPER UTILITIES
// ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function li(
  sno: string,
  description: string,
  quantity: number,
  unit: string,
  rate: number,
): LineItem {
  return { sno, description, quantity: round2(quantity), unit, rate, amount: round2(quantity * rate) };
}

/** Pick the correct per-floor rate key for columns */
function columnRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':   return r.rccColumn_GF;
    case 'FirstFloor':    return r.rccColumn_FF;
    case 'SecondFloor':   return r.rccColumn_SF;
    case 'ThirdFloor':    return r.rccColumn_TF;
    case 'Terrace':
    case 'OHT':           return r.rccColumn_Terrace;
    case 'CompoundWall':  return r.rccColumn_Compound;
    default:              return r.rccColumn_GF;
  }
}

function sillLintelRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':  return r.rccSillLintel_GF;
    case 'FirstFloor':   return r.rccSillLintel_FF;
    case 'SecondFloor':  return r.rccSillLintel_SF;
    case 'ThirdFloor':   return r.rccSillLintel_TF;
    default:             return r.rccSillLintel_Terrace;
  }
}

function roofBeamRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':  return r.rccRoofBeam_GF;
    case 'FirstFloor':   return r.rccRoofBeam_FF;
    case 'SecondFloor':  return r.rccRoofBeam_SF;
    case 'ThirdFloor':   return r.rccRoofBeam_TF;
    default:             return r.rccRoofBeam_Terrace;
  }
}

function roofSlabRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':  return r.rccRoofSlab_GF;
    case 'FirstFloor':   return r.rccRoofSlab_FF;
    case 'SecondFloor':  return r.rccRoofSlab_SF;
    case 'ThirdFloor':   return r.rccRoofSlab_TF;
    default:             return r.rccRoofSlab_Terrace;
  }
}

function staircaseRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':  return r.rccStaircase_GF;
    case 'FirstFloor':   return r.rccStaircase_FF;
    case 'SecondFloor':  return r.rccStaircase_SF;
    case 'ThirdFloor':   return r.rccStaircase_TF;
    default:             return r.rccStaircase_TF;
  }
}

function centeringColumnRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':  return r.centeringColumn_GF;
    case 'FirstFloor':   return r.centeringColumn_FF;
    case 'SecondFloor':  return r.centeringColumn_SF;
    case 'ThirdFloor':   return r.centeringColumn_TF;
    default:             return r.centeringColumn_Terrace;
  }
}

function steelRate(zone: FloorZone, r: RateCard): number {
  switch (zone) {
    case 'GroundFloor':      return r.steelRate_GF;
    case 'FirstFloor':       return r.steelRate_FF;
    case 'SecondFloor':      return r.steelRate_SF;
    case 'ThirdFloor':       return r.steelRate_TF;
    case 'Terrace':
    case 'OHT':              return r.steelRate_Terrace;
    case 'CompoundWall':     return r.steelRate_Compound;
    case 'SepticTank':
    case 'Sump':             return r.steelRate_SumpSeptic;
    case 'Elevation':        return r.steelRate_Elevation;
    default:                 return r.steelRate_GF;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. FLOOR-LEVEL ESTIMATOR
// ─────────────────────────────────────────────────────────────

export function estimateFloor(boq: FloorBOQ, rates: RateCard = DEFAULT_RATES): FloorEstimate {
  const z = boq.zone;
  const civil: LineItem[] = [];
  const centering: LineItem[] = [];
  const steelItems: LineItem[] = [];
  const masonry: LineItem[] = [];
  const plaster: LineItem[] = [];
  const flooring: LineItem[] = [];
  const painting: LineItem[] = [];
  const waterproofing: LineItem[] = [];
  const fabrication: LineItem[] = [];
  const joinery: LineItem[] = [];
  const electrical: LineItem[] = [];
  const plumbing: LineItem[] = [];
  const misc: LineItem[] = [];

  let snoCounter = 1;
  const nextSno = () => String(snoCounter++);

  // ── CIVIL ──────────────────────────────────────────────────

  // Excavation
  if (boq.excavation) {
    if (boq.excavation.upTo5ft > 0) {
      civil.push(li(nextSno(),
        'Excavation in ordinary soils, upto 5\'0" depth', 
        boq.excavation.upTo5ft, 'Cft', rates.excavationUpTo5ft));
    }
    if ((boq.excavation.above5ft ?? 0) > 0) {
      civil.push(li(nextSno(),
        'Excavation in ordinary soils, above 5\'0" depth',
        boq.excavation.above5ft!, 'Cft', rates.excavationAbove5ft));
    }
  }

  // PCC 1:4:8
  if (boq.pcc && boq.pcc > 0) {
    civil.push(li(nextSno(),
      'PCC 1:4:8 using 40mm aggregate, 150mm layers, compacted',
      boq.pcc, 'Cft', rates.pcc148));
  }

  // MSand Cushion
  if (boq.msandCushion && boq.msandCushion > 0) {
    civil.push(li(nextSno(),
      'Supply and laying of M-sand as cushioning layer',
      boq.msandCushion, 'Cft', rates.msandCushion));
  }

  // RCC elements
  if (boq.rcc) {
    const rcc = boq.rcc;

    if ((rcc.footing ?? 0) > 0) {
      civil.push(li(nextSno(),
        'RCC 1:1.5:3 M20 – Footing (excl. steel & shuttering)',
        rcc.footing!, 'Cft', rates.rccFooting));
    }
    if ((rcc.column ?? 0) > 0) {
      civil.push(li(nextSno(),
        `RCC 1:1.5:3 M20 – Column (excl. steel & shuttering) [${z}]`,
        rcc.column!, 'Cft', columnRate(z, rates)));
    }
    if ((rcc.plinthBeam ?? 0) > 0) {
      civil.push(li(nextSno(),
        'RCC 1:1.5:3 M20 – Plinth Beam (excl. steel & shuttering)',
        rcc.plinthBeam!, 'Cft', rates.rccPlinthBeam));
    }
    if ((rcc.sillLintel ?? 0) > 0) {
      civil.push(li(nextSno(),
        `RCC 1:1.5:3 M20 – Sill & Lintel (excl. steel & shuttering) [${z}]`,
        rcc.sillLintel!, 'Cft', sillLintelRate(z, rates)));
    }
    if ((rcc.roofBeam ?? 0) > 0) {
      civil.push(li(nextSno(),
        `RCC 1:1.5:3 M20 – Roof Beam (excl. steel & shuttering) [${z}]`,
        rcc.roofBeam!, 'Cft', roofBeamRate(z, rates)));
    }
    if ((rcc.roofSlab ?? 0) > 0) {
      civil.push(li(nextSno(),
        `RCC 1:1.5:3 M20 – Roof Slab (excl. steel & shuttering) [${z}]`,
        rcc.roofSlab!, 'Cft', roofSlabRate(z, rates)));
    }
    if ((rcc.staircase ?? 0) > 0) {
      civil.push(li(nextSno(),
        `RCC 1:1.5:3 M20 – Staircase (excl. steel & shuttering) [${z}]`,
        rcc.staircase!, 'Cft', staircaseRate(z, rates)));
    }
    if ((rcc.baseSlab ?? 0) > 0) {
      civil.push(li(nextSno(),
        'RCC 1:1.5:3 M20 – Base Slab (Sump/Septic)',
        rcc.baseSlab!, 'Cft', rates.rccBaseSlab));
    }
    if ((rcc.rcWall ?? 0) > 0) {
      civil.push(li(nextSno(),
        'RCC 1:1.5:3 M20 – RC Wall (Sump/Septic)',
        rcc.rcWall!, 'Cft', rates.rccRCWall));
    }
    if ((rcc.coverSlab ?? 0) > 0) {
      civil.push(li(nextSno(),
        'RCC 1:1.5:3 M20 – Cover Slab (Sump/Septic)',
        rcc.coverSlab!, 'Cft', rates.rccCoverSlab));
    }
  }

  // RR Masonry (Compound foundation)
  if ((boq.rrMasonry ?? 0) > 0) {
    civil.push(li(nextSno(),
      'RR Masonry using RR Stone in CM 1:7 – compound wall footing',
      boq.rrMasonry!, 'Cft', rates.rrMasonry));
  }

  // Ramp
  if ((boq.rampFormation ?? 0) > 0) {
    civil.push(li(nextSno(), 'Ramp Formation', boq.rampFormation!, 'Cft', rates.rampFormation));
  }
  if ((boq.rampPCC ?? 0) > 0) {
    civil.push(li(nextSno(), 'Ramp PCC 1:4:8', boq.rampPCC!, 'Cft', rates.pcc148));
  }

  // Back fill
  if ((boq.backFill ?? 0) > 0) {
    civil.push(li(nextSno(),
      'Back filling in foundations incl. watering & compacting in 150mm layers',
      boq.backFill!, 'Cft', rates.backFilling));
  }

  // Surkhi / brick-bat coba
  if ((boq.surkhi ?? 0) > 0) {
    civil.push(li(nextSno(),
      'Supply and laying of surkhi using brick bats',
      boq.surkhi!, 'Cft', rates.surkhi));
  }

  // Screed flooring (outer formation)
  if (boq.flooring?.screed && boq.flooring.screed > 0) {
    civil.push(li(nextSno(),
      'Supply and laying of screed flooring 3" thick over PCC',
      boq.flooring.screed, 'Sft', rates.screedFlooring));
  }

  // Outer formation: bring earth from outside
  if (z === 'OuterFormation' && boq.backFill && boq.backFill > 0) {
    // Already included above — but outer formation uses bringEarthFromOutside rate
    // Remove last backFill item and re-add with correct rate
    const last = civil[civil.length - 1];
    if (last && last.description.includes('Back filling')) {
      civil[civil.length - 1] = li(
        last.sno,
        'Bringing selected earth from outside & backfilling in layers',
        boq.backFill, 'Cft', rates.bringEarthFromOutside);
    }
  }

  // Anti-termite treatment
  if ((boq.antiTermite ?? 0) > 0) {
    civil.push(li(nextSno(),
      'Pest control – Anti-termite treatment',
      boq.antiTermite!, 'Sft', rates.antiTermiteTreatment));
  }

  // Pest control (for Sump etc.)
  if ((boq.pestControl ?? 0) > 0 && !(boq.antiTermite && boq.antiTermite === boq.pestControl)) {
    misc.push(li(nextSno(),
      'Pest control treatment',
      boq.pestControl!, 'Sft', rates.antiTermiteTreatment));
  }

  // Manhole covers
  if ((boq.manholeCovers ?? 0) > 0) {
    misc.push(li(nextSno(),
      "Supply and fixing of 2'x2' FRP Manhole covers",
      boq.manholeCovers!, 'Nos', boq.manholeUnitCost ?? rates.frpManholecover2x2));
  }

  // ── CENTERING ─────────────────────────────────────────────

  if (boq.centering) {
    const c = boq.centering;
    if ((c.footing ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Footing',
        c.footing!, 'Sft', rates.centeringFooting));
    }
    if ((c.column ?? 0) > 0) {
      centering.push(li(nextSno(),
        `Centering & deshuttering – Column [${z}]`,
        c.column!, 'Sft', centeringColumnRate(z, rates)));
    }
    if ((c.plinthBeam ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Plinth Beam',
        c.plinthBeam!, 'Sft', rates.centeringPlinthBeam));
    }
    if ((c.sillLintel ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Sill & Lintel',
        c.sillLintel!, 'Sft', rates.centeringSillLintel));
    }
    if ((c.roofBeam ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Roof Beam',
        c.roofBeam!, 'Sft', rates.centeringRoofBeam));
    }
    if ((c.roofSlab ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Roof Slab',
        c.roofSlab!, 'Sft', rates.centeringRoofSlab));
    }
    if ((c.staircase ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Staircase',
        c.staircase!, 'Sft', rates.centeringStaircase));
    }
    if ((c.baseSlab ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Base Slab',
        c.baseSlab!, 'Sft', rates.centeringBaseSlab));
    }
    if ((c.rcWall ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – RC Wall',
        c.rcWall!, 'Sft', rates.centeringRCWall));
    }
    if ((c.coverSlab ?? 0) > 0) {
      centering.push(li(nextSno(),
        'Centering & deshuttering – Cover Slab',
        c.coverSlab!, 'Sft', rates.centeringCoverSlab));
    }
  }

  // ── STEEL ─────────────────────────────────────────────────

  if (boq.steel) {
    const weightMT = calcSteelWeightMT(boq.steel);
    if (weightMT > 0) {
      steelItems.push(li(nextSno(),
        `TOR Steel Fe-500 – supply, cut, bend, bind & fix in position [${z}]`,
        weightMT, 'MT', steelRate(z, rates)));
    }
  }

  // ── MASONRY ───────────────────────────────────────────────

  if (boq.masonry) {
    const m = boq.masonry;
    if ((m.nineInch ?? 0) > 0) {
      masonry.push(li(nextSno(),
        'Masonry CM 1:5, 9" thick – Wire-cut bricks incl. scaffolding & curing',
        m.nineInch!, 'Cft', rates.brickWork9inch));
    }
    if ((m.fourPointFiveInch ?? 0) > 0) {
      masonry.push(li(nextSno(),
        'Masonry CM 1:5, 4.5" thick – Wire-cut bricks incl. scaffolding & curing',
        m.fourPointFiveInch!, 'Sft', rates.brickWork4_5inch));
    }
    if ((m.brickOnEdge ?? 0) > 0) {
      masonry.push(li(nextSno(),
        'Brick on edge using fly-ash bricks CM 1:5, 9" thick (compound)',
        m.brickOnEdge!, 'Rft', rates.brickOnEdge));
    }
  }

  // ── PLASTER ───────────────────────────────────────────────

  if (boq.plaster) {
    const p = boq.plaster;
    if ((p.exteriorWalls ?? 0) > 0) {
      plaster.push(li(nextSno(),
        'Plastering – exterior walls, CM 1:5, 20mm thick incl. mesh at joints',
        p.exteriorWalls!, 'Sft', rates.exteriorPlaster));
    }
    if ((p.interiorWalls ?? 0) > 0) {
      plaster.push(li(nextSno(),
        'Plastering – interior walls, CM 1:5, 20mm thick',
        p.interiorWalls!, 'Sft', rates.interiorPlaster));
    }
    if ((p.ceiling ?? 0) > 0) {
      plaster.push(li(nextSno(),
        'Plastering – ceiling, CM 1:5, 20mm thick',
        p.ceiling!, 'Sft', rates.ceilingPlaster));
    }
    if ((p.beamColumn ?? 0) > 0) {
      plaster.push(li(nextSno(),
        'Plastering – exposed beams & columns, CM 1:5, 20mm thick',
        p.beamColumn!, 'Sft', rates.beamColumnPlaster));
    }
  }

  // ── FLOORING ──────────────────────────────────────────────

  if (boq.flooring) {
    const f = boq.flooring;
    if ((f.vitrifiedTiles ?? 0) > 0) {
      flooring.push(li(nextSno(),
        'Vitrified tile flooring – supply & fix incl. adhesive & grouting',
        f.vitrifiedTiles!, 'Sft', rates.vitrifiedTiles));
    }
    if ((f.antiSkidTiles ?? 0) > 0) {
      flooring.push(li(nextSno(),
        'Anti-skid tile flooring (bathroom/utility) – supply & fix',
        f.antiSkidTiles!, 'Sft', rates.antiSkidTiles));
    }
    if ((f.granite ?? 0) > 0) {
      flooring.push(li(nextSno(),
        'Granite / natural stone flooring – supply & fix',
        f.granite!, 'Sft', rates.granite));
    }
    // screed already under civil
  }

  // ── PAINTING ──────────────────────────────────────────────

  if (boq.painting) {
    const p = boq.painting;
    if ((p.whiteWash ?? 0) > 0) {
      painting.push(li(nextSno(),
        'White wash – 2 coats over plastered / concrete surface',
        p.whiteWash!, 'Sft', rates.whiteWash));
    }
    if ((p.texturePutty ?? 0) > 0) {
      painting.push(li(nextSno(),
        'Texture putty – supply & application',
        p.texturePutty!, 'Sft', rates.texturePutty));
    }
    if ((p.interiorEmulsion ?? 0) > 0) {
      painting.push(li(nextSno(),
        'Interior emulsion – 2 coats primer + 2 coats finish',
        p.interiorEmulsion!, 'Sft', rates.interiorEmulsion));
    }
    if ((p.exteriorApex ?? 0) > 0) {
      painting.push(li(nextSno(),
        'Exterior apex ultima – 2 coats primer + 2 coats apex',
        p.exteriorApex!, 'Sft', rates.exteriorApex));
    }
  }

  // ── WATERPROOFING ─────────────────────────────────────────

  if (boq.waterproofing) {
    const w = boq.waterproofing;
    if ((w.terraceWaterproofing ?? 0) > 0) {
      waterproofing.push(li(nextSno(),
        'Waterproofing – terrace / roof slab (crystalline / membrane)',
        w.terraceWaterproofing!, 'Sft', rates.terraceWaterproofing));
    }
    if ((w.bathroomWaterproofing ?? 0) > 0) {
      waterproofing.push(li(nextSno(),
        'Waterproofing – bathroom & wet areas',
        w.bathroomWaterproofing!, 'Sft', rates.bathroomWaterproofing));
    }
    if ((w.sumpWaterproofing ?? 0) > 0) {
      waterproofing.push(li(nextSno(),
        'Waterproofing – Sump (crystalline coating)',
        w.sumpWaterproofing!, 'Sft', rates.sumpWaterproofing));
    }
  }

  // ── FABRICATION ───────────────────────────────────────────

  if (boq.fabrication) {
    const f = boq.fabrication;
    if ((f.msGrill ?? 0) > 0) {
      fabrication.push(li(nextSno(),
        'MS grill – supply & fix incl. enamel paint',
        f.msGrill!, 'Sft', rates.msGrill));
    }
    if ((f.msGate ?? 0) > 0) {
      fabrication.push(li(nextSno(),
        'MS gate – supply & fix incl. enamel paint',
        f.msGate!, 'Kgs', rates.msGate));
    }
    if ((f.balconyHandrail ?? 0) > 0) {
      fabrication.push(li(nextSno(),
        'Balcony handrail – SS / MS fabricated',
        f.balconyHandrail!, 'Rft', rates.balconyHandrail));
    }
    if ((f.staircaseRailing ?? 0) > 0) {
      fabrication.push(li(nextSno(),
        'Staircase railing – SS / MS fabricated',
        f.staircaseRailing!, 'Rft', rates.staircaseRailing));
    }
  }

  // ── JOINERY ───────────────────────────────────────────────

  if (boq.joinery) {
    const j = boq.joinery;
    if ((j.mainDoor ?? 0) > 0) {
      joinery.push(li(nextSno(),
        'Main door – teak / engineered wood frame & shutter incl. hardware',
        j.mainDoor!, 'Nos', rates.mainDoor));
    }
    if ((j.internalDoor ?? 0) > 0) {
      joinery.push(li(nextSno(),
        'Internal flush door – frame & shutter incl. hardware',
        j.internalDoor!, 'Nos', rates.internalDoor));
    }
    if ((j.windows ?? 0) > 0) {
      joinery.push(li(nextSno(),
        'UPVC / aluminium windows – supply & fix',
        j.windows!, 'Sft', rates.windows));
    }
  }

  // ── ELECTRICAL ────────────────────────────────────────────

  if (boq.electrical) {
    const e = boq.electrical;
    if (e.lumpSum && e.lumpSum > 0) {
      electrical.push(li(nextSno(),
        'Electrical works with fittings (lump sum)',
        1, 'LS', e.lumpSum));
    } else if ((e.totalPoints ?? 0) > 0) {
      electrical.push(li(nextSno(),
        'Electrical wiring & fittings – per point',
        e.totalPoints!, 'Nos', rates.electricalPerPoint));
    }
  }

  // ── PLUMBING ──────────────────────────────────────────────

  if (boq.plumbing) {
    const p = boq.plumbing;
    if (p.lumpSum && p.lumpSum > 0) {
      plumbing.push(li(nextSno(),
        'Plumbing works with fittings (lump sum)',
        1, 'LS', p.lumpSum));
    } else if ((p.totalFixtures ?? 0) > 0) {
      plumbing.push(li(nextSno(),
        'Plumbing – CPVC/UPVC piping & fixtures',
        p.totalFixtures!, 'Nos', rates.plumbingPerFixture));
    }
  }

  // ── ELEVATION WORKS ───────────────────────────────────────

  if ((boq.elevationCladding ?? 0) > 0) {
    misc.push(li(nextSno(),
      'Elevation works – texture / cladding',
      boq.elevationCladding!, 'Sft', rates.elevationCladding));
  }

  // ── RIVER SAND ESCALATION ────────────────────────────────

  if ((boq.riverSandEscalation ?? 0) > 0) {
    misc.push(li(nextSno(),
      'River sand escalation for plastering (Kerala river sand)',
      1, 'LS', boq.riverSandEscalation!));
  }

  // ── SUBTOTALS ─────────────────────────────────────────────

  const sumItems = (items: LineItem[]) =>
    items.reduce((acc, i) => acc + i.amount, 0);

  const subtotalCivil = sumItems(civil) + sumItems(centering) + sumItems(steelItems) + sumItems(masonry) + sumItems(plaster);
  const subtotalFlooring = sumItems(flooring);
  const subtotalPainting = sumItems(painting);
  const subtotalFabrication = sumItems(fabrication);
  const subtotalJoineries = sumItems(joinery);
  const subtotalElectrical = sumItems(electrical);
  const subtotalPlumbing = sumItems(plumbing);
  const subtotalWaterproofing = sumItems(waterproofing);
  const subtotalMisc = sumItems(misc);

  const floorTotal = round2(
    subtotalCivil + subtotalFlooring + subtotalPainting +
    subtotalFabrication + subtotalJoineries + subtotalElectrical +
    subtotalPlumbing + subtotalWaterproofing + subtotalMisc
  );

  return {
    zone: z,
    builtUpArea: boq.builtUpArea,
    civil,
    centering,
    steel: steelItems,
    masonry,
    plaster,
    flooring,
    painting,
    waterproofing,
    fabrication,
    joinery,
    electrical,
    plumbing,
    misc,
    subtotalCivil: round2(subtotalCivil),
    subtotalFlooring: round2(subtotalFlooring),
    subtotalPainting: round2(subtotalPainting),
    subtotalFabrication: round2(subtotalFabrication),
    subtotalJoineries: round2(subtotalJoineries),
    subtotalElectrical: round2(subtotalElectrical),
    subtotalPlumbing: round2(subtotalPlumbing),
    subtotalWaterproofing: round2(subtotalWaterproofing),
    subtotalMisc: round2(subtotalMisc),
    floorTotal,
  };
}

// ─────────────────────────────────────────────────────────────
// 6. FULL PROJECT ESTIMATOR
// ─────────────────────────────────────────────────────────────

/**
 * Estimate the complete project cost from the BOQ input.
 *
 * The output mirrors the reference sheet's 3-part structure:
 *   Part A – structural / main building finishing (rate per Sft)
 *   Part B – optional finishings (emulsion, handrails, waterproofing, elevation)
 *   Part C – external works (compound wall, sump, septic tank, outer formation, elevation)
 */
export function estimateProject(
  project: ProjectBOQ,
  rates: RateCard = DEFAULT_RATES,
): ProjectEstimate {
  const floorEstimates = project.floors.map(f => estimateFloor(f, rates));

  // Partition floors into Part A, B, and Part C zones
  const partAZones: FloorZone[] = ['GroundFloor', 'FirstFloor', 'SecondFloor', 'ThirdFloor', 'Terrace', 'OHT'];
  const partCZones: FloorZone[] = ['CompoundWall', 'OuterFormation', 'SepticTank', 'Sump', 'Elevation'];

  const partAFloors = floorEstimates.filter(f => partAZones.includes(f.zone));
  const partCFloors = floorEstimates.filter(f => partCZones.includes(f.zone));

  // Part A aggregates
  const partA_civil = partAFloors.reduce((a, f) => a + f.subtotalCivil, 0);
  const partA_flooring = partAFloors.reduce((a, f) => a + f.subtotalFlooring, 0);

  // White wash only (from painting items)
  const partA_painting = partAFloors.reduce((a, f) =>
    a + f.painting.filter(p => p.description.toLowerCase().includes('white wash')).reduce((s, p) => s + p.amount, 0), 0);

  const partA_fabrication = partAFloors.reduce((a, f) =>
    a + f.fabrication.filter(i => i.description.toLowerCase().includes('grill')).reduce((s, i) => s + i.amount, 0), 0);

  const partA_joineries = partAFloors.reduce((a, f) => a + f.subtotalJoineries, 0);
  const partA_electrical = partAFloors.reduce((a, f) => a + f.subtotalElectrical, 0);
  const partA_plumbing = partAFloors.reduce((a, f) => a + f.subtotalPlumbing, 0);

  const partA_riverSand = partAFloors.reduce((a, f) =>
    a + f.misc.filter(m => m.description.toLowerCase().includes('river sand')).reduce((s, m) => s + m.amount, 0), 0);

  const partA_total = round2(
    partA_civil + partA_flooring + partA_painting + partA_fabrication +
    partA_joineries + partA_electrical + partA_plumbing + partA_riverSand
  );

  // Part B aggregates (emulsion/apex painting, handrails, waterproofing, elevation)
  const partB_painting = partAFloors.reduce((a, f) =>
    a + f.painting.filter(p => !p.description.toLowerCase().includes('white wash')).reduce((s, p) => s + p.amount, 0), 0);

  const partB_fabrication = partAFloors.reduce((a, f) =>
    a + f.fabrication.filter(i => !i.description.toLowerCase().includes('grill')).reduce((s, i) => s + i.amount, 0), 0);

  const partB_waterproofing = partAFloors.reduce((a, f) => a + f.subtotalWaterproofing, 0);

  const partB_balconyHandrails = partAFloors.reduce((a, f) =>
    a + f.fabrication.filter(i => i.description.toLowerCase().includes('handrail') || i.description.toLowerCase().includes('balcony')).reduce((s, i) => s + i.amount, 0), 0);

  const partB_elevation = partAFloors.reduce((a, f) =>
    a + f.misc.filter(m => m.description.toLowerCase().includes('elevation')).reduce((s, m) => s + m.amount, 0), 0);

  const partB_total = round2(partB_painting + partB_fabrication + partB_waterproofing + partB_elevation);

  // Part C aggregates (external works)
  const partC_civil = partCFloors.reduce((a, f) => a + f.subtotalCivil, 0);
  const partC_elevation = partCFloors.reduce((a, f) =>
    a + f.misc.filter(m => m.description.toLowerCase().includes('elevation')).reduce((s, m) => s + m.amount, 0), 0);
  const partC_fabrication = partCFloors.reduce((a, f) => a + f.subtotalFabrication, 0);
  const partC_waterproofing = partCFloors.reduce((a, f) => a + f.subtotalWaterproofing, 0);
  const partC_total = round2(partC_civil + partC_elevation + partC_fabrication + partC_waterproofing);

  const grandTotal = round2(partA_total + partB_total + partC_total);
  const grandTotalRatePerSft = round2(grandTotal / project.totalBuiltUpArea);

  return {
    projectName: project.projectName,
    clientName: project.clientName,
    contractor: project.contractor,
    date: project.date,
    totalBuiltUpArea: project.totalBuiltUpArea,
    floorEstimates,
    partA: {
      civil: round2(partA_civil),
      flooring: round2(partA_flooring),
      painting: round2(partA_painting),
      fabrication: round2(partA_fabrication),
      joineries: round2(partA_joineries),
      electrical: round2(partA_electrical),
      plumbing: round2(partA_plumbing),
      riverSandEscalation: round2(partA_riverSand),
      total: partA_total,
      ratePerSft: round2(partA_total / project.totalBuiltUpArea),
    },
    partB: {
      painting: round2(partB_painting),
      fabrication: round2(partB_fabrication),
      waterproofing: round2(partB_waterproofing),
      balconyHandrails: round2(partB_balconyHandrails),
      elevationWorks: round2(partB_elevation),
      total: partB_total,
      ratePerSft: round2(partB_total / project.totalBuiltUpArea),
    },
    partC: {
      civil: round2(partC_civil),
      elevation: round2(partC_elevation),
      fabrication: round2(partC_fabrication),
      waterproofing: round2(partC_waterproofing),
      total: partC_total,
    },
    grandTotal,
    grandTotalRatePerSft,
  };
}

// ─────────────────────────────────────────────────────────────
// 7. REPORT GENERATOR
// ─────────────────────────────────────────────────────────────

/** Formats a number as Indian Rupee string */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Generates a human-readable text summary of the estimate */
export function generateReport(estimate: ProjectEstimate): string {
  const lines: string[] = [];

  const sep = '═'.repeat(72);
  const sep2 = '─'.repeat(72);

  lines.push(sep);
  lines.push(`ABSTRACT ESTIMATE`);
  lines.push(`Project  : ${estimate.projectName}`);
  lines.push(`Client   : ${estimate.clientName}`);
  lines.push(`Contractor: ${estimate.contractor}`);
  lines.push(`Date     : ${estimate.date}`);
  lines.push(`Total BUA: ${estimate.totalBuiltUpArea.toLocaleString('en-IN')} Sft`);
  lines.push(sep);

  // Floor-wise summary
  lines.push('FLOOR-WISE SUMMARY');
  lines.push(sep2);
  for (const f of estimate.floorEstimates) {
    lines.push(`${f.zone.padEnd(20)} | Civil: ${formatINR(f.subtotalCivil).padStart(16)} | Total: ${formatINR(f.floorTotal).padStart(16)}`);
  }
  lines.push(sep2);

  // Part A
  lines.push('');
  lines.push('PART A – MAIN BUILDING (Structural + Core Finishing)');
  lines.push(sep2);
  lines.push(`  Civil (RCC + Masonry + Plaster)   : ${formatINR(estimate.partA.civil)}`);
  lines.push(`  Flooring                           : ${formatINR(estimate.partA.flooring)}`);
  lines.push(`  Painting (White Wash)              : ${formatINR(estimate.partA.painting)}`);
  lines.push(`  Fabrication (Grills)               : ${formatINR(estimate.partA.fabrication)}`);
  lines.push(`  Joineries (Doors & Windows)        : ${formatINR(estimate.partA.joineries)}`);
  lines.push(`  Electrical with fittings           : ${formatINR(estimate.partA.electrical)}`);
  lines.push(`  Plumbing with fittings             : ${formatINR(estimate.partA.plumbing)}`);
  lines.push(`  River Sand Escalation              : ${formatINR(estimate.partA.riverSandEscalation)}`);
  lines.push(sep2);
  lines.push(`  PART A TOTAL                       : ${formatINR(estimate.partA.total)}`);
  lines.push(`  Rate per Sft                       : ${formatINR(estimate.partA.ratePerSft)}`);

  // Part B
  lines.push('');
  lines.push('PART B – OPTIONAL / EXTERNAL FINISHING');
  lines.push(sep2);
  lines.push(`  Painting (Emulsion / Apex)         : ${formatINR(estimate.partB.painting)}`);
  lines.push(`  Fabrication (Handrails etc.)       : ${formatINR(estimate.partB.fabrication)}`);
  lines.push(`  Waterproofing                      : ${formatINR(estimate.partB.waterproofing)}`);
  lines.push(`  Balcony Handrails                  : ${formatINR(estimate.partB.balconyHandrails)}`);
  lines.push(`  Elevation Works                    : ${formatINR(estimate.partB.elevationWorks)}`);
  lines.push(sep2);
  lines.push(`  PART B TOTAL                       : ${formatINR(estimate.partB.total)}`);
  lines.push(`  Rate per Sft                       : ${formatINR(estimate.partB.ratePerSft)}`);

  // Part A + B
  const partAB = estimate.partA.total + estimate.partB.total;
  lines.push('');
  lines.push(`  PART A + B                         : ${formatINR(partAB)}`);
  lines.push(`  Rate per Sft                       : ${formatINR(round2(partAB / estimate.totalBuiltUpArea))}`);

  // Part C
  lines.push('');
  lines.push('PART C – EXTERNAL / SITE WORKS');
  lines.push(sep2);
  lines.push(`  Civil (Compound, Sump, Septic, OF) : ${formatINR(estimate.partC.civil)}`);
  lines.push(`  Elevation Compound                 : ${formatINR(estimate.partC.elevation)}`);
  lines.push(`  Fabrication (Gate etc.)            : ${formatINR(estimate.partC.fabrication)}`);
  lines.push(`  Waterproofing (Sump)               : ${formatINR(estimate.partC.waterproofing)}`);
  lines.push(sep2);
  lines.push(`  PART C TOTAL                       : ${formatINR(estimate.partC.total)}`);

  // Grand Total
  lines.push('');
  lines.push(sep);
  lines.push(`  GRAND TOTAL (A + B + C)            : ${formatINR(estimate.grandTotal)}`);
  lines.push(`  Total Built-Up Area                : ${estimate.totalBuiltUpArea.toLocaleString('en-IN')} Sft`);
  lines.push(`  Rate per Sft                       : ${formatINR(estimate.grandTotalRatePerSft)}`);
  lines.push(sep);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// 8. USAGE EXAMPLE  (remove / adapt for your integration)
// ─────────────────────────────────────────────────────────────

/**
 * EXAMPLE: How to use this engine for a new project.
 *
 * Steps:
 *  1. Read the architect's BOQ and extract quantities for each floor.
 *  2. Create a ProjectBOQ object below.
 *  3. Optionally override rates in DEFAULT_RATES for current market prices.
 *  4. Call estimateProject() and generateReport().
 */
export function exampleUsage(): void {
  const project: ProjectBOQ = {
    projectName:      'New Residence – Kalapatti',
    clientName:       'Mr. & Mrs. Example',
    contractor:       'Plumeria Contracting Services',
    architect:        'Archetype Design Solutions',
    date:             new Date().toLocaleDateString('en-IN'),
    totalBuiltUpArea: 2500, // Sft – update from architect's BOQ

    floors: [
      {
        zone: 'GroundFloor',
        builtUpArea: 1250,

        excavation: { upTo5ft: 4167, above5ft: 2289 },
        pcc: 381,
        msandCushion: 381,

        rcc: {
          footing:    979,
          column:     365,
          plinthBeam: 183,
          sillLintel: 35,
          roofBeam:   372,
          roofSlab:   578,
          staircase:  54,
        },

        centering: {
          footing:    581,
          column:     1410,
          plinthBeam: 488,
          sillLintel: 133,
          roofBeam:   1162,
          roofSlab:   1396,
          staircase:  156,
        },

        // Steel: provide total metres per diameter from BBS sheet
        steel: {
          dia8:  2400,
          dia10: 5800,
          dia12: 0,
          dia16: 3200,
          dia20: 800,
          dia25: 1200,
        },

        masonry: {
          nineInch:         850,  // Cft
          fourPointFiveInch:620,  // Sft
        },

        plaster: {
          exteriorWalls: 1800,
          interiorWalls: 3800,
          ceiling:       1400,
        },

        flooring: {
          vitrifiedTiles: 1050,
          antiSkidTiles:   200,
        },

        painting: {
          whiteWash:        5200,
          texturePutty:     3800,
          interiorEmulsion: 3800,
          exteriorApex:     1800,
        },

        waterproofing: { bathroomWaterproofing: 200 },

        fabrication: {
          msGrill:          106,  // Sft
          balconyHandrail:   20,  // Rft
        },

        joinery: {
          mainDoor:      1,
          internalDoor:  6,
          windows:      350,
        },

        electrical: { lumpSum: 322080 },
        plumbing:   { lumpSum: 248880 },

        riverSandEscalation: 135700,
      },

      {
        zone: 'FirstFloor',
        builtUpArea: 1250,

        rcc: {
          column:    203,
          sillLintel:131,
          roofBeam:  372,
          roofSlab:  597,
          staircase:  52,
        },

        centering: {
          column:    774,
          sillLintel:428,
          roofBeam:  1162,
          roofSlab:  1396,
          staircase: 156,
        },

        steel: {
          dia8:  2200,
          dia10: 5100,
          dia16: 2800,
          dia20: 700,
          dia25: 1100,
        },

        masonry: {
          nineInch:         1030,
          fourPointFiveInch: 922,
        },

        plaster: {
          exteriorWalls: 1967,
          interiorWalls: 4494,
          ceiling:       1615,
        },

        flooring: { vitrifiedTiles: 1100, antiSkidTiles: 150 },

        painting: {
          whiteWash:        5600,
          texturePutty:     4200,
          interiorEmulsion: 4200,
          exteriorApex:     1967,
        },

        waterproofing: { terraceWaterproofing: 220, bathroomWaterproofing: 150 },

        fabrication: { msGrill: 204, balconyHandrail: 40 },
        joinery:     { internalDoor: 7, windows: 420 },
        electrical:  { lumpSum: 380820 },
        plumbing:    { lumpSum: 302270 },
      },

      // Add SecondFloor, ThirdFloor, Terrace, OHT similarly...

      {
        zone: 'CompoundWall',
        builtUpArea: 0,
        excavation: { upTo5ft: 675 },
        rrMasonry:  1683,
        backFill:    675,
        rampFormation: 210,
        rampPCC:     69,
        rcc: { column: 41, plinthBeam: 94 },
        centering: { plinthBeam: 252, column: 180 },
        steel: { dia8: 500, dia12: 1000 },
        masonry: { brickOnEdge: 150 },
        fabrication: { msGate: 600 },
      },

      {
        zone: 'OuterFormation',
        builtUpArea: 0,
        pcc:     306,
        backFill: 1087,
        antiTermite: 929,
        flooring: { screed: 929 },
      },

      {
        zone: 'Sump',
        builtUpArea: 0,
        excavation: { upTo5ft: 869, above5ft: 738 },
        pcc:     86,
        msandCushion: 86,
        rcc: { baseSlab: 82, rcWall: 240, coverSlab: 54 },
        centering: { baseSlab: 31, rcWall: 725, coverSlab: 85 },
        backFill: 1608,
        steel: { dia8: 1200, dia10: 2800 },
        antiTermite: 173,
        plaster: { exteriorWalls: 453 },
        manholeCovers: 2,
      },
    ],
  };

  // Optionally override specific rates for current market
  const customRates: RateCard = {
    ...DEFAULT_RATES,
    brickWork9inch:   350,  // price has gone up
    steelRate_GF:     92000,
    interiorPlaster:   60,
  };

  const estimate = estimateProject(project, customRates);
  const report   = generateReport(estimate);

  console.log(report);

  // You can also access structured data:
  // estimate.grandTotal
  // estimate.grandTotalRatePerSft
  // estimate.floorEstimates[0].civil  → array of LineItems
}

// ─────────────────────────────────────────────────────────────
// Run example if executed directly
// ─────────────────────────────────────────────────────────────
// Uncomment to run: exampleUsage();