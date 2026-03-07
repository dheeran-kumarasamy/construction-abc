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

export default function BuilderBasePricing() {
  const [items, setItems] = useState<BasePriceItem[]>([]);

  const [form, setForm] = useState<BasePriceItem>({
    item: "",
    rate: 0,
    uom: "",
    category: "Material",
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

  useEffect(() => {
    setItems(getBasePricing());
    loadStarterTemplate();
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

  function mergeUniqueItems(base: BasePriceItem[], incoming: BasePriceItem[]) {
    const merged = new Map<string, BasePriceItem>();
    [...base, ...incoming].forEach((item) => {
      const key = `${String(item.item || "").trim().toLowerCase()}|${String(item.uom || "").trim().toLowerCase()}`;
      merged.set(key, {
        item: String(item.item || "").trim(),
        rate: Number(item.rate || 0),
        uom: String(item.uom || "").trim(),
        category: (item.category || "Material") as BasePriceItem["category"],
      });
    });
    return Array.from(merged.values());
  }

  function handleLoadStarterTemplate() {
    if (!templateRows.length) {
      alert("Starter template is not available yet");
      return;
    }

    const merged = mergeUniqueItems(getBasePricing(), templateRows);
    saveBasePricing(merged);
    setItems(merged);
    alert(`Starter template loaded with ${templateRows.length} rows. You can now edit and upload.`);
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

    addBasePrice(form);
    setItems(getBasePricing());

    setForm({ item: "", rate: 0, uom: "", category: "Material" });
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

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(900px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <h2 style={pageStyles.title}>Builder Base Pricing</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="tools" />
          </div>
        </div>

        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.9rem",
            border: "1px solid #99f6e4",
            borderRadius: "8px",
            backgroundColor: "#f0fdfa",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "#0f766e", fontWeight: 700 }}>
              Starter Template from BOQ Calculator Rates
            </p>
            <p style={{ margin: "0.35rem 0 0 0", color: "#475569", fontSize: "0.9rem" }}>
              Pre-populated with {templateRows.length} rich rate-card items from boq-base calculator. Load and edit as your starting point.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button onClick={handleLoadStarterTemplate} disabled={templateLoading || templateRows.length === 0} style={pageStyles.primaryBtn}>
              Load Starter Template
            </button>
            <button onClick={handleDownloadTemplateCsv} disabled={templateLoading || !templateCsv} style={pageStyles.secondaryBtn}>
              Download CSV Template
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setUploadMode(false)}
            style={{
              ...pageStyles.primaryBtn,
              ...(uploadMode ? { opacity: 0.6 } : {}),
            }}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setUploadMode(true)}
            style={{
              ...pageStyles.primaryBtn,
              ...(uploadMode ? {} : { opacity: 0.6 }),
            }}
          >
            Upload File
          </button>
        </div>

        {!uploadMode ? (
          <>
            {/* Manual Entry Form */}
            <div style={pageStyles.formGrid}>
              <input
                placeholder="Item name"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                style={pageStyles.input}
              />

              <input
                type="number"
                placeholder="Rate"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
                style={pageStyles.input}
              />

              <input
                placeholder="UOM (e.g., kg, m, sqft)"
                value={form.uom}
                onChange={(e) => setForm({ ...form, uom: e.target.value })}
                style={pageStyles.input}
              />

              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as BasePriceItem["category"] })
                }
                style={pageStyles.select}
              >
                <option>Material</option>
                <option>Labor</option>
                <option>Machinery</option>
                <option>Other</option>
              </select>

              <button onClick={handleAdd} style={pageStyles.primaryBtn}>
                Add
              </button>
            </div>
          </>
        ) : (
          <>
            {/* File Upload Mode */}
            {!file ? (
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "#0f766e", fontWeight: 500 }}>
                  Upload Excel/CSV File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={pageStyles.input}
                />
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                  Expected columns: Item Name, Rate, UOM (optional), Category (optional). Parser auto-detects header row and normalizes common formats.
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ ...pageStyles.subtitle, marginTop: "2rem" }}>Column Mapping</h3>
                <div style={pageStyles.formGrid}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#0f766e", fontWeight: 500 }}>
                      Item Name
                    </label>
                    <select
                      value={columnMapping.item}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, item: e.target.value })
                      }
                      style={pageStyles.select}
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#0f766e", fontWeight: 500 }}>
                      Rate
                    </label>
                    <select
                      value={columnMapping.rate}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, rate: e.target.value })
                      }
                      style={pageStyles.select}
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#0f766e", fontWeight: 500 }}>
                      UOM
                    </label>
                    <select
                      value={columnMapping.uom}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, uom: e.target.value })
                      }
                      style={pageStyles.select}
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#0f766e", fontWeight: 500 }}>
                      Category (Optional)
                    </label>
                    <select
                      value={columnMapping.category}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, category: e.target.value })
                      }
                      style={pageStyles.select}
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {previewData.length > 0 && (
                  <>
                    <h3 style={{ ...pageStyles.subtitle, marginTop: "2rem" }}>Preview (First 15 Rows)</h3>
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
                          marginTop: "0.85rem",
                          border: "1px solid #cbd5e1",
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
                  </>
                )}

                <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={!columnMapping.item || !columnMapping.rate}
                    style={{
                      ...pageStyles.primaryBtn,
                      ...((!columnMapping.item || !columnMapping.rate) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                    }}
                  >
                    Confirm & Upload
                  </button>
                  <button onClick={resetUpload} style={pageStyles.secondaryBtn}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {lastUploadDiagnostics && (
          <div
            style={{
              marginTop: "1.2rem",
              border: "1px solid #cbd5e1",
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

        {/* Items Table */}
        {items.length > 0 && (
          <>
            <h3 style={{ ...pageStyles.subtitle, marginTop: "3rem" }}>Current Base Pricing</h3>
            <TableWrapper>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Item</th>
                    <th className="amount-header" style={pageStyles.th}>Rate</th>
                    <th style={pageStyles.th}>UOM</th>
                    <th style={pageStyles.th}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((group) => (
                    <Fragment key={`${group.category}-group`}>
                      <tr style={pageStyles.rowEven}>
                        <td
                          style={{
                            ...pageStyles.td,
                            background: "var(--accentSoft)",
                            color: "var(--ink)",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.4px",
                            borderTop: "1px solid var(--border)",
                          }}
                          colSpan={4}
                        >
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((it, idx) => (
                        <tr
                          key={`${group.category}-${it.item}-${it.uom}-${idx}`}
                          style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                        >
                          <td style={pageStyles.td}>{it.item}</td>
                          <td className="amount-cell" style={pageStyles.td}>{it.rate}</td>
                          <td style={pageStyles.td}>{it.uom}</td>
                          <td style={pageStyles.td}>{it.category}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableWrapper>

            <button onClick={handleClear} style={pageStyles.secondaryBtn}>
              Clear All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
