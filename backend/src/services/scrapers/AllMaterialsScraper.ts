import pool from "../../db/pool";
import { IndiaMartScraper } from "./IndiaMartScraper";
import { MaterialTreeScraper } from "./MaterialTreeScraper";
import { FlipkartScraper } from "./FlipkartScraper";
import { TradeKeyScraper } from "./TradeKeyScraper";
import { OLXScraper } from "./OLXScraper";
import { ScrapedPrice, ScrapeTarget } from "./BaseScraper";

/**
 * Comprehensive scraper for ALL materials across Tamil Nadu.
 * Orchestrates multiple sources with proper brand name handling and deduplication.
 */
export class AllMaterialsScraper {
  private readonly indiaMart = new IndiaMartScraper();
  private readonly materialTree = new MaterialTreeScraper();
  private readonly flipkart = new FlipkartScraper();
  private readonly tradeKey = new TradeKeyScraper();
  private readonly olx = new OLXScraper();

  /**
   * Get all materials (excluding those already scraped today) for all districts
   */
  private async getAllTargets(): Promise<ScrapeTarget[]> {
    const { rows } = await pool.query(
      `
      SELECT DISTINCT
        d.id AS district_id,
        d.name AS district_name,
        m.id AS material_id,
        m.name AS material_name,
        c.name AS category_name
      FROM districts d
      CROSS JOIN materials m
      JOIN material_categories c ON c.id = m.category_id
      WHERE m.active = true
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

  /**
   * Merge records, preferring:
   * 1. Higher confidence scores
   * 2. Fresher timestamps
   * 3. Populated brand names
   */
  private mergeBest(records: ScrapedPrice[]): ScrapedPrice[] {
    const map = new Map<string, ScrapedPrice>();

    for (const record of records) {
      // Key: material:district (without brand to find best across all brands)
      const key = `${record.materialId}:${record.districtId}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, record);
        continue;
      }

      // Scoring logic
      let shouldReplace = false;

      // Prefer higher confidence
      if (record.confidence > existing.confidence) {
        shouldReplace = true;
      }
      // Same confidence: prefer newer
      else if (record.confidence === existing.confidence) {
        if (record.scrapedAt.getTime() > existing.scrapedAt.getTime()) {
          shouldReplace = true;
        }
      }
      // If same time: prefer with brand name
      if (record.scrapedAt.getTime() === existing.scrapedAt.getTime() && record.confidence === existing.confidence) {
        if (record.brandName && !existing.brandName) {
          shouldReplace = true;
        }
      }

      if (shouldReplace) {
        map.set(key, record);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Persist a price record to database
   */
  private async persistPrice(record: ScrapedPrice): Promise<void> {
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
  }

  /**
   * Main execution: scrape all materials from all sources
   */
  async run(): Promise<{
    targets: number;
    scraped: number;
    inserted: number;
    districtsWithData: number;
    sourcesUsed: string[];
    completedAt: string;
  }> {
    const targets = await this.getAllTargets();
    console.log(`[all-materials-scraper] Starting scrape for ${targets.length} material-district pairs`);

    // Run all scrapers in parallel
    const [indiaRows, treeRows, flipkartRows, tradekeyRows, olxRows] = await Promise.all([
      this.indiaMart.scrape(targets).catch((err) => {
        console.error("[all-materials-scraper] IndiaMart scraper failed:", err);
        return [];
      }),
      this.materialTree.scrape(targets).catch((err) => {
        console.error("[all-materials-scraper] MaterialTree scraper failed:", err);
        return [];
      }),
      this.flipkart.scrape(targets).catch((err) => {
        console.error("[all-materials-scraper] Flipkart scraper failed:", err);
        return [];
      }),
      this.tradeKey.scrape(targets).catch((err) => {
        console.error("[all-materials-scraper] TradeKey scraper failed:", err);
        return [];
      }),
      this.olx.scrape(targets).catch((err) => {
        console.error("[all-materials-scraper] OLX scraper failed:", err);
        return [];
      }),
    ]);

    // Combine all results
    const all = [...indiaRows, ...treeRows, ...flipkartRows, ...tradekeyRows, ...olxRows];
    console.log(
      `[all-materials-scraper] Scraped ${all.length} total records: ` +
        `indiamart=${indiaRows.length}, materialtree=${treeRows.length}, flipkart=${flipkartRows.length}, ` +
        `tradekey=${tradekeyRows.length}, olx=${olxRows.length}`
    );

    // Deduplicate and merge
    const best = this.mergeBest(all);
    console.log(`[all-materials-scraper] Merged to ${best.length} unique best records`);

    // Persist to database
    let inserted = 0;
    for (const record of best) {
      try {
        await this.persistPrice(record);
        inserted += 1;
      } catch (error) {
        console.error(`[all-materials-scraper] Failed to persist record for material ${record.materialId}:`, error);
      }
    }

    // Calculate coverage statistics
    const coverageRes = await pool.query(
      `
      SELECT COUNT(DISTINCT district_id)::int AS districts_covered
      FROM price_records pr
      WHERE pr.scraped_at >= NOW() - INTERVAL '24 hours'
        AND pr.source IN ('indiamart_scraper', 'aggregator_scraper', 'flipkart_scraper', 'tradekey_scraper', 'olx_scraper')
      `
    );

    const sourcesRes = await pool.query(
      `
      SELECT DISTINCT source
      FROM price_records pr
      WHERE pr.scraped_at >= NOW() - INTERVAL '24 hours'
        AND pr.source IN ('indiamart_scraper', 'aggregator_scraper', 'flipkart_scraper', 'tradekey_scraper', 'olx_scraper')
      ORDER BY source
      `
    );

    const districtsWithData = coverageRes.rows[0]?.districts_covered || 0;
    const sourcesUsed = sourcesRes.rows.map((row) => row.source);

    console.log(
      `[all-materials-scraper] Inserted ${inserted} records, ` +
        `${districtsWithData} districts covered, sources: ${sourcesUsed.join(", ")}`
    );

    return {
      targets: targets.length,
      scraped: all.length,
      inserted,
      districtsWithData,
      sourcesUsed,
      completedAt: new Date().toISOString(),
    };
  }
}
