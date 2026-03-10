import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

export class MaterialTreeScraper extends BaseScraper {
  constructor() {
    super({ source: "aggregator_scraper" });
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(`${target.materialName} price tamil nadu`);
        const url = `https://www.materialtree.com/search?q=${query}`;

        const html = await this.fetchWithRetry(url);
        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_${Date.now()}.html`,
          html
        );

        const matches = Array.from(html.matchAll(/(?:₹|Rs\.?\s?)([\d,]+(?:\.\d+)?)/gi));
        const values = matches
          .map((match) => Number(String(match[1]).replace(/,/g, "")))
          .filter((value) => Number.isFinite(value) && value > 0);

        if (!values.length) continue;

        const mid = values[Math.floor(values.length / 2)];
        const price = Number(mid.toFixed(2));

        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price,
          source: "aggregator_scraper",
          scrapedAt: new Date(),
          confidence: 0.5,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price,
          source: "aggregator_scraper",
          snapshot,
        });
      } catch (error) {
        this.logStructured({
          level: "error",
          district: target.districtName,
          material: target.materialName,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return results;
  }
}
