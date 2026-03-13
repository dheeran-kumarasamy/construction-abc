import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
  comparePrices,
  createBookmark,
  createPriceAlert,
  getDistrictPrices,
  getHistory,
  getMaterialPricesComparison,
  listAlerts,
  listBookmarks,
  listCategories,
  listDistricts,
  listNotifications,
  removeBookmark,
  removePriceAlert,
  updatePriceAlert,
} from "./prices.controller";
import dealerRouter from "./dealer.routes";

const router = Router();

// Market prices (scraped/historical)
router.get("/districts", listDistricts);
router.get("/categories", listCategories);
router.get("/district/:districtId", getDistrictPrices);
router.get("/compare", comparePrices);
router.get("/history/:materialId/:districtId", getHistory);
router.get("/material/:materialId/comparison", getMaterialPricesComparison);

// User bookmarks and alerts
router.get("/bookmarks", authenticate, listBookmarks);
router.post("/bookmarks", authenticate, createBookmark);
router.delete("/bookmarks/:id", authenticate, removeBookmark);

router.get("/alerts", authenticate, listAlerts);
router.post("/alerts", authenticate, createPriceAlert);
router.put("/alerts/:id", authenticate, updatePriceAlert);
router.delete("/alerts/:id", authenticate, removePriceAlert);

router.get("/notifications", authenticate, listNotifications);

// Dealer routes
router.use("/dealers", dealerRouter);

export default router;
