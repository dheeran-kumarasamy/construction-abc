-- Add parsed_data column to store BOQ items in database
-- This allows Vercel serverless to work without file persistence

ALTER TABLE boqs ADD COLUMN IF NOT EXISTS parsed_data JSONB;

-- Add column_mapping if it doesn't exist (for backward compatibility)
ALTER TABLE boqs ADD COLUMN IF NOT EXISTS column_mapping JSONB;
