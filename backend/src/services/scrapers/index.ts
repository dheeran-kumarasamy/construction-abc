import cron from "node-cron";
import { ScraperManager } from "./ScraperManager";

const manager = new ScraperManager();

export async function runScrapers(source?: "indiamart" | "pwd" | "aggregator") {
  return manager.run(source);
}

export function startScraperScheduler() {
  cron.schedule("0 */6 * * *", async () => {
    try {
      await manager.run("indiamart");
    } catch (error) {
      console.error("IndiaMART scheduled scraper failed", error);
    }
  });

  cron.schedule("0 3 * * 1", async () => {
    try {
      await manager.run("pwd");
    } catch (error) {
      console.error("PWD scheduled scraper failed", error);
    }
  });

  cron.schedule("15 2 * * *", async () => {
    try {
      await manager.run("aggregator");
    } catch (error) {
      console.error("Aggregator scheduled scraper failed", error);
    }
  });

  console.log("✅ Price scraper schedules initialized");
}
