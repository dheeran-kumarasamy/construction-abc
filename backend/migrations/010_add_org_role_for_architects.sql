-- Add organization role to distinguish architect head vs team member
ALTER TABLE users
ADD COLUMN IF NOT EXISTS org_role TEXT CHECK (org_role IN ('head', 'member'));

-- Existing architects: first architect user in each organization becomes head
WITH ranked_architects AS (
  SELECT
    id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at ASC, id ASC) AS rn
  FROM users
  WHERE role = 'architect'
    AND organization_id IS NOT NULL
)
UPDATE users u
SET org_role = CASE WHEN ra.rn = 1 THEN 'head' ELSE 'member' END
FROM ranked_architects ra
WHERE u.id = ra.id
  AND u.org_role IS NULL;

-- Add org_role to invites to support architect team-member invites
ALTER TABLE user_invites
ADD COLUMN IF NOT EXISTS org_role TEXT CHECK (org_role IN ('head', 'member'));

-- Default existing architect invites to member
UPDATE user_invites
SET org_role = 'member'
WHERE role = 'architect'
  AND org_role IS NULL;

-- Ensure one architect head per organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_architect_head_per_org
ON users(organization_id)
WHERE role = 'architect' AND org_role = 'head' AND organization_id IS NOT NULL;
