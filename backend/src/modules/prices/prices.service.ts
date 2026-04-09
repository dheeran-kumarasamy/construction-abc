import pool from "../../db/pool";
import { PriceWithTrend, Trend } from "./prices.types";

function parseRangeToDays(range: string | undefined) {
  if (!range) return 90;
  const match = range.trim().match(/^(\d+)(d)?$/i);
  if (!match) return 90;
  const days = Number.parseInt(match[1], 10);
  if (!Number.isFinite(days) || days <= 0) return 90;
  return Math.min(days, 365);
}

function resolveTrend(latest: number, baseline: number | null): { trend: Trend; percentChange: number } {
  if (baseline === null || baseline <= 0) {
    return { trend: "stable", percentChange: 0 };
  }

  const percentChange = Number((((latest - baseline) / baseline) * 100).toFixed(2));
  if (Math.abs(percentChange) < 0.5) {
    return { trend: "stable", percentChange };
  }

  return {
    trend: percentChange > 0 ? "up" : "down",
    percentChange,
  };
}

export async function getAllDistricts() {
  const { rows } = await pool.query(
    `
      SELECT id, name, region, lat, lng
      FROM districts
      ORDER BY name ASC
    `
  );

  return rows;
}

export async function getAllCategoriesWithMaterials() {
  const { rows } = await pool.query(
    `
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.icon,
        c.sort_order AS category_sort,
        m.id AS material_id,
        m.name AS material_name,
        m.unit,
        m.sort_order AS material_sort
      FROM material_categories c
      LEFT JOIN materials m ON m.category_id = c.id
      ORDER BY c.sort_order ASC, c.name ASC, m.sort_order ASC, m.name ASC
    `
  );

  const map = new Map<string, any>();
  for (const row of rows) {
    if (!map.has(row.category_id)) {
      map.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        icon: row.icon,
        materials: [],
      });
    }

    if (row.material_id) {
      map.get(row.category_id).materials.push({
        id: row.material_id,
        categoryId: row.category_id,
        name: row.material_name,
        unit: row.unit,
      });
    }
  }

  return Array.from(map.values());
}

async function resolveDistrictId(input: string) {
  const { rows } = await pool.query(
    `
      SELECT id, name
      FROM districts
      WHERE id::text = $1 OR LOWER(name) = LOWER($1)
      LIMIT 1
    `,
    [input]
  );
  return rows[0] || null;
}

async function resolveCategoryId(input: string) {
  const { rows } = await pool.query(
    `
      SELECT id, name
      FROM material_categories
      WHERE id::text = $1 OR LOWER(name) = LOWER($1)
      LIMIT 1
    `,
    [input]
  );
  return rows[0] || null;
}

export async function getDistrictCategoryPrices(districtInput: string, categoryInput: string) {
  const district = await resolveDistrictId(districtInput);
  if (!district) {
    throw new Error("District not found");
  }

  const category = await resolveCategoryId(categoryInput);
  if (!category) {
    throw new Error("Category not found");
  }

  const latestRows = await pool.query(
    `
      WITH latest AS (
        SELECT DISTINCT ON (pr.material_id, COALESCE(pr.brand_name, ''))
          pr.material_id,
          pr.price,
          pr.brand_name,
          pr.source,
          pr.scraped_at
        FROM price_records pr
        WHERE pr.district_id = $1
        ORDER BY pr.material_id, COALESCE(pr.brand_name, ''), pr.scraped_at DESC
      ),
      baseline AS (
        SELECT DISTINCT ON (pr.material_id, COALESCE(pr.brand_name, ''))
          pr.material_id,
          pr.brand_name,
          pr.price,
          pr.scraped_at
        FROM price_records pr
        JOIN latest l ON l.material_id = pr.material_id
          AND COALESCE(l.brand_name, '') = COALESCE(pr.brand_name, '')
        WHERE pr.district_id = $1
          AND pr.scraped_at <= l.scraped_at - interval '30 days'
        ORDER BY pr.material_id, COALESCE(pr.brand_name, ''), pr.scraped_at DESC
      )
      SELECT
        m.id AS material_id,
        m.name AS material_name,
        m.unit,
        l.price AS latest_price,
        l.brand_name,
        l.source,
        l.scraped_at AS last_updated,
        b.price AS baseline_price
      FROM materials m
      JOIN material_categories c ON c.id = m.category_id
      LEFT JOIN latest l ON l.material_id = m.id
      LEFT JOIN baseline b ON b.material_id = m.id
        AND COALESCE(b.brand_name, '') = COALESCE(l.brand_name, '')
      WHERE c.id = $2
      ORDER BY m.sort_order ASC, m.name ASC, COALESCE(l.brand_name, '') ASC
    `,
    [district.id, category.id]
  );

  const prices: PriceWithTrend[] = latestRows.rows.map((row) => {
    const latestPrice = row.latest_price ? Number(row.latest_price) : 0;
    const baselinePrice = row.baseline_price ? Number(row.baseline_price) : null;
    const trendData = resolveTrend(latestPrice, baselinePrice);

    return {
      materialPriceId: `${row.material_id}:${String(row.brand_name || "generic").toLowerCase()}`,
      materialId: row.material_id,
      materialName: row.material_name,
      brandName: row.brand_name || null,
      unit: row.unit,
      price: latestPrice,
      trend: trendData.trend,
      percentChange: trendData.percentChange,
      source: row.source || "n/a",
      lastUpdated: row.last_updated ? new Date(row.last_updated).toISOString() : "",
    };
  });

  return {
    district,
    category,
    prices,
  };
}

export async function compareDistrictPrices(districtInputs: string[], categoryInput: string) {
  const category = await resolveCategoryId(categoryInput);
  if (!category) {
    throw new Error("Category not found");
  }

  const trimmed = districtInputs.map((d) => d.trim()).filter(Boolean);
  if (trimmed.length < 2) {
    throw new Error("At least 2 districts required for comparison");
  }

  const selectedDistricts = [] as Array<{ id: string; name: string }>;
  for (const districtInput of trimmed.slice(0, 4)) {
    const district = await resolveDistrictId(districtInput);
    if (district) {
      selectedDistricts.push(district);
    }
  }

  if (selectedDistricts.length < 2) {
    throw new Error("At least 2 valid districts are required");
  }

  const materialRows = await pool.query(
    `
      SELECT id, name, unit
      FROM materials
      WHERE category_id = $1
      ORDER BY sort_order ASC, name ASC
    `,
    [category.id]
  );

  const districtPriceMap: Record<string, Record<string, number | null>> = {};

  for (const district of selectedDistricts) {
    const latestRows = await pool.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (pr.material_id)
            pr.material_id,
            pr.price
          FROM price_records pr
          WHERE pr.district_id = $1
          ORDER BY pr.material_id, pr.scraped_at DESC
        )
        SELECT m.id AS material_id, latest.price
        FROM materials m
        LEFT JOIN latest ON latest.material_id = m.id
        WHERE m.category_id = $2
        ORDER BY m.sort_order ASC, m.name ASC
      `,
      [district.id, category.id]
    );

    districtPriceMap[district.name.toLowerCase()] = Object.fromEntries(
      latestRows.rows.map((row) => [row.material_id, row.price ? Number(row.price) : null])
    );
  }

  return {
    category,
    materials: materialRows.rows.map((row) => ({
      materialId: row.id,
      materialName: row.name,
      unit: row.unit,
    })),
    districts: Object.fromEntries(
      selectedDistricts.map((district) => [district.name.toLowerCase(), districtPriceMap[district.name.toLowerCase()]])
    ),
  };
}

export async function getPriceHistory(materialId: string, districtId: string, range: string | undefined) {
  const days = parseRangeToDays(range);

  const { rows } = await pool.query(
    `
      SELECT
        scraped_at::date AS date,
        AVG(price)::numeric(12,2) AS price,
        MIN(source) AS source
      FROM price_records
      WHERE material_id = $1
        AND district_id = $2
        AND scraped_at >= now() - ($3 || ' days')::interval
      GROUP BY scraped_at::date
      ORDER BY date ASC
    `,
    [materialId, districtId, String(days)]
  );

  return rows.map((row) => ({
    date: row.date,
    price: Number(row.price),
    source: row.source,
  }));
}

export async function getBookmarks(userId: string) {
  const { rows } = await pool.query(
    `
      SELECT ub.id, ub.district_id, d.name AS district_name, ub.created_at
      FROM user_bookmarks ub
      JOIN districts d ON d.id = ub.district_id
      WHERE ub.user_id = $1
      ORDER BY ub.created_at DESC
    `,
    [userId]
  );

  return rows;
}

export async function addBookmark(userId: string, districtId: string) {
  const { rows } = await pool.query(
    `
      INSERT INTO user_bookmarks (user_id, district_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, district_id)
      DO UPDATE SET district_id = EXCLUDED.district_id
      RETURNING id, user_id, district_id, created_at
    `,
    [userId, districtId]
  );

  return rows[0];
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  const { rowCount } = await pool.query(
    `
      DELETE FROM user_bookmarks
      WHERE id = $1 AND user_id = $2
    `,
    [bookmarkId, userId]
  );

  return rowCount || 0;
}

export async function getAlerts(userId: string) {
  const { rows } = await pool.query(
    `
      SELECT
        pa.id,
        pa.material_id,
        m.name AS material_name,
        pa.district_id,
        d.name AS district_name,
        pa.condition,
        pa.threshold,
        pa.is_active,
        pa.last_triggered_at,
        pa.created_at,
        pa.updated_at
      FROM price_alerts pa
      JOIN materials m ON m.id = pa.material_id
      JOIN districts d ON d.id = pa.district_id
      WHERE pa.user_id = $1
      ORDER BY pa.created_at DESC
    `,
    [userId]
  );

  return rows;
}

export async function createAlert(
  userId: string,
  payload: { material_id: string; district_id: string; condition: "above" | "below"; threshold: number }
) {
  const { rows } = await pool.query(
    `
      INSERT INTO price_alerts (
        user_id,
        material_id,
        district_id,
        condition,
        threshold,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, true, now(), now())
      RETURNING *
    `,
    [userId, payload.material_id, payload.district_id, payload.condition, payload.threshold]
  );

  return rows[0];
}

export async function updateAlert(
  userId: string,
  alertId: string,
  payload: { condition?: "above" | "below"; threshold?: number; is_active?: boolean }
) {
  const existing = await pool.query(
    `SELECT * FROM price_alerts WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [alertId, userId]
  );

  if (!existing.rows[0]) return null;

  const updated = await pool.query(
    `
      UPDATE price_alerts
      SET
        condition = COALESCE($1, condition),
        threshold = COALESCE($2, threshold),
        is_active = COALESCE($3, is_active),
        updated_at = now()
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `,
    [
      payload.condition ?? null,
      payload.threshold ?? null,
      typeof payload.is_active === "boolean" ? payload.is_active : null,
      alertId,
      userId,
    ]
  );

  return updated.rows[0] || null;
}

export async function deleteAlert(userId: string, alertId: string) {
  const { rowCount } = await pool.query(
    `DELETE FROM price_alerts WHERE id = $1 AND user_id = $2`,
    [alertId, userId]
  );

  return rowCount || 0;
}

export async function getNotifications(userId: string, unreadOnly: boolean) {
  const { rows } = await pool.query(
    `
      SELECT id, user_id, message, is_read, metadata, created_at
      FROM notifications
      WHERE user_id = $1 AND ($2::boolean = false OR is_read = false)
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [userId, unreadOnly]
  );

  return rows;
}

// Get combined market and dealer prices for a material
export async function getMaterialPricesWithDealers(materialId: string, districtFilter?: string) {
  const marketPricesResult = await pool.query(
    `
      WITH latest AS (
        SELECT DISTINCT ON (pr.material_id, pr.district_id)
          pr.price,
          pr.source,
          pr.scraped_at,
          pr.district_id
        FROM price_records pr
        WHERE pr.material_id = $1
        ORDER BY pr.material_id, pr.district_id, pr.scraped_at DESC
      )
      SELECT 
        'market' as source_type,
        d.name as location,
        d.region,
        l.price,
        l.source,
        l.scraped_at
      FROM latest l
      JOIN districts d ON d.id = l.district_id
      ${districtFilter ? "WHERE d.name = $2 OR d.region = $2" : ""}
      ORDER BY l.price ASC
    `,
    districtFilter ? [materialId, districtFilter] : [materialId]
  );

  const dealerPricesResult = await pool.query(
    `
      SELECT 
        'dealer' as source_type,
        d.shop_name as location,
        d.city as location_detail,
        dp.price,
        d.user_id as dealer_id,
        dp.updated_at as last_updated
      FROM dealer_prices dp
      JOIN dealers d ON d.id = dp.dealer_id
      WHERE dp.material_id = $1 AND dp.is_active = true AND d.is_approved = true
      ${districtFilter ? "AND (d.city = $2 OR d.state = $2)" : ""}
      ORDER BY dp.price ASC
    `,
    districtFilter ? [materialId, districtFilter] : [materialId]
  );

  return {
    marketPrices: marketPricesResult.rows,
    dealerPrices: dealerPricesResult.rows,
    combined: (marketPricesResult.rows as any[])
      .concat((dealerPricesResult.rows as any[]))
      .sort((a: any, b: any) => (a.price || 0) - (b.price || 0)),
  };
}
