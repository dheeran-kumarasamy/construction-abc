import pool from "../../db/pool";
import { processPriceAlerts } from "../alerts/price-alerts.service";
import { IndiaMartScraper } from "./IndiaMartScraper";
import { MaterialTreeScraper } from "./MaterialTreeScraper";
import { PWDScheduleScraper } from "./PWDScheduleScraper";
import { ScrapedPrice, ScrapeTarget } from "./BaseScraper";

const anomalyThreshold = Number(process.env.PRICE_ANOMALY_THRESHOLD || 0.3);

export class ScraperManager {
  private readonly indiaMart = new IndiaMartScraper();
  private readonly pwd = new PWDScheduleScraper();
  private readonly aggregator = new MaterialTreeScraper();

  private async getTargets(): Promise<ScrapeTarget[]> {
    const limit = Number.parseInt(String(process.env.SCRAPER_TARGET_LIMIT || "0"), 10);
    const hasLimit = Number.isFinite(limit) && limit > 0;

    const query = `
      SELECT
        d.id AS district_id,
        d.name AS district_name,
        m.id AS material_id,
        m.name AS material_name,
        c.name AS category_name
      FROM districts d
      CROSS JOIN materials m
      JOIN material_categories c ON c.id = m.category_id
      ORDER BY d.name ASC, c.sort_order ASC, m.sort_order ASC, m.name ASC
      ${hasLimit ? "LIMIT $1" : ""}
    `;

    const { rows } = hasLimit
      ? await pool.query(query, [limit])
      : await pool.query(query);

    return rows.map((row) => ({
      districtId: row.district_id,
      districtName: row.district_name,
      materialId: row.material_id,
      materialName: row.material_name,
      categoryName: row.category_name,
    }));
  }

  private mergeBest(records: ScrapedPrice[]) {
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
    const latest = await pool.query(
      `
        SELECT price
        FROM price_records
        WHERE material_id = $1
          AND district_id = $2
          AND COALESCE(brand_name, '') = COALESCE($3, '')
        ORDER BY scraped_at DESC
        LIMIT 1
      `,
      [record.materialId, record.districtId, record.brandName || null]
    );

    const previousPrice = latest.rows[0]?.price ? Number(latest.rows[0].price) : null;
    if (previousPrice && previousPrice > 0) {
      const diffRatio = Math.abs(record.price - previousPrice) / previousPrice;
      if (diffRatio > anomalyThreshold) {
        await pool.query(
          `
            INSERT INTO flagged_prices (
              material_id,
              district_id,
              previous_price,
              new_price,
              diff_ratio,
              source,
              scraped_at,
              raw_snapshot_path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            record.materialId,
            record.districtId,
            previousPrice,
            record.price,
            diffRatio,
            record.source,
            record.scrapedAt,
            record.rawSnapshotPath || null,
          ]
        );

        return { inserted: false, flagged: true };
      }
    }

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

    await processPriceAlerts(record.materialId, record.districtId, record.price);

    return { inserted: true, flagged: false };
  }

  async run(source?: "indiamart" | "pwd" | "aggregator") {
    const targets = await this.getTargets();

    const scrapedCollections: ScrapedPrice[][] = [];

    if (!source || source === "indiamart") {
      if (String(process.env.SCRAPER_INDIAMART_ENABLED || "true") === "true") {
        scrapedCollections.push(await this.indiaMart.scrape(targets));
      }
    }

    if (!source || source === "pwd") {
      if (String(process.env.SCRAPER_PWD_ENABLED || "true") === "true") {
        scrapedCollections.push(await this.pwd.scrape(targets));
      }
    }

    if (!source || source === "aggregator") {
      scrapedCollections.push(await this.aggregator.scrape(targets));
    }

    const merged = this.mergeBest(scrapedCollections.flat());

    let inserted = 0;
    let flagged = 0;

    for (const record of merged) {
      try {
        const status = await this.persistPrice(record);
        if (status.inserted) inserted += 1;
        if (status.flagged) flagged += 1;
      } catch (error) {
        console.error("Failed persisting price record", error);
      }
    }

    return {
      source: source || "all",
      targets: targets.length,
      scraped: scrapedCollections.flat().length,
      inserted,
      flagged,
      completedAt: new Date().toISOString(),
    };
  }
}
