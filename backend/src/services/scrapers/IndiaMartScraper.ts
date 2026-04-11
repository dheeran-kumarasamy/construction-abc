import { BaseScraper, ScrapedPrice, ScrapeTarget } from "./BaseScraper";

function normalizeBrandName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9&+./()\- ]/g, "")
    .trim()
    .slice(0, 80);
}

export class IndiaMartScraper extends BaseScraper {
  constructor() {
    super({ source: "indiamart_scraper" });
  }

  /**
   * Extract the __NEXT_DATA__ JSON embedded by Next.js in the page HTML.
   * IndiaMART uses Next.js SSR, so all product data is in this JSON blob.
   */
  private parseNextData(html: string): Record<string, unknown> | null {
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (!match) return null;
    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * From the IndiaMART search results page, products is an array of product
   * category objects (mcats). Each may have an `isq` array with specification
   * options – including a "Brand" spec for branded products like AAC blocks,
   * cement, paints, pipes etc.
   */
  private extractIsqBrands(products: unknown[]): string[] {
    const brands = new Set<string>();
    for (const product of products) {
      const p = product as Record<string, unknown>;
      const isqArr = Array.isArray(p["isq"]) ? (p["isq"] as unknown[]) : [];
      for (const spec of isqArr) {
        const s = spec as Record<string, unknown>;
        if (typeof s["name"] === "string" && s["name"].toLowerCase() === "brand") {
          const opts = Array.isArray(s["options"]) ? (s["options"] as string[]) : [];
          for (const opt of opts) {
            if (opt && opt !== "Other" && opt.length > 1) {
              brands.add(normalizeBrandName(opt));
            }
          }
        }
      }
    }
    return Array.from(brands).slice(0, 12);
  }

  /**
   * IndiaMART exposes price range buckets (e.g. "₹7 - ₹8", "₹9 - ₹30") in
   * the top-level `priceData.filters` of the page props. We use the midpoint
   * of the middle bounded range as an estimated market price.
   */
  private extractPriceFromFilters(filters: unknown[]): number | null {
    if (!filters?.length) return null;
    type Filter = { minPrice?: number; maxPrice?: number };
    const bounded = (filters as Filter[]).filter(
      (f) => (f.minPrice ?? 0) > 0 && (f.maxPrice ?? 0) > 0
    );
    if (bounded.length === 0) {
      const first = filters[0] as Filter;
      return first?.minPrice ? first.minPrice * 1.5 : null;
    }
    const mid = bounded[Math.floor(bounded.length / 2)];
    return ((mid.minPrice ?? 0) + (mid.maxPrice ?? 0)) / 2;
  }

  /**
   * Each mcat in the search results contains `lat_long_city_data`, an array
   * of objects keyed by city name pointing to a `city_mcat_url`. We also
   * fall back to constructing the URL from the mcat `filename` field.
   */
  private findCityMcatUrl(products: unknown[], districtName: string): string | null {
    const slug = districtName.toLowerCase().replace(/\s+/g, "-");
    for (const product of products) {
      const p = product as Record<string, unknown>;
      const cityData = Array.isArray(p["lat_long_city_data"])
        ? (p["lat_long_city_data"] as unknown[])
        : [];
      for (const entry of cityData) {
        const e = entry as Record<string, unknown>;
        for (const [city, data] of Object.entries(e)) {
          if (city.toLowerCase().replace(/\s+/g, "-") === slug) {
            const url = (data as Record<string, unknown>)?.["city_mcat_url"];
            if (typeof url === "string") return url;
          }
        }
      }
      // Fall back to constructing URL from filename field
      if (typeof p["filename"] === "string" && p["filename"]) {
        return `https://dir.indiamart.com/${slug}/${p["filename"]}.html`;
      }
    }
    return null;
  }

  /**
   * On a city+mcat landing page, IndiaMART renders supplier listing cards.
   * We look for company names in known JSON paths within __NEXT_DATA__.
   */
  private extractCompanyNames(nextData: Record<string, unknown>): string[] {
    const names: string[] = [];
    const pageProps = (nextData["props"] as Record<string, unknown>)?.["pageProps"] ?? {};
    const pp = pageProps as Record<string, unknown>;

    // Try several known paths for supplier listing arrays
    const candidates: unknown[] =
      (pp["supplierData"] as Record<string, unknown> | undefined)?.["suppliers"] as unknown[] ??
      (pp["productData"] as Record<string, unknown> | undefined)?.["suppliers"] as unknown[] ??
      (pp["listings"] as unknown[]) ??
      (pp["results"] as unknown[]) ??
      [];

    for (const item of candidates) {
      const it = item as Record<string, unknown>;
      const name =
        (it["companyName"] as string) ??
        (it["company_name"] as string) ??
        (it["company"] as string) ??
        (it["name"] as string);
      if (name && typeof name === "string" && name.length > 2) {
        names.push(normalizeBrandName(name));
      }
      if (names.length >= 10) break;
    }
    return names;
  }

  async scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];
    const now = new Date();

    for (const target of targets) {
      try {
        const query = encodeURIComponent(
          `${target.materialName} ${target.districtName} Tamil Nadu market price`
        );
        const searchUrl = `https://dir.indiamart.com/search.mp?ss=${query}`;
        const html = await this.fetchWithRetry(searchUrl);

        const snapshot = this.writeRawSnapshot(
          `${target.materialId}_${target.districtId}_${Date.now()}.html`,
          html
        );

        // IndiaMART pages are Next.js SSR — all data lives in __NEXT_DATA__
        const nextData = this.parseNextData(html);
        if (!nextData) {
          this.logStructured({
            level: "warn",
            district: target.districtName,
            material: target.materialName,
            message: "IndiaMART: no __NEXT_DATA__ found in response",
          });
          continue;
        }

        const pageProps =
          ((nextData["props"] as Record<string, unknown>)?.["pageProps"] as Record<
            string,
            unknown
          >) ?? {};
        const products: unknown[] =
          (pageProps["productData"] as Record<string, unknown> | undefined)?.["products"] as
            unknown[] ??
          (pageProps["products"] as unknown[]) ??
          [];

        // 1. Extract ISQ Brand options (curated brand lists per product category)
        const isqBrands = this.extractIsqBrands(products);

        // 2. Extract price estimate from category-level price range filters
        const priceFilters =
          ((pageProps["priceData"] as Record<string, unknown> | undefined)?.["filters"] as
            unknown[]) ?? [];
        const estimatedPrice = this.extractPriceFromFilters(priceFilters);

        // 3. Optionally fetch city-specific mcat page for supplier company names
        let companyBrands: string[] = [];
        const cityMcatUrl = this.findCityMcatUrl(products, target.districtName);
        if (cityMcatUrl) {
          try {
            const cityHtml = await this.fetchWithRetry(cityMcatUrl);
            const cityNextData = this.parseNextData(cityHtml);
            if (cityNextData) {
              companyBrands = this.extractCompanyNames(cityNextData);
            }
          } catch {
            // City page unavailable — proceed with ISQ brands only
          }
        }

        const allBrands = [...new Set([...companyBrands, ...isqBrands])];

        if (!estimatedPrice) {
          this.logStructured({
            level: "warn",
            district: target.districtName,
            material: target.materialName,
            message: "IndiaMART: no price filters found",
          });
          continue;
        }

        if (allBrands.length > 0) {
          for (const brand of allBrands) {
            results.push({
              districtId: target.districtId,
              materialId: target.materialId,
              price: Number(estimatedPrice.toFixed(2)),
              brandName: brand,
              source: "indiamart_scraper",
              scrapedAt: now,
              confidence: 0.70,
              rawSnapshotPath: snapshot,
            });
          }
          this.logStructured({
            district: target.districtName,
            material: target.materialName,
            source: "indiamart_scraper",
            brandsDetected: allBrands.length,
            price: estimatedPrice,
          });
        } else {
          // No brand info — emit a single unbranded price record
          results.push({
            districtId: target.districtId,
            materialId: target.materialId,
            price: Number(estimatedPrice.toFixed(2)),
            source: "indiamart_scraper",
            scrapedAt: now,
            confidence: 0.60,
            rawSnapshotPath: snapshot,
          });
          this.logStructured({
            district: target.districtName,
            material: target.materialName,
            price: estimatedPrice,
            source: "indiamart_scraper",
            brandsDetected: 0,
          });
        }
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
