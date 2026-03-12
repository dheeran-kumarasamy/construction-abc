import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import * as api from "./estimation.api";
import type { BOQProject, BOQSection, BOQItem, RateTemplate, LocationZone, RateComputationResult } from "./types";
import RateAnalysisPanel from "./components/RateAnalysisPanel";
import TemplateSelector from "./components/TemplateSelector";
import PlinthAreaValidator from "./components/PlinthAreaValidator";

const FLOATING_PANEL_WIDTH = 420;
const FLOATING_PANEL_GAP = 24;

export default function BOQWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<BOQProject | null>(null);
  const [sections, setSections] = useState<BOQSection[]>([]);
  const [items, setItems] = useState<BOQItem[]>([]);
  const [zones, setZones] = useState<LocationZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // UI state
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [addingItemToSection, setAddingItemToSection] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BOQItem | null>(null);
  const [rateResult, setRateResult] = useState<RateComputationResult | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null); // item id
  const [isDesktopWide, setIsDesktopWide] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1200 : false
  );

  useEffect(() => {
    const onResize = () => setIsDesktopWide(window.innerWidth >= 1200);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [proj, secs, itms, zns] = await Promise.all([
        api.fetchProject(projectId),
        api.fetchSections(projectId),
        api.fetchItems(projectId),
        api.fetchLocationZones(),
      ]);
      setProject(proj);
      setSections(secs);
      setItems(itms);
      setZones(zns);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddSection() {
    if (!newSectionName.trim() || !projectId) return;
    try {
      const section = await api.createSection(projectId, { name: newSectionName, sort_order: sections.length });
      setSections((prev) => [...prev, section]);
      setNewSectionName("");
      setShowAddSection(false);
    } catch (err) {
      console.error("Failed to create section:", err);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Delete this section and all its items?")) return;
    try {
      await api.deleteSection(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setItems((prev) => prev.filter((i) => i.section_id !== sectionId));
    } catch (err) {
      console.error("Failed to delete section:", err);
    }
  }

  async function handleAddItem(sectionId: string, data: { description: string; quantity: number; unit: string }) {
    if (!projectId) return;
    try {
      const itemNumber = `${sections.findIndex((s) => s.id === sectionId) + 1}.${items.filter((i) => i.section_id === sectionId).length + 1}`;
      const item = await api.createItem({
        section_id: sectionId,
        project_id: projectId,
        item_number: itemNumber,
        description: data.description,
        quantity: data.quantity,
        unit: data.unit,
      });
      setItems((prev) => [...prev, item]);
      setAddingItemToSection(null);
    } catch (err) {
      console.error("Failed to create item:", err);
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await api.deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      if (selectedItem?.id === itemId) setSelectedItem(null);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  }

  async function handleAssignTemplate(itemId: string, template: RateTemplate) {
    try {
      const updated = await api.updateItem(itemId, { template_id: template.id });
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updated, template_code: template.code, template_name: template.name } : i)));
      setShowTemplateSelector(null);
    } catch (err) {
      console.error("Failed to assign template:", err);
    }
  }

  async function handleComputeAll() {
    if (!projectId) return;
    try {
      setComputing(true);
      await api.computeAllItems(projectId);
      // Reload items to get updated rates
      const updatedItems = await api.fetchItems(projectId);
      setItems(updatedItems);
    } catch (err) {
      console.error("Compute all failed:", err);
    } finally {
      setComputing(false);
    }
  }

  async function handleExport() {
    if (!projectId) return;
    try {
      setExporting(true);
      await api.exportProjectExcel(projectId);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function handleViewRate(item: BOQItem) {
    if (!item.template_id) return;
    setSelectedItem(item);
    try {
      const result = await api.computeRate({
        template_id: item.template_id,
        location_zone_id: project?.location_zone_id || undefined,
        conveyance_distance_km: project?.default_conveyance_distance_km || undefined,
        terrain: project?.terrain || "plains",
        floor_level: item.floor_level || undefined,
        height_above_gl: item.height_above_gl || undefined,
        depth_below_gl: item.depth_below_gl || undefined,
      });
      setRateResult(result);
    } catch (err) {
      console.error("Rate computation failed:", err);
    }
  }

  async function handleUpdateProject(data: Partial<BOQProject>) {
    if (!projectId) return;
    try {
      const updated = await api.updateProject(projectId, data);
      setProject(updated);
    } catch (err) {
      console.error("Failed to update project:", err);
    }
  }

  const fmt = (n?: number) =>
    n != null ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";

  const grandTotal = items.reduce((sum, i) => sum + (Number(i.computed_amount) || 0), 0);
  const isRatePanelOpen = Boolean(rateResult || showTemplateSelector);

  if (loading) {
    return (
      <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 32 }}>
        <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 32 }}>
        <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
          <p style={{ textAlign: "center", color: "#dc2626", padding: 40 }}>Project not found</p>
          <button style={pageStyles.primaryBtn} onClick={() => navigate("/estimation")}>Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 24 }}>
      <div style={{ display: "flex", gap: 20, width: "min(1400px, 100%)", flexWrap: "wrap" }}>
        {/* Left: BOQ Table */}
        <div
          style={{
            ...pageStyles.card,
            flex: "1 1 700px",
            minWidth: 0,
            marginRight: isDesktopWide && isRatePanelOpen ? `${FLOATING_PANEL_WIDTH + FLOATING_PANEL_GAP}px` : 0,
          }}
        >
          {/* Header */}
          <div style={pageStyles.header}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <button style={{ ...pageStyles.secondaryBtn, height: 32, padding: "0 10px", fontSize: 13 }} onClick={() => navigate("/estimation")}>← Back</button>
                <h1 style={{ ...pageStyles.title, fontSize: 22 }}>{project.name}</h1>
              </div>
              {project.client_name && <p style={{ ...pageStyles.subtitle, margin: 0 }}>{project.client_name} — {project.project_location || "No location"}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ ...pageStyles.meta, fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                Grand Total: {fmt(grandTotal)}
              </span>
            </div>
          </div>

          {/* Project Settings Row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ ...pageStyles.field, flex: "1 1 180px" }}>
              <label style={{ ...pageStyles.label, fontSize: 12 }}>Location Zone</label>
              <select
                style={{ ...pageStyles.select, height: 36, fontSize: 13 }}
                value={project.location_zone_id || ""}
                onChange={(e) => handleUpdateProject({ location_zone_id: e.target.value || undefined } as any)}
              >
                <option value="">Normal / No extras</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.zone_name} ({z.zone_type})</option>
                ))}
              </select>
            </div>
            <div style={{ ...pageStyles.field, flex: "0 0 120px" }}>
              <label style={{ ...pageStyles.label, fontSize: 12 }}>Conveyance (km)</label>
              <input
                type="number"
                style={{ ...pageStyles.input, height: 36, fontSize: 13 }}
                value={project.default_conveyance_distance_km || ""}
                onChange={(e) => handleUpdateProject({ default_conveyance_distance_km: Number(e.target.value) || undefined } as any)}
                placeholder="0"
              />
            </div>
            <div style={{ ...pageStyles.field, flex: "0 0 100px" }}>
              <label style={{ ...pageStyles.label, fontSize: 12 }}>Terrain</label>
              <select
                style={{ ...pageStyles.select, height: 36, fontSize: 13 }}
                value={project.terrain}
                onChange={(e) => handleUpdateProject({ terrain: e.target.value as any })}
              >
                <option value="plains">Plains</option>
                <option value="hills">Hills</option>
              </select>
            </div>
            <button
              style={{ ...pageStyles.primaryBtn, height: 36, fontSize: 13 }}
              onClick={handleComputeAll}
              disabled={computing}
            >
              {computing ? "Computing..." : "Compute All Rates"}
            </button>
            <button
              style={{ ...pageStyles.secondaryBtn, height: 36, fontSize: 13 }}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>

          {/* Sections & Items */}
          {sections.map((section, sIdx) => {
            const sectionItems = items.filter((i) => i.section_id === section.id);
            const sectionTotal = sectionItems.reduce((sum, i) => sum + (Number(i.computed_amount) || 0), 0);

            return (
              <div key={section.id} style={{ borderTop: "2px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                    {sIdx + 1}. {section.name}
                    <span style={{ marginLeft: 12, fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>
                      {sectionItems.length} items — {fmt(sectionTotal)}
                    </span>
                  </h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ ...pageStyles.secondaryBtn, height: 28, fontSize: 12, padding: "0 10px" }}
                      onClick={() => setAddingItemToSection(section.id)}
                    >
                      + Item
                    </button>
                    <button
                      style={{ ...pageStyles.secondaryBtn, height: 28, fontSize: 12, padding: "0 10px", color: "#dc2626" }}
                      onClick={() => handleDeleteSection(section.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {sectionItems.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ ...pageStyles.table, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ ...pageStyles.th, width: 50 }}>#</th>
                          <th style={pageStyles.th}>Description</th>
                          <th style={{ ...pageStyles.th, width: 80 }}>Qty</th>
                          <th style={{ ...pageStyles.th, width: 60 }}>Unit</th>
                          <th style={{ ...pageStyles.th, width: 120 }}>Template</th>
                          <th style={{ ...pageStyles.th, width: 100, textAlign: "right" }}>Rate</th>
                          <th style={{ ...pageStyles.th, width: 110, textAlign: "right" }}>Amount</th>
                          <th style={{ ...pageStyles.th, width: 100 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionItems.map((item, iIdx) => (
                          <tr key={item.id} style={iIdx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                            <td style={{ ...pageStyles.td, textAlign: "center", fontSize: 12 }}>{item.item_number || `${sIdx + 1}.${iIdx + 1}`}</td>
                            <td style={{ ...pageStyles.td, maxWidth: 280 }}>{item.description}</td>
                            <td style={{ ...pageStyles.td, textAlign: "center" }}>{item.quantity}</td>
                            <td style={{ ...pageStyles.td, textAlign: "center" }}>{item.unit}</td>
                            <td style={pageStyles.td}>
                              {item.template_code ? (
                                <span style={{ fontSize: 11, padding: "2px 6px", background: "#ccfbf1", borderRadius: 4, cursor: "pointer" }}
                                  onClick={() => setShowTemplateSelector(item.id)} title={item.template_name}>
                                  {item.template_code}
                                </span>
                              ) : (
                                <button
                                  style={{ fontSize: 11, padding: "2px 8px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 4, cursor: "pointer" }}
                                  onClick={() => setShowTemplateSelector(item.id)}
                                >
                                  Assign
                                </button>
                              )}
                            </td>
                            <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>
                              {item.computed_rate ? fmt(Number(item.computed_rate)) : "—"}
                            </td>
                            <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                              {item.computed_amount ? fmt(Number(item.computed_amount)) : "—"}
                            </td>
                            <td style={pageStyles.td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                {item.template_id && (
                                  <button style={{ fontSize: 11, padding: "2px 6px", background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 4, cursor: "pointer" }}
                                    onClick={() => handleViewRate(item)}>
                                    Rate
                                  </button>
                                )}
                                <button style={{ fontSize: 11, padding: "2px 6px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#dc2626" }}
                                  onClick={() => handleDeleteItem(item.id)}>
                                  ×
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Item Form */}
                {addingItemToSection === section.id && (
                  <AddItemForm onAdd={(data) => handleAddItem(section.id, data)} onCancel={() => setAddingItemToSection(null)} />
                )}
              </div>
            );
          })}

          {/* Add Section */}
          {showAddSection ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={{ ...pageStyles.input, flex: 1, height: 36, fontSize: 13 }}
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name (e.g. Substructure, Superstructure)"
                onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                autoFocus
              />
              <button style={{ ...pageStyles.primaryBtn, height: 36, fontSize: 13 }} onClick={handleAddSection}>Add</button>
              <button style={{ ...pageStyles.secondaryBtn, height: 36, fontSize: 13 }} onClick={() => { setShowAddSection(false); setNewSectionName(""); }}>Cancel</button>
            </div>
          ) : (
            <button style={{ ...pageStyles.secondaryBtn, width: "100%" }} onClick={() => setShowAddSection(true)}>
              + Add Section
            </button>
          )}

          {/* Plinth Area Validator */}
          {projectId && items.length > 0 && (
            <PlinthAreaValidator projectId={projectId} />
          )}
        </div>

        {/* Right: Rate Analysis Panel */}
        {(rateResult || showTemplateSelector) && (
          <div
            style={{
              ...pageStyles.card,
              ...(isDesktopWide
                ? {
                    position: "fixed" as const,
                    right: 24,
                    top: 24,
                    width: FLOATING_PANEL_WIDTH,
                    maxHeight: "calc(100vh - 48px)",
                    overflowY: "auto" as const,
                    zIndex: 70,
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
                  }
                : {
                    flex: "0 0 420px",
                    maxHeight: "90vh",
                    overflowY: "auto" as const,
                    position: "sticky" as const,
                    top: 24,
                  }),
            }}
          >
            {showTemplateSelector && (
              <TemplateSelector
                onSelect={(tmpl) => handleAssignTemplate(showTemplateSelector, tmpl)}
                onClose={() => setShowTemplateSelector(null)}
              />
            )}
            {rateResult && !showTemplateSelector && (
              <RateAnalysisPanel result={rateResult} onClose={() => { setRateResult(null); setSelectedItem(null); }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline Add Item Form ──────────────────────

function AddItemForm({ onAdd, onCancel }: { onAdd: (d: { description: string; quantity: number; unit: string }) => void; onCancel: () => void }) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Cu.m");

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
      <div style={{ ...pageStyles.field, flex: "2 1 200px" }}>
        <label style={{ ...pageStyles.label, fontSize: 12 }}>Description</label>
        <input style={{ ...pageStyles.input, height: 34, fontSize: 13 }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Item description" autoFocus />
      </div>
      <div style={{ ...pageStyles.field, flex: "0 0 80px" }}>
        <label style={{ ...pageStyles.label, fontSize: 12 }}>Qty</label>
        <input type="number" style={{ ...pageStyles.input, height: 34, fontSize: 13 }} value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div style={{ ...pageStyles.field, flex: "0 0 100px" }}>
        <label style={{ ...pageStyles.label, fontSize: 12 }}>Unit</label>
        <select style={{ ...pageStyles.select, height: 34, fontSize: 13 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {["Cu.m", "Sq.m", "Rmt", "Nos", "Tonne", "Kg", "KL", "Bag", "Day", "LS"].map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <button style={{ ...pageStyles.primaryBtn, height: 34, fontSize: 13 }} onClick={() => { if (desc.trim()) onAdd({ description: desc, quantity: Number(qty) || 1, unit }); }}>Add</button>
      <button style={{ ...pageStyles.secondaryBtn, height: 34, fontSize: 13 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}
