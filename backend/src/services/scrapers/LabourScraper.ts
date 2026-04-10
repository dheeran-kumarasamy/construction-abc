import pool from "../../db/pool";
import { IndiaMartScraper } from "./IndiaMartScraper";
import { MaterialTreeScraper } from "./MaterialTreeScraper";
import { ScrapedPrice, ScrapeTarget } from "./BaseScraper";

/**
 * Dedicated labour scraper for all Tamil Nadu districts.
 * Runs independently of the material category scraper targeting labour rates.
 */
export class LabourScraper {
  private readonly indiaMart = new IndiaMartScraper();
  private readonly aggregator = new MaterialTreeScraper();

  private async getLabourTargets(): Promise<ScrapeTarget[]> {
    const { rows } = await pool.query(
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

    return rows.map((row) => ({
      districtId: row.district_id,
      districtName: row.district_name,
      materialId: row.material_id,
      materialName: row.material_name,
      categoryName: row.category_name,
    }));
  }

  private mergeBest(records: ScrapedPrice[]): ScrapedPrice[] {
    const map = new Map<string, ScrapedPrice>();

    for (const record of records) {
      const key = `${record.materialId}:${record.districtId}:${(record.brandName || "").toLowerCase()}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, record);
        continue;
      }

      const existingTime = existing.scrapedAt.getTime();
      const currentTime = record.scrapedAt.getTime();

      if (record.confidence > existing.confidence || (record.confidence === existing.confidence && currentTime > existingTime)) {
        map.set(key, record);
      }
    }

    return Array.from(map.values());
  }

  private async persistPrice(record: ScrapedPrice) {
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
      [record.materialId, record.districtId, record.price, record.brandName || null, record.source, record.scrapedAt]
    );
  }

  async run(): Promise<{
    targets: number;
    scraped: number;
    inserted: number;
    districtsWithData: number;
    completedAt: string;
  }> {
    const targets = await this.getLabourTargets();
    console.log(`[labour-scraper] Starting scrape for ${targets.length} district-material pairs`);

    const [indiaRows, aggregatorRows] = await Promise.all([
      this.indiaMart.scrape(targets),
      this.aggregator.scrape(targets),
    ]);

    const all = [...indiaRows, ...aggregatorRows];
    console.log(`[labour-scraper] Scraped ${all.length} records (indiamart=${indiaRows.length}, aggregator=${aggregatorRows.length})`);

    const best = this.mergeBest(all);
    console.log(`[labour-scraper] Merged to ${best.length} unique best records`);

    let inserted = 0;
    for (const record of best) {
      try {
        await this.persistPrice(record);
        inserted += 1;
      } catch (error) {
        console.error(`[labour-scraper] Failed to persist price record`, error);
      }
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

    const districtsWithData = coverageRes.rows[0]?.districts_covered || 0;

    console.log(`[labour-scraper] Inserted ${inserted} records, ${districtsWithData} districts now have labour rates`);

    return {
      targets: targets.length,
      scraped: all.length,
      inserted,
      districtsWithData,
      completedAt: new Date().toISOString(),
    };
  }
}
