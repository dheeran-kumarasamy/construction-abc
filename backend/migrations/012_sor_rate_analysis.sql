-- ============================================
-- Migration 012: SOR Rate Analysis & BOQ Estimation Engine
-- TN PWD Schedule of Rates 2025-2026
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SOR REFERENCE DATA (from TN PWD SOR 2025-26)
-- ============================================

CREATE TABLE IF NOT EXISTS sor_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year VARCHAR(20) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  volume VARCHAR(10),
  department VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- RESOURCES (atomic cost items from SOR)
-- ============================================

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sor_version_id UUID REFERENCES sor_versions(id),
  unique_code VARCHAR(20) NOT NULL,
  annexure VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('labour', 'material', 'work_rate', 'equipment', 'conveyance', 'head_load')),
  category VARCHAR(100),
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  basic_rate DECIMAL(14,2) NOT NULL,
  is_at_site BOOLEAN DEFAULT false,
  price_tracker_material_id UUID
    REFERENCES materials(id) ON DELETE SET NULL,
  hsn_sac_code VARCHAR(20),
  wastage_percent DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sor_version_id, unique_code)
);

CREATE INDEX IF NOT EXISTS idx_resources_code ON resources(unique_code);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_annexure ON resources(annexure);

-- ============================================
-- LOCATION EXTRAS (from SOR General Notes)
-- ============================================

CREATE TABLE IF NOT EXISTS location_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sor_version_id UUID REFERENCES sor_versions(id),
  zone_name VARCHAR(255) NOT NULL,
  zone_type VARCHAR(50) NOT NULL,
  description TEXT,
  labour_extra_percent DECIMAL(5,2) DEFAULT 0,
  material_extra_percent DECIMAL(5,2) DEFAULT 0,
  works_extra_percent DECIMAL(5,2) DEFAULT 0,
  conveyance_extra_percent DECIMAL(5,2) DEFAULT 0,
  head_load_extra_percent DECIMAL(5,2) DEFAULT 0,
  applicable_districts TEXT[],
  applicable_areas TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CONVEYANCE RATES (from Annexure-V)
-- ============================================

CREATE TABLE IF NOT EXISTS conveyance_rate_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sor_version_id UUID REFERENCES sor_versions(id),
  terrain VARCHAR(10) NOT NULL,
  material_group VARCHAR(255) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  rate_0_10km DECIMAL(8,2) NOT NULL,
  rate_10_20km DECIMAL(8,2) NOT NULL,
  rate_20_40km DECIMAL(8,2) NOT NULL,
  rate_40_80km DECIMAL(8,2) NOT NULL,
  rate_above_80km DECIMAL(8,2) NOT NULL,
  loading_charges DECIMAL(8,2) DEFAULT 0,
  unloading_charges DECIMAL(8,2) DEFAULT 0,
  interstate_extra DECIMAL(8,2) DEFAULT 0,
  unique_code_prefix VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- RATE ANALYSIS TEMPLATES (the recipes)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  reference_standard VARCHAR(200),
  sor_work_code VARCHAR(20),
  overhead_percent DECIMAL(5,2) DEFAULT 10,
  profit_percent DECIMAL(5,2) DEFAULT 15,
  gst_percent DECIMAL(5,2) DEFAULT 18,
  is_system BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON rate_templates(category);

-- ============================================
-- TEMPLATE LINE ITEMS (recipe ingredients)
-- ============================================

CREATE TABLE IF NOT EXISTS template_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES rate_templates(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  sub_template_id UUID REFERENCES rate_templates(id) ON DELETE SET NULL,
  description VARCHAR(500),
  coefficient DECIMAL(12,6) NOT NULL,
  wastage_override DECIMAL(5,2),
  conveyance_distance_km DECIMAL(8,2),
  conveyance_slab_id UUID REFERENCES conveyance_rate_slabs(id),
  sort_order INT DEFAULT 0,
  notes TEXT,
  CONSTRAINT chk_line_item_type CHECK (
    (resource_id IS NOT NULL AND sub_template_id IS NULL) OR
    (resource_id IS NULL AND sub_template_id IS NOT NULL)
  ),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_template ON template_line_items(template_id);

-- ============================================
-- BOQ PROJECTS (estimation containers)
-- ============================================

CREATE TABLE IF NOT EXISTS boq_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  project_location VARCHAR(255),
  district_id UUID REFERENCES districts(id),
  location_zone_id UUID REFERENCES location_zones(id),
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'submitted')),
  global_overhead_percent DECIMAL(5,2),
  global_profit_percent DECIMAL(5,2),
  global_gst_percent DECIMAL(5,2),
  default_conveyance_distance_km DECIMAL(8,2),
  terrain VARCHAR(10) DEFAULT 'plains',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boq_projects_user ON boq_projects(user_id);

-- ============================================
-- BOQ SECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS boq_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES boq_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BOQ ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS boq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES boq_sections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES boq_projects(id) ON DELETE CASCADE,
  item_number VARCHAR(20),
  description TEXT NOT NULL,
  template_id UUID REFERENCES rate_templates(id),
  quantity DECIMAL(14,4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  computed_rate DECIMAL(14,2),
  computed_amount DECIMAL(14,2),
  rate_override DECIMAL(14,2),
  floor_level VARCHAR(20),
  height_above_gl DECIMAL(8,2),
  depth_below_gl DECIMAL(8,2),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boq_items_project ON boq_items(project_id);

-- ============================================
-- RATE COMPUTATION LOG (audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_computations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES boq_projects(id),
  template_id UUID NOT NULL REFERENCES rate_templates(id),
  location_zone_id UUID REFERENCES location_zones(id),
  breakdown JSONB NOT NULL,
  material_total DECIMAL(14,2),
  labour_total DECIMAL(14,2),
  equipment_total DECIMAL(14,2),
  conveyance_total DECIMAL(14,2),
  works_rate_total DECIMAL(14,2),
  location_extras JSONB,
  lift_charges DECIMAL(14,2) DEFAULT 0,
  direct_cost DECIMAL(14,2),
  overhead_amount DECIMAL(14,2),
  profit_amount DECIMAL(14,2),
  subtotal_before_gst DECIMAL(14,2),
  gst_amount DECIMAL(14,2),
  final_rate DECIMAL(14,2),
  computed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PLINTH AREA RATES (for validation)
-- ============================================

CREATE TABLE IF NOT EXISTS plinth_area_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code VARCHAR(10) NOT NULL,
  class_name VARCHAR(255) NOT NULL,
  description TEXT,
  roof_type VARCHAR(100) NOT NULL,
  floor VARCHAR(50) NOT NULL,
  unit VARCHAR(10) DEFAULT 'Sq.m.',
  rate DECIMAL(14,2) NOT NULL,
  additional_floor_rate DECIMAL(14,2),
  depreciation_percent DECIMAL(5,2),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
