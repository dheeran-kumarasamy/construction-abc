import pool from "../../db/pool";
import { Resource, RateTemplate, TemplateLineItem, LocationZone, ConveyanceSlab } from "./types";

/**
 * PriceLookup – fetches resources, templates, zones from DB with caching.
 */
class PriceLookupService {
  private resourceCache = new Map<string, Resource>();
  private templateCache = new Map<string, RateTemplate>();
  private zoneCache = new Map<string, LocationZone>();
  private slabCache = new Map<string, ConveyanceSlab[]>();
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL;
  }

  invalidateCache(): void {
    this.resourceCache.clear();
    this.templateCache.clear();
    this.zoneCache.clear();
    this.slabCache.clear();
    this.cacheTimestamp = 0;
  }

  async getResource(resourceId: string): Promise<Resource | null> {
    if (this.resourceCache.has(resourceId) && this.isCacheValid()) {
      return this.resourceCache.get(resourceId)!;
    }
    const { rows } = await pool.query(
      `SELECT * FROM resources WHERE id = $1 AND is_active = true`,
      [resourceId]
    );
    if (rows.length === 0) return null;
    const r = this.mapResource(rows[0]);
    this.resourceCache.set(resourceId, r);
    return r;
  }

  async getResourceByCode(code: string): Promise<Resource | null> {
    for (const r of this.resourceCache.values()) {
      if (r.unique_code === code) return r;
    }
    const { rows } = await pool.query(
      `SELECT * FROM resources WHERE unique_code = $1 AND is_active = true`,
      [code]
    );
    if (rows.length === 0) return null;
    const r = this.mapResource(rows[0]);
    this.resourceCache.set(r.id, r);
    return r;
  }

  async getTemplate(templateId: string): Promise<RateTemplate | null> {
    if (this.templateCache.has(templateId) && this.isCacheValid()) {
      return this.templateCache.get(templateId)!;
    }

    const { rows } = await pool.query(
      `SELECT * FROM rate_templates WHERE id = $1 AND is_active = true`,
      [templateId]
    );
    if (rows.length === 0) return null;

    const t: RateTemplate = {
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name,
      category: rows[0].category,
      sub_category: rows[0].sub_category,
      unit: rows[0].unit,
      overhead_percent: parseFloat(rows[0].overhead_percent),
      profit_percent: parseFloat(rows[0].profit_percent),
      gst_percent: parseFloat(rows[0].gst_percent),
      is_system: rows[0].is_system,
    };

    // Load line items with joined resource
    const { rows: items } = await pool.query(`
      SELECT li.*, r.unique_code, r.annexure, r.type AS resource_type, r.category AS resource_category,
             r.name AS resource_name, r.unit AS resource_unit, r.basic_rate, r.is_at_site,
             r.wastage_percent, r.hsn_sac_code
      FROM template_line_items li
      LEFT JOIN resources r ON li.resource_id = r.id
      WHERE li.template_id = $1
      ORDER BY li.sort_order
    `, [templateId]);

    t.line_items = items.map(i => ({
      id: i.id,
      template_id: i.template_id,
      resource_id: i.resource_id,
      sub_template_id: i.sub_template_id,
      description: i.description,
      coefficient: parseFloat(i.coefficient),
      wastage_override: i.wastage_override ? parseFloat(i.wastage_override) : null,
      conveyance_distance_km: i.conveyance_distance_km ? parseFloat(i.conveyance_distance_km) : null,
      conveyance_slab_id: i.conveyance_slab_id,
      sort_order: i.sort_order,
      resource: i.resource_id ? {
        id: i.resource_id,
        unique_code: i.unique_code,
        annexure: i.annexure,
        type: i.resource_type,
        category: i.resource_category,
        name: i.resource_name,
        unit: i.resource_unit,
        basic_rate: parseFloat(i.basic_rate),
        is_at_site: i.is_at_site,
        wastage_percent: parseFloat(i.wastage_percent || "0"),
        hsn_sac_code: i.hsn_sac_code,
      } : undefined,
    }));

    this.templateCache.set(templateId, t);
    this.cacheTimestamp = Date.now();
    return t;
  }

  async getLocationZone(zoneId: string): Promise<LocationZone | null> {
    if (this.zoneCache.has(zoneId) && this.isCacheValid()) {
      return this.zoneCache.get(zoneId)!;
    }
    const { rows } = await pool.query(
      `SELECT * FROM location_zones WHERE id = $1 AND is_active = true`,
      [zoneId]
    );
    if (rows.length === 0) return null;
    const z: LocationZone = {
      id: rows[0].id,
      zone_name: rows[0].zone_name,
      zone_type: rows[0].zone_type,
      labour_extra_percent: parseFloat(rows[0].labour_extra_percent),
      material_extra_percent: parseFloat(rows[0].material_extra_percent),
      works_extra_percent: parseFloat(rows[0].works_extra_percent),
      conveyance_extra_percent: parseFloat(rows[0].conveyance_extra_percent),
      head_load_extra_percent: parseFloat(rows[0].head_load_extra_percent),
      applicable_districts: rows[0].applicable_districts || [],
    };
    this.zoneCache.set(zoneId, z);
    return z;
  }

  async getConveyanceSlabs(terrain: string, sorVersionId?: string): Promise<ConveyanceSlab[]> {
    const key = `${terrain}-${sorVersionId || "default"}`;
    if (this.slabCache.has(key) && this.isCacheValid()) {
      return this.slabCache.get(key)!;
    }

    let query = `SELECT * FROM conveyance_rate_slabs WHERE terrain = $1`;
    const queryParams: any[] = [terrain];
    if (sorVersionId) {
      query += ` AND sor_version_id = $2`;
      queryParams.push(sorVersionId);
    }

    const { rows } = await pool.query(query, queryParams);
    const slabs: ConveyanceSlab[] = rows.map(r => ({
      id: r.id,
      terrain: r.terrain,
      material_group: r.material_group,
      coefficient: parseFloat(r.coefficient),
      unit: r.unit,
      rate_0_10km: parseFloat(r.rate_0_10km),
      rate_10_20km: parseFloat(r.rate_10_20km),
      rate_20_40km: parseFloat(r.rate_20_40km),
      rate_40_80km: parseFloat(r.rate_40_80km),
      rate_above_80km: parseFloat(r.rate_above_80km),
      loading_charges: parseFloat(r.loading_charges),
      unloading_charges: parseFloat(r.unloading_charges),
    }));
    this.slabCache.set(key, slabs);
    return slabs;
  }

  private mapResource(row: any): Resource {
    return {
      id: row.id,
      unique_code: row.unique_code,
      annexure: row.annexure,
      type: row.type,
      category: row.category,
      name: row.name,
      unit: row.unit,
      basic_rate: parseFloat(row.basic_rate),
      is_at_site: row.is_at_site,
      wastage_percent: parseFloat(row.wastage_percent || "0"),
      hsn_sac_code: row.hsn_sac_code,
    };
  }
}

export const priceLookup = new PriceLookupService();
