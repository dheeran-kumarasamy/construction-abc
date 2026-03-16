import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import * as api from "./estimation.api";
import type { RateTemplate, Resource } from "./types";

const CATEGORIES = [
  "Earthwork", "Concrete", "Brickwork", "Plastering", "Flooring",
  "Painting", "Steelwork", "Formwork", "Woodwork", "Waterproofing",
  "Plumbing", "Roofing", "Demolition", "Other",
];

export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [selected, setSelected] = useState<RateTemplate | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterCat, setFilterCat] = useState("");
  const [search, setSearch] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    code: "", name: "", category: "Concrete", unit: "cum",
    overhead_percent: 15, profit_percent: 15, gst_percent: 18,
  });

  // Line item form
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({
    resource_id: "", coefficient: 1, wastage_percent: 0, remarks: "",
  });
  const [resourceSearch, setResourceSearch] = useState("");

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.fetchTemplates({ category: filterCat || undefined, search: search || undefined });
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, [filterCat, search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTemplates();
      const res = await api.fetchResources();
      setResources(res);
      setLoading(false);
    })();
  }, [loadTemplates]);

  useEffect(() => {
    if (!showCreate && !showAddLine) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showAddLine) {
        setShowAddLine(false);
        setResourceSearch("");
        return;
      }
      if (showCreate) {
        setShowCreate(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreate, showAddLine]);

  async function handleSelect(t: RateTemplate) {
    try {
      const detail = await api.fetchTemplateDetail(t.id);
      setSelected(detail);
    } catch (err) {
      console.error("Failed to load template:", err);
    }
  }

  async function handleCreate() {
    try {
      const created = await api.createTemplate(newTemplate);
      setShowCreate(false);
      setNewTemplate({ code: "", name: "", category: "Concrete", unit: "cum", overhead_percent: 15, profit_percent: 15, gst_percent: 18 });
      await loadTemplates();
      handleSelect(created);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpdateField(field: string, value: any) {
    if (!selected) return;
    try {
      await api.updateTemplate(selected.id, { [field]: value });
      setSelected({ ...selected, [field]: value });
      loadTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!selected || !confirm(`Delete template "${selected.name}"?`)) return;
    try {
      await api.deleteTemplate(selected.id);
      setSelected(null);
      loadTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAddLineItem() {
    if (!selected || !newLine.resource_id) return;
    try {
      await api.addLineItem(selected.id, {
        resource_id: newLine.resource_id,
        coefficient: newLine.coefficient,
        wastage_percent: newLine.wastage_percent,
        remarks: newLine.remarks || undefined,
      });
      setShowAddLine(false);
      setNewLine({ resource_id: "", coefficient: 1, wastage_percent: 0, remarks: "" });
      setResourceSearch("");
      const detail = await api.fetchTemplateDetail(selected.id);
      setSelected(detail);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpdateLineItem(lineId: string, field: string, value: any) {
    if (!selected) return;
    try {
      await api.updateLineItem(lineId, { [field]: value });
      const detail = await api.fetchTemplateDetail(selected.id);
      setSelected(detail);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteLineItem(lineId: string) {
    if (!selected) return;
    try {
      await api.deleteLineItem(lineId);
      const detail = await api.fetchTemplateDetail(selected.id);
      setSelected(detail);
    } catch (err: any) {
      alert(err.message);
    }
  }

  const filteredResources = resources.filter((r) => {
    if (!resourceSearch) return true;
    const q = resourceSearch.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.unique_code.toLowerCase().includes(q);
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  if (loading) return <div style={pageStyles.page}><p>Loading templates...</p></div>;

  return (
    <div style={pageStyles.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ ...pageStyles.title, margin: 0 }}>Template Editor</h1>
          <p style={{ ...pageStyles.subtitle, margin: "4px 0 0" }}>Manage rate analysis templates & line items</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={pageStyles.primaryBtn} onClick={() => setShowCreate(true)}>
            + New Template
          </button>
          <button style={pageStyles.secondaryBtn} onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 180px)" }}>
        {/* Left: Template list */}
        <div style={{ ...pageStyles.card, flex: "0 0 360px", overflow: "auto", padding: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              style={{ ...pageStyles.input, marginBottom: 8, fontSize: 13 }}
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <button
                style={{
                  ...pageStyles.secondaryBtn,
                  fontSize: 11,
                  padding: "2px 8px",
                  ...(filterCat === "" ? { background: "var(--accent)", color: "#fff" } : {}),
                }}
                onClick={() => setFilterCat("")}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  style={{
                    ...pageStyles.secondaryBtn,
                    fontSize: 11,
                    padding: "2px 8px",
                    ...(filterCat === c ? { background: "var(--accent)", color: "#fff" } : {}),
                  }}
                  onClick={() => setFilterCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => handleSelect(t)}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: selected?.id === t.id ? "var(--accent)" : "transparent",
                color: selected?.id === t.id ? "#fff" : "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.code}</div>
              <div style={{ fontSize: 12 }}>{t.name}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {t.category} · {t.unit} {t.is_system ? " · System" : ""}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No templates found</p>
          )}
        </div>

        {/* Right: Template detail/editor */}
        <div style={{ ...pageStyles.card, flex: 1, overflow: "auto", padding: 0 }}>
          {!selected ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              Select a template from the list to view and edit
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              {/* Template header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{selected.code} — {selected.name}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    {selected.category} · {selected.unit}
                    {selected.is_system && <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 6px", fontSize: 11 }}>System</span>}
                  </p>
                </div>
                {!selected.is_system && (
                  <button
                    style={{ ...pageStyles.secondaryBtn, color: "#dc2626", borderColor: "#dc2626", fontSize: 12 }}
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Editable fields */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ ...pageStyles.field, flex: "1 1 200px" }}>
                  <label style={{ ...pageStyles.label, fontSize: 11 }}>Name</label>
                  <input
                    style={{ ...pageStyles.input, fontSize: 13 }}
                    value={selected.name}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                    onBlur={(e) => handleUpdateField("name", e.target.value)}
                  />
                </div>
                <div style={{ ...pageStyles.field, flex: "0 0 100px" }}>
                  <label style={{ ...pageStyles.label, fontSize: 11 }}>Overhead %</label>
                  <input
                    type="number"
                    style={{ ...pageStyles.input, fontSize: 13 }}
                    value={selected.overhead_percent}
                    onChange={(e) => setSelected({ ...selected, overhead_percent: Number(e.target.value) })}
                    onBlur={(e) => handleUpdateField("overhead_percent", Number(e.target.value))}
                  />
                </div>
                <div style={{ ...pageStyles.field, flex: "0 0 100px" }}>
                  <label style={{ ...pageStyles.label, fontSize: 11 }}>Profit %</label>
                  <input
                    type="number"
                    style={{ ...pageStyles.input, fontSize: 13 }}
                    value={selected.profit_percent}
                    onChange={(e) => setSelected({ ...selected, profit_percent: Number(e.target.value) })}
                    onBlur={(e) => handleUpdateField("profit_percent", Number(e.target.value))}
                  />
                </div>
                <div style={{ ...pageStyles.field, flex: "0 0 100px" }}>
                  <label style={{ ...pageStyles.label, fontSize: 11 }}>GST %</label>
                  <input
                    type="number"
                    style={{ ...pageStyles.input, fontSize: 13 }}
                    value={selected.gst_percent}
                    onChange={(e) => setSelected({ ...selected, gst_percent: Number(e.target.value) })}
                    onBlur={(e) => handleUpdateField("gst_percent", Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Line items */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Line Items ({selected.line_items?.length || 0})</h3>
                <button
                  style={{ ...pageStyles.primaryBtn, fontSize: 12, padding: "4px 12px" }}
                  onClick={() => setShowAddLine(true)}
                >
                  + Add Resource
                </button>
              </div>

              <table style={{ ...pageStyles.table, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>#</th>
                    <th style={pageStyles.th}>Code</th>
                    <th style={pageStyles.th}>Resource</th>
                    <th style={pageStyles.th}>Type</th>
                    <th style={pageStyles.th}>Coeff</th>
                    <th style={pageStyles.th}>Wastage %</th>
                    <th style={pageStyles.th}>Rate</th>
                    <th style={pageStyles.th}>Amount</th>
                    <th style={pageStyles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.line_items || []).map((li, idx) => (
                    <tr key={li.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                      <td style={pageStyles.td}>{idx + 1}</td>
                      <td style={pageStyles.td}>{li.resource?.unique_code || "—"}</td>
                      <td style={pageStyles.td}>{li.resource?.name || li.description || "Sub-template"}</td>
                      <td style={pageStyles.td}>
                        <span style={{
                          display: "inline-block",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          background: li.resource?.type === "material" ? "#dbeafe" : li.resource?.type === "labour" ? "#dcfce7" : "#fef3c7",
                          color: li.resource?.type === "material" ? "#1d4ed8" : li.resource?.type === "labour" ? "#166534" : "#92400e",
                        }}>
                          {li.resource?.type || "ref"}
                        </span>
                      </td>
                      <td style={pageStyles.td}>
                        <input
                          type="number"
                          step="0.001"
                          style={{ ...pageStyles.input, width: 70, padding: 4, fontSize: 12, textAlign: "right" as const }}
                          value={li.coefficient}
                          onChange={(e) => {
                            const updated = { ...selected, line_items: selected.line_items?.map(l => l.id === li.id ? { ...l, coefficient: Number(e.target.value) } : l) };
                            setSelected(updated);
                          }}
                          onBlur={(e) => handleUpdateLineItem(li.id, "coefficient", Number(e.target.value))}
                        />
                      </td>
                      <td style={pageStyles.td}>
                        <input
                          type="number"
                          step="0.1"
                          style={{ ...pageStyles.input, width: 60, padding: 4, fontSize: 12, textAlign: "right" as const }}
                          value={li.wastage_override ?? 0}
                          onChange={(e) => {
                            const updated = { ...selected, line_items: selected.line_items?.map(l => l.id === li.id ? { ...l, wastage_override: Number(e.target.value) } : l) };
                            setSelected(updated);
                          }}
                          onBlur={(e) => handleUpdateLineItem(li.id, "wastage_percent", Number(e.target.value))}
                        />
                      </td>
                      <td style={pageStyles.td}>{li.resource ? fmt(li.resource.basic_rate) : "—"}</td>
                      <td style={pageStyles.td}>
                        {li.resource ? fmt(li.coefficient * li.resource.basic_rate * (1 + (li.wastage_override || 0) / 100)) : "—"}
                      </td>
                      <td style={pageStyles.td}>
                        <button
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}
                          title="Remove"
                          onClick={() => handleDeleteLineItem(li.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(selected.line_items || []).length > 0 && (
                <div style={{ marginTop: 12, textAlign: "right", fontSize: 14, fontWeight: 600 }}>
                  Estimated Direct Cost:{" "}
                  {fmt(
                    (selected.line_items || []).reduce((sum, li) => {
                      if (!li.resource) return sum;
                      return sum + li.coefficient * li.resource.basic_rate * (1 + (li.wastage_override || 0) / 100);
                    }, 0)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={{ ...pageStyles.card, width: 480, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 16px" }}>
              <h3 style={{ margin: 0 }}>New Template</h3>
              <button
                type="button"
                aria-label="Close new template modal"
                onClick={() => setShowCreate(false)}
                style={{
                  ...pageStyles.secondaryBtn,
                  minWidth: 34,
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 999,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ ...pageStyles.field, flex: "0 0 120px" }}>
                <label style={pageStyles.label}>Code</label>
                <input style={pageStyles.input} value={newTemplate.code} onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value })} placeholder="RA-XX-001" />
              </div>
              <div style={{ ...pageStyles.field, flex: "1 1 200px" }}>
                <label style={pageStyles.label}>Name</label>
                <input style={pageStyles.input} value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} />
              </div>
              <div style={{ ...pageStyles.field, flex: "0 0 140px" }}>
                <label style={pageStyles.label}>Category</label>
                <select style={pageStyles.select} value={newTemplate.category} onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ ...pageStyles.field, flex: "0 0 80px" }}>
                <label style={pageStyles.label}>Unit</label>
                <input style={pageStyles.input} value={newTemplate.unit} onChange={(e) => setNewTemplate({ ...newTemplate, unit: e.target.value })} />
              </div>
              <div style={{ ...pageStyles.field, flex: "0 0 90px" }}>
                <label style={pageStyles.label}>Overhead %</label>
                <input type="number" style={pageStyles.input} value={newTemplate.overhead_percent} onChange={(e) => setNewTemplate({ ...newTemplate, overhead_percent: Number(e.target.value) })} />
              </div>
              <div style={{ ...pageStyles.field, flex: "0 0 90px" }}>
                <label style={pageStyles.label}>Profit %</label>
                <input type="number" style={pageStyles.input} value={newTemplate.profit_percent} onChange={(e) => setNewTemplate({ ...newTemplate, profit_percent: Number(e.target.value) })} />
              </div>
              <div style={{ ...pageStyles.field, flex: "0 0 90px" }}>
                <label style={pageStyles.label}>GST %</label>
                <input type="number" style={pageStyles.input} value={newTemplate.gst_percent} onChange={(e) => setNewTemplate({ ...newTemplate, gst_percent: Number(e.target.value) })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button style={pageStyles.secondaryBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                style={pageStyles.primaryBtn}
                onClick={handleCreate}
                disabled={!newTemplate.code || !newTemplate.name}
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Line Item Modal */}
      {showAddLine && selected && (
        <div style={modalOverlay} onClick={() => { setShowAddLine(false); setResourceSearch(""); }}>
          <div style={{ ...pageStyles.card, width: 520, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px" }}>
              <h3 style={{ margin: 0 }}>Add Resource to {selected.code}</h3>
              <button
                type="button"
                aria-label="Close add line item modal"
                onClick={() => { setShowAddLine(false); setResourceSearch(""); }}
                style={{
                  ...pageStyles.secondaryBtn,
                  minWidth: 34,
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 999,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <input
              style={{ ...pageStyles.input, marginBottom: 8 }}
              placeholder="Search resources..."
              value={resourceSearch}
              onChange={(e) => setResourceSearch(e.target.value)}
            />
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 12 }}>
              {filteredResources.slice(0, 50).map((r) => (
                <div
                  key={r.id}
                  onClick={() => setNewLine({ ...newLine, resource_id: r.id })}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: newLine.resource_id === r.id ? "var(--accent)" : "transparent",
                    color: newLine.resource_id === r.id ? "#fff" : "inherit",
                    fontSize: 13,
                  }}
                >
                  <strong>{r.unique_code}</strong> — {r.name}
                  <span style={{ float: "right", fontSize: 11, opacity: 0.7 }}>{r.type} · {r.unit} · {fmt(r.basic_rate)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Coefficient</label>
                <input type="number" step="0.001" style={pageStyles.input} value={newLine.coefficient} onChange={(e) => setNewLine({ ...newLine, coefficient: Number(e.target.value) })} />
              </div>
              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Wastage %</label>
                <input type="number" step="0.1" style={pageStyles.input} value={newLine.wastage_percent} onChange={(e) => setNewLine({ ...newLine, wastage_percent: Number(e.target.value) })} />
              </div>
              <div style={{ ...pageStyles.field, flex: 2 }}>
                <label style={pageStyles.label}>Remarks</label>
                <input style={pageStyles.input} value={newLine.remarks} onChange={(e) => setNewLine({ ...newLine, remarks: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button style={pageStyles.secondaryBtn} onClick={() => { setShowAddLine(false); setResourceSearch(""); }}>Cancel</button>
              <button
                style={pageStyles.primaryBtn}
                onClick={handleAddLineItem}
                disabled={!newLine.resource_id}
              >
                Add Line Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
