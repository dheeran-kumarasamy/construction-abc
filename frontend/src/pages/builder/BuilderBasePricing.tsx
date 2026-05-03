import { Fragment, useEffect, useMemo, useState } from "react";
import {
  type BasePriceItem,
  getBasePricing,
  addBasePrice,
  clearBasePricing,
  saveBasePricing,
} from "../../services/basePricingStore";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import TableWrapper from "../../components/TableWrapper";
import { apiUrl } from "../../services/api";

const RESIDENTIAL_BOQ_URL = new URL("../../data/boq-residential.json", import.meta.url).href;
const COMMERCIAL_BOQ_URL = new URL("../../data/boq-commercial.json", import.meta.url).href;
const INDUSTRIAL_BOQ_URL = new URL("../../data/boq-Industrial.json", import.meta.url).href;

const BOQ_SOURCES: Array<{ url: string; boqType: string }> = [
  { url: RESIDENTIAL_BOQ_URL, boqType: "Residential" },
  { url: COMMERCIAL_BOQ_URL, boqType: "Commercial" },
  { url: INDUSTRIAL_BOQ_URL, boqType: "Industrial" },
];

interface ColumnMapping {
  item: string;
  rate: string;
  uom?: string;
  category: string;
}

interface ParseDiagnostics {
  detectedHeaderRow?: number;
  totalRows?: number;
  missingItemRows?: number;
  missingRateRows?: number;
  zeroOrNegativeRateRows?: number;
}

interface UploadDiagnostics {
  totalRows?: number;
  nonEmptyRows?: number;
  importedRows?: number;
  invalidRows?: number;
  missingItemRows?: number;
  missingRateRows?: number;
  zeroOrNegativeRateRows?: number;
  duplicateMerged?: number;
}

interface StarterTemplateRow extends BasePriceItem {
  sourceKey?: string;
}

function inferBoqCategory(description: string): BasePriceItem["category"] {
  const text = description.toLowerCase();

  if (
    /(nmr|labou?r|mason|carpenter|helper|bar ?bender|painter|plumber|electrician|manpower|per day|shift of 8 hrs|lifting|loading|shifting|unloading|cleaning|\bwm\b|\bmm\b)/.test(
      text
    )
  ) {
    return "Labor";
  }

  if (/(machine|machinery|equipment|excavator|crane|roller|drilling|vibrator|compressor|batching)/.test(text)) {
    return "Machinery";
  }

  if (/(tax|gst|transport|freight|overhead|misc)/.test(text)) {
    return "Other";
  }

  return "Material";
}

export default function BuilderBasePricing() {
  const [items, setItems] = useState<BasePriceItem[]>([]);

  const [form, setForm] = useState<BasePriceItem>({
    item: "",
    rate: 0,
    uom: "",
    category: "Material",
    boqType: "Manual",
  });

  // File upload states
  const [uploadMode, setUploadMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    item: "",
    rate: "",
    uom: "",
    category: "",
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [parseDiagnostics, setParseDiagnostics] = useState<ParseDiagnostics | null>(null);
  const [lastUploadDiagnostics, setLastUploadDiagnostics] = useState<UploadDiagnostics | null>(null);
  const [templateRows, setTemplateRows] = useState<StarterTemplateRow[]>([]);
  const [templateCsv, setTemplateCsv] = useState<string>("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<{ item: string; uom: string } | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [boqItems, setBoqItems] = useState<BasePriceItem[]>([]);
  const [boqLoading, setBoqLoading] = useState(false);

  useEffect(() => {
    setItems(getBasePricing());
    loadStarterTemplate();
    loadBoqItems();
  }, []);

  async function loadStarterTemplate() {
    setTemplateLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/base-pricing/template"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load starter template");

      const data = await response.json();
      setTemplateRows(Array.isArray(data.rows) ? data.rows : []);
      setTemplateCsv(String(data.csv || ""));
    } catch (err) {
      console.error("Load starter template error:", err);
    } finally {
      setTemplateLoading(false);
    }
  }

  async function loadBoqItems() {
    setBoqLoading(true);
    try {
      const boqData = await Promise.all(
        BOQ_SOURCES.map(async (source) => ({
          ...source,
          data: await fetch(source.url).then((r) => r.json()),
        }))
      );

      const extractedItems: BasePriceItem[] = [];

      for (const source of boqData) {
        if (Array.isArray(source.data.rows)) {
          for (const row of source.data.rows) {
            if (row.type === "line_item" && row.description && row.unit) {
              extractedItems.push({
                item: String(row.description).trim(),
                rate: 0,
                uom: String(row.unit).trim(),
                category: inferBoqCategory(String(row.description)),
                boqType: source.boqType,
              });
            }
          }
        }
      }

      if (extractedItems.length > 0) {
        const token = localStorage.getItem("token");
        try {
          const response = await fetch(apiUrl("/api/base-pricing/bulk-lookup"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ items: extractedItems }),
          });

          if (response.ok) {
            const pricedItems = await response.json();

            // Preserve BOQ type from source file even if backend lookup response omits it.
            const sourceTypeByKey = new Map<string, string>();
            extractedItems.forEach((item) => {
              const key = `${String(item.item || "").trim().toLowerCase()}|${String(item.uom || "").trim().toLowerCase()}`;
              if (item.boqType) {
                sourceTypeByKey.set(key, item.boqType);
              }
            });

            const normalizedPricedItems: BasePriceItem[] = Array.isArray(pricedItems)
              ? pricedItems.map((item: any) => {
                  const key = `${String(item?.item || "").trim().toLowerCase()}|${String(item?.uom || "").trim().toLowerCase()}`;
                  return {
                    item: String(item?.item || "").trim(),
                    rate: Number(item?.rate || 0),
                    uom: String(item?.uom || "").trim(),
                    category: (item?.category || "Material") as BasePriceItem["category"],
                    boqType: String(item?.boqType || sourceTypeByKey.get(key) || "").trim() || undefined,
                  };
                })
              : extractedItems;

            setBoqItems(normalizedPricedItems);
          } else {
            setBoqItems(extractedItems);
          }
        } catch {
          setBoqItems(extractedItems);
        }
      }
    } catch (err) {
      console.error("Load BOQ items error:", err);
    } finally {
      setBoqLoading(false);
    }
  }

  function mergeUniqueItems(base: BasePriceItem[], incoming: BasePriceItem[]) {
    const merged = new Map<string, BasePriceItem>();
    [...base, ...incoming].forEach((item) => {
      const key = `${String(item.item || "").trim().toLowerCase()}|${String(item.uom || "").trim().toLowerCase()}`;
      merged.set(key, {
        item: String(item.item || "").trim(),
        rate: Number(item.rate || 0),
        uom: String(item.uom || "").trim(),
        category: (item.category || "Material") as BasePriceItem["category"],
        boqType: String(item.boqType || "").trim() || undefined,
      });
    });
    return Array.from(merged.values());
  }

  function handleLoadStarterTemplate() {
    if (!templateRows.length) {
      alert("Starter template is not available yet");
      return;
    }

    const allItemsToMerge = [...templateRows];
    if (boqItems.length > 0) {
      allItemsToMerge.push(...boqItems);
    }

    const merged = mergeUniqueItems(getBasePricing(), allItemsToMerge);
    saveBasePricing(merged);
    setItems(merged);
    const boqCount = boqItems.filter((item) => allItemsToMerge.includes(item)).length;
    alert(`Starter template loaded with ${templateRows.length} rows${boqCount > 0 ? ` + ${boqCount} BOQ items` : ""}. You can now edit or upload.`);
  }

  function handleDownloadTemplateCsv() {
    if (!templateCsv) {
      alert("Template CSV is not available");
      return;
    }

    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "builder-base-pricing-starter-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleAdd() {
    if (!form.item || form.rate <= 0) return;

    const normFormItem = form.item.trim().toLowerCase();
    const current = getBasePricing();
    const existingIdx = current.findIndex(
      (it) => it.item.trim().toLowerCase() === normFormItem
    );

    if (existingIdx !== -1) {
      // Update existing item's rate (and uom/category from form)
      current[existingIdx] = {
        ...current[existingIdx],
        rate: form.rate,
        uom: form.uom || current[existingIdx].uom,
        category: form.category || current[existingIdx].category,
      };
      saveBasePricing(current);
    } else {
      addBasePrice(form);
    }

    setItems(getBasePricing());
    setForm({ item: "", rate: 0, uom: "", category: "Material", boqType: "Manual" });
  }

  function handleClear() {
    clearBasePricing();
    setItems([]);
  }

  // File upload handlers
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/base-pricing/parse"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to parse file");

      const data = await response.json();
      setPreviewData(data.preview || []);
      setAvailableColumns(data.columns || []);
      setParseDiagnostics(data.diagnostics || null);

      // Auto-detect columns
      if (data.suggestedMapping) {
        setColumnMapping(data.suggestedMapping);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload file");
    }
  }

  async function handleConfirmUpload() {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("columnMapping", JSON.stringify(columnMapping));

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/base-pricing/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload base pricing");

      const result = await response.json();

      // Add imported items to local storage
      if (result.items) {
        const merged = mergeUniqueItems(getBasePricing(), result.items);
        saveBasePricing(merged);
        setItems(merged);
      }

      setLastUploadDiagnostics(result.diagnostics || null);

      // Reset upload state
      setUploadMode(false);
      setFile(null);
      setPreviewData([]);
      setColumnMapping({ item: "", rate: "", uom: "", category: "" });
      setAvailableColumns([]);
      setParseDiagnostics(null);

      const mergedCount = Number(result?.diagnostics?.duplicateMerged || 0);
      alert(`Successfully imported ${result.count} pricing items${mergedCount > 0 ? ` (${mergedCount} duplicate rows merged)` : ""}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload");
    }
  }

  function resetUpload() {
    setUploadMode(false);
    setFile(null);
    setPreviewData([]);
    setColumnMapping({ item: "", rate: "", uom: "", category: "" });
    setAvailableColumns([]);
    setParseDiagnostics(null);
  }

  function handleStartEdit(it: BasePriceItem) {
    setEditingKey({ item: it.item, uom: it.uom });
    setEditRate(it.rate);
  }

  function handleSaveEdit() {
    if (!editingKey) return;

    const current = getBasePricing();
    const idx = current.findIndex(
      (it) =>
        it.item.trim().toLowerCase() === editingKey.item.trim().toLowerCase() &&
        it.uom.trim().toLowerCase() === editingKey.uom.trim().toLowerCase()
    );

    if (idx !== -1) {
      current[idx] = { ...current[idx], rate: editRate };
      saveBasePricing(current);
      setItems([...current]);
    }

    setEditingKey(null);
  }

  function handleCancelEdit() {
    setEditingKey(null);
  }

  const groupedItems = useMemo(() => {
    const categoryOrder: BasePriceItem["category"][] = ["Material", "Labor", "Machinery", "Other"];

    const grouped = items.reduce<Record<string, BasePriceItem[]>>((acc, item) => {
      const category = item.category || "Other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});

    const orderedCategories = [
      ...categoryOrder.filter((category) => grouped[category]?.length),
      ...Object.keys(grouped)
        .filter((category) => !categoryOrder.includes(category as BasePriceItem["category"]))
        .sort((a, b) => a.localeCompare(b)),
    ];

    return orderedCategories.map((category) => ({
      category,
      items: [...grouped[category]].sort((a, b) => a.item.localeCompare(b.item)),
    }));
  }, [items]);

  const compactTableStyle = {
    ...pageStyles.table,
    tableLayout: "fixed" as const,
  };

  const compactHeaderStyle = {
    ...pageStyles.th,
    textAlign: "center" as const,
    padding: "7px 10px",
    fontSize: "12px",
    color: "#243b53",
    backgroundColor: "#f8fafc",
  };

  const compactCellStyle = {
    ...pageStyles.td,
    textAlign: "center" as const,
    padding: "6px 10px",
    fontSize: "13px",
    lineHeight: 1.3,
  };

  const groupHeaderCellStyle = {
    ...compactCellStyle,
    background: "#eef3f7",
    color: "#243b53",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    borderTop: "1px solid var(--border)",
  };

  const parseTotalRows = Number(parseDiagnostics?.totalRows || 0);
  const parseWarnings = Number(parseDiagnostics?.missingItemRows || 0) + Number(parseDiagnostics?.missingRateRows || 0) + Number(parseDiagnostics?.zeroOrNegativeRateRows || 0);
  const parseValidated = Math.max(0, parseTotalRows - parseWarnings);

  const shellStyle = {
    ...pageStyles.card,
    padding: 0,
    gap: 0,
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    overflow: "hidden",
  };

  const heroStyle = {
    padding: "0.95rem 1.35rem 0.55rem",
    borderBottom: "1px solid #dbe3ec",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap" as const,
  };

  const insightsBandStyle = {
    background: "linear-gradient(90deg, #cfe7e9 0%, #deeff1 50%, #cde5e8 100%)",
    borderTop: "1px solid #bfd4d8",
    borderBottom: "1px solid #bfd4d8",
    padding: "0.72rem 1.35rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
  };

  const panelStyle = {
    background: "#ffffff",
    border: "1px solid #d9e2ec",
    borderRadius: "10px",
    padding: "0.82rem",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
    minHeight: "250px",
  };

  const dataMetricCardStyle = {
    border: "1px solid #d9e2ec",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "0.5rem 0.6rem",
    textAlign: "center" as const,
  };

  const actionPrimaryBtnStyle = {
    ...pageStyles.primaryBtn,
    borderRadius: 8,
    height: 40,
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)",
  };

  const actionSecondaryBtnStyle = {
    ...pageStyles.secondaryBtn,
    borderRadius: 8,
    height: 40,
    border: "1px solid #9fb3c8",
    background: "#ffffff",
    color: "#243b53",
  };

  const isManualMode = !uploadMode;
  const isUploadMode = uploadMode;

  return (
    <div className="builder-theme builder-page" style={pageStyles.page}>
      <div className="builder-surface" style={shellStyle}>
        <div style={heroStyle}>
          <h2 style={{ ...pageStyles.title, margin: 0, fontSize: "clamp(27px, 3.3vw, 34px)", fontWeight: 700, color: "#102a43", letterSpacing: "-0.3px" }}>Base Pricing Management</h2>
          <div style={{ width: "340px", maxWidth: "100%", opacity: 0.34, filter: "grayscale(100%)", marginRight: "0.2rem" }}>
            <ConstructionIllustration type="tools" />
          </div>
        </div>

        <div style={insightsBandStyle}>
          <div>
            <p style={{ margin: 0, color: "#334e68", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>INSIGHTS</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              onClick={handleLoadStarterTemplate}
              disabled={templateLoading || boqLoading || templateRows.length === 0}
              style={{ ...actionPrimaryBtnStyle, background: "#0d9488", boxShadow: "0 2px 8px rgba(13, 148, 136, 0.35)" }}
            >
              Expert Pricing
            </button>
            <button onClick={handleDownloadTemplateCsv} disabled={templateLoading || !templateCsv} style={actionSecondaryBtnStyle}>
              Download CSV Template
            </button>
          </div>
        </div>

        <div style={{ padding: "0.7rem 1.35rem 0" }}>
          <div
            className="bp-segmented"
            style={{
              width: "fit-content",
              margin: "0 auto",
              border: "1px solid #bcccdc",
              borderRadius: 999,
              background: "#f8fafc",
              padding: 4,
              display: "flex",
              gap: 4,
            }}
          >
            <button
              onClick={() => setUploadMode(false)}
              style={{
                minWidth: 134,
                height: 36,
                borderRadius: 999,
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                color: uploadMode ? "#334e68" : "#ffffff",
                background: uploadMode ? "transparent" : "#0f9ea8",
                boxShadow: uploadMode ? "none" : "0 2px 6px rgba(15, 118, 110, 0.28)",
              }}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setUploadMode(true)}
              style={{
                minWidth: 134,
                height: 36,
                borderRadius: 999,
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                color: uploadMode ? "#ffffff" : "#334e68",
                background: uploadMode ? "#0f9ea8" : "transparent",
                boxShadow: uploadMode ? "0 2px 6px rgba(15, 118, 110, 0.28)" : "none",
              }}
            >
              File Upload
            </button>
          </div>
        </div>

        <div className="bp-work-grid" style={{ padding: "0.78rem 1.35rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <div style={{ ...panelStyle, opacity: uploadMode ? 0.64 : 1 }}>
            <h3 style={{ margin: "0 0 0.55rem 0", fontSize: "1.05rem", color: "#102a43", fontWeight: 700 }}>Manual Entry Form</h3>
            <div style={pageStyles.formGrid}>
              <input
                placeholder="Item name"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                style={pageStyles.input}
                disabled={!isManualMode}
              />

              <input
                type="number"
                placeholder="Rate"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
                style={pageStyles.input}
                disabled={!isManualMode}
              />

              <input
                placeholder="UOM"
                value={form.uom}
                onChange={(e) => setForm({ ...form, uom: e.target.value })}
                style={pageStyles.input}
                disabled={!isManualMode}
              />

              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as BasePriceItem["category"] })
                }
                style={pageStyles.select}
                disabled={!isManualMode}
              >
                <option>Material</option>
                <option>Labor</option>
                <option>Machinery</option>
                <option>Other</option>
              </select>

              <button
                onClick={handleAdd}
                disabled={!isManualMode}
                style={{
                  ...actionPrimaryBtnStyle,
                  background: "linear-gradient(90deg, #118a91 0%, #0f766e 100%)",
                  ...(!isManualMode ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}
              >
                Add Item
              </button>
            </div>
          </div>

          <div style={{ ...panelStyle, opacity: uploadMode ? 1 : 0.64 }}>
            <h3 style={{ margin: "0 0 0.55rem 0", fontSize: "1.05rem", color: "#102a43", fontWeight: 700 }}>Upload Area</h3>

            <label style={{ display: "block", marginBottom: "0.45rem", color: "#334e68", fontWeight: 600, fontSize: 14 }}>
              Pick file here
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={pageStyles.input}
              disabled={!isUploadMode}
            />

            {file && (
              <>
                <p style={{ margin: "0.5rem 0 0", color: "#486581", fontSize: 12, fontWeight: 700, letterSpacing: "0.03em" }}>Column Mapping</p>
                <div style={{ ...pageStyles.formGrid, marginTop: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <select
                    value={columnMapping.item}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, item: e.target.value })
                    }
                    style={pageStyles.select}
                    disabled={!isUploadMode}
                  >
                    <option value="">Item Column</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <select
                    value={columnMapping.rate}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, rate: e.target.value })
                    }
                    style={pageStyles.select}
                    disabled={!isUploadMode}
                  >
                    <option value="">Rate Column</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <select
                    value={columnMapping.uom}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, uom: e.target.value })
                    }
                    style={pageStyles.select}
                    disabled={!isUploadMode}
                  >
                    <option value="">UOM Column</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <select
                    value={columnMapping.category}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, category: e.target.value })
                    }
                    style={pageStyles.select}
                    disabled={!isUploadMode}
                  >
                    <option value="">Override Mapping</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="bp-metrics-grid" style={{ marginTop: "0.7rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
              <div style={dataMetricCardStyle}>
                <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>Total Rows</p>
                <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#227c9d", lineHeight: 1 }}>{parseTotalRows}</p>
              </div>
              <div style={dataMetricCardStyle}>
                <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>Validated</p>
                <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#2f855a", lineHeight: 1 }}>{parseValidated}</p>
              </div>
              <div style={dataMetricCardStyle}>
                <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>Warnings</p>
                <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#b7791f", lineHeight: 1 }}>{parseWarnings}</p>
              </div>
            </div>

            {file && (
              <div style={{ display: "flex", gap: "0.7rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={handleConfirmUpload}
                  disabled={!isUploadMode || !columnMapping.item || !columnMapping.rate}
                  style={{
                    ...actionPrimaryBtnStyle,
                    ...((!isUploadMode || !columnMapping.item || !columnMapping.rate) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}
                >
                  Confirm & Upload
                </button>
                <button
                  onClick={resetUpload}
                  disabled={!isUploadMode}
                  style={{
                    ...actionSecondaryBtnStyle,
                    ...(!isUploadMode ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {file && previewData.length > 0 && (
          <div style={{ padding: "0 1.35rem" }}>
            <h3 style={{ ...pageStyles.subtitle, marginTop: "0.2rem", color: "#243b53", fontWeight: 700 }}>Preview (First 15 Rows)</h3>
            <TableWrapper>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    {availableColumns.map((col) => (
                      <th key={col} style={pageStyles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 15).map((row, idx) => (
                    <tr key={idx} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                      {availableColumns.map((col) => (
                        <td key={col} style={pageStyles.td}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>

            {parseDiagnostics && (
              <div
                style={{
                  marginTop: "0.5rem",
                  border: "1px solid #d9e2ec",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  padding: "0.75rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "0.5rem",
                  color: "#334155",
                  fontSize: "0.9rem",
                }}
              >
                <div>Detected header row: {parseDiagnostics.detectedHeaderRow || "-"}</div>
                <div>Total parsed rows: {parseDiagnostics.totalRows || 0}</div>
                <div>Missing item rows: {parseDiagnostics.missingItemRows || 0}</div>
                <div>Missing rate rows: {parseDiagnostics.missingRateRows || 0}</div>
                <div>Zero/negative rate rows: {parseDiagnostics.zeroOrNegativeRateRows || 0}</div>
              </div>
            )}
          </div>
        )}

        {lastUploadDiagnostics && (
          <div
            style={{
              margin: "0.85rem 1.35rem 0",
              border: "1px solid #d9e2ec",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              padding: "0.75rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.5rem",
              color: "#334155",
              fontSize: "0.9rem",
            }}
          >
            <div>Rows scanned: {lastUploadDiagnostics.totalRows || 0}</div>
            <div>Rows imported: {lastUploadDiagnostics.importedRows || 0}</div>
            <div>Invalid rows skipped: {lastUploadDiagnostics.invalidRows || 0}</div>
            <div>Missing item rows: {lastUploadDiagnostics.missingItemRows || 0}</div>
            <div>Missing rate rows: {lastUploadDiagnostics.missingRateRows || 0}</div>
            <div>Zero/negative rate rows: {lastUploadDiagnostics.zeroOrNegativeRateRows || 0}</div>
            <div>Duplicates merged: {lastUploadDiagnostics.duplicateMerged || 0}</div>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ padding: "0 1.35rem 1.2rem" }}>
            <h3 style={{ margin: "1rem 0 0.45rem", color: "#102a43", fontSize: "1.08rem", fontWeight: 700 }}>Current Base Pricing</h3>
            <TableWrapper className="bp-pricing-table-wrap">
              <table style={compactTableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...compactHeaderStyle, width: "35%" }}>Item Name</th>
                    <th style={{ ...compactHeaderStyle, width: "11%" }}>UOM</th>
                    <th className="amount-header" style={{ ...compactHeaderStyle, width: "14%" }}>Base Rate</th>
                    <th className="amount-header" style={{ ...compactHeaderStyle, width: "14%" }}>Override Rate</th>
                    <th style={{ ...compactHeaderStyle, width: "12%" }}>Type</th>
                    <th style={{ ...compactHeaderStyle, width: "14%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((group) => (
                    <Fragment key={`${group.category}-group`}>
                      <tr style={pageStyles.rowEven}>
                        <td className="bp-category-sticky" style={groupHeaderCellStyle} colSpan={6}>
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((it, idx) => (
                        <tr
                          key={`${group.category}-${it.item}-${it.uom}-${idx}`}
                          style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                        >
                          <td style={{ ...compactCellStyle, textAlign: "left", fontWeight: 500 }}>{it.item}</td>
                          <td style={compactCellStyle}>{it.uom}</td>
                          <td className="amount-cell" style={compactCellStyle}>{it.rate}</td>
                          <td className="amount-cell" style={compactCellStyle}>
                            {editingKey?.item === it.item && editingKey?.uom === it.uom ? (
                              <input
                                type="number"
                                value={editRate}
                                onChange={(e) => setEditRate(Number(e.target.value))}
                                style={{ ...pageStyles.input, width: "100%", maxWidth: "110px", margin: "0 auto", padding: "6px 8px", textAlign: "right", borderColor: "#0f766e" }}
                                autoFocus
                              />
                            ) : (
                              it.rate
                            )}
                          </td>
                          <td style={compactCellStyle}>{it.boqType || "-"}</td>
                          <td style={{ ...compactCellStyle, whiteSpace: "nowrap" }}>
                            {editingKey?.item === it.item && editingKey?.uom === it.uom ? (
                              <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                                <button
                                  onClick={handleSaveEdit}
                                  style={{ ...actionPrimaryBtnStyle, padding: "4px 10px", fontSize: 13, height: 32 }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  style={{ ...actionSecondaryBtnStyle, padding: "4px 10px", fontSize: 13, height: 32 }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(it)}
                                style={{ ...actionSecondaryBtnStyle, padding: "4px 10px", fontSize: 13, height: 32 }}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableWrapper>

            <button onClick={handleClear} style={actionSecondaryBtnStyle}>
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
