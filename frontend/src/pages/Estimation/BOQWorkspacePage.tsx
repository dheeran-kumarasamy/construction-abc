

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import * as api from "./estimation.api";
import type { BOQProject, RateTemplate } from "./types";
import { useAuth } from "../../auth/AuthContext";


type BOQRow =
  | { template: RateTemplate; quantity: string; uom: string; rate?: number; amount?: number }
  | { customId: string; customName: string; quantity: string; uom: string; rate?: number; amount?: number };

function normalizeBoqLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapSubmittedItemsToRows(items: api.SubmittedBOQItem[], templates: RateTemplate[]): BOQRow[] {
  const templatesByName = new Map(templates.map((template) => [normalizeBoqLabel(template.name), template]));

  return items.map((item, index) => {
    const matchedTemplate = templatesByName.get(normalizeBoqLabel(item.item));
    if (matchedTemplate) {
      return {
        template: matchedTemplate,
        quantity: String(item.qty ?? ""),
        uom: item.uom || matchedTemplate.unit || "Nos",
        rate: undefined,
        amount: undefined,
      };
    }

    return {
      customId: `existing-${index}`,
      customName: item.item,
      quantity: String(item.qty ?? ""),
      uom: item.uom || "Nos",
      rate: undefined,
      amount: undefined,
    };
  });
}

function toSubmittedItem(row: BOQRow): api.SubmittedBOQItem | null {
  const quantity = String(row.quantity || "").trim();
  if (!quantity || Number.isNaN(Number(quantity))) {
    return null;
  }

  if ("customId" in row) {
    const item = String(row.customName || "").trim();
    return item ? { item, qty: quantity, uom: row.uom } : null;
  }

  return {
    item: row.template.name,
    qty: quantity,
    uom: row.uom,
  };
}




export default function BOQWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get("mode") === "view";
  const { user } = useAuth();
  const isArchitectFlow = user?.role === "architect";
  const isGenericEstimationRoute = location.pathname.startsWith("/estimation/");
  const [project, setProject] = useState<BOQProject | null>(null);
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [boqRows, setBoqRows] = useState<BOQRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [boqError, setBoqError] = useState<string>("");
  const [hasExistingBoq, setHasExistingBoq] = useState<boolean>(false);
  const [isEditingBoq, setIsEditingBoq] = useState<boolean>(!isViewMode);
  const [marketDistricts, setMarketDistricts] = useState<api.MarketDistrict[]>([]);
  const [marketCategories, setMarketCategories] = useState<api.MarketCategory[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [marketRates, setMarketRates] = useState<api.MarketPriceRow[]>([]);
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const UOM_OPTIONS = ["Cu.m", "Sq.m", "Rmt", "Nos", "Tonne", "Kg", "KL", "Bag", "Day", "LS"];
  const projectViewPath = projectId ? `/architect/project/${projectId}` : "/architect/projects";
  const showRateColumns = isEditingBoq;
  const isReadOnlyView = isViewMode && !isEditingBoq;
  const backPath = isGenericEstimationRoute
    ? "/architect"
    : isArchitectFlow
    ? projectViewPath
    : user?.role === "builder"
    ? "/builder"
    : "/estimation";

  useEffect(() => {
    setIsEditingBoq(!isViewMode);
    setEstimate(null);
  }, [isViewMode, projectId]);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      setLoading(true);
      setBoqError("");
      try {
        const [proj, tmpls] = await Promise.all([api.fetchProject(projectId), api.fetchTemplates()]);
        setProject(proj);
        setTemplates(tmpls);

        if (isViewMode) {
          const submitted = await api.fetchSubmittedBOQ(projectId);
          const submittedItems = Array.isArray(submitted.items) ? submitted.items : [];
          setHasExistingBoq(submittedItems.length > 0);
          setBoqRows(mapSubmittedItemsToRows(submittedItems, tmpls));
          if (!submittedItems.length) {
            setBoqError("No submitted BOQ is available for this project.");
          }
        } else {
          setHasExistingBoq(false);
          setBoqRows(
            tmpls.map((t) => ({
              template: t,
              quantity: "",
              uom: t.unit || UOM_OPTIONS[0],
              rate: undefined,
              amount: undefined,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load project/templates:", err);
        if (isViewMode) {
          setBoqError("Unable to load the submitted BOQ for this project.");
          setBoqRows([]);
          setHasExistingBoq(false);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, isViewMode]);

  useEffect(() => {
    if (!isArchitectFlow) {
      setMarketDistricts([]);
      setMarketCategories([]);
      setMarketRates([]);
      return;
    }

    async function loadRateFilters() {
      try {
        const [districts, categories] = await Promise.all([
          api.fetchMarketDistricts(),
          api.fetchMarketCategories(),
        ]);

        setMarketDistricts(districts);
        setMarketCategories(categories);

        const byLocation = (project?.project_location || "").toLowerCase();
        const matchedDistrict =
          districts.find((d) => byLocation.includes(String(d.name || "").toLowerCase())) || districts[0];

        if (matchedDistrict?.id) {
          setSelectedDistrictId(matchedDistrict.id);
        }

        if (categories[0]?.name) {
          setSelectedCategoryName(categories[0].name);
        }
      } catch (err) {
        console.error("Failed to load market rate filters:", err);
      }
    }

    loadRateFilters();
  }, [isArchitectFlow, project?.project_location]);

  useEffect(() => {
    if (!isArchitectFlow || !selectedDistrictId || !selectedCategoryName) {
      setMarketRates([]);
      return;
    }

    async function loadMarketRates() {
      setLoadingRates(true);
      try {
        const rows = await api.fetchMarketDistrictCategoryPrices(selectedDistrictId, selectedCategoryName);
        setMarketRates(rows);
      } catch (err) {
        console.error("Failed to load market rates:", err);
        setMarketRates([]);
      } finally {
        setLoadingRates(false);
      }
    }

    loadMarketRates();
  }, [isArchitectFlow, selectedDistrictId, selectedCategoryName]);

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
          <button style={pageStyles.primaryBtn} onClick={() => navigate(backPath)}>Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 24 }}>
      <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
        <div style={{ ...pageStyles.header, display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <button style={{ ...pageStyles.secondaryBtn, height: 32, padding: "0 10px", fontSize: 13 }} onClick={() => navigate(backPath)}>← Back</button>
            {isReadOnlyView && hasExistingBoq ? (
              <button
                style={{ ...pageStyles.primaryBtn, fontSize: 14 }}
                onClick={() => setIsEditingBoq(true)}
              >
                Update BOQ
              </button>
            ) : (
              <div style={{ width: 104 }} />
            )}
          </div>
          <h1 style={{ ...pageStyles.title, fontSize: 22, textAlign: "center", margin: 0 }}>
            Bill of Quantity for '{project?.name || "Project"}'
          </h1>
          {project?.client_name && (
            <p style={{ ...pageStyles.subtitle, margin: "6px 0 0", textAlign: "center" }}>
              {project.client_name} — {project.project_location || "No location"}
            </p>
          )}
        </div>
        {boqError && <div style={{ ...pageStyles.error, marginTop: 12 }}>{boqError}</div>}
        <div style={{ margin: "24px 0" }}>
          <table style={{ ...pageStyles.table, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...pageStyles.th, width: 50 }}>#</th>
                <th style={pageStyles.th}>Item Name</th>
                <th style={{ ...pageStyles.th, width: 80 }}>Qty</th>
                <th style={{ ...pageStyles.th, width: 80 }}>UOM</th>
                {showRateColumns && <th style={{ ...pageStyles.th, width: 100 }}>Rate</th>}
                {showRateColumns && <th style={{ ...pageStyles.th, width: 110 }}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {boqRows.length === 0 && (
                <tr>
                  <td colSpan={showRateColumns ? 6 : 4} style={pageStyles.empty}>
                    {isViewMode ? "No submitted BOQ rows to display." : "No BOQ rows available."}
                  </td>
                </tr>
              )}
              {boqRows.map((row, idx) => {
                if ('customId' in row) {
                  return (
                    <tr key={row.customId}>
                      <td style={{ ...pageStyles.td, textAlign: "center", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ ...pageStyles.td }}>{row.customName}</td>
                      <td style={{ ...pageStyles.td }}>
                        {isEditingBoq ? (
                          <input
                            type="number"
                            min="0"
                            style={{ ...pageStyles.input, width: 80, fontSize: 13 }}
                            value={row.quantity}
                            onChange={e => {
                              const val = e.target.value;
                              setBoqRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: val } : r));
                            }}
                          />
                        ) : (
                          <span>{row.quantity || "-"}</span>
                        )}
                      </td>
                      <td style={{ ...pageStyles.td }}>
                        {isEditingBoq ? (
                          <select
                            style={{ ...pageStyles.select, width: 80, fontSize: 13 }}
                            value={row.uom}
                            onChange={e => {
                              const val = e.target.value;
                              setBoqRows(prev => prev.map((r, i) => i === idx ? { ...r, uom: val } : r));
                            }}
                          >
                            {[row.uom, ...UOM_OPTIONS.filter(u => u !== row.uom)].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        ) : (
                          <span>{row.uom || "-"}</span>
                        )}
                      </td>
                      {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>{row.rate != null ? `₹${row.rate}` : "—"}</td>}
                      {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{row.amount != null ? `₹${row.amount}` : "—"}</td>}
                    </tr>
                  );
                } else {
                  return (
                    <tr key={row.template.id}>
                      <td style={{ ...pageStyles.td, textAlign: "center", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ ...pageStyles.td }}>{row.template.name}</td>
                      <td style={{ ...pageStyles.td }}>
                        {isEditingBoq ? (
                          <input
                            type="number"
                            min="0"
                            style={{ ...pageStyles.input, width: 80, fontSize: 13 }}
                            value={row.quantity}
                            onChange={e => {
                              const val = e.target.value;
                              setBoqRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: val } : r));
                            }}
                          />
                        ) : (
                          <span>{row.quantity || "-"}</span>
                        )}
                      </td>
                      <td style={{ ...pageStyles.td }}>
                        {isEditingBoq ? (
                          <select
                            style={{ ...pageStyles.select, width: 80, fontSize: 13 }}
                            value={row.uom}
                            onChange={e => {
                              const val = e.target.value;
                              setBoqRows(prev => prev.map((r, i) => i === idx ? { ...r, uom: val } : r));
                            }}
                          >
                            {[row.uom, ...UOM_OPTIONS.filter(u => u !== row.uom)].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        ) : (
                          <span>{row.uom || "-"}</span>
                        )}
                      </td>
                      {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>{row.rate != null ? `₹${row.rate}` : "—"}</td>}
                      {showRateColumns && <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{row.amount != null ? `₹${row.amount}` : "—"}</td>}
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
          {isEditingBoq && (
          <div style={{ marginTop: 12 }}>
            <button
              style={{ ...pageStyles.secondaryBtn, fontSize: 14 }}
              onClick={() => {
                const customName = prompt("Enter new item name:");
                if (!customName) return;
                const uom = UOM_OPTIONS[0];
                setBoqRows(prev => [
                  ...prev,
                  {
                    customId: `custom-${Date.now()}`,
                    customName,
                    quantity: "",
                    uom,
                    rate: undefined,
                    amount: undefined,
                  },
                ]);
              }}
            >
              + Add Custom Line Item
            </button>
          </div>
          )}
        </div>
        {isEditingBoq && (
        <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
          <button
            style={{ ...pageStyles.primaryBtn, fontSize: 15 }}
            onClick={async () => {
              setLoading(true);
              try {
                const updatedRows = await Promise.all(boqRows.map(async (row) => {
                  const qty = parseFloat(row.quantity);
                  if (!qty || isNaN(qty)) return { ...row, rate: undefined, amount: undefined };
                  if ('customId' in row) {
                    // Custom line item: no rate calculation
                    return { ...row, rate: undefined, amount: undefined };
                  } else {
                    // Fetch computed PWD/SOR rate from backend rate engine.
                    try {
                      const computed = await api.computeRate({
                        template_id: row.template.id,
                        location_zone_id: project.location_zone_id,
                        conveyance_distance_km: project.default_conveyance_distance_km,
                        terrain: project.terrain,
                      });
                      const rate = Number(computed.final_rate);
                      return {
                        ...row,
                        rate: Number.isFinite(rate) ? rate : undefined,
                        amount: Number.isFinite(rate) ? rate * qty : undefined,
                      };
                    } catch (err) {
                      console.error("Failed to compute PWD rate for template:", row.template.id, err);
                      return { ...row, rate: undefined, amount: undefined };
                    }
                  }
                }));
                setBoqRows(updatedRows);
                setEstimate(updatedRows.reduce((sum, r) => sum + (r.amount || 0), 0));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            Check Estimate
          </button>
          <button
            style={{ ...pageStyles.secondaryBtn, fontSize: 15 }}
            onClick={async () => {
              setSubmitting(true);
              try {
                if (isViewMode && projectId) {
                  const items = boqRows.map(toSubmittedItem).filter((row): row is api.SubmittedBOQItem => Boolean(row));
                  await api.updateSubmittedBOQ(projectId, items);
                  alert("BOQ updated successfully!");
                  setHasExistingBoq(items.length > 0);
                  setBoqRows(mapSubmittedItemsToRows(items, templates));
                  setIsEditingBoq(false);
                  setEstimate(null);
                  return;
                }

                if (!projectId) {
                  alert("No project selected.");
                  return;
                }

                const items = boqRows
                  .map(toSubmittedItem)
                  .filter((row): row is api.SubmittedBOQItem => Boolean(row));

                if (!items.length) {
                  alert("Please fill in at least one item quantity before submitting.");
                  return;
                }

                await api.submitNewBOQ(projectId, items);
                alert("BOQ submitted successfully!");
                navigate(backPath);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || loading}
          >
            {isViewMode ? "Save Updated BOQ" : "Submit BOQ"}
          </button>
        </div>
        )}
        {showRateColumns && estimate != null && (
          <div style={{ marginTop: 24, fontWeight: 600, fontSize: 18, color: "#0f766e" }}>
            Total Estimate: ₹{estimate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
        )}
        {isArchitectFlow && (
          <div style={{ marginTop: 24, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 12px",
                background: "#f8fafc",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "#0f172a" }}>Basic Material Cost List (Market Rates)</strong>
              <span style={{ color: "#475569", fontSize: 13 }}>
                Rates sourced from scraped Prices module data; visible only to architects.
              </span>
            </div>

            <div style={{ ...pageStyles.formRow, padding: 12, borderBottom: "1px solid var(--border)" }}>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                style={pageStyles.select}
              >
                {marketDistricts.length === 0 ? (
                  <option value="">No Districts</option>
                ) : (
                  marketDistricts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))
                )}
              </select>

              <select
                value={selectedCategoryName}
                onChange={(e) => setSelectedCategoryName(e.target.value)}
                style={pageStyles.select}
              >
                {marketCategories.length === 0 ? (
                  <option value="">No Categories</option>
                ) : (
                  marketCategories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ maxHeight: 280, overflow: "auto" }}>
              <table style={{ ...pageStyles.table, margin: 0, border: "none" }}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Material</th>
                    <th style={pageStyles.th}>Market Rate</th>
                    <th style={pageStyles.th}>UOM</th>
                    <th style={pageStyles.th}>Source</th>
                    <th style={pageStyles.th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRates ? (
                    <tr>
                      <td colSpan={5} style={pageStyles.empty}>Loading market rates...</td>
                    </tr>
                  ) : marketRates.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={pageStyles.empty}>No scraped market rates available for this selection.</td>
                    </tr>
                  ) : (
                    marketRates.slice(0, 60).map((row, idx) => (
                      <tr key={row.materialId} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{row.materialName}</td>
                        <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>
                          {`₹${Number(row.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
                        </td>
                        <td style={pageStyles.td}>{row.unit || "-"}</td>
                        <td style={pageStyles.td}>{row.source || "scraped"}</td>
                        <td style={pageStyles.td}>
                          {row.lastUpdated ? new Date(row.lastUpdated).toLocaleDateString("en-IN") : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
