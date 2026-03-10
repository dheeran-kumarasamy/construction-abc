import dotenv from "dotenv";
import path from "path";
import { app } from "./app";
import { testDbConnection } from "./config/db";
import { startScraperScheduler } from "./services/scrapers";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = process.env.PORT || 4000;

async function startServer() {
  try {
    await testDbConnection();
    startScraperScheduler();

    app.listen(port, () => {
      console.log("🔥 REAL APP.TS LOADED");
      console.log("🔥 AUTH ROUTES SHOULD BE ACTIVE");
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
