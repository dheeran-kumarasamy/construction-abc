import pool from "../db/pool";
import { IndiaMartScraper } from "../services/scrapers/IndiaMartScraper";
import { MaterialTreeScraper } from "../services/scrapers/MaterialTreeScraper";

async function run() {
  const startedAt = Date.now();

  try {
    const targetsRes = await pool.query(
      `
      SELECT
        d.id AS district_id,
        d.name AS district_name,
        m.id AS material_id,
        m.name AS material_name,
        c.name AS category_name
      FROM districts d
      CROSS JOIN materials m
      JOIN material_categories c ON c.id = m.category_id
      WHERE LOWER(c.name) LIKE '%labour%' OR LOWER(c.name) LIKE '%labor%'
      ORDER BY d.name ASC, m.sort_order ASC, m.name ASC
      `
    );

    const targets = targetsRes.rows.map((row) => ({
      districtId: row.district_id,
      districtName: row.district_name,
      materialId: row.material_id,
      materialName: row.material_name,
      categoryName: row.category_name,
    }));

    console.log(`[labour-scrape] targets=${targets.length}`);

    const india = new IndiaMartScraper();
    const aggregator = new MaterialTreeScraper();

    const [indiaRows, aggregatorRows] = await Promise.all([
      india.scrape(targets),
      aggregator.scrape(targets),
    ]);

    const all = [...indiaRows, ...aggregatorRows];
    console.log(
      `[labour-scrape] scraped_total=${all.length} indiamart=${indiaRows.length} aggregator=${aggregatorRows.length}`
    );

    const best = new Map<string, (typeof all)[number]>();
    for (const record of all) {
      const key = `${record.materialId}:${record.districtId}:${(record.brandName || "").toLowerCase()}`;
      const prev = best.get(key);

      if (
        !prev ||
        record.confidence > prev.confidence ||
        (record.confidence === prev.confidence && record.scrapedAt.getTime() > prev.scrapedAt.getTime())
      ) {
        best.set(key, record);
      }
    }

    let inserted = 0;
    for (const record of best.values()) {
      await pool.query(
        `
        INSERT INTO price_records (
          material_id,
          district_id,
          price,
          brand_name,
          source,
          scraped_at,
          flagged,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, false, now())
        `,
        [
          record.materialId,
          record.districtId,
          record.price,
          record.brandName || null,
          record.source,
          record.scrapedAt,
        ]
      );

      inserted += 1;
    }

    const coverageRes = await pool.query(
      `
      SELECT COUNT(DISTINCT district_id)::int AS districts_covered
      FROM price_records pr
      JOIN materials m ON m.id = pr.material_id
      JOIN material_categories c ON c.id = m.category_id
      WHERE (LOWER(c.name) LIKE '%labour%' OR LOWER(c.name) LIKE '%labor%')
        AND pr.scraped_at >= NOW() - INTERVAL '24 hours'
        AND pr.source IN ('indiamart_scraper', 'aggregator_scraper')
      `
    );

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[labour-scrape] inserted=${inserted} unique_best=${best.size} districts_covered_24h=${coverageRes.rows[0].districts_covered} elapsed_sec=${elapsedSec}`
    );
  } catch (error) {
    console.error("[labour-scrape] failed", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
