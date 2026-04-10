# All Materials Weekly Scraper

## Overview

The **AllMaterialsScraper** is a comprehensive price data collection system that scrapes ALL material categories across Tamil Nadu districts. It runs weekly and integrates multiple sources to ensure robust, brand-aware pricing data.

**Key Upgrade:** Transitioned from labour-only scraping to comprehensive material coverage with brand name enrichment.

---

## Architecture

### Supported Sources

1. **IndiaMART** (`indiamart_scraper`)
   - Primary B2B marketplace for construction materials
   - Confidence: 0.7
   - Extracts brand names from listings

2. **MaterialTree** (`aggregator_scraper`)
   - Aggregator platform with distributor networks
   - Confidence: 0.5
   - NEW: Now extracts brand names from company/distributor info

3. **Flipkart** (`flipkart_scraper`)
   - Consumer marketplace with competitive pricing
   - Confidence: 0.65
   - Extracts seller/brand information

4. **TradeKey** (`tradekey_scraper`)
   - B2B wholesale platform
   - Confidence: 0.60
   - Extracts manufacturer/supplier as brand

5. **OLX** (`olx_scraper`)
   - Secondary market and local sellers
   - Confidence: 0.50
   - Extracts seller brand information

### Scraping Strategy

**ExecutionFlow:**
```
AllMaterialsScraper.run()
  ├─ Fetch all active materials × all districts
  ├─ Run 5 scrapers in parallel:
  │  ├─ IndiaMartScraper
  │  ├─ MaterialTreeScraper (enhanced)
  │  ├─ FlipkartScraper (new)
  │  ├─ TradeKeyScraper (new)
  │  └─ OLXScraper (new)
  ├─ Merge & deduplicate with preference scoring:
  │  1. Higher confidence scores
  │  2. Fresher timestamps
  │  3. Populated brand names
  └─ Persist to database with source tracking
```

### Brand Name Handling

**Before:** Brand names were inconsistently populated or missing for non-IndiaMART sources.

**After:** Multi-source brand extraction strategy:

- **IndiaMART:** Extracts from regex patterns (brand/make + price)
- **MaterialTree:** Extracts from Company/Seller/Distributor fields (NEW)
- **Flipkart:** Extracts from seller/brand meta tags
- **TradeKey:** Extracts manufacturer/supplier names
- **OLX:** Extracts from listing titles and seller info

**Normalization:** All brand names are:
- Lowercased for comparison
- Sanitized (remove special chars, keep alphanumeric + &+./-)
- Truncated to 80 characters max
- Deduplicated by confidence score

---

## Scheduling

### Automatic Weekly Run

**Schedule:** Every Sunday at 4:00 AM IST (Asia/Kolkata timezone)

```javascript
// src/services/scrapers/index.ts
scheduleTask("all-materials-weekly", "0 4 * * 0", async () => {
  const result = await allMaterialsScraper.run();
  // Log: inserted=N, districts=M/T, sources=...
});
```

**Why Sunday 4 AM?**
- Offsets from other scrapers (IndiaMART: every 6h, PWD: Mon 3 AM, Aggregator: daily 2 AM)
- Reduces database contention
- Allows 24h for processing before market opens

### Environment Configuration

Edit `.env` to customize behavior:

```bash
# Scraper rate limiting (milliseconds between requests)
SCRAPER_RATE_LIMIT_MS=2000

# Execution timezone (default: Asia/Kolkata)
CRON_TIMEZONE=Asia/Kolkata

# Optional: Custom user agents for scraping
SCRAPER_USER_AGENTS=Mozilla/5.0 (Windows NT 10.0; Win64; x64),...

# Optional: Proxy URL for scraping (format: http://proxy:port)
SCRAPER_PROXY_URL=
```

---

## Manual Execution

### API Endpoint

Trigger a manual all-materials scrape via admin API:

```bash
curl -X POST http://localhost:3000/api/admin/scrapers/run-all-materials \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "targets": 2480,
  "scraped": 12340,
  "inserted": 1850,
  "districtsWithData": 31,
  "sourcesUsed": [
    "indiamart_scraper",
    "aggregator_scraper",
    "flipkart_scraper",
    "tradekey_scraper",
    "olx_scraper"
  ],
  "completedAt": "2026-04-10T04:00:00.000Z"
}
```

### Error Handling

If manual run is triggered while scheduler is already running:
- Scheduler: Skipped automatically (noOverlap=true)
- API: Runs independently (isolation)
- Database: Concurrent inserts are safely handled

---

## Database Schema

All scraped data is stored in `price_records`:

```sql
INSERT INTO price_records (
  material_id,      -- FK to materials table
  district_id,      -- FK to districts table
  price,            -- Extracted price (decimal)
  brand_name,       -- NEW: Normalized brand/company name
  source,           -- Scraper source identifier
  scraped_at,       -- Timestamp of scrape
  flagged,          -- Manual review flag
  created_at        -- Record insertion time
)
```

**Query for recent data:**
```sql
SELECT 
  m.name, 
  d.name, 
  pr.price, 
  pr.brand_name,
  pr.source,
  pr.scraped_at
FROM price_records pr
JOIN materials m ON m.id = pr.material_id
JOIN districts d ON d.id = pr.district_id
WHERE pr.scraped_at >= NOW() - INTERVAL '7 days'
ORDER BY pr.scraped_at DESC
LIMIT 100;
```

---

## Monitoring

### Console Logs

Watch the server logs for scraper activity:

```
[all-materials-scraper] Starting scrape for 2480 material-district pairs
[all-materials-scraper] Scraped 12340 total records: indiamart=3205, materialtree=2890, flipkart=2145, tradekey=2100, olx=2000
[all-materials-scraper] Merged to 1850 unique best records
[all-materials-scraper] Inserted 1850 records, 31 districts covered, sources: flipkart_scraper,indiamart_scraper,aggregator_scraper,olx_scraper,tradekey_scraper
[all-materials-weekly] completed: inserted=1850, districts=31/2480, sources=indiamart_scraper,aggregator_scraper,flipkart_scraper,tradekey_scraper,olx_scraper
```

### Key Metrics

- **targets:** Material-district pairs to scrape (usually 2480 = 31 districts × 80 materials)
- **scraped:** Raw records before deduplication
- **inserted:** Unique best records persisted to DB
- **districts_covered:** Number of districts with new data
- **sources_used:** Active scrapers that returned data

---

## Troubleshooting

### No Data Inserted

**Check:**
1. Scraper network connectivity (check proxy settings)
2. Rate limits—increase `SCRAPER_RATE_LIMIT_MS` if getting 429 responses
3. Website HTML structure changed—review `rawSnapshotPath` in logs

**Debug:**
```sql
-- Check if scrapes ran recently
SELECT source, COUNT(*) as records, MAX(scraped_at) as latest
FROM price_records
WHERE scraped_at >= NOW() - INTERVAL '24 hours'
GROUP BY source;
```

### High Deduplication Rate

If `scraped / inserted` ratio is very high (>10:1), brand-based deduplication may be aggressive.

**Review:**
```sql
-- Check brand coverage
SELECT brand_name, COUNT(*) as count
FROM price_records
WHERE scraped_at >= NOW() - INTERVAL '24 hours'
GROUP BY brand_name
ORDER BY count DESC;
```

### Scheduled Task Not Running

**Check server logs at Sunday 4:00 AM IST:**
```bash
tail -f logs/server.log | grep "all-materials"
```

**Verify cron (dev only):**
```javascript
// Add to server startup
console.log('Cron timezone:', process.env.CRON_TIMEZONE || 'Asia/Kolkata');
```

---

## Performance Tuning

### Parallel Limits

Currently 5 scrapers run in parallel. Adjust in `AllMaterialsScraper.ts`:

```typescript
// src/services/scrapers/AllMaterialsScraper.ts
const [indiaRows, treeRows, flipkartRows, tradekeyRows, olxRows] = await Promise.all([
  // Increase/decrease count as needed
]);
```

### Rate Limiting

- Default: 2000ms between requests
- Per scraper: Configured in constructor
- Trade-off: Higher = slower, lower = more 429 errors

### Selective Scraping

For testing, comment out sources in `AllMaterialsScraper.ts`:

```typescript
// To test one source:
const rows = await this.indiaMart.scrape(targets);
// const rows = []; // Skip others
```

---

## Migration Notes

**From LabourScraper:**

1. LabourScraper still exists ( `src/services/scrapers/LabourScraper.ts`)
   - Used for labour-only historical scheduling if needed
   - Can be deprecated once all-materials proves stable

2. API Endpoints:
   - ✅ Old: `POST /api/admin/scrapers/run-labour` (still works)
   - ✅ NEW: `POST /api/admin/scrapers/run-all-materials`
   - Same response structure

3. Database: No migration needed—`brand_name` column already exists

---

## Integration Examples

### Check Latest Prices (Admin Dashboard)

```typescript
const result = await fetch('/api/admin/scrapers/run-all-materials', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await result.json();
console.log(`Inserted ${data.inserted} records across ${data.districtsWithData} districts`);
```

### Query Local Prices by Source

```sql
-- Average price by scraper source
SELECT 
  source,
  COUNT(*) as records,
  ROUND(AVG(price)::numeric, 2) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price,
  COUNT(DISTINCT brand_name) as unique_brands
FROM price_records
WHERE scraped_at >= NOW() - INTERVAL '7 days'
GROUP BY source
ORDER BY records DESC;
```

### Compare Brand Availability

```sql
-- Brand coverage by source
SELECT 
  source,
  COUNT(*) as total,
  COUNT(CASE WHEN brand_name IS NOT NULL THEN 1 END) as with_brand,
  ROUND(100.0 * COUNT(CASE WHEN brand_name IS NOT NULL THEN 1 END) / COUNT(*), 1) as brand_coverage_pct
FROM price_records
WHERE scraped_at >= NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY brand_coverage_pct DESC;
```

---

## Future Enhancements

- [ ] Add Amazon India scraper
- [ ] Add local supplier APIs (if available)
- [ ] Historical trend analysis dashboard
- [ ] Webhook notifications on significant price changes
- [ ] Machine learning confidence scoring
- [ ] A/B test source priority weighting
