import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

export class OLXScraper extends BaseScraper {
  constructor() {
    super({ source: "olx_scraper", rateLimitMs: 2500 });
  }

  private buildQuery(target: ScrapeTarget): string {
    const category = String(target.categoryName || "").toLowerCase();
    const isLabour = category.includes("labour") || category.includes("labor");

    if (isLabour) {
      return `${target.materialName}`;
    }
    return `${target.materialName}`;
  }

  private extractPricesAndBrand(html: string): { prices: number[]; brand?: string } {
    const prices: number[] = [];

    // Look for price patterns in OLX format
    const priceMatches = Array.from(html.matchAll(/(?:₹|Rs\.?\s?)([\d,]+(?:\.\d+)?)/gi));
    for (const match of priceMatches) {
      const price = Number(String(match[1]).replace(/,/g, ""));
      if (Number.isFinite(price) && price > 0 && price < 10000000) {
        // Reasonable upper bound for material prices
        prices.push(price);
      }
    }

    // Extract brand/seller from meta tags or title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    let brand: string | undefined;
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].trim();
      const parts = title.split(/[-•|]/);
      if (parts.length > 1) {
        brand = parts[1].trim().slice(0, 80);
      }
    }

    return { prices, brand };
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(this.buildQuery(target));
        const url = `https://www.olx.in/search?q=${query}&state=TN`;

        const html = await this.fetchWithRetry(url);
        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_olx_${Date.now()}.html`,
          html
        );

        const { prices, brand } = this.extractPricesAndBrand(html);

        if (prices.length === 0) continue;

        // Use median to avoid outliers
        const sorted = prices.sort((a, b) => a - b);
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        const price = Number(median.toFixed(2));

        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price,
          brandName: brand,
          source: "olx_scraper",
          scrapedAt: new Date(),
          confidence: 0.50,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price,
          brand,
          source: "olx_scraper",
          pricePoints: prices.length,
        });
      } catch (error) {
        this.logStructured({
          level: "error",
          district: target.districtName,
          material: target.materialName,
          source: "olx_scraper",
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return results;
  }
}
