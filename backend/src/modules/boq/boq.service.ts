import { pool } from "../../config/db";
import { unlink } from "fs/promises";
import XLSX from "xlsx";
import path from "path";

type BoqFileKind = "excel" | "csv" | "pdf";

function detectBoqFileKind(mimetype: string, fileName = ""): BoqFileKind {
  const normalizedMime = String(mimetype || "").toLowerCase();
  const extension = path.extname(String(fileName || "").toLowerCase());

  if (
    normalizedMime === "application/vnd.ms-excel" ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === ".xls" ||
    extension === ".xlsx"
  ) {
    return "excel";
  }

  if (normalizedMime === "application/pdf" || extension === ".pdf") {
    return "pdf";
  }

  return "csv";
}

function extractPdfRowsFromText(rawText: string) {
  const unitPattern = "(?:kg|kgs|mt|ton|tons|nos?|no|each|ea|m|rm|rmt|rft|ft|sft|sqft|m2|sqm|cft|cuft|m3|cum|ltr|l|set)";
  const qtyPattern = "-?\\d+(?:[.,]\\d+)?";
  const linePattern = new RegExp(
    `^(?:\\d+[.)\\-]?\\s*)?(.+?)\\s+(${qtyPattern})\\s+(${unitPattern})\\b`,
    "i"
  );

  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items = lines
    .map((line) => {
      const match = line.match(linePattern);
      if (!match) return null;

      const item = String(match[1] || "").trim();
      const qtyRaw = String(match[2] || "").replace(/,/g, "");
      const uom = String(match[3] || "").trim();
      const qty = Number.parseFloat(qtyRaw);

      if (!item || item.length < 3 || !Number.isFinite(qty) || !uom) {
        return null;
      }

      return {
        item,
        qty: Number(qty.toFixed(3)),
        uom,
      };
    })
    .filter((row): row is { item: string; qty: number; uom: string } => Boolean(row));

  return { lines, items };
}

function getConfiguredLlmModel() {
  const raw = String(process.env.LLM_MODEL || "").trim();
  if (!raw) {
    return "gemini-3.1-pro-preview";
  }

  if (/^gpt-|^o\d/i.test(raw)) {
    return "gemini-3.1-pro-preview";
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, "-");

  if (normalized === "gemini-3.1-pro" || normalized === "gemini-3-pro") {
    return "gemini-3.1-pro-preview";
  }

  return normalized;
}

function getConfiguredLlmApiKey() {
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.LLM_API_KEY ||
    "";
  return String(raw).trim().replace(/^['"]+|['"]+$/g, "");
}

function extractJsonPayload(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
  }

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = candidate.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
    }
  }

  return null;
}

function cleanQty(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const normalized = text.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return text;
  return Number(parsed.toFixed(3));
}

async function extractBoqWithLlm(input: {
  columns: string[];
  sampleRows: Array<Record<string, any>>;
}): Promise<{
  mapping: Record<string, string>;
  items: Array<{ item: string; qty: number | string; uom: string }>;
  llmUsed: boolean;
}> {
  const apiKey = getConfiguredLlmApiKey();
  const model = getConfiguredLlmModel();

  if (!apiKey || !input.columns.length || !input.sampleRows.length) {
    return { mapping: {}, items: [], llmUsed: false };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const promptPayload = {
    task: "Extract BOQ rows with only item description, quantity required, and unit of measure",
    columns: input.columns,
    sampleRows: input.sampleRows.slice(0, 80),
    outputRules: [
      "Return strict JSON only",
      "Output shape: { mapping: { item: string, qty: string, uom: string }, items: [{ item: string, qty: number|string, uom: string }] }",
      "mapping values must be from provided columns when possible",
      "Ignore irrelevant columns and rows with no meaningful item",
      "qty should be numeric when obvious, otherwise keep original token",
      "uom should be short normalized unit token where possible (kg, nos, m, sft, cft, rft, mt, ltr)",
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "You are a construction BOQ parser. Extract only Item Description, Quantity, and UOM from noisy template tables.",
              },
              { text: JSON.stringify(promptPayload) },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return { mapping: {}, items: [], llmUsed: false };
    }

    const data = (await response.json()) as any;
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => String(part?.text || ""))
      .join("\n");

    if (!content) {
      return { mapping: {}, items: [], llmUsed: false };
    }

    const parsed = extractJsonPayload(content);
    const mappingRaw = parsed?.mapping && typeof parsed.mapping === "object" ? parsed.mapping : {};
    const mapped = {
      item: String(mappingRaw.item || "").trim(),
      qty: String(mappingRaw.qty || "").trim(),
      uom: String(mappingRaw.uom || "").trim(),
    };

    const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
    const items = itemsRaw
      .map((row: any) => ({
        item: String(row?.item || "").trim(),
        qty: cleanQty(row?.qty),
        uom: String(row?.uom || "").trim(),
      }))
      .filter((row: any) => row.item || row.qty || row.uom)
      .slice(0, 1000);

    return { mapping: mapped, items, llmUsed: items.length > 0 || Boolean(mapped.item || mapped.qty || mapped.uom) };
  } catch {
    return { mapping: {}, items: [], llmUsed: false };
  }
}

function getDbSafeFileType(rawMimeType: string) {
  return String(rawMimeType || "application/octet-stream").slice(0, 50);
}

export async function saveOrUpdateBOQ(
  projectId: string,
  userId: string,
  file: Express.Multer.File,
  columnMapping?: Record<string, string>
) {
  async function notifyInvitedBuildersOnBoqRevision(
    tx: { query: (sql: string, params?: any[]) => Promise<any> },
    targetProjectId: string,
    actorUserId: string
  ) {
    const projectRes = await tx.query(
      `SELECT id, name FROM projects WHERE id = $1 LIMIT 1`,
      [targetProjectId]
    );

    const projectName = String(projectRes.rows[0]?.name || "Project");

    const invitedBuildersRes = await tx.query(
      `SELECT DISTINCT ui.user_id
       FROM user_invites ui
       JOIN users u ON u.id = ui.user_id
       WHERE ui.project_id = $1
         AND ui.role = 'builder'
         AND ui.accepted_at IS NOT NULL
         AND ui.user_id IS NOT NULL
         AND COALESCE(u.is_active, true) = true`,
      [targetProjectId]
    );

    if (!invitedBuildersRes.rows.length) {
      return 0;
    }

    const notificationMessage = `BOQ has been revised for ${projectName}. Please review the update and resubmit your estimate.`;

    for (const row of invitedBuildersRes.rows) {
      await tx.query(
        `INSERT INTO notifications (user_id, message, is_read, metadata, created_at)
         VALUES ($1, $2, false, $3, now())`,
        [
          row.user_id,
          notificationMessage,
          JSON.stringify({
            type: "BOQ_REVISED_RESUBMIT_ESTIMATE",
            projectId: targetProjectId,
            projectName,
            triggeredBy: actorUserId,
          }),
        ]
      );
    }

    await tx.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'BOQ_REVISED_NOTIFY_BUILDERS', $3)`,
      [
        targetProjectId,
        actorUserId,
        JSON.stringify({
          recipients: invitedBuildersRes.rows.length,
          projectName,
          reason: "request_estimate_resubmission",
        }),
      ]
    );

    return invitedBuildersRes.rows.length;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fileType = getDbSafeFileType(file.mimetype);

    // Parse the file to extract data for database storage
    const fs = require("fs");
    const buffer = fs.readFileSync(file.path);
    const parsed = await parseBOQFile(buffer, file.mimetype, columnMapping, file.originalname);

    // Check if BOQ already exists for this project
    const existingBOQ = await client.query(
      "SELECT * FROM boqs WHERE project_id = $1",
      [projectId]
    );

    if (existingBOQ.rows.length > 0) {
      // Delete old file
      try {
        await unlink(existingBOQ.rows[0].file_path);
      } catch (err) {
        console.error("Error deleting old file:", err);
      }

      // Update existing BOQ (supports old/new schema versions)
      let result;
      await client.query("SAVEPOINT boq_update_try_parsed_data");
      try {
        result = await client.query(
          `UPDATE boqs 
           SET file_name = $1, file_path = $2, file_type = $3, 
               file_size = $4, column_mapping = $5, parsed_data = $6, uploaded_at = CURRENT_TIMESTAMP
           WHERE project_id = $7
           RETURNING *`,
          [
            file.originalname,
            file.path,
            fileType,
            file.size,
            JSON.stringify(parsed.mapping),
            JSON.stringify(parsed.items),
            projectId,
          ]
        );
        await client.query("RELEASE SAVEPOINT boq_update_try_parsed_data");
      } catch (errorParsedData: any) {
        if (errorParsedData?.code !== "42703") {
          throw errorParsedData;
        }

        await client.query("ROLLBACK TO SAVEPOINT boq_update_try_parsed_data");
        await client.query("SAVEPOINT boq_update_try_column_mapping");

        try {
          result = await client.query(
            `UPDATE boqs 
             SET file_name = $1, file_path = $2, file_type = $3, 
                 file_size = $4, column_mapping = $5, uploaded_at = CURRENT_TIMESTAMP
             WHERE project_id = $6
             RETURNING *`,
            [
              file.originalname,
              file.path,
              fileType,
              file.size,
              JSON.stringify(parsed.mapping),
              projectId,
            ]
          );
          await client.query("RELEASE SAVEPOINT boq_update_try_column_mapping");
        } catch (errorMapping: any) {
          if (errorMapping?.code !== "42703") {
            throw errorMapping;
          }

          await client.query("ROLLBACK TO SAVEPOINT boq_update_try_column_mapping");
          result = await client.query(
            `UPDATE boqs 
             SET file_name = $1, file_path = $2, file_type = $3, 
                 file_size = $4, uploaded_at = CURRENT_TIMESTAMP
             WHERE project_id = $5
             RETURNING *`,
            [
              file.originalname,
              file.path,
              fileType,
              file.size,
              projectId,
            ]
          );
        }
      }

      await notifyInvitedBuildersOnBoqRevision(client, projectId, userId);

      await client.query("COMMIT");
      return result.rows[0];
    } else {
      // Insert new BOQ (supports old/new schema versions)
      let result;
      await client.query("SAVEPOINT boq_insert_try_parsed_data");
      try {
        result = await client.query(
          `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size, column_mapping, parsed_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            projectId,
            userId,
            file.originalname,
            file.path,
            fileType,
            file.size,
            JSON.stringify(parsed.mapping),
            JSON.stringify(parsed.items),
          ]
        );
        await client.query("RELEASE SAVEPOINT boq_insert_try_parsed_data");
      } catch (errorParsedData: any) {
        if (errorParsedData?.code !== "42703") {
          throw errorParsedData;
        }

        await client.query("ROLLBACK TO SAVEPOINT boq_insert_try_parsed_data");
        await client.query("SAVEPOINT boq_insert_try_column_mapping");

        try {
          result = await client.query(
            `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size, column_mapping)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              projectId,
              userId,
              file.originalname,
              file.path,
              fileType,
              file.size,
              JSON.stringify(parsed.mapping),
            ]
          );
          await client.query("RELEASE SAVEPOINT boq_insert_try_column_mapping");
        } catch (errorMapping: any) {
          if (errorMapping?.code !== "42703") {
            throw errorMapping;
          }

          await client.query("ROLLBACK TO SAVEPOINT boq_insert_try_column_mapping");
          result = await client.query(
            `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
              projectId,
              userId,
              file.originalname,
              file.path,
              fileType,
              file.size,
            ]
          );
        }
      }

      // Update project with boq_id
      await client.query("SAVEPOINT project_boq_reference_update");
      try {
        await client.query(
          "UPDATE projects SET boq_id = $1 WHERE id = $2",
          [result.rows[0].id, projectId]
        );
        await client.query("RELEASE SAVEPOINT project_boq_reference_update");
      } catch (error: any) {
        if (error?.code !== "42703") {
          throw error;
        }
        await client.query("ROLLBACK TO SAVEPOINT project_boq_reference_update");
      }

      await client.query("COMMIT");
      return result.rows[0];
    }
  } catch (err) {
    await client.query("ROLLBACK");
    // Delete uploaded file if transaction fails
    try {
      await unlink(file.path);
    } catch (unlinkErr) {
      console.error("Error deleting file:", unlinkErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getBOQByProject(projectId: string) {
  const result = await pool.query(
    `SELECT b.id, b.project_id, b.file_name, b.file_path, b.file_type, 
            b.file_size, b.column_mapping, b.parsed_data, b.uploaded_at,
            COALESCE(u.email, '') as uploaded_by_name
     FROM boqs b
     LEFT JOIN users u ON b.uploaded_by = u.id
     WHERE b.project_id = $1`,
    [projectId]
  );
  return result.rows[0];
}

export async function saveJsonBOQ(
  projectId: string,
  userId: string,
  items: Array<{ item: string; qty: number | string; uom: string }>
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM boqs WHERE project_id = $1",
      [projectId]
    );

    let boqId: string;

    if (existing.rows.length > 0) {
      // Update parsed_data on the existing row
      const updated = await client.query(
        `UPDATE boqs
         SET parsed_data = $1,
             uploaded_by = $2,
             uploaded_at = CURRENT_TIMESTAMP
         WHERE project_id = $3
         RETURNING id`,
        [JSON.stringify(items), userId, projectId]
      );
      boqId = updated.rows[0].id;
    } else {
      // Insert a new BOQ row (no physical file)
      await client.query("SAVEPOINT boq_json_insert");
      let inserted;
      try {
        inserted = await client.query(
          `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size, parsed_data)
           VALUES ($1, $2, 'manual-entry', '', 'application/json', 0, $3)
           RETURNING id`,
          [projectId, userId, JSON.stringify(items)]
        );
        await client.query("RELEASE SAVEPOINT boq_json_insert");
      } catch (insertErr: any) {
        if (insertErr?.code !== "42703") throw insertErr;
        // parsed_data column may not exist yet — fall back without it
        await client.query("ROLLBACK TO SAVEPOINT boq_json_insert");
        inserted = await client.query(
          `INSERT INTO boqs (project_id, uploaded_by, file_name, file_path, file_type, file_size)
           VALUES ($1, $2, 'manual-entry', '', 'application/json', 0)
           RETURNING id`,
          [projectId, userId]
        );
      }
      boqId = inserted.rows[0].id;
    }

    // Always update the project's boq_id reference
    await client.query("SAVEPOINT update_project_boq_id");
    try {
      await client.query(
        "UPDATE projects SET boq_id = $1 WHERE id = $2",
        [boqId, projectId]
      );
      await client.query("RELEASE SAVEPOINT update_project_boq_id");
    } catch (updateErr: any) {
      // boq_id column might not exist in older schema versions
      if (updateErr?.code !== "42703") throw updateErr;
      await client.query("ROLLBACK TO SAVEPOINT update_project_boq_id");
    }

    await client.query("COMMIT");
    return { id: boqId, project_id: projectId, items };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateBOQItems(
  projectId: string,
  userId: string,
  items: Array<{ item: string; qty: number | string; uom: string }>
) {
  const result = await pool.query(
    `UPDATE boqs
     SET parsed_data = $1,
         uploaded_by = $2,
         uploaded_at = CURRENT_TIMESTAMP
     WHERE project_id = $3
     RETURNING *`,
    [JSON.stringify(items), userId, projectId]
  );

  if (!result.rows.length) {
    throw new Error("BOQ not found");
  }

  return result.rows[0];
}

export async function checkExistingBOQ(projectId: string) {
  const result = await pool.query(
    "SELECT id, file_name FROM boqs WHERE project_id = $1",
    [projectId]
  );
  return result.rows[0] || null;
}

export async function parseStoredBOQFile(filePath: string, columnMapping: Record<string, string>) {
  try {
    const fs = require("fs");
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(String(filePath || "").toLowerCase());
    const mimetype = ext === ".pdf"
      ? "application/pdf"
      : ext === ".xlsx" || ext === ".xls"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";
    
    return parseBOQFile(buffer, mimetype, columnMapping, filePath);
  } catch (err) {
    console.error("Error parsing stored BOQ:", err);
    return { columns: [], mapping: columnMapping, items: [], preview: [] };
  }
}

export async function invalidatePendingInvites(projectId: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE user_invites 
       SET expires_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND accepted_at IS NULL`,
      [projectId]
    );
  } finally {
    client.release();
  }
}

export async function deleteBOQ(projectId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const boq = await client.query(
      "SELECT * FROM boqs WHERE project_id = $1",
      [projectId]
    );

    if (boq.rows.length === 0) {
      throw new Error("BOQ not found");
    }

    // Delete file
    try {
      await unlink(boq.rows[0].file_path);
    } catch (err) {
      console.error("Error deleting file:", err);
    }

    // Update project
    await client.query(
      "UPDATE projects SET boq_id = NULL WHERE id = $1",
      [projectId]
    );

    // Delete BOQ record
    await client.query("DELETE FROM boqs WHERE project_id = $1", [projectId]);

    await client.query("COMMIT");
    return { message: "BOQ deleted successfully" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function uploadBOQ(
  projectId: string, 
  userId: string, 
  file: Express.Multer.File,
  columnMapping?: Record<string, string>
) {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const resolvedPath = file?.path ||
    (file?.destination && file?.filename
      ? path.join(file.destination, file.filename)
      : "");

  if (!resolvedPath) {
    throw new Error("Uploaded file path is missing");
  }

  const normalizedFile = {
    ...file,
    path: resolvedPath,
  } as Express.Multer.File;

  const boq = await saveOrUpdateBOQ(projectId, userId, normalizedFile, columnMapping);
  
  // Invalidate pending invites for this project
  await invalidatePendingInvites(projectId);

  return {
    message: "BOQ uploaded successfully",
    boq,
  };
}

export async function parseBOQFile(
  buffer: Buffer,
  mimetype: string,
  overrideMapping?: Record<string, string>,
  originalFileName?: string
) {
  const UNIT_TOKENS = new Set([
    "kg", "kgs", "mt", "ton", "tons", "nos", "no", "each", "ea", "m", "rm", "rmt",
    "rft", "ft", "sft", "sqft", "m2", "sqm", "cft", "cuft", "m3", "cum", "ltr", "l", "set",
  ]);

  const itemPositive = /(item(\s*description)?|description|particulars?|activity|work\s*description|material|specification|item\s*name)/i;
  const itemNegative = /(qty|quantity|uom|unit|rate|amount|price|total|code|id|s\/?no|serial|remark|gst|tax)/i;
  const qtyPositive = /(qty|quantity|quant(?:ity)?|required\s*qty|boq\s*qty)/i;
  const qtyNegative = /(amount|rate|price|total|uom|unit|description|item|code|remark|gst|tax)/i;
  const uomPositive = /(uom|unit\s*of\s*measure(?:ment)?|unit|measure(?:ment)?)/i;
  const uomNegative = /(amount|rate|price|total|qty|quantity|description|item|code|remark|gst|tax)/i;

  const normalizeHeader = (value: string) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const scoreHeader = (header: string, type: "item" | "qty" | "uom") => {
    const normalized = normalizeHeader(header);
    if (!normalized) return -999;

    if (type === "item") {
      let score = 0;
      if (itemPositive.test(normalized)) score += 6;
      if (/\b(item|description|particulars?)\b/.test(normalized)) score += 3;
      if (/\b(amount|rate|total|qty|quantity|uom|unit)\b/.test(normalized)) score -= 4;
      if (itemNegative.test(normalized)) score -= 3;
      return score;
    }

    if (type === "qty") {
      let score = 0;
      if (qtyPositive.test(normalized)) score += 7;
      if (/\b(qty|quantity|quant)\b/.test(normalized)) score += 4;
      if (/\b(amount|rate|total|price)\b/.test(normalized)) score -= 6;
      if (qtyNegative.test(normalized)) score -= 3;
      return score;
    }

    let score = 0;
    if (uomPositive.test(normalized)) score += 7;
    if (/\b(uom|unit|measure)\b/.test(normalized)) score += 3;
    if (/\b(amount|rate|total|qty|quantity)\b/.test(normalized)) score -= 5;
    if (uomNegative.test(normalized)) score -= 2;
    return score;
  };

  const deriveStatsMapping = (headers: string[], rows: Array<Record<string, any>>) => {
    if (!rows.length) return {} as Record<string, string>;

    const stats = headers.map((header) => {
      const values = rows.slice(0, 120).map((row) => String(row[header] ?? "").trim()).filter(Boolean);
      const count = values.length || 1;
      const numericRatio = values.filter((v) => /^-?\d+(?:\.\d+)?$/.test(v.replace(/,/g, ""))).length / count;
      const uomRatio = values.filter((v) => UNIT_TOKENS.has(v.toLowerCase())).length / count;
      const longTextRatio = values.filter((v) => v.length >= 12 && /[a-zA-Z]/.test(v)).length / count;
      return { header, numericRatio, uomRatio, longTextRatio };
    });

    const bestQty = stats
      .filter((s) => !/amount|rate|price|total/i.test(s.header))
      .sort((a, b) => b.numericRatio - a.numericRatio)[0];

    const bestUom = stats
      .filter((s) => !/amount|rate|price|total|qty|quantity/i.test(s.header))
      .sort((a, b) => b.uomRatio - a.uomRatio)[0];

    const bestItem = stats
      .filter((s) => !/amount|rate|price|total|qty|quantity|uom|unit/i.test(s.header))
      .sort((a, b) => b.longTextRatio - a.longTextRatio)[0];

    const mapped: Record<string, string> = {};
    if (bestItem && bestItem.longTextRatio > 0.2) mapped.item = bestItem.header;
    if (bestQty && bestQty.numericRatio > 0.2) mapped.qty = bestQty.header;
    if (bestUom && bestUom.uomRatio > 0.15) mapped.uom = bestUom.header;
    return mapped;
  };

  const detectColumnMapping = (headers: string[], rows: Array<Record<string, any>> = []) => {
    const mapping: Record<string, string> = {};
    const available = [...headers];

    const pickBest = (type: "item" | "qty" | "uom") => {
      const ranked = available
        .map((header) => ({ header, score: scoreHeader(header, type) }))
        .sort((a, b) => b.score - a.score);
      return ranked[0] && ranked[0].score > 0 ? ranked[0].header : "";
    };

    const pickedItem = pickBest("item");
    if (pickedItem) {
      mapping.item = pickedItem;
      const idx = available.indexOf(pickedItem);
      if (idx >= 0) available.splice(idx, 1);
    }

    const pickedQty = pickBest("qty");
    if (pickedQty) {
      mapping.qty = pickedQty;
      const idx = available.indexOf(pickedQty);
      if (idx >= 0) available.splice(idx, 1);
    }

    const pickedUom = pickBest("uom");
    if (pickedUom) {
      mapping.uom = pickedUom;
      const idx = available.indexOf(pickedUom);
      if (idx >= 0) available.splice(idx, 1);
    }

    const fallback = deriveStatsMapping(headers, rows);
    return {
      item: mapping.item || fallback.item || "",
      qty: mapping.qty || fallback.qty || "",
      uom: mapping.uom || fallback.uom || "",
    };
  };

  const sanitizeLlmMapping = (
    llmMapping: Record<string, string>,
    headers: string[],
    fallback: Record<string, string>
  ) => {
    const headerSet = new Set(headers);
    const accepted: Record<string, string> = {};

    const maybeAccept = (field: "item" | "qty" | "uom") => {
      const candidate = String(llmMapping[field] || "").trim();
      if (!candidate || !headerSet.has(candidate)) return;
      if (Object.values(accepted).includes(candidate)) return;
      if (scoreHeader(candidate, field) <= 0) return;
      accepted[field] = candidate;
    };

    maybeAccept("item");
    maybeAccept("qty");
    maybeAccept("uom");

    return {
      item: accepted.item || fallback.item || "",
      qty: accepted.qty || fallback.qty || "",
      uom: accepted.uom || fallback.uom || "",
    };
  };

  // Use override mapping if provided, otherwise auto-detect
  const useMapping = (headers: string[], rows: Array<Record<string, any>> = []) => {
    if (overrideMapping && Object.keys(overrideMapping).length > 0) {
      return overrideMapping;
    }
    return detectColumnMapping(headers, rows);
  };

  const normalizeRow = (row: Record<string, any>, mapping: Record<string, string>) => {
    return {
      item: mapping.item ? String(row[mapping.item] ?? "").trim() : "",
      qty: mapping.qty ? cleanQty(row[mapping.qty]) : "",
      uom: mapping.uom ? String(row[mapping.uom] ?? "").trim() : "",
    };
  };

  const fileKind = detectBoqFileKind(mimetype, originalFileName);
  const isExcel = fileKind === "excel";

  if (isExcel) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return { columns: [], mapping: {}, items: [], preview: [] };

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    
    if (rows.length === 0) return { columns: [], mapping: {}, items: [], preview: [] };
    
    const columns = Object.keys(rows[0]);
    let mapping = useMapping(columns, rows);
    const heuristicItems = rows
      .map(row => normalizeRow(row, mapping))
      .filter(r => r.item || r.qty || r.uom);

    let llmUsed = false;
    let items = heuristicItems;

    if (!overrideMapping || Object.keys(overrideMapping).length === 0) {
      const llmResult = await extractBoqWithLlm({
        columns,
        sampleRows: rows.slice(0, 120),
      });

      if (llmResult.llmUsed) {
        if (llmResult.mapping.item || llmResult.mapping.qty || llmResult.mapping.uom) {
          mapping = sanitizeLlmMapping(llmResult.mapping, columns, mapping);
        }

        if (llmResult.items.length > 0) {
          items = llmResult.items;
        }

        llmUsed = true;
      }
    }
    
    return {
      columns,
      mapping,
      items,
      preview: items.slice(0, 5), // First 5 rows for preview
      llmUsed,
    };
  }

  if (fileKind === "pdf") {
    let extractedText = "";

    try {
      const pdfParse = await import("pdf-parse");
      const parsed = await pdfParse.default(buffer);
      extractedText = String(parsed?.text || "");
    } catch {
      throw new Error("Failed to extract BOQ content from PDF");
    }

    if (!extractedText.trim()) {
      return {
        columns: ["item", "qty", "uom"],
        mapping: { item: "item", qty: "qty", uom: "uom" },
        items: [],
        preview: [],
        llmUsed: false,
      };
    }

    const { lines, items: regexItems } = extractPdfRowsFromText(extractedText);
    let items = regexItems as Array<{ item: string; qty: number | string; uom: string }>;
    let llmUsed = false;

    if (items.length === 0) {
      const llmResult = await extractBoqWithLlm({
        columns: ["line"],
        sampleRows: lines.slice(0, 180).map((line) => ({ line })),
      });

      if (llmResult.llmUsed && llmResult.items.length > 0) {
        items = llmResult.items;
        llmUsed = true;
      }
    }

    return {
      columns: ["item", "qty", "uom"],
      mapping: { item: "item", qty: "qty", uom: "uom" },
      items,
      preview: items.slice(0, 5),
      llmUsed,
    };
  }

  const csv = buffer.toString();
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { columns: [], mapping: {}, items: [], preview: [] };

  const headers = lines[0].split(",").map(h => h.trim());
  
  const rawRows = lines.slice(1).map(line => {
    const cols = line.split(",");
    const rawRow: Record<string, string> = {};
    headers.forEach((header, index) => {
      rawRow[header] = cols[index]?.trim() || "";
    });
    return rawRow;
  });

  let mapping = useMapping(headers, rawRows);

  const heuristicItems = rawRows.map((row) => normalizeRow(row, mapping));

  let llmUsed = false;
  let items = heuristicItems.filter(r => r.item || r.qty || r.uom);

  if (!overrideMapping || Object.keys(overrideMapping).length === 0) {
    const llmResult = await extractBoqWithLlm({
      columns: headers,
      sampleRows: rawRows.slice(0, 120),
    });

    if (llmResult.llmUsed) {
      if (llmResult.mapping.item || llmResult.mapping.qty || llmResult.mapping.uom) {
        mapping = sanitizeLlmMapping(llmResult.mapping, headers, mapping);
      }

      if (llmResult.items.length > 0) {
        items = llmResult.items;
      }

      llmUsed = true;
    }
  }

  return {
    columns: headers,
    mapping,
    items,
    preview: items.slice(0, 5), // First 5 rows for preview
    llmUsed,
  };
}

