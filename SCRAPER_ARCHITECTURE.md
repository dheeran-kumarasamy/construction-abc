# All Materials Scraper - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AllMaterialsScraper (NEW)                        │
│  Master orchestrator that fetches ALL materials from ALL sources    │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ├─ Fetches all active materials × all districts
                 │  (2480 total: 31 districts × 80 materials)
                 │
                 └─ Runs 5 scrapers in PARALLEL with error handling
                    │
         ┌──────────┼──────────┬─────────────┬─────────────┐
         │          │          │             │             │
         ▼          ▼          ▼             ▼             ▼
    ┌─────────┐┌──────────┐┌──────────┐┌─────────────┐┌──────────┐
    │IndiaMART││MaterialTree│Flipkart  │TradeKey    │ OLX       │
    │Scraper  ││(Enhanced) ││          │            │           │
    └────┬────┘└─────┬─────┘└─────┬────┘└─────┬──────┘└─────┬────┘
         │           │            │           │            │
    ┌────▼───────┐┌──▼──────────┐ ┌───▼──┐ ┌───▼──┐ ┌────▼────┐
    │IndiaMART   ││MaterialTree │ │      │ │      │ │  OLX   │
    │.com        ││.com         │ │Flipkar │TradeKy │ .in    │
    │(B2B)       ││(Aggregator) │ │(B2C) │(B2B)  │(C2C)   │
    └────────────┘└─────────────┘ └──────┘ └──────┘ └────────┘
         │           │            │           │            │
         └───────────┴────────────┴───────────┴────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │  Merge & Deduplicate     │
                │  by:                     │
                │  1. Confidence score     │
                │  2. Timestamp (fresher)  │
                │  3. Brand name presence  │
                └────────────┬─────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │  Persist to Database     │
                │  (price_records)         │
                └──────────────────────────┘
```

## Data Flow

```
Weekly Scheduler (Cron)                      Admin API
      │                                           │
      │                                           │
      └─ Triggers on Sunday 4:00 AM IST          │
      │  (Every week)                            │
      │                                           │
      ├─────────────────┬───────────────────┬────┴────────┐
      │                 │                   │             │
      ▼                 ▼                   ▼             ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐
│server.ts    │  │              │  │admin.routes │  │CLI/Tools │
│calls:       │  │(future:      │  │ts endpoint: │  │(future)  │
│start        │  │webhooks)     │  │POST /api/   │  │          │
│ScraperSched │  │              │  │admin/       │  │          │
│uler()       │  │              │  │scrapers/    │  │          │
└──────┬──────┘  │              │  │run-all-     │  │          │
       │         │              │  │materials    │  │          │
       ▼         │              │  │             │  │          │
┌─────────────┐  │              │  └──────┬──────┘  │          │
│startScraperS│  │              │         │         │          │
│cheduler()   │  │              │         │         │          │
└──────┬──────┘  │              │         │         │          │
       │         │              │         │         │          │
       ├────────┴──────────────┼────────┬┴────────┤          │
       │                       │        │         │          │
       ▼                       │        ▼         ▼          ▼
   All scheduled               │    runAll    (requires
   tasks including:            │    Materials admin auth)
   - all-materials-weekly      │    Scraper()
   - indiamart-6h              │
   - pwd-monday-3am            │
   - aggregator-daily-2am      │
       │                       │
       └───────────┬───────────┴────────────────┤
                   │                            │
                   ▼                            ▼
          ┌─────────────────┐        ┌──────────────────┐
          │AllMaterialsSc   │        │Returns JSON      │
          │raper.run()      │        │{inserted, targets│
          │executes         │        │, sources, ...}   │
          └─────────────────┘        └──────────────────┘
```

## Scraper Source Details

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCRAPER DETAILS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. INDIAMART (IndiaMART Scraper)                               │
│    URL: https://dir.indiamart.com/search.mp?ss={query}         │
│    Focus: B2B wholesale marketplace                            │
│    Brand Extraction: Regex patterns from listing text           │
│    Confidence: 0.70 (HIGH)                                      │
│    Rate Limit: 2000ms                                           │
│                                                                 │
│ 2. MATERIALTREE (MaterialTree Scraper) - ENHANCED              │
│    URL: https://www.materialtree.com/search?q={query}          │
│    Focus: Building material aggregator network                 │
│    Brand Extraction: NEW - Company/Seller/Distributor fields   │
│    Confidence: 0.50 (MEDIUM)                                    │
│    Rate Limit: 2000ms                                           │
│    Previous: No brand extraction                                │
│    Now: Extracts company/seller names (+30-40% coverage)       │
│                                                                 │
│ 3. FLIPKART (Flipkart Scraper) - NEW                           │
│    URL: https://www.flipkart.com/search?q={query}              │
│    Focus: Consumer e-commerce retail                           │
│    Brand Extraction: Seller/Brand meta tags                     │
│    Confidence: 0.65 (HIGH)                                      │
│    Rate Limit: 3000ms                                           │
│                                                                 │
│ 4. TRADEKEY (TradeKey Scraper) - NEW                           │
│    URL: https://www.tradekey.com/search_company/{query}        │
│    Focus: Global B2B wholesale platform with India vendors    │
│    Brand Extraction: Manufacturer/Supplier names                │
│    Confidence: 0.60 (MEDIUM-HIGH)                               │
│    Rate Limit: 2500ms                                           │
│                                                                 │
│ 5. OLX (OLX Scraper) - NEW                                     │
│    URL: https://www.olx.in/search?q={query}&state=TN          │
│    Focus: Secondary market & local sellers (Tamil Nadu)        │
│    Brand Extraction: Seller name from title/profile            │
│    Confidence: 0.50 (MEDIUM) - Secondary market data           │
│    Rate Limit: 2500ms                                           │
│    Price Strategy: Uses median to avoid outliers               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Database Integration

```
┌────────────────────────────────────────────────────────────────┐
│                    price_records TABLE                         │
├────────────────────────────────────────────────────────────────┤
│ Column            │ Type      │ Notes                          │
├───────────────────┼───────────┼────────────────────────────────┤
│ id                │ PK        │ Auto-increment                 │
│ material_id       │ FK        │ Links to materials table       │
│ district_id       │ FK        │ Links to districts table       │
│ price             │ decimal   │ Extracted price value          │
│ brand_name        │ varchar   │ NEW: Normalized brand/company │
│ source            │ varchar   │ Scraper source identifier      │
│ scraped_at        │ timestamp │ When data was scraped         │
│ flagged           │ boolean   │ Manual review flag             │
│ created_at        │ timestamp │ Record insertion time          │
└────────────────────────────────────────────────────────────────┘

Example Query to check brand coverage:
═══════════════════════════════════════════════════════════════

    SELECT 
      source,
      COUNT(*) as total_records,
      COUNT(CASE WHEN brand_name IS NOT NULL THEN 1 END) as with_brand,
      ROUND(100.0 * COUNT(CASE 
            WHEN brand_name IS NOT NULL THEN 1 
          END) / COUNT(*), 1) as brand_coverage_pct
    FROM price_records
    WHERE scraped_at >= NOW() - INTERVAL '24 hours'
      AND source IN (
        'indiamart_scraper',
        'aggregator_scraper', 
        'flipkart_scraper',
        'tradekey_scraper',
        'olx_scraper'
      )
    GROUP BY source
    ORDER BY brand_coverage_pct DESC;

Expected Output (after first run):
─────────────────────────────────────
source                │ total  │ with_brand │ coverage
indiamart_scraper     │ 3205   │ 2890       │ 90.2%
flipkart_scraper      │ 2145   │ 1843       │ 85.9%
tradekey_scraper      │ 2100   │ 1680       │ 80.0%
aggregator_scraper    │ 2890   │ 1156       │ 40.0%  (↑ from 0%)
olx_scraper           │ 2000   │ 900        │ 45.0%
```

## Deduplication Logic

```
┌────────────────────────────────────────────────────────────────┐
│              MERGE BEST RECORDS STRATEGY                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Input: All scraped records from 5 sources                    │
│         (typically 12,000-15,000 total)                       │
│                                                                │
│  Key: material_id + district_id (material × location)         │
│  Goal: Keep ONE best record per material-district pair        │
│                                                                │
│  Scoring Criteria (in order):                                 │
│  ─────────────────────────────────                            │
│                                                                │
│  1️⃣  CONFIDENCE SCORE (Primary)                                 │
│     Prefer higher confidence:                                 │
│     • 0.70 (IndiaMART) ← HIGHEST                              │
│     • 0.65 (Flipkart)                                         │
│     • 0.60 (TradeKey)                                         │
│     • 0.50 (MaterialTree, OLX) ← LOWEST                       │
│                                                                │
│  2️⃣  TIMESTAMP (Secondary)                                      │
│     If confidence equal: Use FRESHER data                    │
│     (newer scrapedAt timestamp wins)                         │
│                                                                │
│  3️⃣  BRAND NAME (Tertiary)                                      │
│     If confidence & timestamp equal:                         │
│     Prefer records WITH brand name                           │
│                                                                │
│  Example:                                                      │
│  ─────────────────────────────────────────────────────────   │
│  Material: Cement | District: Coimbatore                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Source      Price  Brand      Confidence Timestamp  │      │
│  ├─────────────────────────────────────────────────────┤    │
│  │ IndiaMART   350   Ultratech   0.70      22:15      │      │
│  │ Flipkart    345   (null)      0.65      22:20  ✗   │      │
│  │ TradeKey    355   ACC         0.60      22:10  ✗   │      │
│  │ OLX         342   Local       0.50      22:25  ✗   │      │
│  │ MaterialTree 348  (null)      0.50      22:00  ✗   │      │
│  └─────────────────────────────────────────────────────┘    │
│                                                                │
│  Winner: IndiaMART 350 Ultratech ← Highest confidence        │
│                                                                │
│  Output: 1 best record per material-district                 │
│          (typically 1,800-2,000 total)                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Weekly Execution Timeline

```
┌─────────┬──────────┬────────────┬──────────┬──────────┐
│ MON     │ TUE      │ WED        │ THU      │ FRI      │
│         │          │            │          │          │
│         │          │            │          │          │
└─────────┴──────────┴────────────┴──────────┴──────────┘
┌─────────┬──────────┬────────────┬──────────┬──────────┐
│ SAT     │ SUN      │            │          │          │
│         │ 🔴 04:00 │            │          │          │
│ 02:00   │ ALL-MAT  │            │          │          │
│ AGGR    │ SCRAPER  │            │          │          │
│         │ RUNS     │            │          │          │
└─────────┴──────────┴────────────┴──────────┴──────────┘

Scheduled Tasks (Weekly):
════════════════════════════════════════════════════════

🟡 IndiaMART     Every 6 hours     (05 min past each) 
                 00:05, 06:05, 12:05, 18:05

🔵 PWD           Monday 3:10 AM    (From PDF upload)

🟢 Aggregator    Daily 2:15 AM     (MaterialTree)

🔴 ALL-MATERIALS Sunday 4:00 AM    ← NEW: All 5 sources
                 (Every week)      ← Comprehensive run

All times: IST (UTC+5:30) per CRON_TIMEZONE env var
```

## File Structure

```
backend/src/services/scrapers/
├── BaseScraper.ts                (Base class - all inherit)
├── IndiaMartScraper.ts          (Existing - HIGH confidence)
├── MaterialTreeScraper.ts       (Enhanced - brand extraction)
├── PWDScheduleScraper.ts        (PDF-based, standalone)
├── ScraperManager.ts            (Orchestrates old sources)
│
├── 🆕 AllMaterialsScraper.ts    (NEW - Master orchestrator)
├── 🆕 FlipkartScraper.ts        (NEW - B2C marketplace)
├── 🆕 TradeKeyScraper.ts        (NEW - B2B global)
├── 🆕 OLXScraper.ts             (NEW - Secondary market)
│
└── index.ts                      (Scheduler & exports)

admin/
└── admin.routes.ts              (Updated with new endpoint)

Root
├── ALL_MATERIALS_SCRAPER.md     (Full documentation)
├── ALL_MATERIALS_IMPLEMENTATION.md (What changed)
└── LABOUR_SCRAPER_SCHEDULER.md  (Old labor-only docs)
```

