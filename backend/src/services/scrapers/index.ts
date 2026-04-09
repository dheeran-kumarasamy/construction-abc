import cron from "node-cron";
import { ScraperManager } from "./ScraperManager";

const manager = new ScraperManager();
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || "Asia/Kolkata";

export async function runScrapers(source?: "indiamart" | "pwd" | "aggregator") {
  return manager.run(source);
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

  console.log(`✅ Price scraper schedules initialized (timezone: ${CRON_TIMEZONE})`);
}
