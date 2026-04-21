-- ============================================
-- Migration 028: Add quoted_price to product_inquiries
-- Stores the market price shown to the user at the time of inquiry.
-- ============================================

ALTER TABLE product_inquiries
  ADD COLUMN IF NOT EXISTS quoted_price DECIMAL(14, 2);

WITH latest_prices AS (
  SELECT DISTINCT ON (pr.material_id, pr.district_id)
    pr.material_id,
    pr.district_id,
    pr.price
  FROM price_records pr
  ORDER BY pr.material_id, pr.district_id, pr.scraped_at DESC, pr.created_at DESC
)
UPDATE product_inquiries pi
SET quoted_price = lp.price
FROM latest_prices lp
WHERE pi.quoted_price IS NULL
  AND pi.material_id = lp.material_id
  AND pi.district_id = lp.district_id;
