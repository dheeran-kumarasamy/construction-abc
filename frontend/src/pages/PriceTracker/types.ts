export interface District {
  id: string;
  name: string;
  region: "north" | "south" | "west" | "central";
  lat: number;
  lng: number;
}

export interface MaterialCategory {
  id: string;
  name: string;
  icon: string;
  materials: Material[];
}

export interface Material {
  id: string;
  categoryId: string;
  name: string;
  unit: string;
}

export interface PriceRecord {
  materialId: string;
  materialName: string;
  unit: string;
  price: number;
  trend: "up" | "down" | "stable";
  percentChange: number;
  source: string;
  lastUpdated: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  source: string;
}

export interface PriceAlert {
  id: string;
  materialId: string;
  materialName: string;
  districtId: string;
  districtName: string;
  condition: "above" | "below";
  threshold: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
}

export interface Bookmark {
  id: string;
  districtId: string;
  districtName: string;
}

export interface CompareResponse {
  materials: Array<{ materialId: string; materialName: string; unit: string }>;
  districts: Record<string, Record<string, number | null>>;
}

export interface DealerOwnPrice {
  id: string;
  materialId: string;
  materialName?: string;
  categoryName?: string;
  price: number;
  minimumQuantity: number;
  unitOfSale: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface DealerPricePayload {
  materialId: string;
  price: number;
  minimumQuantity?: number;
  unitOfSale: string;
  notes?: string;
}
