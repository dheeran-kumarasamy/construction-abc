ALTER TABLE price_records
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_price_records_material_district_brand_scraped
  ON price_records(material_id, district_id, brand_name, scraped_at DESC);
