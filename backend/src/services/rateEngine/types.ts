// ─────────────────────────────────────────────────
// Rate Engine Types
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
  is_at_site: boolean;
  wastage_percent: number;
  hsn_sac_code?: string;
}

export interface TemplateLineItem {
  id: string;
  template_id: string;
  resource_id: string | null;
  sub_template_id: string | null;
  description: string;
  coefficient: number;
  wastage_override: number | null;
  conveyance_distance_km: number | null;
  conveyance_slab_id: string | null;
  sort_order: number;
  // Joined
  resource?: Resource;
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

export interface ComputeRateInput {
  template_id: string;
  location_zone_id?: string;
  conveyance_distance_km?: number;
  terrain?: "plains" | "hills";
  floor_level?: string;
  height_above_gl?: number;
  depth_below_gl?: number;
  override_overhead?: number;
  override_profit?: number;
  override_gst?: number;
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

export interface LocationExtrasBreakdown {
  labour_extra: number;
  material_extra: number;
  works_extra: number;
  conveyance_extra: number;
  head_load_extra: number;
  total_extra: number;
  zone_name: string;
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
  location_extras: LocationExtrasBreakdown | null;
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

export interface BOQProject {
  id: string;
  user_id: string;
  name: string;
  client_name?: string;
  project_location?: string;
  district_id?: string;
  location_zone_id?: string;
  status: "draft" | "in_progress" | "completed" | "submitted";
  global_overhead_percent?: number;
  global_profit_percent?: number;
  global_gst_percent?: number;
  default_conveyance_distance_km?: number;
  terrain: "plains" | "hills";
}

export interface BOQSection {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
}

export interface BOQItem {
  id: string;
  section_id: string;
  project_id: string;
  item_number: string;
  description: string;
  template_id?: string;
  quantity: number;
  unit: string;
  computed_rate?: number;
  computed_amount?: number;
  rate_override?: number;
  floor_level?: string;
  height_above_gl?: number;
  depth_below_gl?: number;
}
