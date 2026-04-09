WITH labour_category AS (
  INSERT INTO material_categories (name, icon, sort_order)
  VALUES ('Labour', '👷', 6)
  ON CONFLICT (name)
  DO UPDATE SET icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
  RETURNING id
), category_ref AS (
  SELECT id FROM labour_category
  UNION ALL
  SELECT id FROM material_categories WHERE name = 'Labour' AND NOT EXISTS (SELECT 1 FROM labour_category)
), labour_materials(name, unit, sort_order, base_price) AS (
  VALUES
    ('Mason', 'per day', 1, 1200.00),
    ('Helper', 'per day', 2, 750.00),
    ('Bar Bender', 'per day', 3, 1100.00),
    ('Carpenter', 'per day', 4, 1300.00),
    ('Electrician', 'per day', 5, 1400.00),
    ('Plumber', 'per day', 6, 1350.00),
    ('Painter', 'per day', 7, 1000.00),
    ('Tile Layer', 'per day', 8, 1250.00)
), upsert_materials AS (
  INSERT INTO materials (category_id, name, unit, sort_order)
  SELECT c.id, lm.name, lm.unit, lm.sort_order
  FROM category_ref c
  CROSS JOIN labour_materials lm
  ON CONFLICT (category_id, name)
  DO UPDATE SET unit = EXCLUDED.unit, sort_order = EXCLUDED.sort_order
  RETURNING id, name
), all_labour_materials AS (
  SELECT m.id, m.name
  FROM materials m
  JOIN category_ref c ON c.id = m.category_id
), deleted_seed_rows AS (
  DELETE FROM price_records pr
  USING all_labour_materials lm
  WHERE pr.material_id = lm.id
    AND pr.source = 'seed_generator'
  RETURNING pr.id
)
INSERT INTO price_records (material_id, district_id, price, source, scraped_at, flagged, created_at)
SELECT
  m.id,
  d.id,
  ROUND((
    lm.base_price *
    CASE d.region
      WHEN 'north' THEN 1.05
      WHEN 'south' THEN 1.00
      WHEN 'west' THEN 0.95
      WHEN 'central' THEN 0.98
      ELSE 1.00
    END *
    (1 + ((MOD(ABS(HASHTEXT(d.name || ':' || lm.name)), 11) - 5) * 0.003)) *
    (1 + SIN(gs.day_index::double precision / 6.0) * 0.02 + (gs.day_index::double precision / 90.0) * 0.03)
  )::numeric, 2) AS price,
  'seed_generator' AS source,
  NOW() - make_interval(days => (89 - gs.day_index)) AS scraped_at,
  false,
  NOW()
FROM districts d
JOIN all_labour_materials m ON true
JOIN labour_materials lm ON lm.name = m.name
CROSS JOIN generate_series(0, 89) AS gs(day_index);