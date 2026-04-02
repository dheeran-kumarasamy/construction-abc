import { Request, Response } from "express";
import * as dealerService from "./dealer.service";

function getUserId(req: Request): string | undefined {
  return (req as any)?.user?.userId as string | undefined;
}

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value || "";
}

// ==================== Dealer Profile Endpoints ====================

export async function createDealerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { shopName, email, location, contactNumber, city, state, organizationId, productCategoryId } = req.body;

    if (!shopName || !email) {
      return res.status(400).json({ error: "shopName and email are required" });
    }

    const dealer = await dealerService.createDealerProfile(
      userId,
      shopName,
      email,
      location,
      contactNumber,
      city,
      state,
      organizationId,
      productCategoryId
    );

    return res.status(201).json(dealer);
  } catch (error) {
    console.error("Create dealer profile error:", error);
    return res.status(500).json({ error: "Failed to create dealer profile" });
  }
}

export async function getDealerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer profile not found" });
    }

    return res.json(dealer);
  } catch (error) {
    console.error("Get dealer profile error:", error);
    return res.status(500).json({ error: "Failed to fetch dealer profile" });
  }
}

export async function updateDealerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer profile not found" });
    }

    const { shopName, location, contactNumber, email, city, state, productCategoryId } = req.body;

    const updated = await dealerService.updateDealerProfile(dealer.id, {
      shopName,
      location,
      contactNumber,
      email,
      city,
      state,
      productCategoryId,
    });

    return res.json(updated);
  } catch (error) {
    console.error("Update dealer profile error:", error);
    return res.status(500).json({ error: "Failed to update dealer profile" });
  }
}

export async function listApprovedDealers(req: Request, res: Response) {
  try {
    const dealers = await dealerService.getAllApprovedDealers();
    return res.json(dealers);
  } catch (error) {
    console.error("List dealers error:", error);
    return res.status(500).json({ error: "Failed to fetch dealers" });
  }
}

export async function getDealersByCity(req: Request, res: Response) {
  try {
    const city = asString(req.params.city);
    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    const dealers = await dealerService.getDealersByCity(city);
    return res.json(dealers);
  } catch (error) {
    console.error("Get dealers by city error:", error);
    return res.status(500).json({ error: "Failed to fetch dealers" });
  }
}

// ==================== Dealer Price Endpoints ====================

export async function setPriceForMaterial(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer profile not found. Please complete your profile first." });
    }

    const { materialId, price, minimumQuantity, unitOfSale, notes } = req.body;

    if (!materialId || price === undefined || price <= 0) {
      return res.status(400).json({ error: "materialId and valid price are required" });
    }

    if (!unitOfSale || !String(unitOfSale).trim()) {
      return res.status(400).json({ error: "unitOfSale (UOM) is required" });
    }

    const dealerPrice = await dealerService.setDealerPrice(
      dealer.id,
      materialId,
      Number(price),
      minimumQuantity ? Number(minimumQuantity) : undefined,
      unitOfSale,
      notes
    );

    return res.status(201).json(dealerPrice);
  } catch (error) {
    console.error("Set dealer price error:", error);
    if ((error as any)?.message?.includes("materials")) {
      return res.status(400).json({ error: "Invalid material ID" });
    }
    if ((error as any)?.message?.includes("selected category") || (error as any)?.message?.includes("product category")) {
      return res.status(400).json({ error: (error as any)?.message });
    }
    return res.status(500).json({ error: "Failed to set price" });
  }
}

export async function getDealerPrices(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer profile not found" });
    }

    const onlyActive = req.query.onlyActive !== "false";
    const prices = await dealerService.getDealerPrices(dealer.id, onlyActive);

    return res.json(prices);
  } catch (error) {
    console.error("Get dealer prices error:", error);
    return res.status(500).json({ error: "Failed to fetch prices" });
  }
}

export async function getPricesForMaterial(req: Request, res: Response) {
  try {
    const materialId = asString(req.params.materialId);
    const city = req.query.city ? asString(req.query.city as any) : undefined;

    if (!materialId) {
      return res.status(400).json({ error: "materialId is required" });
    }

    const prices = await dealerService.getDealerPricesByMaterial(materialId, city);

    return res.json(prices);
  } catch (error) {
    console.error("Get prices for material error:", error);
    return res.status(500).json({ error: "Failed to fetch material prices" });
  }
}

export async function bulkSetPrices(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer profile not found. Please complete your profile first." });
    }

    const { prices } = req.body;
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: "prices array is required" });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const priceData of prices) {
      try {
        const { materialId, price, minimumQuantity, unitOfSale, notes } = priceData;

        if (!materialId || price === undefined || price <= 0) {
          errors.push({ materialId, error: "Valid materialId and price are required" });
          continue;
        }

        if (!unitOfSale || !String(unitOfSale).trim()) {
          errors.push({ materialId, error: "unitOfSale (UOM) is required" });
          continue;
        }

        const dealerPrice = await dealerService.setDealerPrice(
          dealer.id,
          materialId,
          Number(price),
          minimumQuantity ? Number(minimumQuantity) : undefined,
          unitOfSale,
          notes
        );

        results.push(dealerPrice);
      } catch (error) {
        errors.push({ ...priceData, error: (error as any)?.message });
      }
    }

    return res.json({
      success: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Bulk set prices error:", error);
    return res.status(500).json({ error: "Failed to set prices" });
  }
}

export async function getPriceHistory(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealerPriceId = asString(req.params.priceId);
    if (!dealerPriceId) {
      return res.status(400).json({ error: "priceId is required" });
    }

    // Verify ownership
    const dealerPrice = await dealerService.getDealerPrice(dealerPriceId);
    if (!dealerPrice) {
      return res.status(404).json({ error: "Price entry not found" });
    }

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer || dealer.id !== dealerPrice.dealerId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const history = await dealerService.getDealerPriceHistory(dealerPriceId);

    return res.json(history);
  } catch (error) {
    console.error("Get price history error:", error);
    return res.status(500).json({ error: "Failed to fetch price history" });
  }
}

export async function deactivatePrice(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dealerPriceId = asString(req.params.priceId);
    if (!dealerPriceId) {
      return res.status(400).json({ error: "priceId is required" });
    }

    // Verify ownership
    const dealerPrice = await dealerService.getDealerPrice(dealerPriceId);
    if (!dealerPrice) {
      return res.status(404).json({ error: "Price entry not found" });
    }

    const dealer = await dealerService.getDealerByUserId(userId);
    if (!dealer || dealer.id !== dealerPrice.dealerId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    await dealerService.deactivateDealerPrice(dealerPriceId);

    return res.json({ message: "Price deactivated successfully" });
  } catch (error) {
    console.error("Deactivate price error:", error);
    return res.status(500).json({ error: "Failed to deactivate price" });
  }
}

// ==================== Admin Endpoints ====================

export async function approveDealerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // TODO: Check if user is admin
    // For now, allow architect with org role head to approve

    const { dealerId } = req.body;
    if (!dealerId) {
      return res.status(400).json({ error: "dealerId is required" });
    }

    const dealer = await dealerService.approveDealerProfile(dealerId, userId);

    return res.json(dealer);
  } catch (error) {
    console.error("Approve dealer profile error:", error);
    return res.status(500).json({ error: "Failed to approve dealer profile" });
  }
}

export async function getDealerById(req: Request, res: Response) {
  try {
    const dealerId = asString(req.params.dealerId);
    if (!dealerId) {
      return res.status(400).json({ error: "dealerId is required" });
    }

    const dealer = await dealerService.getDealerById(dealerId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found" });
    }

    return res.json(dealer);
  } catch (error) {
    console.error("Get dealer error:", error);
    return res.status(500).json({ error: "Failed to fetch dealer" });
  }
}
