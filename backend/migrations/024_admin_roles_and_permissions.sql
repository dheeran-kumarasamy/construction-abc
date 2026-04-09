-- ============================================================
-- Migration 024: Admin roles (super_admin / admin_team) and
--                per-module permission table
-- ============================================================

-- 1. Add admin_role discriminator column to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20)
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'admin_team'));

-- 2. Backfill: every existing admin account becomes super_admin
UPDATE users
SET admin_role = 'super_admin'
WHERE role = 'admin'
  AND admin_role IS NULL;

-- 3. Table that records which modules an admin_team user may access
CREATE TABLE IF NOT EXISTS admin_module_permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key  VARCHAR(50) NOT NULL,
  granted_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_module_perm_user
  ON admin_module_permissions(user_id);
