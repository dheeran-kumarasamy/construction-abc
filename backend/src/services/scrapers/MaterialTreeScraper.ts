import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

export class MaterialTreeScraper extends BaseScraper {
  constructor() {
    super({ source: "aggregator_scraper" });
  }

  private normalizeBrandName(value: string): string {
    return value
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9&+./()\- ]/g, "")
      .trim()
      .slice(0, 80);
  }

  private extractBrand(html: string): string | undefined {
    // Look for seller/company/brand info in MaterialTree listings
    const companyMatch = html.match(/(?:Company|Seller|Brand|Distributor)[\s:]*([a-zA-Z][a-zA-Z0-9&+./()\- ]{1,80})/i);
    if (companyMatch && companyMatch[1]) {
      return this.normalizeBrandName(companyMatch[1]);
    }

    // Try to extract from common HTML patterns
    const titleMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].trim();
      const parts = title.split(/[-•|]/);
      if (parts.length > 1) {
        return this.normalizeBrandName(parts[1]);
      }
    }

    return undefined;
  }

  private buildQuery(target: ScrapeTarget) {
    const category = String(target.categoryName || "").toLowerCase();
    const labourIntent = category.includes("labour") || category.includes("labor");

    if (labourIntent) {
      return `${target.materialName} labour wages per day ${target.districtName} Tamil Nadu`;
    }

    return `${target.materialName} price ${target.districtName} Tamil Nadu`;
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(this.buildQuery(target));
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
        const brand = this.extractBrand(html);

        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price,
          brandName: brand,
          source: "aggregator_scraper",
          scrapedAt: new Date(),
          confidence: 0.5,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price,
          brand,
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
