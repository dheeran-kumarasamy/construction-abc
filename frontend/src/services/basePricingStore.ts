// Simple in-browser Base Pricing database using localStorage
// This is MVP storage before real backend/database is added.

export interface BasePriceItem {
    item: string;
    rate: number;
    uom: string;
    category: "Material" | "Labor" | "Machinery" | "Other";
  }
  
  const STORAGE_KEY = "builder_base_pricing";
  
  export function getBasePricing(): BasePriceItem[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  
  export function saveBasePricing(items: BasePriceItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  
  export function addBasePrice(item: BasePriceItem) {
    const existing = getBasePricing();
    existing.push(item);
    saveBasePricing(existing);
  }
  
  export function clearBasePricing() {
    localStorage.removeItem(STORAGE_KEY);
  }
  