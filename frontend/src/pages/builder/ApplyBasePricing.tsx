import { useEffect, useRef, useState } from "react";
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
  itemDescription: string;
  priority: "zero_rate_fill" | "location_pricing" | "target_alignment";
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

const STANDARD_GUARDRAILS = [
  {
    id: "no_quality_compromise",
    label: "Do not compromise quality or safety",
  },
  {
    id: "respect_architect_specs",
    label: "Do not violate architect-mandated specifications",
  },
  {
    id: "prefer_equivalent_brands",
    label: "Prefer equivalent compliant brand/vendor alternatives",
  },
  {
    id: "city_realistic_pricing",
    label: "Use realistic city/location based pricing",
  },
  {
    id: "avoid_unavailable_materials",
    label: "Avoid unavailable/non-standard materials",
  },
] as const;

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
  const [optimizerBaseRatesByItem, setOptimizerBaseRatesByItem] = useState<Record<number, number>>({});
  const suggestionsContainerRef = useRef<HTMLDivElement | null>(null);

  function getPriorityStyle(priority: OptimizerSuggestion["priority"]) {
    if (priority === "zero_rate_fill") {
      return { border: "#f59e0b", background: "#fffbeb", text: "#92400e", label: "Priority 1 • Zero-rate fill" };
    }
    if (priority === "location_pricing") {
      return { border: "#3b82f6", background: "#eff6ff", text: "#1e40af", label: "Priority 2 • Location pricing" };
    }
    return { border: "#10b981", background: "#ecfdf5", text: "#065f46", label: "Priority 3 • Target alignment" };
  }

  function getPriorityRank(priority: OptimizerSuggestion["priority"]) {
    if (priority === "zero_rate_fill") return 0;
    if (priority === "location_pricing") return 1;
    return 2;
  }

  useEffect(() => {
    if (!optimizerSuggestions.length) {
      return;
    }

    const hasZeroRatePriority = optimizerSuggestions.some(
      (suggestion) => suggestion.priority === "zero_rate_fill"
    );

    if (hasZeroRatePriority && suggestionsContainerRef.current) {
      suggestionsContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [optimizerSuggestions]);
  const [selectedGuardrails, setSelectedGuardrails] = useState<string[]>(
    STANDARD_GUARDRAILS.map((item) => item.id)
  );
  const isUiLocked = optimizerLoading;

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
    setOptimizerBaseRatesByItem({});
    setSelectedGuardrails(STANDARD_GUARDRAILS.map((item) => item.id));
    
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
    const hasZeroRateItems = pricedItems.some((item) => Number(item.rate || 0) <= 0);
    const effectiveTarget =
      Number.isFinite(parsedTarget) && parsedTarget > 0
        ? parsedTarget
        : hasZeroRateItems
          ? Math.max(Number(totals.grandTotal || 0), 1)
          : NaN;

    if (!Number.isFinite(effectiveTarget) || effectiveTarget <= 0) {
      setOptimizerError("Enter a valid target total");
      return;
    }

    if ((!Number.isFinite(parsedTarget) || parsedTarget <= 0) && hasZeroRateItems) {
      setTargetTotal(effectiveTarget.toFixed(2));
    }

    if (selectedGuardrails.length === 0) {
      setOptimizerError("Please select at least one guardrail before requesting AI suggestions");
      return;
    }

    setOptimizerLoading(true);
    setOptimizerError("");
    setOptimizerEngineInfo("");
    try {
      const token = localStorage.getItem("token");
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      const response = await fetch(
        apiUrl(`/api/builder/projects/${selectedProjectId}/optimize-target`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetTotal: effectiveTarget,
            pricedItems,
            marginConfig,
            hardFail: false,
            selectedGuardrails,
            projectContext: {
              siteAddress: selectedProject?.site_address || "",
            },
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

      const baseRates = pricedItems.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = Number(item.rate || 0);
        return acc;
      }, {});

      setOptimizerBaseRatesByItem(baseRates);
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

      setOptimizerSuggestions((prev) =>
        prev.map((s) => {
          if (s.boqItemId !== suggestion.boqItemId) {
            return s;
          }

          if (s.suggestionId === suggestionId) {
            return { ...s, decision: "accepted" };
          }

          return { ...s, decision: undefined };
        })
      );
      return;
    }

    if (suggestion.decision === "accepted") {
      const baseRate = Number(optimizerBaseRatesByItem[suggestion.boqItemId]);
      if (Number.isFinite(baseRate) && baseRate >= 0) {
        setPricedItems((prev) =>
          prev.map((item) => {
            if (item.id !== suggestion.boqItemId) {
              return item;
            }

            return {
              ...item,
              rate: baseRate,
              total: Number((item.qty * baseRate).toFixed(2)),
            };
          })
        );
      }
    }

    setOptimizerSuggestions((prev) =>
      prev.map((s) =>
        s.suggestionId === suggestionId
          ? { ...s, decision: "declined" }
          : s
      )
    );
  }

  function handleAcceptAllLlmSuggestions() {
    const actionableLlmSuggestions = optimizerSuggestions.filter(
      (suggestion) => suggestion.source === "llm" && !suggestion.blocked
    );

    if (actionableLlmSuggestions.length === 0) {
      return;
    }

    const bestSuggestionByItem = new Map<number, OptimizerSuggestion>();
    actionableLlmSuggestions.forEach((suggestion) => {
      const existing = bestSuggestionByItem.get(suggestion.boqItemId);
      if (!existing) {
        bestSuggestionByItem.set(suggestion.boqItemId, suggestion);
        return;
      }

      const existingPriorityRank = getPriorityRank(existing.priority);
      const nextPriorityRank = getPriorityRank(suggestion.priority);

      if (
        nextPriorityRank < existingPriorityRank ||
        (nextPriorityRank === existingPriorityRank && suggestion.confidence > existing.confidence)
      ) {
        bestSuggestionByItem.set(suggestion.boqItemId, suggestion);
      }
    });

    const acceptedIds = new Set(
      Array.from(bestSuggestionByItem.values()).map((suggestion) => suggestion.suggestionId)
    );
    const acceptedItemIds = new Set(Array.from(bestSuggestionByItem.keys()));

    setPricedItems((prev) =>
      prev.map((item) => {
        const selected = bestSuggestionByItem.get(item.id);
        if (!selected) {
          return item;
        }

        const newRate = Number(selected.newRate || 0);
        return {
          ...item,
          rate: newRate,
          total: Number((item.qty * newRate).toFixed(2)),
        };
      })
    );

    setOptimizerSuggestions((prev) =>
      prev.map((suggestion) => {
        if (!acceptedItemIds.has(suggestion.boqItemId)) {
          return suggestion;
        }

        if (acceptedIds.has(suggestion.suggestionId)) {
          return { ...suggestion, decision: "accepted" };
        }

        if (suggestion.source === "llm" && !suggestion.blocked) {
          return { ...suggestion, decision: undefined };
        }

        return suggestion;
      })
    );
  }

  function handleGuardrailToggle(guardrailId: string) {
    setSelectedGuardrails((prev) =>
      prev.includes(guardrailId)
        ? prev.filter((id) => id !== guardrailId)
        : [...prev, guardrailId]
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
      setTargetTotal("");
      setOptimizerError("");
      setOptimizerSuggestions([]);
      setOptimizerEngineInfo("");
      setOptimizerBaseRatesByItem({});
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
  const acceptedSuggestions = optimizerSuggestions.filter((s) => s.decision === "accepted" && !s.blocked);
  const acceptedImpact = acceptedSuggestions.reduce((sum, s) => sum + Number(s.totalDelta || 0), 0);
  const acceptedCount = acceptedSuggestions.length;
  const zeroRateCount = pricedItems.filter((item) => Number(item.rate || 0) <= 0).length;
  const actionableLlmSuggestionCount = optimizerSuggestions.filter(
    (suggestion) => suggestion.source === "llm" && !suggestion.blocked
  ).length;
  const sortedSuggestions = [...optimizerSuggestions].sort((a, b) => {
    const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return Math.abs(Number(b.totalDelta || 0)) - Math.abs(Number(a.totalDelta || 0));
  });
  const zeroRateBoqItemIds = Object.keys(optimizerBaseRatesByItem)
    .map((key) => Number(key))
    .filter((id) => Number(optimizerBaseRatesByItem[id]) <= 0);
  const zeroRateTotal = zeroRateBoqItemIds.length;
  const zeroRateResolvedCount = zeroRateBoqItemIds.filter((id) => {
    const item = pricedItems.find((row) => row.id === id);
    return Number(item?.rate || 0) > 0;
  }).length;
  const prioritySectionConfig: Array<{ key: OptimizerSuggestion["priority"]; title: string }> = [
    { key: "zero_rate_fill", title: "Priority 1 • Zero-rate Fill" },
    { key: "location_pricing", title: "Priority 2 • Location Pricing" },
    { key: "target_alignment", title: "Priority 3 • Target Alignment" },
  ];
  const prioritySections: Array<{
    key: OptimizerSuggestion["priority"];
    title: string;
    suggestions: OptimizerSuggestion[];
    accepted: number;
    blocked: number;
    totalImpact: number;
  }> = prioritySectionConfig.map((section) => {
    const suggestions = sortedSuggestions.filter((item) => item.priority === section.key);
    return {
      ...section,
      suggestions,
      accepted: suggestions.filter((item) => item.decision === "accepted").length,
      blocked: suggestions.filter((item) => item.blocked).length,
      totalImpact: suggestions.reduce((sum, item) => sum + Number(item.totalDelta || 0), 0),
    };
  });

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
            disabled={isUiLocked}
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

              <div
                style={{
                  marginBottom: "0.9rem",
                  padding: "0.75rem",
                  border: "1px solid #99f6e4",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                }}
              >
                <p style={{ margin: "0 0 0.5rem 0", color: "#0f766e", fontWeight: 600 }}>
                  Guardrails to apply before AI suggestions
                </p>
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {STANDARD_GUARDRAILS.map((guardrail) => (
                    <label key={guardrail.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={selectedGuardrails.includes(guardrail.id)}
                        disabled={isUiLocked}
                        onChange={() => handleGuardrailToggle(guardrail.id)}
                      />
                      <span>{guardrail.label}</span>
                    </label>
                  ))}
                </div>
                <p style={{ margin: "0.6rem 0 0 0", color: "#475569", fontSize: "0.9rem" }}>
                  Priority applied: 1) Fill zero-priced BOQ items 2) Adjust by city/location pricing 3) Recommend target-alignment revisions 4) Enforce selected guardrails.
                </p>
              </div>

              {zeroRateCount > 0 && (
                <div
                  style={{
                    marginBottom: "0.9rem",
                    padding: "0.75rem",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    backgroundColor: "#fffbeb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "#92400e", fontWeight: 600 }}>
                    {zeroRateCount} BOQ item(s) still have zero rate. AI can recommend market rates for these items.
                  </span>
                  <button
                    onClick={handleGenerateSuggestions}
                    disabled={isUiLocked}
                    style={pageStyles.primaryBtn}
                  >
                    {optimizerLoading ? "Generating..." : "Get Zero-rate Recommendations"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter target grand total"
                  value={targetTotal}
                  disabled={isUiLocked}
                  onChange={(e) => setTargetTotal(e.target.value)}
                  style={{ ...pageStyles.input, width: "280px" }}
                />
                <button
                  onClick={handleGenerateSuggestions}
                  disabled={isUiLocked}
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

              {targetGap !== null && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0, color: targetGap <= 0 ? "#15803d" : "#1e293b", fontWeight: 600 }}>
                  {targetGap <= 0
                    ? `Target achieved. Current estimate is ₹${Math.abs(targetGap).toFixed(2)} below target.`
                    : `Need ₹${targetGap.toFixed(2)} more reduction to reach target.`}
                </p>
              )}

              {acceptedCount > 0 && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "#334155" }}>
                  Accepted suggestions: {acceptedCount} • Net grand-total impact: ₹{acceptedImpact.toFixed(2)}
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
                <div ref={suggestionsContainerRef} style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                  <div
                    style={{
                      border: "1px solid #99f6e4",
                      borderRadius: "10px",
                      backgroundColor: "#ffffff",
                      padding: "0.9rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0, color: "#0f766e", fontWeight: 700 }}>Optimization Report</h4>
                      {actionableLlmSuggestionCount > 0 && (
                        <button
                          onClick={handleAcceptAllLlmSuggestions}
                          disabled={isUiLocked}
                          style={pageStyles.primaryBtn}
                        >
                          Accept All LLM Recommendations ({actionableLlmSuggestionCount})
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: "0.75rem",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: "0.65rem",
                      }}
                    >
                      <div style={{ border: "1px solid #ccfbf1", borderRadius: "8px", padding: "0.6rem", backgroundColor: "#f0fdfa" }}>
                        <div style={{ color: "#0f766e", fontSize: "0.82rem" }}>Total suggestions</div>
                        <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>{sortedSuggestions.length}</div>
                      </div>
                      <div style={{ border: "1px solid #ccfbf1", borderRadius: "8px", padding: "0.6rem", backgroundColor: "#f0fdfa" }}>
                        <div style={{ color: "#0f766e", fontSize: "0.82rem" }}>Accepted actions</div>
                        <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>{acceptedCount}</div>
                      </div>
                      <div style={{ border: "1px solid #ccfbf1", borderRadius: "8px", padding: "0.6rem", backgroundColor: "#f0fdfa" }}>
                        <div style={{ color: "#0f766e", fontSize: "0.82rem" }}>Net accepted impact</div>
                        <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>₹{acceptedImpact.toFixed(2)}</div>
                      </div>
                      <div style={{ border: "1px solid #ccfbf1", borderRadius: "8px", padding: "0.6rem", backgroundColor: "#f0fdfa" }}>
                        <div style={{ color: "#0f766e", fontSize: "0.82rem" }}>Remaining gap</div>
                        <div style={{ color: targetGap !== null && targetGap <= 0 ? "#15803d" : "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>
                          {targetGap === null ? "—" : `₹${targetGap.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    {zeroRateTotal > 0 && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          border: "1px solid #f59e0b",
                          backgroundColor: "#fffbeb",
                          color: "#92400e",
                          borderRadius: "8px",
                          padding: "0.65rem 0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        Zero-rate items resolved: {zeroRateResolvedCount}/{zeroRateTotal}
                      </div>
                    )}
                  </div>

                  {prioritySections.map((section) => {
                    if (!section.suggestions.length) return null;
                    const sectionStyle = getPriorityStyle(section.key);
                    return (
                      <div
                        key={section.key}
                        style={{
                          border: `1px solid ${sectionStyle.border}`,
                          borderRadius: "10px",
                          backgroundColor: sectionStyle.background,
                          padding: "0.85rem",
                          display: "grid",
                          gap: "0.65rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                          <strong style={{ color: sectionStyle.text }}>{section.title}</strong>
                          <span style={{ color: sectionStyle.text, fontWeight: 600 }}>
                            Items: {section.suggestions.length} • Accepted: {section.accepted} • Blocked: {section.blocked} • Impact: ₹{section.totalImpact.toFixed(2)}
                          </span>
                        </div>

                        {section.suggestions.map((suggestion) => (
                          <div
                            key={suggestion.suggestionId}
                            style={{
                              border: "1px solid rgba(15, 23, 42, 0.12)",
                              borderRadius: "8px",
                              backgroundColor: "#ffffff",
                              padding: "0.7rem",
                              display: "grid",
                              gap: "0.5rem",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                              <strong>
                                Item #{suggestion.boqItemId} • {suggestion.type.replace("_", " ")}
                              </strong>
                              <span style={{ color: "#334155", fontWeight: 600 }}>
                                Rate: ₹{suggestion.oldRate.toFixed(2)} → ₹{suggestion.newRate.toFixed(2)}
                              </span>
                            </div>

                            <p style={{ margin: 0, color: "#0f172a", fontWeight: 600 }}>
                              {suggestion.itemDescription || "(No item description)"}
                            </p>

                            <p style={{ margin: 0, color: "#334155" }}>{suggestion.reason}</p>

                            {suggestion.qualityValidation && (
                              <p style={{ margin: 0, color: "#0f766e", fontWeight: 500 }}>
                                Quality validation: {suggestion.qualityValidation}
                              </p>
                            )}

                            {Array.isArray(suggestion.alternatives) && suggestion.alternatives.length > 0 && (
                              <div>
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
                                    disabled={isUiLocked || suggestion.decision === "accepted"}
                                    style={pageStyles.primaryBtn}
                                  >
                                    {suggestion.decision === "accepted" ? "Accepted" : "Accept"}
                                  </button>
                                  <button
                                    onClick={() => handleSuggestionDecision(suggestion.suggestionId, "declined")}
                                    disabled={isUiLocked || suggestion.decision === "declined"}
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
                    );
                  })}
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
                          disabled={isUiLocked}
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
                  disabled={isUiLocked}
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
                disabled={loading || isUiLocked}
                style={{
                  ...pageStyles.primaryBtn,
                  fontSize: "1.125rem",
                  padding: "0.875rem 2rem",
                  ...(loading || isUiLocked ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}
              >
                {loading ? "Submitting..." : isUiLocked ? "AI Processing..." : "Submit Estimate to Architect"}
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

      {isUiLocked && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #99f6e4",
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              minWidth: "280px",
              textAlign: "center",
              color: "#0f766e",
              fontWeight: 600,
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
            }}
          >
            AI is processing recommendations. Please wait...
          </div>
        </div>
      )}
    </div>
  );
}
