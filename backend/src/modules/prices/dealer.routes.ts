import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import * as dealerController from "./dealer.controller";

const router = Router();

// ==================== Dealer Profile Routes ====================

// Create/get dealer profile by current user
router.post("/profile", authenticate, dealerController.createDealerProfile);
router.get("/profile", authenticate, dealerController.getDealerProfile);
router.put("/profile", authenticate, dealerController.updateDealerProfile);

// List all approved dealers (public endpoint)
router.get("/list", dealerController.listApprovedDealers);
router.get("/list/city/:city", dealerController.getDealersByCity);

// ==================== Dealer Price Routes ====================

// Set/manage prices for materials
router.post("/prices/set", authenticate, dealerController.setPriceForMaterial);
router.get("/prices", authenticate, dealerController.getDealerPrices);
router.post("/prices/bulk", authenticate, dealerController.bulkSetPrices);

// Get prices for a specific material (public - shows all dealer prices)
router.get("/prices/material/:materialId", dealerController.getPricesForMaterial);

// Price history and management
router.get("/prices/:priceId/history", authenticate, dealerController.getPriceHistory);
router.delete("/prices/:priceId", authenticate, dealerController.deactivatePrice);

// Get specific dealer — MUST be after /prices/* routes to avoid catching "prices" as a dealerId
router.get("/:dealerId", dealerController.getDealerById);

// ==================== Admin Routes ====================

// Approve dealer profile (admin only)
router.post("/admin/approve", authenticate, dealerController.approveDealerProfile);

export default router;
