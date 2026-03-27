-- ============================================
-- Migration 017: Builder Profile & Self-Signup
-- Adds builder_profiles table so builders can
-- fill portfolio details that architects can discover.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS builder_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name          VARCHAR(255),
  contact_phone         VARCHAR(50),
  service_locations     TEXT,       -- comma-separated cities/states
  specialties           TEXT,       -- comma-separated trades e.g. "Residential, Interiors"
  past_projects         TEXT,       -- free-text description
  portfolio_links       TEXT,       -- comma-separated URLs
  team_size             INTEGER,
  min_project_budget    DECIMAL(14,2),
  is_visible_to_architects BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_profiles_user   ON builder_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_builder_profiles_visible ON builder_profiles(is_visible_to_architects)
  WHERE is_visible_to_architects = true;
