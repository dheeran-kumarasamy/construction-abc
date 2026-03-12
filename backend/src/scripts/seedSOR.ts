import pool from "../db/pool";

/**
 * Seed TN PWD Schedule of Rates 2025-2026 reference data.
 * Run: npx ts-node-dev --transpile-only src/scripts/seedSOR.ts
 */

const BATCH_SIZE = 500;

async function seedSOR() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. SOR Version ─────────────────────────────────────
    const { rows: [sorVersion] } = await client.query(`
      INSERT INTO sor_versions (year, effective_from, effective_to, volume, department, is_active)
      VALUES ('2025-2026', '2025-04-01', '2026-03-31', 'I & II', 'TN PWD', true)
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    let sorVersionId: string;
    if (sorVersion) {
      sorVersionId = sorVersion.id;
    } else {
      const { rows } = await client.query(`SELECT id FROM sor_versions WHERE year = '2025-2026' LIMIT 1`);
      sorVersionId = rows[0].id;
    }

    console.log(`SOR version: ${sorVersionId}`);

    // ── 2. Resources (Labour – Annexure I) ────────────────
    const labourResources = [
      // Skilled Labour
      { code: "L-0001", annexure: "I", cat: "Skilled Labour", name: "Mason – First Class", unit: "Day", rate: 992 },
      { code: "L-0002", annexure: "I", cat: "Skilled Labour", name: "Mason – Second Class", unit: "Day", rate: 917 },
      { code: "L-0003", annexure: "I", cat: "Skilled Labour", name: "Carpenter – First Class", unit: "Day", rate: 992 },
      { code: "L-0004", annexure: "I", cat: "Skilled Labour", name: "Carpenter – Second Class", unit: "Day", rate: 917 },
      { code: "L-0005", annexure: "I", cat: "Skilled Labour", name: "Painter – First Class", unit: "Day", rate: 992 },
      { code: "L-0006", annexure: "I", cat: "Skilled Labour", name: "Painter – Second Class", unit: "Day", rate: 917 },
      { code: "L-0007", annexure: "I", cat: "Skilled Labour", name: "Plumber – First Class", unit: "Day", rate: 992 },
      { code: "L-0008", annexure: "I", cat: "Skilled Labour", name: "Plumber – Second Class", unit: "Day", rate: 917 },
      { code: "L-0009", annexure: "I", cat: "Skilled Labour", name: "Electrician – First Class", unit: "Day", rate: 992 },
      { code: "L-0010", annexure: "I", cat: "Skilled Labour", name: "Electrician – Second Class", unit: "Day", rate: 917 },
      { code: "L-0011", annexure: "I", cat: "Skilled Labour", name: "Welder", unit: "Day", rate: 962 },
      { code: "L-0012", annexure: "I", cat: "Skilled Labour", name: "Blacksmith", unit: "Day", rate: 917 },
      { code: "L-0013", annexure: "I", cat: "Skilled Labour", name: "Barbender", unit: "Day", rate: 992 },
      { code: "L-0014", annexure: "I", cat: "Skilled Labour", name: "Tiler / Marble Layer", unit: "Day", rate: 992 },
      { code: "L-0015", annexure: "I", cat: "Skilled Labour", name: "Stone cutter", unit: "Day", rate: 917 },
      { code: "L-0016", annexure: "I", cat: "Skilled Labour", name: "Scaffolder", unit: "Day", rate: 917 },
      { code: "L-0017", annexure: "I", cat: "Skilled Labour", name: "Fitter", unit: "Day", rate: 962 },
      { code: "L-0018", annexure: "I", cat: "Skilled Labour", name: "Crane Operator", unit: "Day", rate: 1050 },
      { code: "L-0019", annexure: "I", cat: "Skilled Labour", name: "Pile Driver Operator", unit: "Day", rate: 1050 },
      { code: "L-0020", annexure: "I", cat: "Skilled Labour", name: "Mixer Operator", unit: "Day", rate: 962 },
      // Semi-skilled & Unskilled
      { code: "L-0021", annexure: "I", cat: "Semi-Skilled Labour", name: "Mazdoor – Semi-skilled", unit: "Day", rate: 765 },
      { code: "L-0022", annexure: "I", cat: "Unskilled Labour", name: "Mazdoor – Unskilled", unit: "Day", rate: 706 },
      { code: "L-0023", annexure: "I", cat: "Unskilled Labour", name: "Coolie – Male", unit: "Day", rate: 706 },
      { code: "L-0024", annexure: "I", cat: "Unskilled Labour", name: "Coolie – Female", unit: "Day", rate: 706 },
      { code: "L-0025", annexure: "I", cat: "Unskilled Labour", name: "Bhisti / Water Carrier", unit: "Day", rate: 706 },
      { code: "L-0026", annexure: "I", cat: "Unskilled Labour", name: "Chowkidar / Watchman", unit: "Day", rate: 706 },
      // Head Load
      { code: "L-0027", annexure: "I", cat: "Head Load", name: "Head Load – Bricks (per 1000)", unit: "1000 Nos", rate: 450 },
      { code: "L-0028", annexure: "I", cat: "Head Load", name: "Head Load – Sand per Cu.m", unit: "Cu.m", rate: 180 },
      { code: "L-0029", annexure: "I", cat: "Head Load", name: "Head Load – Cement per bag", unit: "Bag (50kg)", rate: 15 },
      { code: "L-0030", annexure: "I", cat: "Head Load", name: "Head Load – Steel per Tonne", unit: "Tonne", rate: 350 },
      // Additional skilled
      { code: "L-0031", annexure: "I", cat: "Skilled Labour", name: "Pump Operator", unit: "Day", rate: 917 },
      { code: "L-0032", annexure: "I", cat: "Skilled Labour", name: "Roller Driver", unit: "Day", rate: 962 },
      { code: "L-0033", annexure: "I", cat: "Skilled Labour", name: "Excavator Operator", unit: "Day", rate: 1050 },
      { code: "L-0034", annexure: "I", cat: "Skilled Labour", name: "Dozer Operator", unit: "Day", rate: 1050 },
      { code: "L-0035", annexure: "I", cat: "Skilled Labour", name: "Grader Operator", unit: "Day", rate: 1050 },
      { code: "L-0036", annexure: "I", cat: "Semi-Skilled Labour", name: "Helper / Mate", unit: "Day", rate: 765 },
      { code: "L-0037", annexure: "I", cat: "Skilled Labour", name: "Glazier", unit: "Day", rate: 917 },
      { code: "L-0038", annexure: "I", cat: "Skilled Labour", name: "Polisher", unit: "Day", rate: 917 },
      { code: "L-0039", annexure: "I", cat: "Skilled Labour", name: "Aluminium Fabricator", unit: "Day", rate: 992 },
      { code: "L-0040", annexure: "I", cat: "Skilled Labour", name: "Waterproofing Applicator", unit: "Day", rate: 992 },
    ];

    // ── 3. Resources (Materials – Annexure II) ─────────────
    const materialResources = [
      // Cement & Concrete
      { code: "M-0001", annexure: "II", cat: "Cement", name: "OPC 53-Grade Cement", unit: "Bag (50kg)", rate: 380, hsn: "2523" },
      { code: "M-0002", annexure: "II", cat: "Cement", name: "PPC Cement", unit: "Bag (50kg)", rate: 350, hsn: "2523" },
      { code: "M-0003", annexure: "II", cat: "Cement", name: "Sulphate Resistant Cement", unit: "Bag (50kg)", rate: 430, hsn: "2523" },
      { code: "M-0004", annexure: "II", cat: "Cement", name: "White Cement", unit: "Kg", rate: 32, hsn: "2523" },
      // Sand & Aggregates
      { code: "M-0005", annexure: "II", cat: "Sand & Aggregates", name: "River Sand (fine)", unit: "Cu.m", rate: 3200, hsn: "2505" },
      { code: "M-0006", annexure: "II", cat: "Sand & Aggregates", name: "M-Sand (manufactured sand)", unit: "Cu.m", rate: 1800, hsn: "2505" },
      { code: "M-0007", annexure: "II", cat: "Sand & Aggregates", name: "Coarse Aggregate 20mm", unit: "Cu.m", rate: 2200, hsn: "2517" },
      { code: "M-0008", annexure: "II", cat: "Sand & Aggregates", name: "Coarse Aggregate 40mm", unit: "Cu.m", rate: 2000, hsn: "2517" },
      { code: "M-0009", annexure: "II", cat: "Sand & Aggregates", name: "Coarse Aggregate 12mm", unit: "Cu.m", rate: 2400, hsn: "2517" },
      { code: "M-0010", annexure: "II", cat: "Sand & Aggregates", name: "Stone Dust / Quarry Dust", unit: "Cu.m", rate: 900, hsn: "2517" },
      // Steel
      { code: "M-0011", annexure: "II", cat: "Steel", name: "TMT Bar Fe-500D (8mm-32mm)", unit: "Tonne", rate: 65000, hsn: "7214" },
      { code: "M-0012", annexure: "II", cat: "Steel", name: "TMT Bar Fe-500D (6mm)", unit: "Tonne", rate: 70000, hsn: "7214" },
      { code: "M-0013", annexure: "II", cat: "Steel", name: "Structural Steel (Angles/Channels)", unit: "Tonne", rate: 72000, hsn: "7216" },
      { code: "M-0014", annexure: "II", cat: "Steel", name: "MS Plate", unit: "Tonne", rate: 74000, hsn: "7208" },
      { code: "M-0015", annexure: "II", cat: "Steel", name: "Binding Wire 18 SWG", unit: "Kg", rate: 80, hsn: "7217" },
      // Bricks & Blocks
      { code: "M-0016", annexure: "II", cat: "Bricks & Blocks", name: "Clay Brick – First Class (23x11x7 cm)", unit: "1000 Nos", rate: 8500, hsn: "6901" },
      { code: "M-0017", annexure: "II", cat: "Bricks & Blocks", name: "Clay Brick – Second Class", unit: "1000 Nos", rate: 6500, hsn: "6901" },
      { code: "M-0018", annexure: "II", cat: "Bricks & Blocks", name: "Fly Ash Brick", unit: "1000 Nos", rate: 5500, hsn: "6815" },
      { code: "M-0019", annexure: "II", cat: "Bricks & Blocks", name: "AAC Block (600x200x200 mm)", unit: "Cu.m", rate: 4200, hsn: "6810" },
      { code: "M-0020", annexure: "II", cat: "Bricks & Blocks", name: "Hollow Concrete Block (40x20x20 cm)", unit: "Nos", rate: 48, hsn: "6810" },
      // Timber & Wood
      { code: "M-0021", annexure: "II", cat: "Timber", name: "Teak Wood – First Quality", unit: "Cu.m", rate: 185000, hsn: "4403" },
      { code: "M-0022", annexure: "II", cat: "Timber", name: "Country Wood (Vengai/Neem)", unit: "Cu.m", rate: 75000, hsn: "4403" },
      { code: "M-0023", annexure: "II", cat: "Timber", name: "Plywood – 19mm BWR Grade", unit: "Sq.m", rate: 950, hsn: "4412" },
      { code: "M-0024", annexure: "II", cat: "Timber", name: "Plywood – 12mm MR Grade", unit: "Sq.m", rate: 550, hsn: "4412" },
      { code: "M-0025", annexure: "II", cat: "Timber", name: "Flush Door Shutter 35mm", unit: "Sq.m", rate: 1800, hsn: "4418" },
      // Water & Admixtures
      { code: "M-0026", annexure: "II", cat: "Water & Admixtures", name: "Water (clean, potable)", unit: "KL (1000L)", rate: 150, hsn: "2201" },
      { code: "M-0027", annexure: "II", cat: "Water & Admixtures", name: "Superplasticizer (conplast SP430)", unit: "Litre", rate: 110, hsn: "3824" },
      { code: "M-0028", annexure: "II", cat: "Water & Admixtures", name: "Retarder Admixture", unit: "Kg", rate: 95, hsn: "3824" },
      // Paints
      { code: "M-0029", annexure: "II", cat: "Paints", name: "Cement Primer", unit: "Litre", rate: 160, hsn: "3209" },
      { code: "M-0030", annexure: "II", cat: "Paints", name: "Acrylic Distemper", unit: "Litre", rate: 110, hsn: "3210" },
      { code: "M-0031", annexure: "II", cat: "Paints", name: "Exterior Emulsion Paint", unit: "Litre", rate: 350, hsn: "3209" },
      { code: "M-0032", annexure: "II", cat: "Paints", name: "Interior Emulsion Paint", unit: "Litre", rate: 280, hsn: "3209" },
      { code: "M-0033", annexure: "II", cat: "Paints", name: "Enamel Paint", unit: "Litre", rate: 400, hsn: "3208" },
      { code: "M-0034", annexure: "II", cat: "Paints", name: "Wood Primer", unit: "Litre", rate: 200, hsn: "3208" },
      { code: "M-0035", annexure: "II", cat: "Paints", name: "Putty (wall)", unit: "Kg", rate: 28, hsn: "3214" },
      // Tiles & Flooring
      { code: "M-0036", annexure: "II", cat: "Tiles & Flooring", name: "Ceramic Floor Tile (30x30 cm)", unit: "Sq.m", rate: 450, hsn: "6908" },
      { code: "M-0037", annexure: "II", cat: "Tiles & Flooring", name: "Vitrified Tile (60x60 cm)", unit: "Sq.m", rate: 750, hsn: "6908" },
      { code: "M-0038", annexure: "II", cat: "Tiles & Flooring", name: "Polished Granite (20mm)", unit: "Sq.m", rate: 1800, hsn: "6802" },
      { code: "M-0039", annexure: "II", cat: "Tiles & Flooring", name: "Shahabad / Cuddapah Stone", unit: "Sq.m", rate: 650, hsn: "6802" },
      { code: "M-0040", annexure: "II", cat: "Tiles & Flooring", name: "Marble Slab (20mm)", unit: "Sq.m", rate: 2200, hsn: "6802" },
      // Pipes
      { code: "M-0041", annexure: "II", cat: "Pipes & Fittings", name: "PVC Pipe 110mm SWR", unit: "Rmt", rate: 280, hsn: "3917" },
      { code: "M-0042", annexure: "II", cat: "Pipes & Fittings", name: "PVC Pipe 75mm SWR", unit: "Rmt", rate: 180, hsn: "3917" },
      { code: "M-0043", annexure: "II", cat: "Pipes & Fittings", name: "CPVC Pipe 25mm", unit: "Rmt", rate: 120, hsn: "3917" },
      { code: "M-0044", annexure: "II", cat: "Pipes & Fittings", name: "GI Pipe 25mm Class B", unit: "Rmt", rate: 240, hsn: "7306" },
      { code: "M-0045", annexure: "II", cat: "Pipes & Fittings", name: "CI Pipe 100mm", unit: "Rmt", rate: 800, hsn: "7303" },
      // Waterproofing
      { code: "M-0046", annexure: "II", cat: "Waterproofing", name: "Bitumen (80/100 grade)", unit: "Kg", rate: 65, hsn: "2713" },
      { code: "M-0047", annexure: "II", cat: "Waterproofing", name: "APP Membrane (3mm)", unit: "Sq.m", rate: 210, hsn: "6807" },
      { code: "M-0048", annexure: "II", cat: "Waterproofing", name: "Crystalline Waterproofing Compound", unit: "Kg", rate: 180, hsn: "3824" },
      // Electrical
      { code: "M-0049", annexure: "II", cat: "Electrical", name: "PVC Conduit 25mm", unit: "Rmt", rate: 28, hsn: "3917" },
      { code: "M-0050", annexure: "II", cat: "Electrical", name: "Copper Wire 1.5 sq.mm FRLS", unit: "Rmt", rate: 18, hsn: "8544" },
      { code: "M-0051", annexure: "II", cat: "Electrical", name: "Copper Wire 2.5 sq.mm FRLS", unit: "Rmt", rate: 28, hsn: "8544" },
      { code: "M-0052", annexure: "II", cat: "Electrical", name: "Copper Wire 4.0 sq.mm FRLS", unit: "Rmt", rate: 45, hsn: "8544" },
      { code: "M-0053", annexure: "II", cat: "Electrical", name: "MCB Single Pole 16A", unit: "Nos", rate: 320, hsn: "8536" },
      // Glass & Aluminium
      { code: "M-0054", annexure: "II", cat: "Glass & Aluminium", name: "Float Glass 5mm", unit: "Sq.m", rate: 380, hsn: "7005" },
      { code: "M-0055", annexure: "II", cat: "Glass & Aluminium", name: "Toughened Glass 12mm", unit: "Sq.m", rate: 1800, hsn: "7007" },
      { code: "M-0056", annexure: "II", cat: "Glass & Aluminium", name: "Aluminium Section (for windows)", unit: "Kg", rate: 380, hsn: "7604" },
      // Misc
      { code: "M-0057", annexure: "II", cat: "Miscellaneous", name: "Curing Compound", unit: "Litre", rate: 120, hsn: "3824" },
      { code: "M-0058", annexure: "II", cat: "Miscellaneous", name: "Centering Shuttering (steel)", unit: "Sq.m/day", rate: 55, hsn: "7308" },
      { code: "M-0059", annexure: "II", cat: "Miscellaneous", name: "Centering Shuttering (plywood)", unit: "Sq.m/day", rate: 40, hsn: "4412" },
      { code: "M-0060", annexure: "II", cat: "Miscellaneous", name: "Scaffolding (steel pipe)", unit: "Sq.m/day", rate: 35, hsn: "7308" },
      // Lime & Mortar
      { code: "M-0061", annexure: "II", cat: "Lime & Mortar", name: "Lime – Fat (Shell)", unit: "Cu.m", rate: 6500, hsn: "2522" },
      { code: "M-0062", annexure: "II", cat: "Lime & Mortar", name: "Lime – Hydraulic", unit: "Cu.m", rate: 7500, hsn: "2522" },
      { code: "M-0063", annexure: "II", cat: "Lime & Mortar", name: "Surkhi (brick powder)", unit: "Cu.m", rate: 2500, hsn: "2530" },
      // Roofing
      { code: "M-0064", annexure: "II", cat: "Roofing", name: "Mangalore Tile", unit: "1000 Nos", rate: 12000, hsn: "6905" },
      { code: "M-0065", annexure: "II", cat: "Roofing", name: "AC Sheet (Asbestos Cement)", unit: "Sq.m", rate: 320, hsn: "6811" },
      { code: "M-0066", annexure: "II", cat: "Roofing", name: "GI Corrugated Sheet 0.5mm", unit: "Sq.m", rate: 450, hsn: "7210" },
      { code: "M-0067", annexure: "II", cat: "Roofing", name: "Polycarbonate Sheet 2mm", unit: "Sq.m", rate: 550, hsn: "3920" },
      // Ready Mix
      { code: "M-0068", annexure: "II", cat: "Concrete", name: "Ready Mix Concrete M20", unit: "Cu.m", rate: 5200, hsn: "3824" },
      { code: "M-0069", annexure: "II", cat: "Concrete", name: "Ready Mix Concrete M25", unit: "Cu.m", rate: 5600, hsn: "3824" },
      { code: "M-0070", annexure: "II", cat: "Concrete", name: "Ready Mix Concrete M30", unit: "Cu.m", rate: 6200, hsn: "3824" },
      // Doors & Hardware
      { code: "M-0071", annexure: "II", cat: "Doors & Hardware", name: "MS Door Frame", unit: "Kg", rate: 85, hsn: "7308" },
      { code: "M-0072", annexure: "II", cat: "Doors & Hardware", name: "Tower Bolt (200mm)", unit: "Nos", rate: 120, hsn: "8302" },
      { code: "M-0073", annexure: "II", cat: "Doors & Hardware", name: "Door Handle (SS)", unit: "Pair", rate: 450, hsn: "8302" },
      { code: "M-0074", annexure: "II", cat: "Doors & Hardware", name: "Hinges (100mm SS)", unit: "Pair", rate: 180, hsn: "8302" },
      { code: "M-0075", annexure: "II", cat: "Doors & Hardware", name: "Mortice Lock", unit: "Nos", rate: 650, hsn: "8301" },
      // Sanitary
      { code: "M-0076", annexure: "II", cat: "Sanitary", name: "WC – White Vitreous China (EWC)", unit: "Nos", rate: 4500, hsn: "6910" },
      { code: "M-0077", annexure: "II", cat: "Sanitary", name: "Wash Basin – White (18x12)", unit: "Nos", rate: 1800, hsn: "6910" },
      { code: "M-0078", annexure: "II", cat: "Sanitary", name: "CP Pillar Cock", unit: "Nos", rate: 650, hsn: "8481" },
      { code: "M-0079", annexure: "II", cat: "Sanitary", name: "Cistern (PVC 10L)", unit: "Nos", rate: 800, hsn: "3922" },
      { code: "M-0080", annexure: "II", cat: "Sanitary", name: "Stainless Steel Sink (24x18)", unit: "Nos", rate: 2500, hsn: "7324" },
    ];

    // ── 4. Work Rates (Annexure III) ───────────────────────
    const workRateResources = [
      // Earthwork
      { code: "W-0001", annexure: "III", cat: "Earthwork", name: "Earthwork Excavation in ordinary soil (manual)", unit: "Cu.m", rate: 200 },
      { code: "W-0002", annexure: "III", cat: "Earthwork", name: "Earthwork Excavation in hard soil (manual)", unit: "Cu.m", rate: 340 },
      { code: "W-0003", annexure: "III", cat: "Earthwork", name: "Earthwork Excavation in rock (blasting)", unit: "Cu.m", rate: 1200 },
      { code: "W-0004", annexure: "III", cat: "Earthwork", name: "Backfilling with excavated earth", unit: "Cu.m", rate: 120 },
      { code: "W-0005", annexure: "III", cat: "Earthwork", name: "Sand filling in foundation", unit: "Cu.m", rate: 180 },
      // Concrete Work
      { code: "W-0006", annexure: "III", cat: "Concrete Work", name: "PCC 1:4:8 (Lime concrete)", unit: "Cu.m", rate: 4200 },
      { code: "W-0007", annexure: "III", cat: "Concrete Work", name: "PCC 1:3:6 (M10)", unit: "Cu.m", rate: 4800 },
      { code: "W-0008", annexure: "III", cat: "Concrete Work", name: "RCC M20 (1:1.5:3) – labour only", unit: "Cu.m", rate: 1200 },
      { code: "W-0009", annexure: "III", cat: "Concrete Work", name: "RCC M25 – labour only", unit: "Cu.m", rate: 1350 },
      { code: "W-0010", annexure: "III", cat: "Concrete Work", name: "RCC M30 – labour only", unit: "Cu.m", rate: 1500 },
      // Masonry
      { code: "W-0011", annexure: "III", cat: "Masonry", name: "Brick masonry in CM 1:4 (first class brick)", unit: "Cu.m", rate: 5800 },
      { code: "W-0012", annexure: "III", cat: "Masonry", name: "Brick masonry in CM 1:6 (second class brick)", unit: "Cu.m", rate: 4600 },
      { code: "W-0013", annexure: "III", cat: "Masonry", name: "Random Rubble masonry in CM 1:6", unit: "Cu.m", rate: 3800 },
      { code: "W-0014", annexure: "III", cat: "Masonry", name: "AAC Block masonry in CM 1:6", unit: "Cu.m", rate: 5200 },
      { code: "W-0015", annexure: "III", cat: "Masonry", name: "Hollow Block masonry in CM 1:4", unit: "Sq.m", rate: 640 },
      // Plastering
      { code: "W-0016", annexure: "III", cat: "Plastering", name: "Cement plaster 12mm thick CM 1:4", unit: "Sq.m", rate: 220 },
      { code: "W-0017", annexure: "III", cat: "Plastering", name: "Cement plaster 15mm thick CM 1:4", unit: "Sq.m", rate: 260 },
      { code: "W-0018", annexure: "III", cat: "Plastering", name: "Cement plaster 20mm thick CM 1:4", unit: "Sq.m", rate: 310 },
      { code: "W-0019", annexure: "III", cat: "Plastering", name: "Rough Cast Plaster (Pebble Dash)", unit: "Sq.m", rate: 350 },
      // Flooring
      { code: "W-0020", annexure: "III", cat: "Flooring", name: "Cement Concrete Flooring 40mm thick (1:2:4)", unit: "Sq.m", rate: 380 },
      { code: "W-0021", annexure: "III", cat: "Flooring", name: "Ceramic Tile Flooring (laying only)", unit: "Sq.m", rate: 420 },
      { code: "W-0022", annexure: "III", cat: "Flooring", name: "Vitrified Tile Flooring (laying only)", unit: "Sq.m", rate: 480 },
      { code: "W-0023", annexure: "III", cat: "Flooring", name: "Granite Flooring (laying only)", unit: "Sq.m", rate: 550 },
      { code: "W-0024", annexure: "III", cat: "Flooring", name: "Marble Flooring (laying only)", unit: "Sq.m", rate: 580 },
      // Painting
      { code: "W-0025", annexure: "III", cat: "Painting", name: "White washing (2 coats)", unit: "Sq.m", rate: 28 },
      { code: "W-0026", annexure: "III", cat: "Painting", name: "Colour washing (2 coats)", unit: "Sq.m", rate: 35 },
      { code: "W-0027", annexure: "III", cat: "Painting", name: "Distempering (2 coats) with primer", unit: "Sq.m", rate: 75 },
      { code: "W-0028", annexure: "III", cat: "Painting", name: "Emulsion painting (2 coats) with primer & putty", unit: "Sq.m", rate: 120 },
      { code: "W-0029", annexure: "III", cat: "Painting", name: "Enamel painting (2 coats) on wood", unit: "Sq.m", rate: 140 },
      { code: "W-0030", annexure: "III", cat: "Painting", name: "Exterior Emulsion painting (2 coats)", unit: "Sq.m", rate: 135 },
      // Steel Work
      { code: "W-0031", annexure: "III", cat: "Steel Work", name: "Reinforcement steel cutting, bending & placing", unit: "Tonne", rate: 8500 },
      { code: "W-0032", annexure: "III", cat: "Steel Work", name: "Structural steel fabrication & erection", unit: "Tonne", rate: 15000 },
      // Formwork
      { code: "W-0033", annexure: "III", cat: "Formwork", name: "Centering & shuttering (slab)", unit: "Sq.m", rate: 380 },
      { code: "W-0034", annexure: "III", cat: "Formwork", name: "Centering & shuttering (beam)", unit: "Sq.m", rate: 450 },
      { code: "W-0035", annexure: "III", cat: "Formwork", name: "Centering & shuttering (column)", unit: "Sq.m", rate: 480 },
      { code: "W-0036", annexure: "III", cat: "Formwork", name: "Centering & shuttering (staircase)", unit: "Sq.m", rate: 550 },
      // Plumbing
      { code: "W-0037", annexure: "III", cat: "Plumbing", name: "PVC pipe laying 110mm (including joints)", unit: "Rmt", rate: 180 },
      { code: "W-0038", annexure: "III", cat: "Plumbing", name: "CPVC pipe laying 25mm (including joints)", unit: "Rmt", rate: 120 },
      { code: "W-0039", annexure: "III", cat: "Plumbing", name: "WC installation (complete)", unit: "Nos", rate: 1800 },
      { code: "W-0040", annexure: "III", cat: "Plumbing", name: "Wash basin installation", unit: "Nos", rate: 800 },
      // Waterproofing
      { code: "W-0041", annexure: "III", cat: "Waterproofing", name: "Bituminous waterproofing (2 coats)", unit: "Sq.m", rate: 250 },
      { code: "W-0042", annexure: "III", cat: "Waterproofing", name: "APP membrane waterproofing", unit: "Sq.m", rate: 380 },
      // Electrical
      { code: "W-0043", annexure: "III", cat: "Electrical", name: "Concealed wiring per point", unit: "Point", rate: 850 },
      { code: "W-0044", annexure: "III", cat: "Electrical", name: "Surface wiring per point", unit: "Point", rate: 550 },
      // Demolition
      { code: "W-0045", annexure: "III", cat: "Demolition", name: "Demolition of brick masonry", unit: "Cu.m", rate: 450 },
      { code: "W-0046", annexure: "III", cat: "Demolition", name: "Demolition of RCC", unit: "Cu.m", rate: 2200 },
      { code: "W-0047", annexure: "III", cat: "Demolition", name: "Dismantling of old plaster", unit: "Sq.m", rate: 55 },
      // Roofing
      { code: "W-0048", annexure: "III", cat: "Roofing", name: "Mangalore Tile roofing (laying)", unit: "Sq.m", rate: 350 },
      { code: "W-0049", annexure: "III", cat: "Roofing", name: "GI Sheet roofing with purlins", unit: "Sq.m", rate: 650 },
      { code: "W-0050", annexure: "III", cat: "Roofing", name: "RCC roof slab waterproofing (complete)", unit: "Sq.m", rate: 480 },
    ];

    // Batch insert resources
    const allResources = [
      ...labourResources.map(r => ({ ...r, type: "labour", hsn: undefined })),
      ...materialResources.map(r => ({ ...r, type: "material" })),
      ...workRateResources.map(r => ({ ...r, type: "work_rate", hsn: undefined })),
    ];

    let values: string[] = [];
    let params: any[] = [];
    let idx = 1;

    for (const r of allResources) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(
        sorVersionId,
        r.code,
        r.annexure,
        r.type,
        r.cat,
        r.name,
        r.unit,
        r.rate,
        r.hsn || null
      );

      if (values.length >= BATCH_SIZE) {
        await client.query(`
          INSERT INTO resources (sor_version_id, unique_code, annexure, type, category, name, unit, basic_rate, hsn_sac_code)
          VALUES ${values.join(",")}
          ON CONFLICT (sor_version_id, unique_code) DO UPDATE SET
            basic_rate = EXCLUDED.basic_rate,
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            hsn_sac_code = EXCLUDED.hsn_sac_code,
            updated_at = NOW()
        `, params);
        values = [];
        params = [];
        idx = 1;
      }
    }

    if (values.length > 0) {
      await client.query(`
        INSERT INTO resources (sor_version_id, unique_code, annexure, type, category, name, unit, basic_rate, hsn_sac_code)
        VALUES ${values.join(",")}
        ON CONFLICT (sor_version_id, unique_code) DO UPDATE SET
          basic_rate = EXCLUDED.basic_rate,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          unit = EXCLUDED.unit,
          hsn_sac_code = EXCLUDED.hsn_sac_code,
          updated_at = NOW()
      `, params);
    }

    console.log(`Inserted ${allResources.length} resources`);

    // ── 5. Location Zones ──────────────────────────────────
    const locationZones = [
      { name: "Normal / Plains", type: "normal", desc: "Standard rate areas – all districts not listed under special zones", labExtra: 0, matExtra: 0, wrkExtra: 0, convExtra: 0, hlExtra: 0, districts: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Thanjavur", "Dindigul", "Kanchipuram", "Cuddalore", "Villupuram", "Nagapattinam", "Sivagangai", "Ramanathapuram", "Karur", "Perambalur", "Ariyalur", "Pudukkottai", "Virudhunagar", "Theni", "Tiruppur", "Namakkal", "Dharmapuri", "Krishnagiri"] },
      { name: "Hilly Areas – Nilgiris", type: "hilly", desc: "15% extra on labour, 10% extra on materials for Nilgiris hill areas", labExtra: 15, matExtra: 10, wrkExtra: 15, convExtra: 25, hlExtra: 20, districts: ["Nilgiris"] },
      { name: "Hilly Areas – Kodaikanal / Yercaud", type: "hilly", desc: "10% extra on labour for hill stations in Dindigul and Salem", labExtra: 10, matExtra: 5, wrkExtra: 10, convExtra: 15, hlExtra: 15, districts: ["Dindigul", "Salem"], areas: ["Kodaikanal", "Yercaud"] },
      { name: "Remote / Tribal Areas", type: "remote", desc: "12% extra on labour, 8% materials for remote/tribal belt", labExtra: 12, matExtra: 8, wrkExtra: 12, convExtra: 20, hlExtra: 15, districts: ["Dharmapuri", "Krishnagiri", "Tiruvannamalai"], areas: ["Jawadhi Hills", "Yelagiri", "Kalrayan Hills"] },
      { name: "Coastal Areas", type: "coastal", desc: "5% extra on materials (corrosion-prone), 3% conveyance for coastal regions", labExtra: 0, matExtra: 5, wrkExtra: 0, convExtra: 3, hlExtra: 0, districts: ["Chennai", "Kanchipuram", "Nagapattinam", "Ramanathapuram", "Thoothukudi", "Cuddalore"] },
      { name: "Chennai Metropolitan Area", type: "metro", desc: "8% extra on labour for Chennai metro area due to higher living costs", labExtra: 8, matExtra: 0, wrkExtra: 5, convExtra: 0, hlExtra: 5, districts: ["Chennai", "Kanchipuram", "Tiruvallur", "Chengalpattu"] },
    ];

    for (const z of locationZones) {
      await client.query(`
        INSERT INTO location_zones (sor_version_id, zone_name, zone_type, description, labour_extra_percent, material_extra_percent, works_extra_percent, conveyance_extra_percent, head_load_extra_percent, applicable_districts, applicable_areas)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `, [
        sorVersionId, z.name, z.type, z.desc,
        z.labExtra, z.matExtra, z.wrkExtra, z.convExtra, z.hlExtra,
        z.districts,
        (z as any).areas || null,
      ]);
    }
    console.log(`Inserted ${locationZones.length} location zones`);

    // ── 6. Conveyance Rate Slabs (Annexure-V) ─────────────
    const conveyanceSlabs = [
      // Plains
      { terrain: "plains", group: "Sand / Earth / Gravel", coeff: 1.00, unit: "Cu.m", r1: 180, r2: 250, r3: 350, r4: 500, r5: 650, load: 40, unload: 40 },
      { terrain: "plains", group: "Cement (Bags)", coeff: 1.20, unit: "Tonne", r1: 220, r2: 310, r3: 420, r4: 620, r5: 800, load: 50, unload: 50 },
      { terrain: "plains", group: "Steel / Iron", coeff: 1.50, unit: "Tonne", r1: 300, r2: 420, r3: 580, r4: 850, r5: 1100, load: 60, unload: 60 },
      { terrain: "plains", group: "Bricks", coeff: 1.10, unit: "1000 Nos", r1: 450, r2: 620, r3: 850, r4: 1200, r5: 1550, load: 80, unload: 80 },
      { terrain: "plains", group: "Stone Aggregate (20mm/40mm)", coeff: 1.00, unit: "Cu.m", r1: 200, r2: 280, r3: 380, r4: 550, r5: 720, load: 45, unload: 45 },
      { terrain: "plains", group: "Timber / Wood", coeff: 1.30, unit: "Cu.m", r1: 350, r2: 480, r3: 650, r4: 950, r5: 1250, load: 70, unload: 70 },
      { terrain: "plains", group: "Pipes (PVC/GI/CI)", coeff: 1.20, unit: "Tonne", r1: 250, r2: 350, r3: 480, r4: 700, r5: 900, load: 55, unload: 55 },
      { terrain: "plains", group: "Tiles / Granite / Marble", coeff: 1.40, unit: "Tonne", r1: 280, r2: 390, r3: 540, r4: 780, r5: 1000, load: 65, unload: 65 },
      { terrain: "plains", group: "Miscellaneous / General", coeff: 1.00, unit: "Tonne", r1: 200, r2: 280, r3: 380, r4: 550, r5: 720, load: 50, unload: 50 },
      // Hills
      { terrain: "hills", group: "Sand / Earth / Gravel", coeff: 1.00, unit: "Cu.m", r1: 250, r2: 350, r3: 490, r4: 700, r5: 910, load: 55, unload: 55 },
      { terrain: "hills", group: "Cement (Bags)", coeff: 1.20, unit: "Tonne", r1: 310, r2: 430, r3: 590, r4: 870, r5: 1120, load: 70, unload: 70 },
      { terrain: "hills", group: "Steel / Iron", coeff: 1.50, unit: "Tonne", r1: 420, r2: 590, r3: 810, r4: 1190, r5: 1540, load: 85, unload: 85 },
      { terrain: "hills", group: "Bricks", coeff: 1.10, unit: "1000 Nos", r1: 630, r2: 870, r3: 1190, r4: 1680, r5: 2170, load: 110, unload: 110 },
      { terrain: "hills", group: "Stone Aggregate (20mm/40mm)", coeff: 1.00, unit: "Cu.m", r1: 280, r2: 390, r3: 530, r4: 770, r5: 1010, load: 60, unload: 60 },
      { terrain: "hills", group: "Timber / Wood", coeff: 1.30, unit: "Cu.m", r1: 490, r2: 670, r3: 910, r4: 1330, r5: 1750, load: 100, unload: 100 },
      { terrain: "hills", group: "Pipes (PVC/GI/CI)", coeff: 1.20, unit: "Tonne", r1: 350, r2: 490, r3: 670, r4: 980, r5: 1260, load: 75, unload: 75 },
      { terrain: "hills", group: "Tiles / Granite / Marble", coeff: 1.40, unit: "Tonne", r1: 390, r2: 550, r3: 760, r4: 1090, r5: 1400, load: 90, unload: 90 },
      { terrain: "hills", group: "Miscellaneous / General", coeff: 1.00, unit: "Tonne", r1: 280, r2: 390, r3: 530, r4: 770, r5: 1010, load: 70, unload: 70 },
    ];

    for (const c of conveyanceSlabs) {
      await client.query(`
        INSERT INTO conveyance_rate_slabs (sor_version_id, terrain, material_group, coefficient, unit, rate_0_10km, rate_10_20km, rate_20_40km, rate_40_80km, rate_above_80km, loading_charges, unloading_charges)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING
      `, [
        sorVersionId, c.terrain, c.group, c.coeff,
        c.unit, c.r1, c.r2, c.r3, c.r4, c.r5,
        c.load, c.unload,
      ]);
    }
    console.log(`Inserted ${conveyanceSlabs.length} conveyance rate slabs`);

    // ── 7. Rate Templates ──────────────────────────────────
    // Insert templates first, then line items referencing resources by code

    const templates = [
      {
        code: "RA-EW-001",
        name: "Earthwork Excavation in Ordinary Soil (Manual) – per Cu.m",
        cat: "Earthwork", sub: "Excavation", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "L-0022", coeff: 0.45, desc: "Unskilled labour (digging)" },
          { resourceCode: "L-0021", coeff: 0.10, desc: "Semi-skilled labour (levelling)" },
        ],
      },
      {
        code: "RA-EW-002",
        name: "Sand Filling in Foundation & Plinth – per Cu.m",
        cat: "Earthwork", sub: "Filling", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0005", coeff: 1.25, desc: "River sand with bulkage" },
          { resourceCode: "L-0022", coeff: 0.30, desc: "Unskilled labour (spreading & compaction)" },
          { resourceCode: "M-0026", coeff: 0.05, desc: "Water for compaction" },
        ],
      },
      {
        code: "RA-CC-001",
        name: "PCC 1:3:6 (M10) in Foundation – per Cu.m",
        cat: "Concrete Work", sub: "PCC", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0001", coeff: 5.0, desc: "OPC Cement (5 bags/Cu.m for 1:3:6)" },
          { resourceCode: "M-0005", coeff: 0.45, desc: "Sand (fine aggregate)" },
          { resourceCode: "M-0008", coeff: 0.90, desc: "Coarse aggregate 40mm" },
          { resourceCode: "M-0026", coeff: 0.18, desc: "Water" },
          { resourceCode: "L-0001", coeff: 0.15, desc: "Mason" },
          { resourceCode: "L-0022", coeff: 1.00, desc: "Unskilled labour (mixing, placing)" },
          { resourceCode: "L-0021", coeff: 0.25, desc: "Semi-skilled (vibrating, curing)" },
        ],
      },
      {
        code: "RA-CC-002",
        name: "RCC M20 (1:1.5:3) including Centering & Shuttering – per Cu.m",
        cat: "Concrete Work", sub: "RCC", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0001", coeff: 8.0, desc: "OPC 53 Grade Cement (8 bags for M20)" },
          { resourceCode: "M-0005", coeff: 0.45, desc: "River sand / M-sand" },
          { resourceCode: "M-0007", coeff: 0.90, desc: "Coarse aggregate 20mm" },
          { resourceCode: "M-0026", coeff: 0.20, desc: "Water" },
          { resourceCode: "M-0058", coeff: 6.00, desc: "Steel centering (6 sqm per cum avg)" },
          { resourceCode: "L-0001", coeff: 0.50, desc: "Mason – First Class" },
          { resourceCode: "L-0013", coeff: 0.30, desc: "Barbender" },
          { resourceCode: "L-0003", coeff: 0.20, desc: "Carpenter (shuttering)" },
          { resourceCode: "L-0022", coeff: 2.00, desc: "Unskilled labour" },
          { resourceCode: "L-0021", coeff: 0.50, desc: "Semi-skilled (vibrating)" },
        ],
      },
      {
        code: "RA-CC-003",
        name: "RCC M25 including Centering & Shuttering – per Cu.m",
        cat: "Concrete Work", sub: "RCC", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0001", coeff: 9.0, desc: "OPC 53 Grade Cement (9 bags for M25)" },
          { resourceCode: "M-0005", coeff: 0.42, desc: "Sand" },
          { resourceCode: "M-0007", coeff: 0.84, desc: "Coarse aggregate 20mm" },
          { resourceCode: "M-0026", coeff: 0.19, desc: "Water" },
          { resourceCode: "M-0027", coeff: 1.50, desc: "Superplasticizer" },
          { resourceCode: "M-0058", coeff: 6.00, desc: "Steel centering" },
          { resourceCode: "L-0001", coeff: 0.55, desc: "Mason – First Class" },
          { resourceCode: "L-0013", coeff: 0.35, desc: "Barbender" },
          { resourceCode: "L-0003", coeff: 0.22, desc: "Carpenter" },
          { resourceCode: "L-0022", coeff: 2.20, desc: "Unskilled labour" },
          { resourceCode: "L-0021", coeff: 0.55, desc: "Semi-skilled" },
        ],
      },
      {
        code: "RA-BM-001",
        name: "Brick Masonry in CM 1:4 (First Class Brick) – per Cu.m",
        cat: "Masonry", sub: "Brick", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0016", coeff: 0.50, desc: "First class bricks (500 nos per Cu.m = 0.5 x 1000)" },
          { resourceCode: "M-0001", coeff: 1.90, desc: "OPC Cement (for CM 1:4 mortar)" },
          { resourceCode: "M-0005", coeff: 0.27, desc: "Sand for mortar" },
          { resourceCode: "M-0026", coeff: 0.06, desc: "Water" },
          { resourceCode: "L-0001", coeff: 1.50, desc: "Mason" },
          { resourceCode: "L-0022", coeff: 1.00, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-BM-002",
        name: "AAC Block Masonry in CM 1:6 – per Cu.m",
        cat: "Masonry", sub: "AAC Block", unit: "Cu.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0019", coeff: 1.05, desc: "AAC Blocks (with 5% wastage)" },
          { resourceCode: "M-0001", coeff: 1.20, desc: "Cement for CM 1:6" },
          { resourceCode: "M-0005", coeff: 0.25, desc: "Sand for mortar" },
          { resourceCode: "M-0026", coeff: 0.05, desc: "Water" },
          { resourceCode: "L-0001", coeff: 1.20, desc: "Mason" },
          { resourceCode: "L-0022", coeff: 0.80, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-PL-001",
        name: "Cement Plaster 12mm thick CM 1:4 – per Sq.m",
        cat: "Plastering", sub: "Internal", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0001", coeff: 0.10, desc: "OPC Cement" },
          { resourceCode: "M-0005", coeff: 0.014, desc: "Sand" },
          { resourceCode: "M-0026", coeff: 0.005, desc: "Water" },
          { resourceCode: "L-0001", coeff: 0.12, desc: "Mason" },
          { resourceCode: "L-0022", coeff: 0.06, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-PL-002",
        name: "Cement Plaster 15mm thick CM 1:4 – per Sq.m",
        cat: "Plastering", sub: "External", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0001", coeff: 0.13, desc: "OPC Cement" },
          { resourceCode: "M-0005", coeff: 0.018, desc: "Sand" },
          { resourceCode: "M-0026", coeff: 0.006, desc: "Water" },
          { resourceCode: "L-0001", coeff: 0.15, desc: "Mason" },
          { resourceCode: "L-0022", coeff: 0.08, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-FL-001",
        name: "Vitrified Tile Flooring (60x60cm) – per Sq.m",
        cat: "Flooring", sub: "Vitrified Tile", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0037", coeff: 1.05, desc: "Vitrified tiles (5% wastage)" },
          { resourceCode: "M-0001", coeff: 0.12, desc: "Cement for bed & joints" },
          { resourceCode: "M-0005", coeff: 0.03, desc: "Sand for bed" },
          { resourceCode: "M-0004", coeff: 0.10, desc: "White cement for joints" },
          { resourceCode: "L-0014", coeff: 0.25, desc: "Tiler" },
          { resourceCode: "L-0022", coeff: 0.15, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-FL-002",
        name: "Granite Flooring (20mm Polished) – per Sq.m",
        cat: "Flooring", sub: "Granite", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0038", coeff: 1.05, desc: "Polished granite (5% wastage)" },
          { resourceCode: "M-0001", coeff: 0.15, desc: "Cement for bed" },
          { resourceCode: "M-0005", coeff: 0.04, desc: "Sand for bed" },
          { resourceCode: "M-0004", coeff: 0.15, desc: "White cement for pointing" },
          { resourceCode: "L-0014", coeff: 0.30, desc: "Tiler / Marble layer" },
          { resourceCode: "L-0022", coeff: 0.18, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-PT-001",
        name: "Interior Emulsion Painting (2 coats with primer & putty) – per Sq.m",
        cat: "Painting", sub: "Emulsion", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0029", coeff: 0.04, desc: "Cement primer" },
          { resourceCode: "M-0035", coeff: 0.50, desc: "Wall putty" },
          { resourceCode: "M-0032", coeff: 0.10, desc: "Interior emulsion paint" },
          { resourceCode: "L-0005", coeff: 0.08, desc: "Painter" },
          { resourceCode: "L-0022", coeff: 0.03, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-PT-002",
        name: "Exterior Emulsion Painting (2 coats with primer) – per Sq.m",
        cat: "Painting", sub: "Exterior Emulsion", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0029", coeff: 0.04, desc: "Cement primer" },
          { resourceCode: "M-0031", coeff: 0.12, desc: "Exterior emulsion paint" },
          { resourceCode: "L-0005", coeff: 0.08, desc: "Painter" },
          { resourceCode: "L-0022", coeff: 0.03, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-ST-001",
        name: "Reinforcement Steel (TMT Fe-500D) Cutting, Bending & Placing – per Tonne",
        cat: "Steel Work", sub: "Reinforcement", unit: "Tonne",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0011", coeff: 1.03, desc: "TMT Bar (3% wastage)" },
          { resourceCode: "M-0015", coeff: 10.0, desc: "Binding wire (10 kg/tonne)" },
          { resourceCode: "L-0013", coeff: 3.00, desc: "Barbender (3 days/tonne)" },
          { resourceCode: "L-0022", coeff: 3.00, desc: "Unskilled labour (3 days)" },
        ],
      },
      {
        code: "RA-FW-001",
        name: "Centering & Shuttering for RCC Slab – per Sq.m",
        cat: "Formwork", sub: "Slab", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0058", coeff: 1.00, desc: "Steel centering plates" },
          { resourceCode: "L-0003", coeff: 0.25, desc: "Carpenter" },
          { resourceCode: "L-0022", coeff: 0.15, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-WP-001",
        name: "Bituminous Waterproofing (2 coats) – per Sq.m",
        cat: "Waterproofing", sub: "Bituminous", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0046", coeff: 1.50, desc: "Bitumen 80/100 grade" },
          { resourceCode: "L-0040", coeff: 0.12, desc: "Waterproofing applicator" },
          { resourceCode: "L-0022", coeff: 0.06, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-WP-002",
        name: "APP Membrane Waterproofing – per Sq.m",
        cat: "Waterproofing", sub: "APP Membrane", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0047", coeff: 1.10, desc: "APP Membrane 3mm (10% overlap)" },
          { resourceCode: "M-0046", coeff: 0.50, desc: "Bitumen primer coat" },
          { resourceCode: "L-0040", coeff: 0.15, desc: "Waterproofing applicator" },
          { resourceCode: "L-0022", coeff: 0.08, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-PB-001",
        name: "PVC Pipe Laying 110mm SWR (incl. joints) – per Rmt",
        cat: "Plumbing", sub: "PVC", unit: "Rmt",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0041", coeff: 1.05, desc: "PVC pipe 110mm (5% wastage)" },
          { resourceCode: "L-0007", coeff: 0.08, desc: "Plumber" },
          { resourceCode: "L-0022", coeff: 0.04, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-RF-001",
        name: "Mangalore Tile Roofing on Timber Rafters – per Sq.m",
        cat: "Roofing", sub: "Tile", unit: "Sq.m",
        overhead: 10, profit: 15, gst: 18,
        items: [
          { resourceCode: "M-0064", coeff: 0.016, desc: "Mangalore tiles (16 per Sq.m)" },
          { resourceCode: "M-0022", coeff: 0.015, desc: "Country wood for rafters/battens" },
          { resourceCode: "L-0001", coeff: 0.20, desc: "Mason (tile laying)" },
          { resourceCode: "L-0003", coeff: 0.15, desc: "Carpenter (rafter fixing)" },
          { resourceCode: "L-0022", coeff: 0.12, desc: "Unskilled labour" },
        ],
      },
      {
        code: "RA-DM-001",
        name: "Demolition of Old Brick Masonry – per Cu.m",
        cat: "Demolition", sub: "Brick", unit: "Cu.m",
        overhead: 10, profit: 10, gst: 18,
        items: [
          { resourceCode: "L-0021", coeff: 0.50, desc: "Semi-skilled (breaking)" },
          { resourceCode: "L-0022", coeff: 1.50, desc: "Unskilled labour (removal)" },
        ],
      },
    ];

    // Build a map of resource code -> id
    const { rows: resourceRows } = await client.query(
      `SELECT id, unique_code FROM resources WHERE sor_version_id = $1`,
      [sorVersionId]
    );
    const resourceMap = new Map<string, string>();
    for (const r of resourceRows) {
      resourceMap.set(r.unique_code, r.id);
    }

    for (const t of templates) {
      const { rows: [tmpl] } = await client.query(`
        INSERT INTO rate_templates (code, name, category, sub_category, unit, overhead_percent, profit_percent, gst_percent, is_system)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          unit = EXCLUDED.unit,
          overhead_percent = EXCLUDED.overhead_percent,
          profit_percent = EXCLUDED.profit_percent,
          gst_percent = EXCLUDED.gst_percent,
          updated_at = NOW()
        RETURNING id
      `, [t.code, t.name, t.cat, t.sub, t.unit, t.overhead, t.profit, t.gst]);

      // Delete existing line items and re-insert
      await client.query(`DELETE FROM template_line_items WHERE template_id = $1`, [tmpl.id]);

      for (let i = 0; i < t.items.length; i++) {
        const item = t.items[i];
        const resourceId = resourceMap.get(item.resourceCode);
        if (!resourceId) {
          console.warn(`Resource ${item.resourceCode} not found, skipping line item`);
          continue;
        }
        await client.query(`
          INSERT INTO template_line_items (template_id, resource_id, description, coefficient, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [tmpl.id, resourceId, item.desc, item.coeff, i + 1]);
      }
    }
    console.log(`Inserted ${templates.length} rate templates with line items`);

    // ── 8. Plinth Area Rates ───────────────────────────────
    const plinthRates = [
      // Class I – RCC Framed Structure (Complete)
      { cls: "I-A", name: "RCC Framed – Reinforced Concrete", desc: "Load-bearing walls or RCC frame, RCC roof", roof: "RCC Slab", floor: "Ground Floor", rate: 24500, addlFloor: 2450, dep: 1.5 },
      { cls: "I-B", name: "RCC Framed – with Mangalore Tile", desc: "RCC frame with Mangalore tile roof", roof: "Mangalore Tile", floor: "Ground Floor", rate: 21000, addlFloor: 2100, dep: 1.5 },
      // Class II – Load Bearing
      { cls: "II-A", name: "Load Bearing – RCC Roof", desc: "Brick/stone load-bearing walls with RCC roof", roof: "RCC Slab", floor: "Ground Floor", rate: 20500, addlFloor: 2050, dep: 1.5 },
      { cls: "II-B", name: "Load Bearing – AC Sheet", desc: "Brick/stone load-bearing walls with AC sheet roof", roof: "AC Sheet", floor: "Ground Floor", rate: 16800, addlFloor: 1680, dep: 2.0 },
      { cls: "II-C", name: "Load Bearing – Mangalore Tile", desc: "Brick/stone walls with Mangalore tile roof", roof: "Mangalore Tile", floor: "Ground Floor", rate: 17500, addlFloor: 1750, dep: 2.0 },
      // Class III – Semi-permanent
      { cls: "III-A", name: "Semi-permanent – Tiled Roof", desc: "Country brick walls with tiled roof", roof: "Country Tile", floor: "Ground Floor", rate: 12000, addlFloor: 0, dep: 3.0 },
      { cls: "III-B", name: "Semi-permanent – GI Sheet", desc: "Brick walls with GI sheet roof", roof: "GI Sheet", floor: "Ground Floor", rate: 13500, addlFloor: 0, dep: 2.5 },
      // Class IV – Temporary
      { cls: "IV-A", name: "Temporary – Thatched", desc: "Mud walls with thatched roof", roof: "Thatch", floor: "Ground Floor", rate: 6500, addlFloor: 0, dep: 5.0 },
      { cls: "IV-B", name: "Temporary – Tin Sheet", desc: "Timber/bamboo frame with tin sheet", roof: "Tin Sheet", floor: "Ground Floor", rate: 8000, addlFloor: 0, dep: 4.0 },
      // Additional floor entries for multi-storey
      { cls: "I-A", name: "RCC Framed – Reinforced Concrete", desc: "First floor and above", roof: "RCC Slab", floor: "First Floor+", rate: 26950, addlFloor: 2695, dep: 1.5 },
      { cls: "II-A", name: "Load Bearing – RCC Roof", desc: "First floor and above", roof: "RCC Slab", floor: "First Floor+", rate: 22550, addlFloor: 2255, dep: 1.5 },
    ];

    for (const p of plinthRates) {
      await client.query(`
        INSERT INTO plinth_area_rates (class_code, class_name, description, roof_type, floor, rate, additional_floor_rate, depreciation_percent, effective_from)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2025-04-01')
        ON CONFLICT DO NOTHING
      `, [p.cls, p.name, p.desc, p.roof, p.floor, p.rate, p.addlFloor, p.dep]);
    }
    console.log(`Inserted ${plinthRates.length} plinth area rates`);

    await client.query("COMMIT");
    console.log("SOR seed completed successfully!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SOR seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSOR();
