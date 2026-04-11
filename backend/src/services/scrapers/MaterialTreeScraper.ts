/**
 * ExportersIndia scraper — replaces the broken MaterialTree source.
 *
 * MaterialTree.com returns a JavaScript redirect that fetch() cannot follow,
 * so it yields zero data. ExportersIndia.com is a server-rendered B2B
 * directory with Indian construction material listings including company
 * names (used as brand identifiers) and prices.
 */
import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

export class MaterialTreeScraper extends BaseScraper {
  constructor() {
    super({ source: "aggregator_scraper" });
  }

  private buildQuery(target: ScrapeTarget): string {
    const category = String(target.categoryName || "").toLowerCase();
    const labourIntent = category.includes("labour") || category.includes("labor");
    if (labourIntent) {
      return `${target.materialName} labour wages ${target.districtName} Tamil Nadu`;
    }
    return `${target.materialName} price ${target.districtName} Tamil Nadu`;
  }

  /**
   * ExportersIndia product cards typically contain:
   *  - Company name in <a class="companyname">, <span class="companyname">,
   *    <div class="company-name">, or a link with data-company attribute
   *  - Price near "Rs." / "₹" symbols
   *
   * We extract all company names found and use the first one as the brand.
   */
  private extractCompanyNames(html: string): string[] {
    const names: string[] = [];
    const seen = new Set<string>();

    // Pattern 1: common ExportersIndia company name class
    const classPatterns = [
      /class="companyname"[^>]*>\s*<a[^>]*>([^<]{2,80})<\/a>/gi,
      /class="company-?name"[^>]*>([^<]{2,80})<\//gi,
      /<a[^>]+data-company="([^"]{2,80})"/gi,
    ];
    for (const pattern of classPatterns) {
      for (const match of html.matchAll(pattern)) {
        const name = (match[1] || "").trim().replace(/\s+/g, " ");
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          names.push(name.slice(0, 80));
        }
      }
    }

    // Pattern 2: h2/h3 text that looks like a company name (contains Pvt/Ltd/Enterprises/Traders etc.)
    const companyKeywords = /\b(Pvt|Ltd|Limited|Enterprises|Traders|Industries|Trading|Supplier|Agency|Works)\b/i;
    for (const match of html.matchAll(/<h[23][^>]*>([^<]{5,80})<\/h[23]>/gi)) {
      const text = (match[1] || "").trim();
      if (companyKeywords.test(text) && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        names.push(text.slice(0, 80));
      }
    }

    return names.slice(0, 8);
  }

  private extractPrices(html: string): number[] {
    const values: number[] = [];
    // Match "Rs. 350 / Bag", "₹450 per piece", "INR 1200", "Rs 400" etc.
    const pricePattern = /(?:₹|Rs\.?\s?|INR\s?)([\d,]+(?:\.\d+)?)/gi;
    for (const match of html.matchAll(pricePattern)) {
      const value = Number(String(match[1]).replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0 && value < 10000000) {
        values.push(value);
      }
    }
    return values;
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const target of targets) {
      try {
        const query = encodeURIComponent(this.buildQuery(target));
        // ExportersIndia search — server-rendered HTML, no JS execution required
        const url = `https://www.exportersindia.com/search.php?q=${query}`;

        const html = await this.fetchWithRetry(url);
        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_${Date.now()}.html`,
          html
        );

        const prices = this.extractPrices(html);
        if (!prices.length) continue;

        const companies = this.extractCompanyNames(html);
        // Use median price for robustness against outliers
        const sorted = [...prices].sort((a, b) => a - b);
        const medianPrice = Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));

        if (companies.length > 0) {
          // Emit one record per company (brand) with the median market price
          for (const company of companies) {
            results.push({
              districtId: target.districtId,
              materialId: target.materialId,
              price: medianPrice,
              brandName: company,
              source: "aggregator_scraper",
              scrapedAt: new Date(),
              confidence: 0.55,
              rawSnapshotPath: snapshot,
            });
          }
        } else {
          results.push({
            districtId: target.districtId,
            materialId: target.materialId,
            price: medianPrice,
            source: "aggregator_scraper",
            scrapedAt: new Date(),
            confidence: 0.45,
            rawSnapshotPath: snapshot,
          });
        }

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price: medianPrice,
          brands: companies.length,
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
