import { app } from "./app";
import { testDbConnection } from "./config/db";

const port = process.env.PORT || 3001;

async function startServer() {
  try {
    await testDbConnection();

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
