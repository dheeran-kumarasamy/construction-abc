import { apiUrl } from "../../services/api";
import type {
  Resource,
  RateTemplate,
  TemplateLineItem,
  LocationZone,
  ConveyanceSlab,
  PlinthAreaRate,
  BOQProject,
  BOQSection,
  BOQItem,
  RateComputationResult,
  ProjectSummary,
} from "./types";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── SOR Reference ─────────────────────────────

export async function fetchResources(params?: {
  type?: string;
  category?: string;
  annexure?: string;
  search?: string;
}): Promise<Resource[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.category) qs.set("category", params.category);
  if (params?.annexure) qs.set("annexure", params.annexure);
  if (params?.search) qs.set("search", params.search);
  const res = await fetch(apiUrl(`/api/estimation/sor/resources?${qs}`));
  return json<Resource[]>(res);
}

export async function fetchTemplates(params?: {
  category?: string;
  search?: string;
}): Promise<RateTemplate[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.search) qs.set("search", params.search);
  const res = await fetch(apiUrl(`/api/estimation/sor/templates?${qs}`));
  return json<RateTemplate[]>(res);
}

export async function fetchTemplateDetail(id: string): Promise<RateTemplate> {
  const res = await fetch(apiUrl(`/api/estimation/sor/templates/${id}`));
  return json<RateTemplate>(res);
}

// ── Template CRUD ─────────────────────────────

export async function createTemplate(data: {
  code: string;
  name: string;
  category: string;
  sub_category?: string;
  unit: string;
  overhead_percent?: number;
  profit_percent?: number;
  gst_percent?: number;
}): Promise<RateTemplate> {
  const res = await fetch(apiUrl("/api/estimation/templates"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<RateTemplate>(res);
}

export async function updateTemplate(id: string, data: Partial<RateTemplate>): Promise<RateTemplate> {
  const res = await fetch(apiUrl(`/api/estimation/templates/${id}`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<RateTemplate>(res);
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/estimation/templates/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete template");
}

export async function addLineItem(templateId: string, data: {
  resource_id?: string;
  sub_template_id?: string;
  coefficient: number;
  wastage_percent?: number;
  remarks?: string;
}): Promise<TemplateLineItem> {
  const res = await fetch(apiUrl(`/api/estimation/templates/${templateId}/line-items`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<TemplateLineItem>(res);
}

export async function updateLineItem(id: string, data: {
  coefficient?: number;
  wastage_percent?: number;
  remarks?: string;
}): Promise<TemplateLineItem> {
  const res = await fetch(apiUrl(`/api/estimation/line-items/${id}`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<TemplateLineItem>(res);
}

export async function deleteLineItem(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/estimation/line-items/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete line item");
}

export async function fetchLocationZones(): Promise<LocationZone[]> {
  const res = await fetch(apiUrl("/api/estimation/sor/location-zones"));
  return json<LocationZone[]>(res);
}

export async function fetchConveyanceSlabs(terrain?: string): Promise<ConveyanceSlab[]> {
  const qs = terrain ? `?terrain=${terrain}` : "";
  const res = await fetch(apiUrl(`/api/estimation/sor/conveyance-slabs${qs}`));
  return json<ConveyanceSlab[]>(res);
}

export async function fetchPlinthAreaRates(): Promise<PlinthAreaRate[]> {
  const res = await fetch(apiUrl("/api/estimation/sor/plinth-area-rates"));
  return json<PlinthAreaRate[]>(res);
}

export interface BasicMaterialRate {
  sourceKey: string;
  item: string;
  rate: number;
  uom: string;
  category: string;
}

export async function fetchBasicMaterialRates(): Promise<BasicMaterialRate[]> {
  const res = await fetch(apiUrl("/api/base-pricing/template"), {
    headers: authHeaders(),
  });
  const payload = await json<{ rows?: BasicMaterialRate[] }>(res);
  return Array.isArray(payload.rows) ? payload.rows : [];
}

export interface MarketDistrict {
  id: string;
  name: string;
}

export interface MarketCategory {
  id: string;
  name: string;
}

export interface MarketPriceRow {
  materialId: string;
  materialName: string;
  unit: string;
  price: number;
  source: string;
  lastUpdated: string;
}

export interface SubmittedBOQItem {
  item: string;
  qty: number | string;
  uom: string;
}

export interface SubmittedBOQResponse {
  id: string;
  project_id: string;
  file_name?: string;
  uploaded_at?: string;
  uploaded_by_name?: string;
  items: SubmittedBOQItem[];
}

export async function fetchMarketDistricts(): Promise<MarketDistrict[]> {
  const res = await fetch(apiUrl("/api/prices/districts"), {
    headers: authHeaders(),
  });
  return json<MarketDistrict[]>(res);
}

export async function fetchMarketCategories(): Promise<MarketCategory[]> {
  const res = await fetch(apiUrl("/api/prices/categories"), {
    headers: authHeaders(),
  });
  return json<MarketCategory[]>(res);
}

export async function fetchMarketDistrictCategoryPrices(
  districtId: string,
  categoryName: string
): Promise<MarketPriceRow[]> {
  const res = await fetch(
    apiUrl(`/api/prices/district/${districtId}?category=${encodeURIComponent(categoryName)}`),
    {
      headers: authHeaders(),
    }
  );

  const payload = await json<{ prices?: MarketPriceRow[] }>(res);
  return Array.isArray(payload.prices) ? payload.prices : [];
}

export async function fetchSubmittedBOQ(projectId: string): Promise<SubmittedBOQResponse> {
  const res = await fetch(apiUrl(`/api/boq/${projectId}`), {
    headers: authHeaders(),
  });
  return json<SubmittedBOQResponse>(res);
}

export async function submitNewBOQ(
  projectId: string,
  items: SubmittedBOQItem[]
): Promise<{ message: string; boq: SubmittedBOQResponse }> {
  const res = await fetch(apiUrl(`/api/boq/${projectId}/items`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return json<{ message: string; boq: SubmittedBOQResponse }>(res);
}

export async function updateSubmittedBOQ(
  projectId: string,
  items: SubmittedBOQItem[]
): Promise<{ message: string; boq: SubmittedBOQResponse; items: SubmittedBOQItem[] }> {
  const res = await fetch(apiUrl(`/api/boq/${projectId}/items`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return json<{ message: string; boq: SubmittedBOQResponse; items: SubmittedBOQItem[] }>(res);
}

// ── Rate Computation ──────────────────────────

export async function computeRate(input: {
  template_id: string;
  location_zone_id?: string;
  conveyance_distance_km?: number;
  terrain?: string;
  floor_level?: string;
  height_above_gl?: number;
  depth_below_gl?: number;
}): Promise<RateComputationResult> {
  const res = await fetch(apiUrl("/api/estimation/compute/rate"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return json<RateComputationResult>(res);
}

// ── BOQ Projects ──────────────────────────────

export async function createProject(data: Partial<BOQProject>): Promise<BOQProject> {
  const res = await fetch(apiUrl("/api/estimation/projects"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQProject>(res);
}

export async function fetchProjects(): Promise<BOQProject[]> {
  const res = await fetch(apiUrl("/api/estimation/projects"), {
    headers: authHeaders(),
  });
  return json<BOQProject[]>(res);
}

export async function fetchInvitedProjects(): Promise<BOQProject[]> {
  const res = await fetch(apiUrl("/api/estimation/projects/invited"), {
    headers: authHeaders(),
  });
  return json<BOQProject[]>(res);
}

export async function fetchProject(id: string): Promise<BOQProject> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${id}`), {
    headers: authHeaders(),
  });
  return json<BOQProject>(res);
}

export async function updateProject(id: string, data: Partial<BOQProject>): Promise<BOQProject> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${id}`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQProject>(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete project");
}

// ── BOQ Sections ──────────────────────────────

export async function createSection(projectId: string, data: { name: string; sort_order?: number }): Promise<BOQSection> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/sections`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQSection>(res);
}

export async function fetchSections(projectId: string): Promise<BOQSection[]> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/sections`), {
    headers: authHeaders(),
  });
  return json<BOQSection[]>(res);
}

export async function updateSection(id: string, data: Partial<BOQSection>): Promise<BOQSection> {
  const res = await fetch(apiUrl(`/api/estimation/sections/${id}`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQSection>(res);
}

export async function deleteSection(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/estimation/sections/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete section");
}

// ── BOQ Items ─────────────────────────────────

export async function createItem(data: Partial<BOQItem>): Promise<BOQItem> {
  const res = await fetch(apiUrl("/api/estimation/items"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQItem>(res);
}

export async function fetchItems(projectId: string, sectionId?: string): Promise<BOQItem[]> {
  const qs = sectionId ? `?section_id=${sectionId}` : "";
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/items${qs}`), {
    headers: authHeaders(),
  });
  return json<BOQItem[]>(res);
}

export async function updateItem(id: string, data: Partial<BOQItem>): Promise<BOQItem> {
  const res = await fetch(apiUrl(`/api/estimation/items/${id}`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return json<BOQItem>(res);
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/estimation/items/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete item");
}

// ── Compute & Summary ─────────────────────────

export async function computeAllItems(projectId: string): Promise<any[]> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/compute-all`), {
    method: "POST",
    headers: authHeaders(),
  });
  return json<any[]>(res);
}

export async function fetchProjectSummary(projectId: string): Promise<ProjectSummary> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/summary`), {
    headers: authHeaders(),
  });
  return json<ProjectSummary>(res);
}

export async function exportProjectExcel(projectId: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/export`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Export failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  a.download = match?.[1] || `BOQ_Export.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface PlinthValidationInput {
  plinth_area_sqm: number;
  building_class: string;
  num_floors: number;
}

export interface PlinthValidationResult {
  status: "pass" | "warning" | "fail" | "no_benchmark";
  message: string;
  project_total: number;
  plinth_area_sqm: number;
  num_floors: number;
  total_area: number;
  benchmark_rate_per_sqm: number | null;
  benchmark_total: number | null;
  cost_per_sqft: number | null;
  deviation_percent: number | null;
  flags: string[];
}

export async function validatePlinthArea(
  projectId: string,
  input: PlinthValidationInput
): Promise<PlinthValidationResult> {
  const res = await fetch(apiUrl(`/api/estimation/projects/${projectId}/validate-plinth`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return json<PlinthValidationResult>(res);
}
