-- ============================================
-- Migration 025: Builder portfolio photos
-- Allows builders to attach up to 10 image files
-- to their profile portfolio for architect viewing.
-- ============================================

ALTER TABLE builder_profiles
ADD COLUMN IF NOT EXISTS portfolio_photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
