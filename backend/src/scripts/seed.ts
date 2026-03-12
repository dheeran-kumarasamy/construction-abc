import pool from "../db/pool";

type Region = "north" | "south" | "west" | "central";

const DISTRICTS: Array<{ name: string; region: Region; lat: number; lng: number }> = [
  { name: "Chennai", region: "north", lat: 13.0827, lng: 80.2707 },
  { name: "Coimbatore", region: "west", lat: 11.0168, lng: 76.9558 },
  { name: "Madurai", region: "south", lat: 9.9252, lng: 78.1198 },
  { name: "Tiruchirappalli", region: "central", lat: 10.7905, lng: 78.7047 },
  { name: "Salem", region: "west", lat: 11.6643, lng: 78.146 },
  { name: "Tirunelveli", region: "south", lat: 8.7139, lng: 77.7567 },
  { name: "Erode", region: "west", lat: 11.341, lng: 77.7172 },
  { name: "Vellore", region: "north", lat: 12.9165, lng: 79.1325 },
  { name: "Thoothukudi", region: "south", lat: 8.7642, lng: 78.1348 },
  { name: "Dindigul", region: "south", lat: 10.3673, lng: 77.98 },
  { name: "Thanjavur", region: "central", lat: 10.7867, lng: 79.1378 },
  { name: "Virudhunagar", region: "south", lat: 9.568, lng: 77.9624 },
  { name: "Tiruppur", region: "west", lat: 11.1085, lng: 77.3411 },
  { name: "Kancheepuram", region: "north", lat: 12.8342, lng: 79.7036 },
  { name: "Cuddalore", region: "north", lat: 11.7447, lng: 79.768 },
  { name: "Kanyakumari", region: "south", lat: 8.0883, lng: 77.5385 },
  { name: "Karur", region: "central", lat: 10.9577, lng: 78.0766 },
  { name: "Nagapattinam", region: "central", lat: 10.7662, lng: 79.8449 },
  { name: "Namakkal", region: "west", lat: 11.2194, lng: 78.1674 },
  { name: "Perambalur", region: "central", lat: 11.2342, lng: 78.8805 },
  { name: "Pudukkottai", region: "central", lat: 10.3797, lng: 78.8208 },
  { name: "Ramanathapuram", region: "south", lat: 9.3706, lng: 78.83 },
  { name: "Sivaganga", region: "south", lat: 9.847, lng: 78.4836 },
  { name: "Theni", region: "south", lat: 10.0104, lng: 77.4768 },
  { name: "The Nilgiris", region: "west", lat: 11.4064, lng: 76.6932 },
  { name: "Tiruvarur", region: "central", lat: 10.7669, lng: 79.6368 },
  { name: "Villupuram", region: "north", lat: 11.939, lng: 79.4924 },
  { name: "Ariyalur", region: "central", lat: 11.1385, lng: 79.0756 },
  { name: "Krishnagiri", region: "west", lat: 12.5266, lng: 78.214 },
  { name: "Dharmapuri", region: "west", lat: 12.1277, lng: 78.1579 },
  { name: "Tiruvannamalai", region: "north", lat: 12.2253, lng: 79.0747 },
];

const CATEGORIES = [
  {
    name: "Cement",
    icon: "🧱",
    materials: [
      { name: "OPC 53 Grade", unit: "per bag (50kg)" },
      { name: "PPC", unit: "per bag (50kg)" },
      { name: "PSC", unit: "per bag (50kg)" },
      { name: "White Cement", unit: "per bag (5kg)" },
    ],
  },
  {
    name: "Sand & Gravel",
    icon: "🏖️",
    materials: [
      { name: "River Sand", unit: "per unit (100 cft)" },
      { name: "M-Sand", unit: "per unit (100 cft)" },
      { name: "P-Sand", unit: "per unit (100 cft)" },
      { name: "Blue Metal 20mm", unit: "per unit (100 cft)" },
      { name: "Blue Metal 40mm", unit: "per unit (100 cft)" },
      { name: "Gravel", unit: "per unit (100 cft)" },
    ],
  },
  {
    name: "Steel / TMT",
    icon: "🏗️",
    materials: [
      { name: "TMT 8mm Fe500D", unit: "per kg" },
      { name: "TMT 10mm Fe500D", unit: "per kg" },
      { name: "TMT 12mm Fe500D", unit: "per kg" },
      { name: "TMT 16mm Fe500D", unit: "per kg" },
      { name: "TMT 20mm Fe500D", unit: "per kg" },
      { name: "Binding Wire", unit: "per kg" },
    ],
  },
  {
    name: "Bricks / Blocks",
    icon: "🧱",
    materials: [
      { name: "Red Clay Brick", unit: "per piece" },
      { name: "Fly Ash Brick", unit: "per piece" },
      { name: "Solid Block 6 inch", unit: "per piece" },
      { name: "Solid Block 8 inch", unit: "per piece" },
      { name: "Hollow Block 6 inch", unit: "per piece" },
      { name: "Hollow Block 8 inch", unit: "per piece" },
      { name: "AAC Block", unit: "per piece" },
    ],
  },
  {
    name: "Wood / Timber",
    icon: "🪵",
    materials: [
      { name: "Teak", unit: "per cft" },
      { name: "Sal", unit: "per cft" },
      { name: "Mango", unit: "per cft" },
      { name: "Pine", unit: "per cft" },
      { name: "Plywood 19mm BWR", unit: "per sqft" },
      { name: "Plywood 12mm Commercial", unit: "per sqft" },
    ],
  },
];

const BASE_PRICES: Record<string, number> = {
  "OPC 53 Grade": 430,
  PPC: 390,
  PSC: 370,
  "White Cement": 280,
  "River Sand": 6500,
  "M-Sand": 5200,
  "P-Sand": 4800,
  "Blue Metal 20mm": 3900,
  "Blue Metal 40mm": 3600,
  Gravel: 3400,
  "TMT 8mm Fe500D": 70,
  "TMT 10mm Fe500D": 69,
  "TMT 12mm Fe500D": 68,
  "TMT 16mm Fe500D": 67,
  "TMT 20mm Fe500D": 66,
  "Binding Wire": 74,
  "Red Clay Brick": 9,
  "Fly Ash Brick": 7,
  "Solid Block 6 inch": 45,
  "Solid Block 8 inch": 56,
  "Hollow Block 6 inch": 40,
  "Hollow Block 8 inch": 50,
  "AAC Block": 72,
  Teak: 2700,
  Sal: 1800,
  Mango: 1400,
  Pine: 1100,
  "Plywood 19mm BWR": 112,
  "Plywood 12mm Commercial": 72,
};

const REGION_FACTOR: Record<Region, number> = {
  north: 1.05,
  south: 1.0,
  west: 0.95,
  central: 0.98,
};

function dayFluctuation(dayOffset: number) {
  const wave = Math.sin(dayOffset / 6) * 0.02;
  const drift = (dayOffset / 90) * 0.03;
  return 1 + wave + drift;
}

function districtVariance(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return 1 + ((hash % 11) - 5) * 0.003;
}

async function seed() {
  await pool.query("BEGIN");

  try {
    for (const district of DISTRICTS) {
      await pool.query(
        `
          INSERT INTO districts (name, region, lat, lng, created_at, updated_at)
          VALUES ($1, $2, $3, $4, now(), now())
          ON CONFLICT (name)
          DO UPDATE SET region = EXCLUDED.region, lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = now()
        `,
        [district.name, district.region, district.lat, district.lng]
      );
    }

    for (let categoryIndex = 0; categoryIndex < CATEGORIES.length; categoryIndex += 1) {
      const category = CATEGORIES[categoryIndex];

      const categoryInsert = await pool.query(
        `
          INSERT INTO material_categories (name, icon, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (name)
          DO UPDATE SET icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
          RETURNING id
        `,
        [category.name, category.icon, categoryIndex + 1]
      );

      const categoryId = categoryInsert.rows[0].id;

      for (let materialIndex = 0; materialIndex < category.materials.length; materialIndex += 1) {
        const material = category.materials[materialIndex];

        await pool.query(
          `
            INSERT INTO materials (category_id, name, unit, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (category_id, name)
            DO UPDATE SET unit = EXCLUDED.unit, sort_order = EXCLUDED.sort_order
          `,
          [categoryId, material.name, material.unit, materialIndex + 1]
        );
      }
    }

    const districtRows = await pool.query(`SELECT id, name, region FROM districts`);
    const materialRows = await pool.query(`SELECT id, name FROM materials`);

    await pool.query(`DELETE FROM price_records WHERE source = 'seed_generator'`);

    const now = new Date();
    const BATCH_SIZE = 500;
    let values: string[] = [];
    let params: any[] = [];
    let paramIdx = 1;

    for (const district of districtRows.rows) {
      for (const material of materialRows.rows) {
        const base = BASE_PRICES[material.name] || 100;
        const regionFactor = REGION_FACTOR[district.region as Region] || 1;
        const localFactor = districtVariance(`${district.name}:${material.name}`);

        for (let i = 89; i >= 0; i -= 1) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);

          const price = Number((base * regionFactor * localFactor * dayFluctuation(89 - i)).toFixed(2));

          values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, 'seed_generator', $${paramIdx + 3}, false, now())`);
          params.push(material.id, district.id, price, date);
          paramIdx += 4;

          if (values.length >= BATCH_SIZE) {
            await pool.query(
              `INSERT INTO price_records (material_id, district_id, price, source, scraped_at, flagged, created_at) VALUES ${values.join(", ")}`,
              params
            );
            console.log(`  Inserted ${values.length} price records...`);
            values = [];
            params = [];
            paramIdx = 1;
          }
        }
      }
    }

    if (values.length > 0) {
      await pool.query(
        `INSERT INTO price_records (material_id, district_id, price, source, scraped_at, flagged, created_at) VALUES ${values.join(", ")}`,
        params
      );
      console.log(`  Inserted ${values.length} price records (final batch)...`);
    }

    await pool.query("COMMIT");

    console.log("✅ Price tracker seed completed successfully");
    console.log(`Districts: ${DISTRICTS.length}, Categories: ${CATEGORIES.length}, Materials: ${materialRows.rows.length}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ Seed failed", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
