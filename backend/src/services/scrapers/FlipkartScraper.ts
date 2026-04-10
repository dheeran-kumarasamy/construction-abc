import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

function extractBrandFromFlipkart(html: string): string | null {
  const sellerMatch = html.match(/(?:Seller|Brand)[\s:]*([^<\n]*(?:[a-zA-Z][a-zA-Z0-9\s&+./()\-]*)?)/i);
  if (sellerMatch && sellerMatch[1]) {
    return sellerMatch[1].trim().slice(0, 80) || null;
  }
  const brandTag = html.match(/<span[^>]*class="[^"]*brand[^"]*"[^>]*>([^<]*)<\/span>/i);
  if (brandTag && brandTag[1]) {
    return brandTag[1].trim().slice(0, 80) || null;
  }
  return null;
}

export class FlipkartScraper extends BaseScraper {
  constructor() {
    super({ source: "flipkart_scraper", rateLimitMs: 3000 });
  }

  private buildQuery(target: ScrapeTarget): string {
    const category = String(target.categoryName || "").toLowerCase();
    const isLabour = category.includes("labour") || category.includes("labor");

    if (isLabour) {
      return `${target.materialName} labour`;
    }
    return target.materialName;
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(this.buildQuery(target));
        const url = `https://www.flipkart.com/search?q=${query}`;

        const html = await this.fetchWithRetry(url);
        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_flipkart_${Date.now()}.html`,
          html
        );

        // Extract prices
        const priceMatches = Array.from(html.matchAll(/₹([\d,]+(?:\.\d+)?)/gi));
        const prices = priceMatches
          .map((match) => Number(String(match[1]).replace(/,/g, "")))
          .filter((value) => Number.isFinite(value) && value > 0)
          .slice(0, 10); // Get top 10 prices

        if (prices.length === 0) continue;

        // Extract brand
        const brand = extractBrandFromFlipkart(html);
        const price = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));

        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price,
          brandName: brand || undefined,
          source: "flipkart_scraper",
          scrapedAt: new Date(),
          confidence: 0.65,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price,
          brand: brand,
          source: "flipkart_scraper",
        });
      } catch (error) {
        this.logStructured({
          level: "error",
          district: target.districtName,
          material: target.materialName,
          source: "flipkart_scraper",
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return results;
  }
}
