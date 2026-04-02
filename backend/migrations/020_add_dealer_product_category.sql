-- Add category selection for dealer registration and price restrictions.
ALTER TABLE dealers
ADD COLUMN IF NOT EXISTS product_category_id UUID REFERENCES material_categories(id);

CREATE INDEX IF NOT EXISTS idx_dealers_product_category_id ON dealers(product_category_id);
