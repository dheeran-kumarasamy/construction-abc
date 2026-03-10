import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

export class IndiaMartScraper extends BaseScraper {
  constructor() {
    super({ source: "indiamart_scraper" });
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(`${target.materialName} ${target.districtName} Tamil Nadu price`);
        const url = `https://dir.indiamart.com/search.mp?ss=${query}`;
        const html = await this.fetchWithRetry(url);

        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_${Date.now()}.html`,
          html
        );

        const matches = Array.from(html.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g));
        const numeric = matches
          .map((match) => Number(String(match[1]).replace(/,/g, "")))
          .filter((value) => Number.isFinite(value) && value > 0);

        if (numeric.length === 0) {
          continue;
        }

        const price = numeric.slice(0, 8).reduce((sum, value) => sum + value, 0) / Math.min(8, numeric.length);

        const entry: ScrapedPrice = {
          districtId: target.districtId,
          materialId: target.materialId,
          price: Number(price.toFixed(2)),
          source: "indiamart_scraper",
          scrapedAt: new Date(),
          confidence: 0.65,
          rawSnapshotPath: snapshot,
        };

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price: entry.price,
          source: entry.source,
          snapshot,
        });

        results.push(entry);
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
