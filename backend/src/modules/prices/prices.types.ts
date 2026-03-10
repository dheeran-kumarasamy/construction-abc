export type Trend = "up" | "down" | "stable";

export interface PriceWithTrend {
  materialId: string;
  materialName: string;
  unit: string;
  price: number;
  trend: Trend;
  percentChange: number;
  source: string;
  lastUpdated: string;
}
