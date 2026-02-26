import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import TableWrapper from "../../components/TableWrapper";
import { getBasePricing } from "../../services/basePricingStore";
import { apiUrl } from "../../services/api";

interface Project {
  id: string;
  name: string;
  description: string;
  site_address: string;
  estimate_status: string | null;
}

interface BOQItem {
  id: number;
  item: string;
  qty: number;
  uom: string;
  rate: number;
  total: number;
  category?: string;
}

interface BasePriceItem {
  item: string;
  rate: number;
  uom: string;
  category: string;
}

interface MarginConfig {
  overallMargin: number;
  laborUplift: number;
  machineryUplift: number;
}

interface OptimizerSuggestion {
  suggestionId: string;
  boqItemId: number;
  type: "brand_swap" | "finish_change" | "spec_variant" | "vendor_switch";
  reason: string;
  oldRate: number;
  newRate: number;
  rateDelta: number;
  totalDelta: number;
  confidence: number;
  blocked: boolean;
  blockReason?: string;
  qualityValidation?: string;
  alternatives?: string[];
  source?: "llm" | "heuristic";
  decision?: "accepted" | "declined";
}

export default function ApplyBasePricing() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [basePricing, setBasePricing] = useState<BasePriceItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [pricedItems, setPricedItems] = useState<BOQItem[]>([]);
  const [marginConfig, setMarginConfig] = useState<MarginConfig>({
    overallMargin: 10,
    laborUplift: 5,
    machineryUplift: 5,
  });
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [targetTotal, setTargetTotal] = useState<string>("");
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [optimizerSuggestions, setOptimizerSuggestions] = useState<OptimizerSuggestion[]>([]);
  const [optimizerEngineInfo, setOptimizerEngineInfo] = useState<string>("");

  useEffect(() => {
    fetchProjects();
    fetchBasePricing();
    loadMarginConfig();
  }, []);

  function loadMarginConfig() {
    const overallMargin = Number(sessionStorage.getItem("overallMargin") || 10);
    const laborUplift = Number(sessionStorage.getItem("laborUplift") || 5);
    const machineryUplift = Number(sessionStorage.getItem("machineryUplift") || 5);
    
    setMarginConfig({ overallMargin, laborUplift, machineryUplift });
  }

  useEffect(() => {
    if (selectedProjectId && boqItems.length > 0) {
      autoMatchPricing(boqItems, basePricing);
    }
  }, [basePricing, boqItems, selectedProjectId]);

  async function fetchProjects() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/builder/available-projects"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error("Fetch projects error:", err);
      alert(err instanceof Error ? err.message : "Failed to fetch projects");
    }
  }

  async function fetchBasePricing() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/builder/base-pricing"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const localItems = getBasePricing();
      let apiItems: BasePriceItem[] = [];

      if (response.ok) {
        apiItems = await response.json();
      }

      // Merge backend + local items, preferring latest local entry for same item+uom
      const mergedMap = new Map<string, BasePriceItem>();
      [...apiItems, ...localItems].forEach((item) => {
        const key = `${normalizeText(item.item)}|${normalizeText(item.uom)}`;
        mergedMap.set(key, item);
      });

      setBasePricing(Array.from(mergedMap.values()));
    } catch (err) {
      console.error("Fetch base pricing error:", err);
      // Fallback to local base pricing so auto-fill still works
      setBasePricing(getBasePricing());
    }
  }

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setTargetTotal("");
    setOptimizerError("");
    setOptimizerSuggestions([]);
    setOptimizerEngineInfo("");
    
    if (!projectId) {
      setBoqItems([]);
      setPricedItems([]);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        apiUrl(`/api/builder/projects/${projectId}/boq-items`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch BOQ items");

      const items = await response.json();
      setBoqItems(items);

      // Auto-match pricing
      autoMatchPricing(items, basePricing);
    } catch (err) {
      console.error("Fetch BOQ error:", err);
      alert(err instanceof Error ? err.message : "Failed to fetch BOQ");
    } finally {
      setLoading(false);
    }
  }

  function normalizeText(value: string) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function autoMatchPricing(items: BOQItem[], pricingSource: BasePriceItem[] = basePricing) {
    const matched = items.map((item) => {
      // Try to find exact match or partial match in base pricing
      const normalizedItemName = normalizeText(item.item);
      const normalizedItemUom = normalizeText(item.uom);
      
      let match = pricingSource.find(
        (bp) =>
          normalizeText(bp.item) === normalizedItemName &&
          (!normalizedItemUom || normalizeText(bp.uom) === normalizedItemUom)
      );

      if (!match) {
        // Try exact item match ignoring UOM
        match = pricingSource.find(
          (bp) => normalizeText(bp.item) === normalizedItemName
        );
      }

      if (!match) {
        // Try partial match on item name
        match = pricingSource.find((bp) => {
          const normalizedBaseItem = normalizeText(bp.item);
          return (
            normalizedItemName.includes(normalizedBaseItem) ||
            normalizedBaseItem.includes(normalizedItemName)
          );
        }
        );
      }

      const rate = match ? match.rate : 0;
      const total = item.qty * rate;
      const category = match ? match.category : "Material";

      return {
        ...item,
        rate,
        total,
        category,
      };
    });

    setPricedItems(matched);
  }

  function handleRateChange(index: number, newRate: number) {
    const updated = [...pricedItems];
    updated[index].rate = newRate;
    updated[index].total = updated[index].qty * newRate;
    setPricedItems(updated);
  }

  async function handleGenerateSuggestions() {
    if (!selectedProjectId) {
      setOptimizerError("Select a project first");
      return;
    }

    const parsedTarget = Number(targetTotal);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setOptimizerError("Enter a valid target total");
      return;
    }

    setOptimizerLoading(true);
    setOptimizerError("");
    setOptimizerEngineInfo("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        apiUrl(`/api/builder/projects/${selectedProjectId}/optimize-target`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetTotal: parsedTarget,
            pricedItems,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate suggestions");
      }

      const suggestions = Array.isArray(data.suggestions)
        ? (data.suggestions as OptimizerSuggestion[])
        : [];
      setOptimizerSuggestions(suggestions);

      const engine = String(data?.suggestionEngine || "heuristic").toUpperCase();
      const model = data?.llmModel ? ` (${String(data.llmModel)})` : "";
      const usedLabel = data?.llmUsed ? "LLM used" : "Fallback rules used";
      const diagnostics = [
        `attempted=${Boolean(data?.llmAttempted)}`,
        `configured=${Boolean(data?.llmConfigured)}`,
        `candidates=${Number(data?.llmCandidateCount || 0)}`,
        `returned=${Number(data?.llmSuggestionCount || 0)}`,
      ];
      if (data?.llmFailureReason) {
        diagnostics.push(`reason=${String(data.llmFailureReason)}`);
      }

      setOptimizerEngineInfo(
        `Engine: ${engine}${model} • ${usedLabel} • ${diagnostics.join(" • ")}`
      );
    } catch (err) {
      setOptimizerError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setOptimizerLoading(false);
    }
  }

  function handleSuggestionDecision(
    suggestionId: string,
    decision: "accepted" | "declined"
  ) {
    const suggestion = optimizerSuggestions.find((s) => s.suggestionId === suggestionId);
    if (!suggestion || suggestion.blocked) {
      return;
    }

    if (decision === "accepted") {
      setPricedItems((prev) =>
        prev.map((item) => {
          if (item.id !== suggestion.boqItemId) {
            return item;
          }
          const newRate = Number(suggestion.newRate || 0);
          return {
            ...item,
            rate: newRate,
            total: Number((item.qty * newRate).toFixed(2)),
          };
        })
      );
    }

    setOptimizerSuggestions((prev) =>
      prev.map((s) =>
        s.suggestionId === suggestionId
          ? { ...s, decision }
          : s
      )
    );
  }

  async function handleSubmit() {
    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    if (pricedItems.some((item) => item.rate === 0)) {
      const confirm = window.confirm(
        "Some items have zero rate. Do you want to continue?"
      );
      if (!confirm) return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        apiUrl(`/api/builder/projects/${selectedProjectId}/estimate`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pricedItems,
            marginConfig,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit estimate");
      }

      const result = await response.json();
      alert(
        `Estimate submitted successfully!\nRevision: ${result.revisionNumber}\nGrand Total: ₹${result.grandTotal.toFixed(2)}`
      );

      // Refresh projects to update status
      fetchProjects();
      
      // Clear form
      setSelectedProjectId("");
      setBoqItems([]);
      setPricedItems([]);
      setNotes("");
      loadMarginConfig();
    } catch (err) {
      console.error("Submit estimate error:", err);
      alert(err instanceof Error ? err.message : "Failed to submit estimate");
    } finally {
      setLoading(false);
    }
  }

  // Calculate category-wise totals with uplifts
  function calculateTotals() {
    let materialTotal = 0;
    let laborTotal = 0;
    let machineryTotal = 0;
    let otherTotal = 0;

    pricedItems.forEach((item) => {
      const cat = String(item.category || "Material").toLowerCase();
      const total = item.total || 0;

      if (cat.includes("labor") || cat.includes("labour")) {
        laborTotal += total;
      } else if (cat.includes("mach")) {
        machineryTotal += total;
      } else if (cat.includes("other")) {
        otherTotal += total;
      } else {
        materialTotal += total;
      }
    });

    // Apply uplifts to labor and machinery
    const laborWithUplift = laborTotal * (1 + marginConfig.laborUplift / 100);
    const machineryWithUplift = machineryTotal * (1 + marginConfig.machineryUplift / 100);

    const subtotalWithUplifts = materialTotal + laborWithUplift + machineryWithUplift + otherTotal;
    const grandTotal = subtotalWithUplifts * (1 + marginConfig.overallMargin / 100);

    return {
      materialTotal,
      laborTotal,
      laborWithUplift,
      machineryTotal,
      machineryWithUplift,
      otherTotal,
      subtotalWithUplifts,
      marginAmount: grandTotal - subtotalWithUplifts,
      grandTotal,
    };
  }

  const totals = calculateTotals();
  const parsedTargetTotal = Number(targetTotal || 0);
  const targetGap = Number.isFinite(parsedTargetTotal) && parsedTargetTotal > 0
    ? totals.grandTotal - parsedTargetTotal
    : null;

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
          <h2 style={pageStyles.title}>Apply Base Pricing to Project</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="blueprint" />
          </div>
        </div>

        {/* Project Selection */}
        <div style={{ marginBottom: "2rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#0f766e",
              fontWeight: 500,
            }}
          >
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{ ...pageStyles.select, width: "100%" }}
          >
            <option value="">-- Select a Project --</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name} - {proj.site_address}
                {proj.estimate_status ? ` (${proj.estimate_status})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading...</p>
        )}

        {!loading && pricedItems.length > 0 && (
          <>
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                border: "1px solid #ccfbf1",
                backgroundColor: "#f0fdfa",
                borderRadius: "8px",
              }}
            >
              <h3 style={{ ...pageStyles.subtitle, margin: "0 0 0.75rem 0", color: "#0f766e" }}>
                Target Price Optimizer (MVP)
              </h3>

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter target grand total"
                  value={targetTotal}
                  onChange={(e) => setTargetTotal(e.target.value)}
                  style={{ ...pageStyles.input, width: "280px" }}
                />
                <button
                  onClick={handleGenerateSuggestions}
                  disabled={optimizerLoading}
                  style={pageStyles.primaryBtn}
                >
                  {optimizerLoading ? "Generating..." : "Get AI Suggestions"}
                </button>
              </div>

              {targetGap !== null && (
                <p style={{ marginTop: "0.75rem", marginBottom: 0, color: "#0f766e", fontWeight: 500 }}>
                  Current vs Target Gap: ₹{targetGap.toFixed(2)}
                </p>
              )}

              {optimizerError && (
                <p style={{ ...pageStyles.error, marginTop: "0.75rem", marginBottom: 0 }}>
                  {optimizerError}
                </p>
              )}

              {optimizerEngineInfo && (
                <p style={{ marginTop: "0.75rem", marginBottom: 0, color: "#475569", fontSize: "0.9rem" }}>
                  {optimizerEngineInfo}
                </p>
              )}

              {optimizerSuggestions.length > 0 && (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                  {optimizerSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.suggestionId}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <strong>
                          Item #{suggestion.boqItemId} • {suggestion.type.replace("_", " ")}
                        </strong>
                        <span>
                          Rate: ₹{suggestion.oldRate.toFixed(2)} → ₹{suggestion.newRate.toFixed(2)}
                        </span>
                      </div>

                      <p style={{ margin: "0.5rem 0", color: "#334155" }}>{suggestion.reason}</p>

                      {suggestion.qualityValidation && (
                        <p style={{ margin: "0.25rem 0", color: "#0f766e", fontWeight: 500 }}>
                          Quality validation: {suggestion.qualityValidation}
                        </p>
                      )}

                      {Array.isArray(suggestion.alternatives) && suggestion.alternatives.length > 0 && (
                        <div style={{ margin: "0.5rem 0" }}>
                          <p style={{ margin: 0, color: "#334155", fontWeight: 500 }}>Alternative options:</p>
                          <ul style={{ margin: "0.25rem 0 0 1rem", color: "#475569" }}>
                            {suggestion.alternatives.map((option, optionIndex) => (
                              <li key={`${suggestion.suggestionId}-alt-${optionIndex}`}>{option}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ color: "#0f766e", fontWeight: 500 }}>
                          Total impact: ₹{suggestion.totalDelta.toFixed(2)} • Confidence: {(suggestion.confidence * 100).toFixed(0)}% • Source: {(suggestion.source || "heuristic").toUpperCase()}
                        </span>

                        {suggestion.blocked ? (
                          <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                            Guardrail: {suggestion.blockReason || "Blocked"}
                          </span>
                        ) : (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleSuggestionDecision(suggestion.suggestionId, "accepted")}
                              disabled={suggestion.decision === "accepted"}
                              style={pageStyles.primaryBtn}
                            >
                              {suggestion.decision === "accepted" ? "Accepted" : "Accept"}
                            </button>
                            <button
                              onClick={() => handleSuggestionDecision(suggestion.suggestionId, "declined")}
                              disabled={suggestion.decision === "declined"}
                              style={pageStyles.secondaryBtn}
                            >
                              {suggestion.decision === "declined" ? "Declined" : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BOQ Items with Pricing */}
            <h3 style={{ ...pageStyles.subtitle, marginTop: "2rem" }}>
              BOQ Items & Pricing
            </h3>
            <TableWrapper>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Quantity</th>
                    <th>UOM</th>
                    <th>Rate (₹)</th>
                    <th>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.item}</td>
                      <td>{item.qty}</td>
                      <td>{item.uom}</td>
                      <td>
                        <input
                          type="number"
                          value={Number.isFinite(item.rate) ? item.rate : 0}
                          onChange={(e) =>
                            handleRateChange(index, Number(e.target.value))
                          }
                          style={{
                            ...pageStyles.input,
                            width: "120px",
                            padding: "0.5rem",
                          }}
                        />
                      </td>
                      <td>{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>

            {/* Totals Section */}
            <div
              style={{
                marginTop: "2rem",
                padding: "1.5rem",
                backgroundColor: "#f0fdfa",
                borderRadius: "8px",
                border: "1px solid #ccfbf1",
              }}
            >
              <h3
                style={{
                  margin: "0 0 1rem 0",
                  color: "#0f766e",
                  fontWeight: 600,
                }}
              >
                Cost Breakdown (Margins from Margin & Uplift Engine)
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                  fontSize: "0.95rem",
                }}
              >
                <div style={{ color: "#0d9488" }}>Material:</div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{totals.materialTotal.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488" }}>
                  Labor (base):
                </div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{totals.laborTotal.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488", paddingLeft: "1rem" }}>
                  + Labor Uplift ({marginConfig.laborUplift}%):
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#0f766e" }}>
                  ₹{totals.laborWithUplift.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488" }}>
                  Machinery (base):
                </div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{totals.machineryTotal.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488", paddingLeft: "1rem" }}>
                  + Machinery Uplift ({marginConfig.machineryUplift}%):
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#0f766e" }}>
                  ₹{totals.machineryWithUplift.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488" }}>Other:</div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{totals.otherTotal.toFixed(2)}
                </div>

                <div
                  style={{
                    borderTop: "2px solid #99f6e4",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    color: "#0f766e",
                    fontWeight: 600,
                  }}
                >
                  Subtotal (with uplifts):
                </div>
                <div
                  style={{
                    borderTop: "2px solid #99f6e4",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#0f766e",
                  }}
                >
                  ₹{totals.subtotalWithUplifts.toFixed(2)}
                </div>

                <div style={{ color: "#0d9488" }}>
                  + Overall Margin ({marginConfig.overallMargin}%):
                </div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  ₹{totals.marginAmount.toFixed(2)}
                </div>

                <div
                  style={{
                    borderTop: "3px solid #5eead4",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    color: "#0f766e",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  Grand Total:
                </div>
                <div
                  style={{
                    borderTop: "3px solid #5eead4",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: "1.5rem",
                    color: "#0f766e",
                  }}
                >
                  ₹{totals.grandTotal.toFixed(2)}
                </div>
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#0f766e",
                    fontWeight: 500,
                  }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  value={notes ?? ""}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the architect..."
                  rows={3}
                  style={{
                    ...pageStyles.input,
                    width: "100%",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: "2rem", textAlign: "center" }}>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  ...pageStyles.primaryBtn,
                  fontSize: "1.125rem",
                  padding: "0.875rem 2rem",
                  ...(loading ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}
              >
                {loading ? "Submitting..." : "Submit Estimate to Architect"}
              </button>
            </div>
          </>
        )}

        {!loading && selectedProjectId && pricedItems.length === 0 && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            No BOQ items found for this project.
          </p>
        )}

        {!selectedProjectId && !loading && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            Please select a project to start applying base pricing.
          </p>
        )}
      </div>
    </div>
  );
}
