import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

function normalizeBrandName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9&+./()\- ]/g, "")
    .trim()
    .slice(0, 80);
}

export class TradeKeyScraper extends BaseScraper {
  constructor() {
    super({ source: "tradekey_scraper", rateLimitMs: 2500 });
  }

  private buildQuery(target: ScrapeTarget): string {
    const category = String(target.categoryName || "").toLowerCase();
    const isLabour = category.includes("labour") || category.includes("labor");

    if (isLabour) {
      return `${target.materialName} daily labour rate`;
    }
    return `${target.materialName} wholesale price`;
  }

  private extractBrandAndPrice(html: string): { brand?: string; price?: number } {
    // Look for pattern: Manufacturer: BrandName or Supplier: BrandName
    const manufacturerMatch = html.match(
      /(?:Manufacturer|Supplier|Company)[\s:]*([a-zA-Z][a-zA-Z0-9&+./()\- ]{1,80})/i
    );

    let brand: string | undefined;
    if (manufacturerMatch && manufacturerMatch[1]) {
      brand = normalizeBrandName(manufacturerMatch[1]);
    }

    // Extract price
    const priceMatches = Array.from(
      html.matchAll(/(?:Price|Cost)[\s:]*(?:₹|USD\s?\$|Rs\.?\s?)([\d,]+(?:\.\d+)?)/gi)
    );

    if (priceMatches.length > 0) {
      const price = Number(String(priceMatches[0][1]).replace(/,/g, ""));
      if (Number.isFinite(price) && price > 0) {
        return { brand, price };
      }
    }

    return { brand };
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(this.buildQuery(target));
        const url = `https://www.tradekey.com/search_company/${query}`;

        const html = await this.fetchWithRetry(url);
        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_tradekey_${Date.now()}.html`,
          html
        );

        const { brand, price } = this.extractBrandAndPrice(html);

        if (!price || price <= 0) continue;

        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price,
          brandName: brand,
          source: "tradekey_scraper",
          scrapedAt: new Date(),
          confidence: 0.60,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price,
          brand,
          source: "tradekey_scraper",
        });
      } catch (error) {
        this.logStructured({
          level: "error",
          district: target.districtName,
          material: target.materialName,
          source: "tradekey_scraper",
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return results;
  }
}
