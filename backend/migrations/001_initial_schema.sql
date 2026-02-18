-- Construction DB Schema Migration
-- Version: 001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('architect','builder','client')),
  created_at TIMESTAMP DEFAULT now()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('architect','builder','client')),
  created_at TIMESTAMP DEFAULT now()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  architect_id UUID REFERENCES users(id),
  client_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Project revisions table
CREATE TABLE project_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  revision_number INT NOT NULL,
  site_address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  tentative_start_date DATE,
  duration_months INT,
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, revision_number)
);

-- BOQ revisions table
CREATE TABLE boq_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  project_revision_id UUID REFERENCES project_revisions(id),
  revision_number INT NOT NULL,
  file_url TEXT,
  parsed_json JSONB,
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, revision_number)
);

-- Builder invitations table
CREATE TABLE builder_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  builder_org_id UUID REFERENCES organizations(id),
  status TEXT CHECK (status IN ('pending','accepted','declined')),
  invited_at TIMESTAMP DEFAULT now(),
  responded_at TIMESTAMP
);

-- Base pricing table
CREATE TABLE base_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_org_id UUID REFERENCES organizations(id),
  item_name TEXT,
  category TEXT,
  rate NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);

-- Estimates table
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  builder_org_id UUID REFERENCES organizations(id),
  status TEXT CHECK (status IN ('draft','submitted','awarded','rejected')),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, builder_org_id)
);

-- Estimate revisions table
CREATE TABLE estimate_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID REFERENCES estimates(id),
  revision_number INT NOT NULL,
  source TEXT CHECK (source IN ('builder','architect_request')),
  project_revision_id UUID REFERENCES project_revisions(id),
  boq_revision_id UUID REFERENCES boq_revisions(id),
  pricing_snapshot JSONB NOT NULL,
  margin_config JSONB,
  grand_total NUMERIC NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  UNIQUE(estimate_id, revision_number)
);

-- Awards table
CREATE TABLE awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  estimate_revision_id UUID REFERENCES estimate_revisions(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP DEFAULT now()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_architect ON projects(architect_id);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_project_revisions_project ON project_revisions(project_id);
CREATE INDEX idx_boq_revisions_project ON boq_revisions(project_id);
CREATE INDEX idx_builder_invitations_project ON builder_invitations(project_id);
CREATE INDEX idx_estimates_project ON estimates(project_id);
CREATE INDEX idx_estimate_revisions_estimate ON estimate_revisions(estimate_id);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
