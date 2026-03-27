-- ============================================
-- Migration 016: Repair Missing BOQ Tables
-- Purpose: Ensure BOQ estimation tables exist in environments
-- where earlier migrations were skipped or partially applied.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BOQ PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS boq_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  project_location VARCHAR(255),
  district_id UUID REFERENCES districts(id),
  location_zone_id UUID REFERENCES location_zones(id),
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  global_overhead_percent DECIMAL(5,2),
  global_profit_percent DECIMAL(5,2),
  global_gst_percent DECIMAL(5,2),
  default_conveyance_distance_km DECIMAL(8,2),
  terrain VARCHAR(10) DEFAULT 'plains',
  notes TEXT,
  source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_type VARCHAR(20) DEFAULT 'own',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE boq_projects
ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS project_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id),
ADD COLUMN IF NOT EXISTS location_zone_id UUID REFERENCES location_zones(id),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS global_overhead_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS global_profit_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS global_gst_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS default_conveyance_distance_km DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS terrain VARCHAR(10) DEFAULT 'plains',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) DEFAULT 'own',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE boq_projects
DROP CONSTRAINT IF EXISTS boq_projects_status_check;

ALTER TABLE boq_projects
ADD CONSTRAINT boq_projects_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'submitted', 'estimated'));

ALTER TABLE boq_projects
DROP CONSTRAINT IF EXISTS boq_projects_project_type_check;

ALTER TABLE boq_projects
ADD CONSTRAINT boq_projects_project_type_check
  CHECK (project_type IN ('own', 'invited'));

CREATE INDEX IF NOT EXISTS idx_boq_projects_user ON boq_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_boq_projects_source ON boq_projects(source_project_id);

-- ============================================
-- BOQ SECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS boq_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES boq_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE boq_sections
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_boq_sections_project ON boq_sections(project_id);

-- ============================================
-- BOQ ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS boq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE boq_items
ADD COLUMN IF NOT EXISTS item_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES rate_templates(id),
ADD COLUMN IF NOT EXISTS computed_rate DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS computed_amount DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS rate_override DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS floor_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS height_above_gl DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS depth_below_gl DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_boq_items_project ON boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_section ON boq_items(section_id);
