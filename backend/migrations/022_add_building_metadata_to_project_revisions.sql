ALTER TABLE project_revisions
  ADD COLUMN IF NOT EXISTS building_type TEXT,
  ADD COLUMN IF NOT EXISTS floors_above_ground INT,
  ADD COLUMN IF NOT EXISTS floors_below_ground INT;

ALTER TABLE project_revisions
  DROP CONSTRAINT IF EXISTS project_revisions_building_type_check;

ALTER TABLE project_revisions
  ADD CONSTRAINT project_revisions_building_type_check
  CHECK (
    building_type IS NULL
    OR building_type IN ('Residential', 'Commercial', 'Industrial', 'Multistory')
  );

ALTER TABLE project_revisions
  DROP CONSTRAINT IF EXISTS project_revisions_floors_above_ground_check;

ALTER TABLE project_revisions
  ADD CONSTRAINT project_revisions_floors_above_ground_check
  CHECK (floors_above_ground IS NULL OR floors_above_ground >= 1);

ALTER TABLE project_revisions
  DROP CONSTRAINT IF EXISTS project_revisions_floors_below_ground_check;

ALTER TABLE project_revisions
  ADD CONSTRAINT project_revisions_floors_below_ground_check
  CHECK (floors_below_ground IS NULL OR floors_below_ground >= 0);
