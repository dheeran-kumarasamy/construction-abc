import cron from "node-cron";
import { ScraperManager } from "./ScraperManager";
import { LabourScraper } from "./LabourScraper";
import { AllMaterialsScraper } from "./AllMaterialsScraper";

const manager = new ScraperManager();
const labourScraper = new LabourScraper();
const allMaterialsScraper = new AllMaterialsScraper();
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || "Asia/Kolkata";

export async function runScrapers(source?: "indiamart" | "pwd" | "aggregator") {
  return manager.run(source);
}

export async function runLabourScraper() {
  return labourScraper.run();
}

export async function runAllMaterialsScraper() {
  return allMaterialsScraper.run();
}

export function startScraperScheduler() {
  const scheduleTask = (
    name: string,
    expression: string,
    run: () => Promise<void>
  ) => {
    let running = false;

    cron.schedule(
      expression,
      async () => {
        if (running) {
          console.warn(`[scheduler] ${name} skipped because previous run is still active.`);
          return;
        }

        running = true;
        const startedAt = Date.now();
        try {
          await run();
        } catch (error) {
          console.error(`[scheduler] ${name} failed`, error);
        } finally {
          running = false;
          const elapsedMs = Date.now() - startedAt;
          console.log(`[scheduler] ${name} completed in ${elapsedMs}ms`);
        }
      },
      {
        timezone: CRON_TIMEZONE,
        noOverlap: true,
      }
    );
  };

  // Offset heavy jobs away from :00 to reduce missed execution during hourly load spikes.
  scheduleTask("indiamart", "5 */6 * * *", async () => {
    await manager.run("indiamart");
  });

  scheduleTask("pwd", "10 3 * * 1", async () => {
    await manager.run("pwd");
  });

  scheduleTask("aggregator", "15 2 * * *", async () => {
    await manager.run("aggregator");
  });

  // Weekly comprehensive materials scraper: runs on Sunday at 4:00 AM
  // Scrapes ALL materials from multiple sources with brand name enrichment
  scheduleTask("all-materials-weekly", "0 4 * * 0", async () => {
    const result = await allMaterialsScraper.run();
    console.log(
      `[all-materials-weekly] completed: inserted=${result.inserted}, ` +
      `districts=${result.districtsWithData}/${result.targets}, ` +
      `sources=${result.sourcesUsed.join(",")}`
    );
  });

  console.log(`✅ Price scraper schedules initialized (timezone: ${CRON_TIMEZONE})`);
}
