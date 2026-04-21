ALTER TABLE project_revisions
  ADD COLUMN IF NOT EXISTS currency_code TEXT;

ALTER TABLE project_revisions
  DROP CONSTRAINT IF EXISTS project_revisions_currency_code_check;

ALTER TABLE project_revisions
  ADD CONSTRAINT project_revisions_currency_code_check
  CHECK (
    currency_code IS NULL
    OR currency_code IN ('INR', 'USD')
  );

UPDATE project_revisions
SET currency_code = COALESCE(NULLIF(currency_code, ''), 'INR')
WHERE currency_code IS NULL OR currency_code = '';
