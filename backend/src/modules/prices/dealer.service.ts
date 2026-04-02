import pool from "../../db/pool";

// Types
export interface DealerProfile {
  id: string;
  userId: string;
  organizationId: string | null;
  productCategoryId: string | null;
  shopName: string;
  location: string | null;
  contactNumber: string | null;
  email: string;
  city: string | null;
  state: string | null;
  productCategoryName?: string | null;
  isApproved: boolean;
  approvalDate: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealerPrice {
  id: string;
  dealerId: string;
  materialId: string;
  materialName?: string;
  categoryName?: string;
  unit?: string;
  price: number;
  minimumQuantity: number;
  unitOfSale: string | null;
  notes: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DealerPriceInput {
  materialId: string;
  price: number;
  minimumQuantity?: number;
  unitOfSale?: string;
  notes?: string;
}

// Dealer Profile Operations
export async function createDealerProfile(
  userId: string,
  shopName: string,
  email: string,
  location?: string,
  contactNumber?: string,
  city?: string,
  state?: string,
  organizationId?: string,
  productCategoryId?: string
): Promise<DealerProfile> {
  const { rows } = await pool.query(
    `
      INSERT INTO dealers (
        user_id, shop_name, email, location, contact_number, city, state, organization_id, product_category_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, user_id, organization_id, product_category_id, shop_name, location, contact_number, email,
        city, state, is_approved, approval_date, approved_by, created_at, updated_at
    `,
    [
      userId,
      shopName,
      email,
      location || null,
      contactNumber || null,
      city || null,
      state || null,
      organizationId || null,
      productCategoryId || null,
    ]
  );

  return formatDealerProfile(rows[0]);
}

export async function getDealerById(dealerId: string): Promise<DealerProfile | null> {
  const { rows } = await pool.query(
    `
      SELECT 
        id, user_id, organization_id, product_category_id, shop_name, location, contact_number, email,
        city, state, is_approved, approval_date, approved_by, created_at, updated_at
      FROM dealers
      WHERE id = $1
    `,
    [dealerId]
  );

  return rows.length > 0 ? formatDealerProfile(rows[0]) : null;
}

export async function getDealerByUserId(userId: string): Promise<DealerProfile | null> {
  const { rows } = await pool.query(
    `
      SELECT 
        id, user_id, organization_id, product_category_id, shop_name, location, contact_number, email,
        city, state, is_approved, approval_date, approved_by, created_at, updated_at
      FROM dealers
      WHERE user_id = $1
    `,
    [userId]
  );

  return rows.length > 0 ? formatDealerProfile(rows[0]) : null;
}

export async function getAllApprovedDealers(): Promise<DealerProfile[]> {
  const { rows } = await pool.query(
    `
      SELECT 
        d.id, d.user_id, d.organization_id, d.product_category_id, d.shop_name, d.location, d.contact_number, d.email,
        d.city, d.state, d.is_approved, d.approval_date, d.approved_by, d.created_at, d.updated_at,
        mc.name as product_category_name
      FROM dealers d
      LEFT JOIN material_categories mc ON mc.id = d.product_category_id
      WHERE d.is_approved = true
      ORDER BY d.shop_name ASC
    `
  );

  return rows.map(formatDealerProfile);
}

export async function getDealersByCity(city: string): Promise<DealerProfile[]> {
  const { rows } = await pool.query(
    `
      SELECT 
        d.id, d.user_id, d.organization_id, d.product_category_id, d.shop_name, d.location, d.contact_number, d.email,
        d.city, d.state, d.is_approved, d.approval_date, d.approved_by, d.created_at, d.updated_at,
        mc.name as product_category_name
      FROM dealers d
      LEFT JOIN material_categories mc ON mc.id = d.product_category_id
      WHERE d.city = $1 AND d.is_approved = true
      ORDER BY d.shop_name ASC
    `,
    [city]
  );

  return rows.map(formatDealerProfile);
}

export async function updateDealerProfile(
  dealerId: string,
  updates: Partial<{
    shopName: string;
    location: string;
    contactNumber: string;
    email: string;
    city: string;
    state: string;
    productCategoryId: string;
  }>
): Promise<DealerProfile> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.shopName !== undefined) {
    fields.push(`shop_name = $${paramIndex++}`);
    values.push(updates.shopName);
  }
  if (updates.location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(updates.location);
  }
  if (updates.contactNumber !== undefined) {
    fields.push(`contact_number = $${paramIndex++}`);
    values.push(updates.contactNumber);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.city !== undefined) {
    fields.push(`city = $${paramIndex++}`);
    values.push(updates.city);
  }
  if (updates.state !== undefined) {
    fields.push(`state = $${paramIndex++}`);
    values.push(updates.state);
  }
  if (updates.productCategoryId !== undefined) {
    fields.push(`product_category_id = $${paramIndex++}`);
    values.push(updates.productCategoryId || null);
  }

  fields.push(`updated_at = now()`);
  values.push(dealerId);

  const { rows } = await pool.query(
    `
      UPDATE dealers
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id, user_id, organization_id, product_category_id, shop_name, location, contact_number, email,
        city, state, is_approved, approval_date, approved_by, created_at, updated_at
    `,
    values
  );

  if (rows.length === 0) {
    throw new Error("Dealer not found");
  }

  return formatDealerProfile(rows[0]);
}

export async function approveDealerProfile(dealerId: string, approvedByUserId: string): Promise<DealerProfile> {
  const { rows } = await pool.query(
    `
      UPDATE dealers
      SET is_approved = true, approval_date = now(), approved_by = $2, updated_at = now()
      WHERE id = $1
      RETURNING 
        id, user_id, organization_id, product_category_id, shop_name, location, contact_number, email,
        city, state, is_approved, approval_date, approved_by, created_at, updated_at
    `,
    [dealerId, approvedByUserId]
  );

  if (rows.length === 0) {
    throw new Error("Dealer not found");
  }

  return formatDealerProfile(rows[0]);
}

// Dealer Price Operations
export async function setDealerPrice(
  dealerId: string,
  materialId: string,
  price: number,
  minimumQuantity?: number,
  unitOfSale?: string,
  notes?: string
): Promise<DealerPrice> {
  const allowedCategory = await pool.query(
    `
      SELECT
        d.product_category_id,
        mc.name AS category_name,
        COALESCE(
          ARRAY_AGG(DISTINCT dpc.category_id) FILTER (WHERE dpc.category_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS selected_category_ids,
        COALESCE(
          ARRAY_AGG(DISTINCT mcs.name) FILTER (WHERE mcs.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS selected_category_names
      FROM dealers d
      LEFT JOIN material_categories mc ON mc.id = d.product_category_id
      LEFT JOIN dealer_product_categories dpc ON dpc.dealer_id = d.id
      LEFT JOIN material_categories mcs ON mcs.id = dpc.category_id
      WHERE d.id = $1
      GROUP BY d.product_category_id, mc.name
      LIMIT 1
    `,
    [dealerId]
  );

  if (!allowedCategory.rows.length) {
    throw new Error("Dealer profile not found");
  }

  const selectedCategoryIds = (allowedCategory.rows[0].selected_category_ids || []) as string[];
  const fallbackCategoryId = (allowedCategory.rows[0].product_category_id || null) as string | null;
  const categoryIds = selectedCategoryIds.length > 0
    ? selectedCategoryIds
    : (fallbackCategoryId ? [fallbackCategoryId] : []);

  if (categoryIds.length === 0) {
    throw new Error("Dealer product category is not set");
  }

  const materialAllowed = await pool.query(
    `SELECT 1 FROM materials WHERE id = $1 AND category_id = ANY($2::uuid[]) LIMIT 1`,
    [materialId, categoryIds]
  );
  if (!materialAllowed.rows.length) {
    const selectedCategoryNames = ((allowedCategory.rows[0].selected_category_names || []) as string[])
      .filter(Boolean);
    const fallbackCategoryName = String(allowedCategory.rows[0].category_name || "").trim();
    const categoryLabel = selectedCategoryNames.length > 0
      ? selectedCategoryNames.join(", ")
      : (fallbackCategoryName || "selected categories");
    throw new Error(`You can only set prices for materials in your selected categories: ${categoryLabel}`);
  }

  // Check if price already exists
  const existing = await pool.query(
    `SELECT id, version FROM dealer_prices WHERE dealer_id = $1 AND material_id = $2 AND is_active = true`,
    [dealerId, materialId]
  );

  let priceRow;
  if (existing.rows.length > 0) {
    // Update existing price
    const existingId = existing.rows[0].id;
    const previousPrice = await pool.query(
      `SELECT price FROM dealer_prices WHERE id = $1`,
      [existingId]
    );

    const newVersion = existing.rows[0].version + 1;

    // Record history
    if (previousPrice.rows.length > 0) {
      await pool.query(
        `
          INSERT INTO dealer_price_history (dealer_price_id, previous_price, new_price, changed_by, change_reason)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [existingId, previousPrice.rows[0].price, price, dealerId, "Price update by dealer"]
      );
    }

    // Update the price
    const { rows } = await pool.query(
      `
        UPDATE dealer_prices
        SET price = $1, minimum_quantity = $2, unit_of_sale = $3, notes = $4, version = $5, updated_at = now()
        WHERE id = $6
        RETURNING 
          id, dealer_id, material_id, price, minimum_quantity, unit_of_sale, notes,
          is_active, version, created_at, updated_at
      `,
      [price, minimumQuantity || 1, unitOfSale || null, notes || null, newVersion, existingId]
    );
    priceRow = rows[0];
  } else {
    // Create new price
    const { rows } = await pool.query(
      `
        INSERT INTO dealer_prices (
          dealer_id, material_id, price, minimum_quantity, unit_of_sale, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id, dealer_id, material_id, price, minimum_quantity, unit_of_sale, notes,
          is_active, version, created_at, updated_at
      `,
      [dealerId, materialId, price, minimumQuantity || 1, unitOfSale || null, notes || null]
    );
    priceRow = rows[0];
  }

  return formatDealerPrice(priceRow);
}

export async function getDealerPrice(dealerPriceId: string): Promise<DealerPrice | null> {
  const { rows } = await pool.query(
    `
      SELECT 
        dp.id, dp.dealer_id, dp.material_id, m.name as material_name, 
        mc.name as category_name, m.unit,
        dp.price, dp.minimum_quantity, dp.unit_of_sale, dp.notes,
        dp.is_active, dp.version, dp.created_at, dp.updated_at
      FROM dealer_prices dp
      JOIN materials m ON m.id = dp.material_id
      JOIN material_categories mc ON mc.id = m.category_id
      WHERE dp.id = $1
    `,
    [dealerPriceId]
  );

  return rows.length > 0 ? formatDealerPriceWithMaterial(rows[0]) : null;
}

export async function getDealerPrices(dealerId: string, onlyActive = true): Promise<DealerPrice[]> {
  const { rows } = await pool.query(
    `
      SELECT 
        dp.id, dp.dealer_id, dp.material_id, m.name as material_name,
        mc.name as category_name, m.unit,
        dp.price, dp.minimum_quantity, dp.unit_of_sale, dp.notes,
        dp.is_active, dp.version, dp.created_at, dp.updated_at
      FROM dealer_prices dp
      JOIN materials m ON m.id = dp.material_id
      JOIN material_categories mc ON mc.id = m.category_id
      WHERE dp.dealer_id = $1 ${onlyActive ? "AND dp.is_active = true" : ""}
      ORDER BY mc.name ASC, m.name ASC
    `,
    [dealerId]
  );

  return rows.map(formatDealerPriceWithMaterial);
}

export async function getDealerPricesByMaterial(materialId: string, districtFilter?: string): Promise<DealerPrice[]> {
  let query = `
    SELECT 
      dp.id, dp.dealer_id, dp.material_id, m.name as material_name,
      mc.name as category_name, m.unit,
      dp.price, dp.minimum_quantity, dp.unit_of_sale, dp.notes,
      dp.is_active, dp.version, dp.created_at, dp.updated_at
    FROM dealer_prices dp
    JOIN materials m ON m.id = dp.material_id
    JOIN material_categories mc ON mc.id = m.category_id
    JOIN dealers d ON d.id = dp.dealer_id
    WHERE dp.material_id = $1 AND dp.is_active = true AND d.is_approved = true
  `;

  const params: any[] = [materialId];

  if (districtFilter) {
    query += ` AND (d.city = $2 OR d.state = $2)`;
    params.push(districtFilter);
  }

  query += ` ORDER BY dp.price ASC`;

  const { rows } = await pool.query(query, params);

  return rows.map(formatDealerPriceWithMaterial);
}

export async function deactivateDealerPrice(dealerPriceId: string): Promise<void> {
  await pool.query(
    `UPDATE dealer_prices SET is_active = false, updated_at = now() WHERE id = $1`,
    [dealerPriceId]
  );
}

export async function getDealerPriceHistory(dealerPriceId: string): Promise<any[]> {
  const { rows } = await pool.query(
    `
      SELECT 
        id, dealer_price_id, previous_price, new_price, changed_by, change_reason, created_at
      FROM dealer_price_history
      WHERE dealer_price_id = $1
      ORDER BY created_at DESC
    `,
    [dealerPriceId]
  );

  return rows;
}

// Helper functions
function formatDealerProfile(row: any): DealerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    productCategoryId: row.product_category_id || null,
    shopName: row.shop_name,
    location: row.location,
    contactNumber: row.contact_number,
    email: row.email,
    city: row.city,
    state: row.state,
    productCategoryName: row.product_category_name || null,
    isApproved: row.is_approved,
    approvalDate: row.approval_date ? new Date(row.approval_date).toISOString() : null,
    approvedBy: row.approved_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function formatDealerPrice(row: any): DealerPrice {
  return {
    id: row.id,
    dealerId: row.dealer_id,
    materialId: row.material_id,
    price: Number(row.price),
    minimumQuantity: row.minimum_quantity || 1,
    unitOfSale: row.unit_of_sale,
    notes: row.notes,
    isActive: row.is_active,
    version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function formatDealerPriceWithMaterial(row: any): DealerPrice {
  return {
    id: row.id,
    dealerId: row.dealer_id,
    materialId: row.material_id,
    materialName: row.material_name,
    categoryName: row.category_name,
    unit: row.unit,
    price: Number(row.price),
    minimumQuantity: row.minimum_quantity || 1,
    unitOfSale: row.unit_of_sale,
    notes: row.notes,
    isActive: row.is_active,
    version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
