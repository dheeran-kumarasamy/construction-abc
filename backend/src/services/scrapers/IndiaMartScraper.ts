import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

type BrandPricePair = {
  brandName: string;
  price: number;
};

function normalizeBrandName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9&+./()\- ]/g, "")
    .trim()
    .slice(0, 80);
}

function extractBrandPricePairs(text: string): BrandPricePair[] {
  const direct: BrandPricePair[] = [];

  const brandBeforePrice = /(?:brand|make)\s*[:\-]?\s*([a-zA-Z][a-zA-Z0-9&+./()\- ]{1,80})[^\n]{0,200}?(?:₹|rs\.?\s?)([\d,]+(?:\.\d+)?)/gi;
  const priceBeforeBrand = /(?:₹|rs\.?\s?)([\d,]+(?:\.\d+)?)[^\n]{0,200}?(?:brand|make)\s*[:\-]?\s*([a-zA-Z][a-zA-Z0-9&+./()\- ]{1,80})/gi;

  for (const match of text.matchAll(brandBeforePrice)) {
    const brand = normalizeBrandName(String(match[1] || ""));
    const price = Number(String(match[2] || "").replace(/,/g, ""));
    if (brand && Number.isFinite(price) && price > 0) {
      direct.push({ brandName: brand, price });
    }
  }

  for (const match of text.matchAll(priceBeforeBrand)) {
    const price = Number(String(match[1] || "").replace(/,/g, ""));
    const brand = normalizeBrandName(String(match[2] || ""));
    if (brand && Number.isFinite(price) && price > 0) {
      direct.push({ brandName: brand, price });
    }
  }

  const seen = new Set<string>();
  const unique: BrandPricePair[] = [];
  for (const item of direct) {
    const key = `${item.brandName.toLowerCase()}:${item.price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 8) break;
  }

  return unique;
}

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

        const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        const matches = Array.from(text.matchAll(/(?:₹|Rs\.?\s?)([\d,]+(?:\.\d+)?)/gi));
        const numeric = matches
          .map((match) => Number(String(match[1]).replace(/,/g, "")))
          .filter((value) => Number.isFinite(value) && value > 0);

        if (numeric.length === 0) {
          continue;
        }

        const now = new Date();
        const brandPairs = extractBrandPricePairs(text);

        if (brandPairs.length > 0) {
          for (const pair of brandPairs) {
            results.push({
              districtId: target.districtId,
              materialId: target.materialId,
              price: Number(pair.price.toFixed(2)),
              brandName: pair.brandName,
              source: "indiamart_scraper",
              scrapedAt: now,
              confidence: 0.72,
              rawSnapshotPath: snapshot,
            });
          }

          this.logStructured({
            district: target.districtName,
            material: target.materialName,
            source: "indiamart_scraper",
            brandsDetected: brandPairs.length,
            snapshot,
          });

          continue;
        }

        const price = numeric.slice(0, 8).reduce((sum, value) => sum + value, 0) / Math.min(8, numeric.length);
        results.push({
          districtId: target.districtId,
          materialId: target.materialId,
          price: Number(price.toFixed(2)),
          source: "indiamart_scraper",
          scrapedAt: now,
          confidence: 0.65,
          rawSnapshotPath: snapshot,
        });

        this.logStructured({
          district: target.districtName,
          material: target.materialName,
          price: Number(price.toFixed(2)),
          source: "indiamart_scraper",
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
