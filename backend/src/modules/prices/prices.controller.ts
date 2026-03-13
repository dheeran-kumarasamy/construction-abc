import { Request, Response } from "express";
import {
  addBookmark,
  compareDistrictPrices,
  createAlert,
  deleteAlert,
  deleteBookmark,
  getAlerts,
  getAllCategoriesWithMaterials,
  getAllDistricts,
  getBookmarks,
  getDistrictCategoryPrices,
  getNotifications,
  getMaterialPricesWithDealers,
  getPriceHistory,
  updateAlert,
} from "./prices.service";

function getUserId(req: Request) {
  return (req as any)?.user?.userId as string | undefined;
}

function asString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value || "";
}

function isMissingRelationError(error: unknown, relation: string) {
  const err = error as { code?: string; message?: string };
  return err?.code === "42P01" && (err?.message || "").toLowerCase().includes(relation.toLowerCase());
}

function isAnyMissingRelationError(error: unknown) {
  const err = error as { code?: string };
  return err?.code === "42P01";
}

export async function listDistricts(_req: Request, res: Response) {
  try {
    const data = await getAllDistricts();
    return res.json(data);
  } catch (error) {
    if (isMissingRelationError(error, "districts")) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("List districts error:", error);
    return res.status(500).json({ error: "Failed to fetch districts" });
  }
}

export async function listCategories(_req: Request, res: Response) {
  try {
    const data = await getAllCategoriesWithMaterials();
    return res.json(data);
  } catch (error) {
    if (isMissingRelationError(error, "material_categories") || isMissingRelationError(error, "materials")) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("List categories error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
}

export async function getDistrictPrices(req: Request, res: Response) {
  try {
    const districtId = asString(req.params.districtId);
    const category = String(req.query.category || "Cement");

    const data = await getDistrictCategoryPrices(districtId, category);
    return res.json(data);
  } catch (error) {
    if (error instanceof Error && /(District|Category) not found/.test(error.message)) {
      return res.status(404).json({ error: error.message });
    }

    if (isAnyMissingRelationError(error)) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("Get district prices error:", error);
    return res.status(500).json({ error: "Failed to fetch district prices" });
  }
}

export async function comparePrices(req: Request, res: Response) {
  try {
    const districts = String(req.query.districts || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const category = String(req.query.category || "Cement");
    const data = await compareDistrictPrices(districts, category);

    return res.json(data);
  } catch (error) {
    if (error instanceof Error && /required|not found|valid/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    if (isAnyMissingRelationError(error)) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("Compare prices error:", error);
    return res.status(500).json({ error: "Failed to compare prices" });
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const materialId = asString(req.params.materialId);
    const districtId = asString(req.params.districtId);
    const range = typeof req.query.range === "string" ? req.query.range : undefined;

    const data = await getPriceHistory(materialId, districtId, range);
    return res.json(data);
  } catch (error) {
    if (isAnyMissingRelationError(error)) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("Get history error:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
}

export async function listBookmarks(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = await getBookmarks(userId);
    return res.json(data);
  } catch (error) {
    if (isMissingRelationError(error, "user_bookmarks")) {
      return res.json([]);
    }

    console.error("List bookmarks error:", error);
    return res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
}

export async function createBookmark(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const districtId = req.body?.district_id;
    if (!districtId) return res.status(400).json({ error: "district_id is required" });

    const data = await addBookmark(userId, districtId);
    return res.status(201).json(data);
  } catch (error) {
    if (isMissingRelationError(error, "user_bookmarks")) {
      return res.status(503).json({ error: "Bookmarks are unavailable until database migration 011 is applied" });
    }

    console.error("Create bookmark error:", error);
    return res.status(500).json({ error: "Failed to create bookmark" });
  }
}

export async function removeBookmark(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const deleted = await deleteBookmark(userId, asString(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Bookmark not found" });

    return res.status(204).send();
  } catch (error) {
    if (isMissingRelationError(error, "user_bookmarks")) {
      return res.status(503).json({ error: "Bookmarks are unavailable until database migration 011 is applied" });
    }

    console.error("Delete bookmark error:", error);
    return res.status(500).json({ error: "Failed to delete bookmark" });
  }
}

export async function listAlerts(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = await getAlerts(userId);
    return res.json(data);
  } catch (error) {
    if (isMissingRelationError(error, "price_alerts")) {
      return res.json([]);
    }

    console.error("List alerts error:", error);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
}

export async function createPriceAlert(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { material_id, district_id, condition, threshold } = req.body || {};
    if (!material_id || !district_id || !condition || threshold == null) {
      return res.status(400).json({ error: "material_id, district_id, condition, threshold are required" });
    }

    const data = await createAlert(userId, {
      material_id,
      district_id,
      condition,
      threshold: Number(threshold),
    });

    return res.status(201).json(data);
  } catch (error) {
    if (isMissingRelationError(error, "price_alerts")) {
      return res.status(503).json({ error: "Price alerts are unavailable until database migration 011 is applied" });
    }

    console.error("Create alert error:", error);
    return res.status(500).json({ error: "Failed to create alert" });
  }
}

export async function updatePriceAlert(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = await updateAlert(userId, asString(req.params.id), {
      condition: req.body?.condition,
      threshold: req.body?.threshold != null ? Number(req.body.threshold) : undefined,
      is_active: req.body?.is_active,
    });

    if (!data) return res.status(404).json({ error: "Alert not found" });
    return res.json(data);
  } catch (error) {
    if (isMissingRelationError(error, "price_alerts")) {
      return res.status(503).json({ error: "Price alerts are unavailable until database migration 011 is applied" });
    }

    console.error("Update alert error:", error);
    return res.status(500).json({ error: "Failed to update alert" });
  }
}

export async function removePriceAlert(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const deleted = await deleteAlert(userId, asString(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Alert not found" });

    return res.status(204).send();
  } catch (error) {
    if (isMissingRelationError(error, "price_alerts")) {
      return res.status(503).json({ error: "Price alerts are unavailable until database migration 011 is applied" });
    }

    console.error("Delete alert error:", error);
    return res.status(500).json({ error: "Failed to delete alert" });
  }
}

export async function listNotifications(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const unreadOnly = String(req.query.unread || "false") === "true";
    const data = await getNotifications(userId, unreadOnly);
    return res.json(data);
  } catch (error) {
    console.error("List notifications error:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

export async function getMaterialPricesComparison(req: Request, res: Response) {
  try {
    const materialId = asString(req.params.materialId);
    const location = asString((req.query.location as any) || "");

    if (!materialId) {
      return res.status(400).json({ error: "materialId is required" });
    }

    const data = await getMaterialPricesWithDealers(materialId, location || undefined);
    return res.json(data);
  } catch (error) {
    if (isAnyMissingRelationError(error)) {
      return res.status(503).json({ error: "Price tracker schema is missing. Run database migrations." });
    }

    console.error("Get material prices comparison error:", error);
    return res.status(500).json({ error: "Failed to fetch price comparison" });
  }
}
