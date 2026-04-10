# Labour Scraper Scheduling

## Overview
The labour scraper has been integrated into the codebase with both **automatic weekly scheduling** and **on-demand manual triggers**.

## Automatic Weekly Schedule

The labour scraper is configured to run automatically every **Sunday at 3:00 AM (Asia/Kolkata timezone)**.

**Schedule Details:**
- **Cron Expression**: `0 3 * * 0` (Sunday 03:00 AM IST)
- **Scope**: All Tamil Nadu districts (31 districts)
- **Materials**: All 8 labour types (Mason, Helper, Bar Bender, Carpenter, Electrician, Plumber, Painter, Tile Layer)
- **Sources**: IndiaMart search directory + MaterialTree aggregator
- **Rate Limit**: 100ms per request (configurable via `SCRAPER_RATE_LIMIT_MS` env var)

## Scheduler Integration

The labour scraper runs as part of the main scraper scheduler that starts automatically when the backend server boots:

```typescript
// backend/src/server.ts
startScraperScheduler(); // Initializes all scheduled jobs including labour weekly
```

**Existing scraper schedule:**
- `indiamart` scraper: Every 6 hours starting at 00:05 AM
- `pwd` scraper: Every Monday at 3:10 AM
- `aggregator` scraper: Daily at 2:15 AM
- `labour-weekly`: **Every Sunday at 3:00 AM** ← NEW

## Manual Execution

### Via Admin API

Trigger labour scraping on-demand:

```bash
POST /api/admin/scrapers/run-labour
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "targets": 248,
  "scraped": 219,
  "inserted": 219,
  "districtsWithData": 30,
  "completedAt": "2026-04-10T17:47:55.962Z"
}
```

### Via CLI Script

Run the labour scraper directly from command line:

```bash
cd backend
SCRAPER_RATE_LIMIT_MS=100 npm run ts build && npm run ts src/scripts/runLabourScrapeAllDistricts.ts
```

## Configuration

### Environment Variables

- **`CRON_TIMEZONE`**: Timezone for scheduler (default: `Asia/Kolkata`)
  - Example: `export CRON_TIMEZONE="America/New_York"`
- **`SCRAPER_RATE_LIMIT_MS`**: Milliseconds between HTTP requests per scraper
  - Default: 2000ms
  - Labour scrape typically uses 100ms for faster batch runs

### Modify Schedule

To change the weekly schedule, edit [backend/src/services/scrapers/index.ts](./index.ts):

```typescript
// Current: Sunday 3:00 AM
scheduleTask("labour-weekly", "0 3 * * 0", async () => { ... });

// Alternative examples:
// "0 2 * * 0"        → Sunday 2:00 AM
// "0 3 * * 1"        → Every Monday 3:00 AM  
// "0 3 * * 0,3"      → Sunday and Wednesday 3:00 AM (twice weekly)
// "0 */12 * * *"     → Every 12 hours
```

## Monitoring

### Logs

The scheduler logs all activity:

```
[scheduler] labour-weekly skipped because previous run is still active.
[labour-scraper] Starting scrape for 248 district-material pairs
[labour-scraper] Scraped 219 records (indiamart=219, aggregator=0)
[labour-scraper] Merged to 219 unique best records
[labour-scraper] Inserted 219 records, 30 districts now have labour rates
[scheduler] labour-weekly completed in 171234ms
[labour-weekly] completed: inserted=219, districts=30/248
```

### Database Queries

Check last labour scrape run:

```sql
-- Latest labour rates by district
SELECT d.name, COUNT(*) as records, MAX(pr.scraped_at) as last_update
FROM price_records pr
JOIN materials m ON m.id = pr.material_id
JOIN material_categories c ON c.id = m.category_id
JOIN districts d ON d.id = pr.district_id
WHERE LOWER(c.name) LIKE '%labour%'
  AND pr.source IN ('indiamart_scraper', 'aggregator_scraper')
GROUP BY d.name
ORDER BY last_update DESC;

-- Overall labour data coverage
SELECT COUNT(*) as total_records, COUNT(DISTINCT district_id) as districts_covered
FROM price_records pr
JOIN materials m ON m.id = pr.material_id
JOIN material_categories c ON c.id = m.category_id
WHERE LOWER(c.name) LIKE '%labour%'
  AND pr.scraped_at > NOW() - INTERVAL '7 days';
```

## Error Handling

- **Overlapping runs**: If a previously scheduled job is still running, the next scheduled run is skipped with a warning log
- **Failed requests**: Individual scrape requests that fail are logged but don't block other requests; best-effort insertion continues
- **Database errors**: Failed inserts are logged to console; check logs for details

## Architecture

**File Structure:**
```
backend/src/services/scrapers/
├── index.ts                    # Scheduler control center (updated)
├── LabourScraper.ts           # NEW: Dedicated labour scraper class
├── ScraperManager.ts          # Category-based material scraper
├── IndiaMartScraper.ts        # IndiaMART search + parse
├── MaterialTreeScraper.ts     # MaterialTree search + parse
└── BaseScraper.ts             # Base HTTP + snapshot utilities
```

**Entry Point:**
- Scheduler starts in [backend/src/server.ts](../server.ts) on boot
- Admin endpoint: `POST /api/admin/scrapers/run-labour`
- Exported function: `runLabourScraper()` in `backend/src/services/scrapers/index.ts`

## Performance Notes

- **Expected Duration**: 170–200 seconds for full 248 district-material scan
- **Data Points per Run**: 210–220 records (some scrapes fail due to throttling)
- **Districts Covered**: Typically 28–31 out of 31 districts
- **Optimal Time**: Scheduled for 3:00 AM Sunday to minimize peak traffic impact
