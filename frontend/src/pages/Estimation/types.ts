// ─────────────────────────────────────────────────
// Estimation Module Types
// ─────────────────────────────────────────────────

export interface Resource {
  id: string;
  unique_code: string;
  annexure: string;
  type: "labour" | "material" | "work_rate" | "equipment" | "conveyance" | "head_load";
  category: string;
  name: string;
  unit: string;
  basic_rate: number;
  hsn_sac_code?: string;
}

export interface RateTemplate {
  id: string;
  code: string;
  name: string;
  category: string;
  sub_category: string;
  unit: string;
  overhead_percent: number;
  profit_percent: number;
  gst_percent: number;
  is_system: boolean;
  line_items?: TemplateLineItem[];
}

export interface TemplateLineItem {
  id: string;
  resource_id: string | null;
  sub_template_id: string | null;
  description: string;
  coefficient: number;
  wastage_override: number | null;
  sort_order: number;
  resource?: Resource;
}

export interface LocationZone {
  id: string;
  zone_name: string;
  zone_type: string;
  labour_extra_percent: number;
  material_extra_percent: number;
  works_extra_percent: number;
  conveyance_extra_percent: number;
  head_load_extra_percent: number;
  applicable_districts: string[];
}

export interface ConveyanceSlab {
  id: string;
  terrain: string;
  material_group: string;
  coefficient: number;
  unit: string;
  rate_0_10km: number;
  rate_10_20km: number;
  rate_20_40km: number;
  rate_40_80km: number;
  rate_above_80km: number;
  loading_charges: number;
  unloading_charges: number;
}

export interface PlinthAreaRate {
  id: string;
  class_code: string;
  class_name: string;
  description: string;
  roof_type: string;
  floor: string;
  rate: number;
  additional_floor_rate: number;
  depreciation_percent: number;
}

export interface BOQProject {
  id: string;
  user_id: string;
  source_project_id?: string | null;
  project_type?: "own" | "invited";
  building_type?: string | null;
  floors_above_ground?: number | null;
  floors_below_ground?: number | null;
  name: string;
  client_name?: string;
  project_location?: string;
  district_id?: string;
  location_zone_id?: string;
  description?: string;
  status: "draft" | "in_progress" | "WIP" | "completed" | "submitted";
  global_overhead_percent?: number;
  global_profit_percent?: number;
  global_gst_percent?: number;
  default_conveyance_distance_km?: number;
  terrain: "plains" | "hills";
  notes?: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  total_amount?: number;
}

export interface BOQSection {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  item_count?: number;
}

export interface BOQItem {
  id: string;
  section_id: string;
  project_id: string;
  item_number: string;
  description: string;
  template_id?: string;
  template_code?: string;
  template_name?: string;
  quantity: number;
  unit: string;
  computed_rate?: number;
  computed_amount?: number;
  rate_override?: number;
  floor_level?: string;
  height_above_gl?: number;
  depth_below_gl?: number;
  notes?: string;
}

export interface LineItemBreakdown {
  line_item_id: string;
  resource_code: string;
  resource_name: string;
  resource_type: string;
  unit: string;
  coefficient: number;
  basic_rate: number;
  wastage_percent: number;
  effective_rate: number;
  amount: number;
  conveyance_amount: number;
}

export interface RateComputationResult {
  template_id: string;
  template_code: string;
  template_name: string;
  unit: string;
  breakdown: LineItemBreakdown[];
  material_total: number;
  labour_total: number;
  equipment_total: number;
  conveyance_total: number;
  works_rate_total: number;
  location_extras: {
    labour_extra: number;
    material_extra: number;
    works_extra: number;
    conveyance_extra: number;
    head_load_extra: number;
    total_extra: number;
    zone_name: string;
  } | null;
  lift_charges: number;
  direct_cost: number;
  overhead_percent: number;
  overhead_amount: number;
  profit_percent: number;
  profit_amount: number;
  subtotal_before_gst: number;
  gst_percent: number;
  gst_amount: number;
  final_rate: number;
}

export interface ProjectSummary {
  project: BOQProject;
  sections: (BOQSection & { items: BOQItem[]; total: number })[];
  grand_total: number;
  item_count: number;
  computed_count: number;
}
