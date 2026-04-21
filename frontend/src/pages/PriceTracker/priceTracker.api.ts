import { apiUrl } from "../../services/api";
import type {
  Bookmark,
  CompareResponse,
  DealerOwnPrice,
  DealerPricePayload,
  District,
  MaterialCategory,
  PriceAlert,
  PriceHistoryPoint,
  PriceRecord,
  ProductInquiryPayload,
} from "./types";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchDistricts(): Promise<District[]> {
  const res = await fetch(apiUrl("/api/prices/districts"));
  if (!res.ok) throw new Error("Failed to fetch districts");
  return res.json();
}

export async function fetchCategories(): Promise<MaterialCategory[]> {
  const res = await fetch(apiUrl("/api/prices/categories"));
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function fetchDistrictPrices(districtId: string, category: string): Promise<PriceRecord[]> {
  const res = await fetch(apiUrl(`/api/prices/district/${districtId}?category=${encodeURIComponent(category)}`));
  if (!res.ok) throw new Error("Failed to fetch district prices");
  const data = await res.json();
  return data.prices || [];
}

export async function fetchCompare(districts: string[], category: string): Promise<CompareResponse> {
  const query = districts.join(",");
  const res = await fetch(apiUrl(`/api/prices/compare?districts=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`));
  if (!res.ok) throw new Error("Failed to fetch compare prices");
  return res.json();
}

export async function fetchHistory(
  materialId: string,
  districtId: string,
  range: "30d" | "60d" | "90d" = "90d"
): Promise<PriceHistoryPoint[]> {
  const res = await fetch(apiUrl(`/api/prices/history/${materialId}/${districtId}?range=${range}`));
  if (!res.ok) throw new Error("Failed to fetch price history");
  return res.json();
}

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const res = await fetch(apiUrl("/api/prices/bookmarks"), { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  const rows = await res.json();
  return rows.map((row: any) => ({
    id: row.id,
    districtId: row.district_id,
    districtName: row.district_name,
  }));
}

export async function addBookmark(districtId: string) {
  const res = await fetch(apiUrl("/api/prices/bookmarks"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ district_id: districtId }),
  });

  if (!res.ok) throw new Error("Failed to add bookmark");
}

export async function removeBookmark(bookmarkId: string) {
  const res = await fetch(apiUrl(`/api/prices/bookmarks/${bookmarkId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok && res.status !== 204) throw new Error("Failed to remove bookmark");
}

export async function fetchAlerts(): Promise<PriceAlert[]> {
  const res = await fetch(apiUrl("/api/prices/alerts"), { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch alerts");
  const rows = await res.json();

  return rows.map((row: any) => ({
    id: row.id,
    materialId: row.material_id,
    materialName: row.material_name,
    districtId: row.district_id,
    districtName: row.district_name,
    condition: row.condition,
    threshold: Number(row.threshold),
    isActive: !!row.is_active,
    lastTriggeredAt: row.last_triggered_at || null,
  }));
}

export async function createAlert(payload: {
  materialId: string;
  districtId: string;
  condition: "above" | "below";
  threshold: number;
}) {
  const res = await fetch(apiUrl("/api/prices/alerts"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      material_id: payload.materialId,
      district_id: payload.districtId,
      condition: payload.condition,
      threshold: payload.threshold,
    }),
  });

  if (!res.ok) throw new Error("Failed to create alert");
}

export async function deleteAlert(alertId: string) {
  const res = await fetch(apiUrl(`/api/prices/alerts/${alertId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok && res.status !== 204) throw new Error("Failed to delete alert");
}

export async function fetchDealerOwnPrices(): Promise<DealerOwnPrice[]> {
  const res = await fetch(apiUrl("/api/prices/dealers/prices"), {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch dealer prices");
  }

  const rows = await res.json();
  return rows.map((row: any) => ({
    id: row.id,
    materialId: row.materialId,
    materialName: row.materialName,
    categoryName: row.categoryName,
    price: Number(row.price),
    minimumQuantity: Number(row.minimumQuantity || 1),
    unitOfSale: row.unitOfSale || null,
    notes: row.notes || null,
    updatedAt: row.updatedAt,
  }));
}

export async function setDealerMaterialPrice(payload: DealerPricePayload): Promise<void> {
  const res = await fetch(apiUrl("/api/prices/dealers/prices/set"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save dealer price");
  }
}

export async function submitProductInquiry(payload: ProductInquiryPayload): Promise<void> {
  const res = await fetch(apiUrl("/api/prices/inquiries"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      material_id: payload.materialId,
      district_id: payload.districtId,
      requested_quantity: payload.requestedQuantity,
      specification: payload.specification,
      requested_location: payload.requestedLocation,
      requested_phone_number: payload.requestedPhoneNumber,
      quoted_price: payload.quotedPrice ?? null,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to submit product inquiry");
  }
}
