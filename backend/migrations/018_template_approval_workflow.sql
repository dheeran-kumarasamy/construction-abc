-- ============================================
-- Migration 018: Template approval workflow
-- ============================================

ALTER TABLE rate_templates
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_for_global BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_rate_templates_owner_org ON rate_templates(owner_organization_id);
CREATE INDEX IF NOT EXISTS idx_rate_templates_approval_status ON rate_templates(approval_status);

UPDATE rate_templates
SET approval_status = 'approved'
WHERE approval_status IS NULL;
