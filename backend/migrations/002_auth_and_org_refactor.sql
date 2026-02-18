-- ============================================
-- Migration 002: Auth + Org Refactor
-- ============================================

-- 1️⃣ Add organization ownership to projects
ALTER TABLE projects
ADD COLUMN architect_org_id UUID REFERENCES organizations(id),
ADD COLUMN client_org_id UUID REFERENCES organizations(id);

-- Backfill from existing user references (if any)
UPDATE projects p
SET architect_org_id = u.organization_id
FROM users u
WHERE p.architect_id = u.id;

UPDATE projects p
SET client_org_id = u.organization_id
FROM users u
WHERE p.client_id = u.id;

-- 2️⃣ Make password nullable for invite flow
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- 3️⃣ Create user_invites table
CREATE TABLE user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  role TEXT CHECK (role IN ('architect','builder','client')),

  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_user_invites_email ON user_invites(email);
CREATE INDEX idx_user_invites_token ON user_invites(token);
