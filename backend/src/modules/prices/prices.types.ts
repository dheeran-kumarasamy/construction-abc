export type Trend = "up" | "down" | "stable";

export interface PriceWithTrend {
  materialPriceId: string;
  materialId: string;
  materialName: string;
  brandName: string | null;
  unit: string;
  price: number;
  trend: Trend;
  percentChange: number;
  source: string;
  lastUpdated: string;
}
