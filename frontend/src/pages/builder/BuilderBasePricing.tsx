import { useEffect, useState } from "react";
import {
  type BasePriceItem,
  getBasePricing,
  addBasePrice,
  clearBasePricing,
} from "../../services/basePricingStore";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import TableWrapper from "../../components/TableWrapper";
import { apiUrl } from "../../services/api";

interface ColumnMapping {
  item: string;
  rate: string;
  uom: string;
  category: string;
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

  useEffect(() => {
    setItems(getBasePricing());
  }, []);

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
        result.items.forEach((item: BasePriceItem) => addBasePrice(item));
        setItems(getBasePricing());
      }

      // Reset upload state
      setUploadMode(false);
      setFile(null);
      setPreviewData([]);
      setColumnMapping({ item: "", rate: "", uom: "", category: "" });
      setAvailableColumns([]);

      alert(`Successfully imported ${result.count} pricing items`);
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
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(900px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <h2 style={pageStyles.title}>Builder Base Pricing</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="tools" />
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
                  Expected columns: Item Name, Rate, UOM, Category (Material/Labor/Machinery/Other)
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
                    <h3 style={{ ...pageStyles.subtitle, marginTop: "2rem" }}>Preview (First 5 Rows)</h3>
                    <TableWrapper>
                      <table style={pageStyles.table}>
                        <thead>
                          <tr>
                            {availableColumns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 5).map((row, idx) => (
                            <tr key={idx}>
                              {availableColumns.map((col) => (
                                <td key={col}>{row[col]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrapper>
                  </>
                )}

                <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={!columnMapping.item || !columnMapping.rate || !columnMapping.uom}
                    style={{
                      ...pageStyles.primaryBtn,
                      ...((!columnMapping.item || !columnMapping.rate || !columnMapping.uom) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
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

        {/* Items Table */}
        {items.length > 0 && (
          <>
            <h3 style={{ ...pageStyles.subtitle, marginTop: "3rem" }}>Current Base Pricing</h3>
            <TableWrapper>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Rate</th>
                    <th>UOM</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.item}</td>
                      <td>{it.rate}</td>
                      <td>{it.uom}</td>
                      <td>{it.category}</td>
                    </tr>
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
