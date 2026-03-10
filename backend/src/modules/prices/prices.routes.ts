import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
  comparePrices,
  createBookmark,
  createPriceAlert,
  getDistrictPrices,
  getHistory,
  listAlerts,
  listBookmarks,
  listCategories,
  listDistricts,
  listNotifications,
  removeBookmark,
  removePriceAlert,
  updatePriceAlert,
} from "./prices.controller";

const router = Router();

router.get("/districts", listDistricts);
router.get("/categories", listCategories);
router.get("/district/:districtId", getDistrictPrices);
router.get("/compare", comparePrices);
router.get("/history/:materialId/:districtId", getHistory);

router.get("/bookmarks", authenticate, listBookmarks);
router.post("/bookmarks", authenticate, createBookmark);
router.delete("/bookmarks/:id", authenticate, removeBookmark);

router.get("/alerts", authenticate, listAlerts);
router.post("/alerts", authenticate, createPriceAlert);
router.put("/alerts/:id", authenticate, updatePriceAlert);
router.delete("/alerts/:id", authenticate, removePriceAlert);

router.get("/notifications", authenticate, listNotifications);

export default router;
