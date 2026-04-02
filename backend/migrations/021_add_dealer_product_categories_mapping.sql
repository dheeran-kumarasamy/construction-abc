-- Support multiple product categories per dealer.
CREATE TABLE IF NOT EXISTS dealer_product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_dealer_product_categories_dealer_id
  ON dealer_product_categories(dealer_id);

CREATE INDEX IF NOT EXISTS idx_dealer_product_categories_category_id
  ON dealer_product_categories(category_id);

-- Backfill existing dealer single-category selection.
INSERT INTO dealer_product_categories (dealer_id, category_id)
SELECT d.id, d.product_category_id
FROM dealers d
WHERE d.product_category_id IS NOT NULL
ON CONFLICT (dealer_id, category_id) DO NOTHING;
