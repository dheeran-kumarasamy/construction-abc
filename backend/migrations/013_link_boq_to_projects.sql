-- ============================================
-- Migration 013: Link BOQ Projects to Architect Projects
-- ============================================

-- Add optional reference to architect's project
ALTER TABLE boq_projects
ADD COLUMN source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_boq_projects_source ON boq_projects(source_project_id);

-- Add project_type to distinguish between own and linked projects
ALTER TABLE boq_projects
ADD COLUMN project_type VARCHAR(20) DEFAULT 'own' CHECK (project_type IN ('own', 'invited'));

-- Update status to handle more states
ALTER TABLE boq_projects
DROP CONSTRAINT IF EXISTS boq_projects_status_check;

ALTER TABLE boq_projects
ADD CONSTRAINT boq_projects_status_check 
  CHECK (status IN ('draft', 'in_progress', 'completed', 'submitted', 'estimated'));
