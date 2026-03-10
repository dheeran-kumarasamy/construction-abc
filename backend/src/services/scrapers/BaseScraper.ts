import fs from "fs";
import path from "path";

export interface ScrapeTarget {
  districtId: string;
  districtName: string;
  materialId: string;
  materialName: string;
}

export interface ScrapedPrice {
  districtId: string;
  materialId: string;
  price: number;
  source: string;
  scrapedAt: Date;
  confidence: number;
  rawSnapshotPath?: string;
}

interface BaseScraperConfig {
  source: string;
  rateLimitMs?: number;
  userAgents?: string[];
  proxyUrl?: string;
  retries?: number;
}

export abstract class BaseScraper {
  protected readonly source: string;
  private readonly rateLimitMs: number;
  private readonly userAgents: string[];
  private readonly proxyUrl?: string;
  private readonly retries: number;

  constructor(config: BaseScraperConfig) {
    this.source = config.source;
    this.rateLimitMs = config.rateLimitMs ?? Number(process.env.SCRAPER_RATE_LIMIT_MS || 2000);
    this.userAgents =
      config.userAgents ||
      (process.env.SCRAPER_USER_AGENTS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    this.proxyUrl = config.proxyUrl || process.env.SCRAPER_PROXY_URL || undefined;
    this.retries = config.retries ?? 3;
  }

  protected async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected pickUserAgent() {
    if (this.userAgents.length === 0) {
      return "Mozilla/5.0 (compatible; TNPriceTrackerBot/1.0; +https://example.com/bot)";
    }

    const index = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[index];
  }

  protected async fetchWithRetry(url: string): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.retries; attempt += 1) {
      try {
        await this.delay(this.rateLimitMs);

        const targetUrl = this.proxyUrl ? `${this.proxyUrl}${encodeURIComponent(url)}` : url;
        const response = await fetch(targetUrl, {
          headers: {
            "user-agent": this.pickUserAgent(),
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }

        return await response.text();
      } catch (error) {
        lastError = error;
        const waitMs = this.rateLimitMs * Math.pow(2, attempt);
        await this.delay(waitMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to fetch URL");
  }

  protected writeRawSnapshot(filename: string, content: string) {
    const dir = path.join(process.cwd(), "data", "raw", this.source);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  }

  protected logStructured(payload: Record<string, unknown>) {
    const event = {
      source: this.source,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    console.log(JSON.stringify(event));
  }

  abstract scrape(targets: ScrapeTarget[]): Promise<ScrapedPrice[]>;
}
