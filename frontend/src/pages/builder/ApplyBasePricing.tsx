import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import TableWrapper from "../../components/TableWrapper";
import { getBasePricing } from "../../services/basePricingStore";
import { apiUrl } from "../../services/api";
import { formatINR } from "../../services/currency";
import { useLocation } from "react-router-dom";

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
  rateSource?: string;
}

interface BasePriceItem {
  item: string;
  rate: number;
  uom: string;
  category: string;
  sourceType?: "builder_override" | "pwd_template";
}

interface MarketRateItem {
  materialName: string;
  brandName?: string | null;
  unit: string;
  price: number;
  source: string;
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

interface ExpenseRecommendation {
  head: "labor" | "machinery";
  suggestedAmount: number;
  reason: string;
  confidence: number;
  source: "llm" | "heuristic";
  decision?: "increase" | "decrease" | "base" | "ignored";
}

const FLOATING_BREAKDOWN_WIDTH = 360;
const FLOATING_BREAKDOWN_COLLAPSED_WIDTH = 220;
const FLOATING_BREAKDOWN_GAP = 32;

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

export default function ApplyBasePricing({
  initialProjectId,
  embedded = false,
  onSubmitted,
}: {
  initialProjectId?: string;
  embedded?: boolean;
  onSubmitted?: () => void;
}) {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [basePricing, setBasePricing] = useState<BasePriceItem[]>([]);
  const [pwdTemplateRates, setPwdTemplateRates] = useState<BasePriceItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [pricedItems, setPricedItems] = useState<BOQItem[]>([]);
  const [marketRates, setMarketRates] = useState<MarketRateItem[]>([]);
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
  const [expenseRecommendations, setExpenseRecommendations] = useState<ExpenseRecommendation[]>([]);
  const [optimizerEngineInfo, setOptimizerEngineInfo] = useState<string>("");
  const [optimizerBaseRatesByItem, setOptimizerBaseRatesByItem] = useState<Record<number, number>>({});
  const [basicMaterialCost, setBasicMaterialCost] = useState<string>("");
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);
  const [isLandscapeWide, setIsLandscapeWide] = useState(false);
  const [isFloatingBreakdownCollapsed, setIsFloatingBreakdownCollapsed] = useState(false);
  const suggestionsContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const pageHeading = selectedProject?.name
    ? `${selectedProject.name} - BOQ Estimate`
    : "Project Name - BOQ Estimate";
  const queryProjectId = useMemo(
    () => new URLSearchParams(location.search).get("projectId") || "",
    [location.search]
  );
  const preferredProjectId = initialProjectId || queryProjectId;

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
    fetchPwdTemplateRates();
    loadMarginConfig();
  }, []);

  useEffect(() => {
    const computeLayout = () => {
      if (typeof window === "undefined") {
        setIsLandscapeWide(false);
        return;
      }
      const wideEnough = window.innerWidth >= 1200;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscapeWide(wideEnough && isLandscape);
    };

    computeLayout();
    window.addEventListener("resize", computeLayout);
    return () => window.removeEventListener("resize", computeLayout);
  }, []);

  useEffect(() => {
    if (!isLandscapeWide) {
      setIsFloatingBreakdownCollapsed(false);
    }
  }, [isLandscapeWide]);

  function loadMarginConfig() {
    const overallMargin = Number(sessionStorage.getItem("overallMargin") || 10);
    const laborUplift = Number(sessionStorage.getItem("laborUplift") || 5);
    const machineryUplift = Number(sessionStorage.getItem("machineryUplift") || 5);
    
    setMarginConfig({ overallMargin, laborUplift, machineryUplift });
  }

  function handleMarginConfigChange(
    key: keyof MarginConfig,
    storageKey: "overallMargin" | "laborUplift" | "machineryUplift",
    nextValue: number
  ) {
    const normalizedValue = Number.isFinite(nextValue) ? Math.max(nextValue, 0) : 0;

    setMarginConfig((prev) => ({
      ...prev,
      [key]: normalizedValue,
    }));

    sessionStorage.setItem(storageKey, String(normalizedValue));
  }

  function renderInlineAdjuster(
    key: keyof MarginConfig,
    storageKey: "overallMargin" | "laborUplift" | "machineryUplift",
    value: number,
    step = 1
  ) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginLeft: "0.35rem" }}>
        <button
          type="button"
          disabled={isUiLocked}
          onClick={() => handleMarginConfigChange(key, storageKey, value - step)}
          style={{ ...pageStyles.secondaryBtn, height: "26px", padding: "0 8px", borderRadius: "6px", fontSize: "0.85rem" }}
        >
          -
        </button>
        <button
          type="button"
          disabled={isUiLocked}
          onClick={() => handleMarginConfigChange(key, storageKey, value + step)}
          style={{ ...pageStyles.secondaryBtn, height: "26px", padding: "0 8px", borderRadius: "6px", fontSize: "0.85rem" }}
        >
          +
        </button>
      </span>
    );
  }

  useEffect(() => {
    if (selectedProjectId && boqItems.length > 0) {
      autoMatchPricing(boqItems, [...basePricing, ...pwdTemplateRates]);
    }
  }, [basePricing, pwdTemplateRates, boqItems, selectedProjectId, marketRates]);

  useEffect(() => {
    if (!preferredProjectId || !projects.length || selectedProjectId === preferredProjectId) {
      return;
    }

    const exists = projects.some((project) => project.id === preferredProjectId);
    if (exists) {
      handleProjectChange(preferredProjectId);
    }
  }, [preferredProjectId, projects]);

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
        mergedMap.set(key, {
          ...item,
          sourceType: "builder_override",
        });
      });

      setBasePricing(Array.from(mergedMap.values()));
    } catch (err) {
      console.error("Fetch base pricing error:", err);
      // Fallback to local base pricing so auto-fill still works
      setBasePricing(
        getBasePricing().map((item) => ({
          ...item,
          sourceType: "builder_override",
        }))
      );
    }
  }

  async function fetchPwdTemplateRates() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/base-pricing/template"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch PWD template rates");
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      const normalizedRows: BasePriceItem[] = rows
        .map((row: any) => ({
          item: String(row?.item || "").trim(),
          rate: Number(row?.rate || 0),
          uom: String(row?.uom || "").trim(),
          category: String(row?.category || "Material").trim() || "Material",
          sourceType: "pwd_template" as const,
        }))
        .filter((row: BasePriceItem) => row.item && Number.isFinite(row.rate) && row.rate > 0);

      setPwdTemplateRates(normalizedRows);
    } catch (err) {
      console.error("Fetch PWD template rates error:", err);
      setPwdTemplateRates([]);
    }
  }

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setTargetTotal("");
    setOptimizerError("");
    setOptimizerSuggestions([]);
    setExpenseRecommendations([]);
    setOptimizerEngineInfo("");
    setOptimizerBaseRatesByItem({});
    setActiveRecommendationId(null);
    setSelectedGuardrails(STANDARD_GUARDRAILS.map((item) => item.id));
    
    if (!projectId) {
      setBoqItems([]);
      setPricedItems([]);
      setMarketRates([]);
      setBasicMaterialCost("");
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
      const loadedMarketRates = await loadMarketRatesForProject(projectId);
      setMarketRates(loadedMarketRates);
      setBoqItems(items);

      // Auto-match pricing
      autoMatchPricing(items, [...basePricing, ...pwdTemplateRates], loadedMarketRates);
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

  const UOM_ALIASES: Record<string, string> = {
    sqft: "sqft", sft: "sqft", "sq ft": "sqft", ft2: "sqft",
    sqm: "sqm", "sq m": "sqm", m2: "sqm",
    cft: "cft", "cu ft": "cft",
    cum: "cum", m3: "cum",
    nos: "nos", no: "nos", number: "nos", pcs: "nos", each: "nos",
    rmt: "rmt", rm: "rmt", "running meter": "rmt", lm: "rmt",
    kg: "kg", bags: "bags",
  };

  const WORD_ALIASES: Record<string, string> = {
    rcc: "reinforced concrete",
    "reinforced cement concrete": "reinforced concrete",
    "reinforced concrete cement": "reinforced concrete",
    pcc: "plain concrete",
    "plain cement concrete": "plain concrete",
    brickwork: "brick work",
    vitrified: "vitrified tiles",
    granite: "granite flooring",
    "ms steel": "steel",
    "mild steel": "steel",
    tmt: "steel",
    "tmt bar": "steel",
    opc: "cement",
    ppc: "cement",
    "m sand": "manufactured sand",
    "river sand": "sand",
    plaster: "plastering",
    paint: "painting",
    dado: "wall tiles",
  };

  function normalizeUom(uom: string): string {
    const u = normalizeText(uom);
    return UOM_ALIASES[u] ?? u;
  }

  function expandAliases(text: string): string {
    let result = text;
    for (const [alias, canonical] of Object.entries(WORD_ALIASES)) {
      result = result.replace(new RegExp(`\\b${alias}\\b`, "g"), canonical);
    }
    return result;
  }

  function tokenScore(a: string, b: string): number {
    const tokensA = new Set(expandAliases(a).split(" ").filter(Boolean));
    const tokensB = new Set(expandAliases(b).split(" ").filter(Boolean));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let intersect = 0;
    tokensA.forEach((t) => { if (tokensB.has(t)) intersect++; });
    return intersect / Math.min(tokensA.size, tokensB.size);
  }

  function resolveRateLabel(source: string) {
    const s = normalizeText(source);
    if (!s) return "Scraped";
    if (s.includes("dealer")) return "Scraped (Dealer)";
    if (s.includes("pwd")) return "PWD";
    return "Scraped";
  }

  function findBestMatch<T extends { item?: string; materialName?: string; uom?: string; unit?: string }>(
    itemName: string,
    itemUom: string,
    source: T[]
  ) {
    const normName = normalizeText(itemName);
    const normUom = normalizeUom(itemUom);

    // 1. Exact name + UOM
    let match = source.find((entry) => {
      const n = normalizeText((entry as any).item || (entry as any).materialName || "");
      const u = normalizeUom((entry as any).uom || (entry as any).unit || "");
      return n === normName && (!normUom || u === normUom || !u);
    });

    // 2. Exact name only
    if (!match) {
      match = source.find((entry) => {
        const n = normalizeText((entry as any).item || (entry as any).materialName || "");
        return n === normName;
      });
    }

    // 3. Substring
    if (!match) {
      match = source.find((entry) => {
        const n = normalizeText((entry as any).item || (entry as any).materialName || "");
        return normName.includes(n) || n.includes(normName);
      });
    }

    // 4. Token overlap score >= 0.5
    if (!match) {
      let bestScore = 0.5;
      let bestEntry: T | null = null;
      source.forEach((entry) => {
        const n = normalizeText((entry as any).item || (entry as any).materialName || "");
        const score = tokenScore(normName, n);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      });
      if (bestEntry) match = bestEntry;
    }

    return match || null;
  }

  async function loadMarketRatesForProject(projectId: string): Promise<MarketRateItem[]> {
    const project = projects.find((entry) => entry.id === projectId);
    const siteAddress = String(project?.site_address || "").trim();

    if (!siteAddress) {
      return [];
    }

    try {
      const [districtsRes, categoriesRes] = await Promise.all([
        fetch(apiUrl("/api/prices/districts")),
        fetch(apiUrl("/api/prices/categories")),
      ]);

      if (!districtsRes.ok || !categoriesRes.ok) {
        return [];
      }

      const districts = await districtsRes.json();
      const categories = await categoriesRes.json();

      const normalizedSite = normalizeText(siteAddress);
      const district = (districts || []).find((entry: any) =>
        normalizedSite.includes(normalizeText(String(entry?.name || "")))
      );

      if (!district?.id) {
        return [];
      }

      const categoryNames = (categories || []).map((entry: any) => String(entry?.name || "")).filter(Boolean);
      const rows: MarketRateItem[] = [];

      await Promise.all(
        categoryNames.map(async (categoryName: string) => {
          const response = await fetch(
            apiUrl(`/api/prices/district/${district.id}?category=${encodeURIComponent(categoryName)}`)
          );
          if (!response.ok) return;
          const data = await response.json();
          const prices = Array.isArray(data?.prices) ? data.prices : [];

          prices.forEach((entry: any) => {
            const price = Number(entry?.price || 0);
            if (!Number.isFinite(price) || price <= 0) return;
            rows.push({
              materialName: String(entry?.materialName || "").trim(),
              brandName: entry?.brandName ? String(entry.brandName).trim() : null,
              unit: String(entry?.unit || "").trim(),
              price,
              source: String(entry?.source || "scraped").trim(),
            });
          });
        })
      );

      return rows;
    } catch {
      return [];
    }
  }

  function autoMatchPricing(
    items: BOQItem[],
    pricingSource: BasePriceItem[] = [...basePricing, ...pwdTemplateRates],
    marketSource: MarketRateItem[] = marketRates
  ) {
    const matched = items.map((item) => {
      const pwdRate = Number(item.rate || 0);
      const manualMatch = findBestMatch(item.item, item.uom, pricingSource);
      const marketMatch = pwdRate > 0 ? null : manualMatch ? null : findBestMatch(item.item, item.uom, marketSource);

      let rate = 0;
      let category = "Material";
      let rateSource = "PWD";

      if (pwdRate > 0) {
        rate = pwdRate;
        category = item.category || "Material";
        rateSource = "PWD";
      } else if (manualMatch) {
        rate = Number((manualMatch as BasePriceItem).rate || 0);
        category = (manualMatch as BasePriceItem).category || "Material";
        rateSource =
          (manualMatch as BasePriceItem).sourceType === "pwd_template"
            ? "PWD Template"
            : "Base Pricing Override";
      } else if (marketMatch) {
        rate = Number((marketMatch as MarketRateItem).price || 0);
        rateSource = resolveRateLabel((marketMatch as MarketRateItem).source || "scraped");
      }

      const total = item.qty * rate;

      return {
        ...item,
        rate,
        total,
        category,
        rateSource,
      };
    });

    setPricedItems(matched);
  }

  function handleRateChange(index: number, newRate: number) {
    const updated = [...pricedItems];
    updated[index].rate = newRate;
    updated[index].total = updated[index].qty * newRate;
    updated[index].rateSource = "Manual Override";
    setPricedItems(updated);
  }

  function handleMarketRateChange(index: number, newRate: number) {
    const safeRate = Number.isFinite(newRate) && newRate >= 0 ? newRate : 0;
    const updatedMarketRates = [...marketRates];
    const current = updatedMarketRates[index];

    if (!current) {
      return;
    }

    updatedMarketRates[index] = {
      ...current,
      price: safeRate,
      source: "manual",
    };

    setMarketRates(updatedMarketRates);

    // Keep BOQ rows synced only when they were previously using scraped market rates.
    setPricedItems((prev) =>
      prev.map((item) => {
        const currentSource = normalizeText(item.rateSource || "");
        if (!currentSource.includes("scraped")) {
          return item;
        }

        const match = findBestMatch(item.item, item.uom, updatedMarketRates);
        if (!match) {
          return item;
        }

        const nextRate = Number((match as MarketRateItem).price || 0);
        return {
          ...item,
          rate: nextRate,
          total: Number((item.qty * nextRate).toFixed(2)),
          rateSource: resolveRateLabel((match as MarketRateItem).source || "manual"),
        };
      })
    );
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
    setActiveRecommendationId(null);
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
      const expenses = Array.isArray(data.expenseRecommendations)
        ? (data.expenseRecommendations as ExpenseRecommendation[])
        : [];

      const baseRates = pricedItems.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = Number(item.rate || 0);
        return acc;
      }, {});

      setOptimizerBaseRatesByItem(baseRates);
      setOptimizerSuggestions(suggestions);
      setExpenseRecommendations(
        expenses.map((item) => ({
          ...item,
          head: item.head === "machinery" ? "machinery" : "labor",
          decision: undefined,
        }))
      );

      const engine = String(data?.suggestionEngine || "heuristic").toUpperCase();
      const llmConfigured = Boolean(data?.llmConfigured);
      const llmAttempted = Boolean(data?.llmAttempted);
      const llmUsed = Boolean(data?.llmUsed);
      const failureReason = String(data?.llmFailureReason || "");
      const model = llmConfigured && llmAttempted && data?.llmModel ? ` (${String(data.llmModel)})` : "";
      const usedLabel = llmUsed ? "LLM used" : "Fallback rules used";

      if (!llmConfigured && failureReason === "missing_api_key") {
        setOptimizerEngineInfo(
          "Engine: HEURISTIC • Fallback rules used • LLM disabled (missing API key). Set GEMINI_API_KEY in backend .env to enable LLM recommendations."
        );
      } else {
        const diagnostics = [
          `attempted=${llmAttempted}`,
          `configured=${llmConfigured}`,
          `candidates=${Number(data?.llmCandidateCount || 0)}`,
          `returned=${Number(data?.llmSuggestionCount || 0)}`,
        ];
        if (failureReason) {
          diagnostics.push(`reason=${failureReason}`);
        }

        setOptimizerEngineInfo(
          `Engine: ${engine}${model} • ${usedLabel} • ${diagnostics.join(" • ")}`
        );
      }
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

  function applyExpenseRecommendation(head: "labor" | "machinery", mode: "increase" | "decrease" | "base") {
    const recommendation = expenseRecommendations.find((item) => item.head === head);
    if (!recommendation) return;

    const multiplier = mode === "increase" ? 1.1 : mode === "decrease" ? 0.9 : 1;
    const adjustedAmount = Number((Number(recommendation.suggestedAmount || 0) * multiplier).toFixed(2));
    if (!Number.isFinite(adjustedAmount) || adjustedAmount <= 0) return;

    const syntheticId = head === "labor" ? 900000001 : 900000002;
    const lineItem: BOQItem = {
      id: syntheticId,
      item: head === "labor" ? "Recommended Labour Expense" : "Recommended Machinery Expense",
      qty: 1,
      uom: "LS",
      rate: adjustedAmount,
      total: adjustedAmount,
      category: head === "labor" ? "Labour" : "Machinery",
    };

    setPricedItems((prev) => {
      const idx = prev.findIndex((item) => item.id === syntheticId);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = lineItem;
        return clone;
      }
      return [...prev, lineItem];
    });

    setExpenseRecommendations((prev) =>
      prev.map((item) => (item.head === head ? { ...item, decision: mode } : item))
    );
  }

  function ignoreExpenseRecommendation(head: "labor" | "machinery") {
    const syntheticId = head === "labor" ? 900000001 : 900000002;
    const zeroLineItem: BOQItem = {
      id: syntheticId,
      item: head === "labor" ? "Recommended Labour Expense" : "Recommended Machinery Expense",
      qty: 1,
      uom: "LS",
      rate: 0,
      total: 0,
      category: head === "labor" ? "Labour" : "Machinery",
    };

    setPricedItems((prev) => {
      const idx = prev.findIndex((item) => item.id === syntheticId);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = zeroLineItem;
        return clone;
      }
      return [...prev, zeroLineItem];
    });

    setExpenseRecommendations((prev) =>
      prev.map((item) => (item.head === head ? { ...item, decision: "ignored" } : item))
    );
  }

  async function handleSubmit() {
    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    const submissionTotals = calculateTotals();
    const missingExpenseHeads: string[] = [];
    if (Number(submissionTotals.laborTotal || 0) <= 0) {
      missingExpenseHeads.push("Labour");
    }
    if (Number(submissionTotals.machineryTotal || 0) <= 0) {
      missingExpenseHeads.push("Machinery");
    }

    if (missingExpenseHeads.length > 0) {
      alert(
        `Please add ${missingExpenseHeads.join(" and ")} expenses before submitting the estimate.\n\n` +
          "Update BOQ/base-pricing mappings so relevant items are categorized under Labour/Machinery with valid rates."
      );
      return;
    }

    if (pricedItems.some((item) => item.rate === 0)) {
      const confirm = window.confirm(
        "Some items have zero rate. Do you want to continue?"
      );
      if (!confirm) return;
    }

    const normalizedBasicMaterialCost = basicMaterialCost.trim() === ""
      ? null
      : Number(basicMaterialCost);

    if (
      normalizedBasicMaterialCost !== null &&
      (!Number.isFinite(normalizedBasicMaterialCost) || normalizedBasicMaterialCost < 0)
    ) {
      alert("Basic material cost must be a non-negative number");
      return;
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
            basicMaterialCost: normalizedBasicMaterialCost,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit estimate");
      }

      const result = await response.json();
      const informationalAlerts = Array.isArray(result?.informationalAlerts)
        ? result.informationalAlerts
        : [];
      const previousProjectIncreaseAlert = informationalAlerts.find(
        (item: any) => item?.type === "previous_project_unit_price_increase"
      );

      const informationalSuffix = previousProjectIncreaseAlert
        ? `\n\nInfo Alert (can be ignored): ${previousProjectIncreaseAlert.itemCount || 0} material rate(s) are > ${Number(previousProjectIncreaseAlert.thresholdPercent || 10).toFixed(2)}% higher than previous project (${previousProjectIncreaseAlert.previousProjectName || "previous project"}).`
        : "";
      alert(
        `Estimate submitted successfully!\nRevision: ${result.revisionNumber}\nGrand Total: ${formatINR(result.grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${informationalSuffix}`
      );

      // Refresh projects to update status
      fetchProjects();
      onSubmitted?.();
      
      // Clear form
      setSelectedProjectId("");
      setBoqItems([]);
      setPricedItems([]);
      setNotes("");
      setTargetTotal("");
      setOptimizerError("");
      setOptimizerSuggestions([]);
      setExpenseRecommendations([]);
      setOptimizerEngineInfo("");
      setOptimizerBaseRatesByItem({});
      setBasicMaterialCost("");
      setActiveRecommendationId(null);
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
  const llmSuggestionByBoqItem = optimizerSuggestions.reduce<Map<number, OptimizerSuggestion>>((acc, suggestion) => {
    if (suggestion.source !== "llm") {
      return acc;
    }

    const boqItem = pricedItems.find((item) => item.id === suggestion.boqItemId);
    const category = String(boqItem?.category || "").toLowerCase();
    if (category.includes("labor") || category.includes("labour") || category.includes("mach")) {
      return acc;
    }

    const existing = acc.get(suggestion.boqItemId);
    if (!existing) {
      acc.set(suggestion.boqItemId, suggestion);
      return acc;
    }

    const existingPriority = getPriorityRank(existing.priority);
    const nextPriority = getPriorityRank(suggestion.priority);
    if (nextPriority < existingPriority || (nextPriority === existingPriority && suggestion.confidence > existing.confidence)) {
      acc.set(suggestion.boqItemId, suggestion);
    }

    return acc;
  }, new Map<number, OptimizerSuggestion>());

  const activeRecommendation = activeRecommendationId
    ? optimizerSuggestions.find((suggestion) => suggestion.suggestionId === activeRecommendationId) || null
    : null;

  useEffect(() => {
    if (!activeRecommendationId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveRecommendationId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRecommendationId]);

  const laborMarginAmount = totals.laborWithUplift - totals.laborTotal;
  const machineryMarginAmount = totals.machineryWithUplift - totals.machineryTotal;

  const renderCostBreakdownPanel = (
    extraStyle: React.CSSProperties = {},
    options: {
      collapsible?: boolean;
      collapsed?: boolean;
      onToggleCollapse?: () => void;
    } = {}
  ) => (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "#f0fdfa",
        borderRadius: "10px",
        border: "1px solid #ccfbf1",
        ...extraStyle,
      }}
    >
      <div
        style={{
          margin: "0 0 1rem 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#0f766e",
            fontWeight: 600,
          }}
        >
          Cost Summary
        </h3>
        {options.collapsible && options.onToggleCollapse ? (
          <button
            type="button"
            onClick={options.onToggleCollapse}
            style={{
              ...pageStyles.secondaryBtn,
              height: "34px",
              padding: "0 10px",
              borderRadius: "8px",
              fontSize: "0.85rem",
            }}
          >
            {options.collapsed ? "Expand" : "Collapse"}
          </button>
        ) : null}
      </div>

      {options.collapsed ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0.35rem",
            fontSize: "0.95rem",
          }}
        >
          <div style={{ color: "#0d9488", fontWeight: 600 }}>Grand Total</div>
          <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "1.4rem" }}>
            {formatINR(totals.grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      ) : (
        <>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "0.75rem",
            marginBottom: "0.5rem",
            fontSize: "0.95rem",
          }}
        >
        <div style={{ color: "#0d9488" }}>Material:</div>
        <div style={{ textAlign: "right", fontWeight: 500 }}>{formatINR(totals.materialTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ color: "#0d9488" }}>Labor Rate:</div>
        <div style={{ textAlign: "right", fontWeight: 500 }}>{formatINR(totals.laborTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ color: "#0d9488", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          Labor Margin ({marginConfig.laborUplift}%)
          {renderInlineAdjuster("laborUplift", "laborUplift", marginConfig.laborUplift)}
        </div>
        <div style={{ textAlign: "right", fontWeight: 600, color: "#0f766e" }}>{formatINR(laborMarginAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ color: "#0d9488" }}>Machinery Rate:</div>
        <div style={{ textAlign: "right", fontWeight: 500 }}>{formatINR(totals.machineryTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ color: "#0d9488", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          Machinery Margin ({marginConfig.machineryUplift}%)
          {renderInlineAdjuster("machineryUplift", "machineryUplift", marginConfig.machineryUplift)}
        </div>
        <div style={{ textAlign: "right", fontWeight: 600, color: "#0f766e" }}>{formatINR(machineryMarginAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ color: "#0d9488" }}>Other:</div>
        <div style={{ textAlign: "right", fontWeight: 500 }}>{formatINR(totals.otherTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ borderTop: "2px solid #99f6e4", paddingTop: "0.75rem", marginTop: "0.5rem", color: "#0f766e", fontWeight: 600 }}>
          Subtotal (with labor/machinery adjustments):
        </div>
        <div style={{ borderTop: "2px solid #99f6e4", paddingTop: "0.75rem", marginTop: "0.5rem", textAlign: "right", fontWeight: 700, fontSize: "1.1rem", color: "#0f766e" }}>
          {formatINR(totals.subtotalWithUplifts, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div style={{ color: "#0d9488", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          Project Overall Margin ({marginConfig.overallMargin}%)
          {renderInlineAdjuster("overallMargin", "overallMargin", marginConfig.overallMargin)}
        </div>
        <div style={{ textAlign: "right", fontWeight: 600, color: "#0f766e" }}>{formatINR(totals.marginAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

        <div style={{ borderTop: "3px solid #5eead4", paddingTop: "0.75rem", marginTop: "0.5rem", color: "#0f766e", fontWeight: 700, fontSize: "1.15rem", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          Grand Total:
        </div>
        <div style={{ borderTop: "3px solid #5eead4", paddingTop: "0.75rem", marginTop: "0.5rem", textAlign: "right", fontWeight: 700, fontSize: "1.5rem", color: "#0f766e" }}>
          {formatINR(totals.grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        </div>
        </>
      )}
    </div>
  );

  const outerStyle = embedded ? { display: "block" as const } : pageStyles.page;
  const cardStyle = embedded ? { ...pageStyles.card, padding: "0" } : pageStyles.card;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {!embedded ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "2rem",
            }}
          >
            <h2 style={pageStyles.title}>{pageHeading}</h2>
            <div style={{ width: "120px", opacity: 0.7 }}>
              <ConstructionIllustration type="blueprint" />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ ...pageStyles.title, fontSize: "clamp(18px, 3vw, 24px)" }}>{pageHeading}</h3>
            {selectedProject ? (
              <p style={pageStyles.subtitle}>
                Selected project: {selectedProject.name} ({selectedProject.site_address || "No location"})
              </p>
            ) : (
              <p style={pageStyles.subtitle}>Select a project from the dashboard status board below.</p>
            )}
          </div>
        )}

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
                marginRight: isLandscapeWide
                  ? `${(isFloatingBreakdownCollapsed ? FLOATING_BREAKDOWN_COLLAPSED_WIDTH : FLOATING_BREAKDOWN_WIDTH) + FLOATING_BREAKDOWN_GAP}px`
                  : 0,
              }}
            >
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
                  Current vs Target Gap: {formatINR(targetGap, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}

              {targetGap !== null && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0, color: targetGap <= 0 ? "#15803d" : "#1e293b", fontWeight: 600 }}>
                  {targetGap <= 0
                    ? `Target achieved. Current estimate is ${formatINR(Math.abs(targetGap), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} below target.`
                    : `Need ${formatINR(targetGap, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more reduction to reach target.`}
                </p>
              )}

              {acceptedCount > 0 && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "#334155" }}>
                  Accepted suggestions: {acceptedCount} • Net grand-total impact: {formatINR(acceptedImpact, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              {(optimizerSuggestions.length > 0 || expenseRecommendations.length > 0) && (
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
                        <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>{formatINR(acceptedImpact, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ border: "1px solid #ccfbf1", borderRadius: "8px", padding: "0.6rem", backgroundColor: "#f0fdfa" }}>
                        <div style={{ color: "#0f766e", fontSize: "0.82rem" }}>Remaining gap</div>
                        <div style={{ color: targetGap !== null && targetGap <= 0 ? "#15803d" : "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>
                          {targetGap === null ? "—" : formatINR(targetGap, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                  {expenseRecommendations.length > 0 && (
                    <div
                      style={{
                        border: "1px solid #6366f1",
                        borderRadius: "10px",
                        backgroundColor: "#eef2ff",
                        padding: "0.85rem",
                        display: "grid",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <strong style={{ color: "#3730a3" }}>Labour & Machinery Recommendations</strong>
                        <span style={{ color: "#312e81", fontWeight: 600 }}>Accepted choices create/update BOQ line items</span>
                      </div>

                      {expenseRecommendations.map((recommendation) => {
                        const headLabel = recommendation.head === "labor" ? "Labour" : "Machinery";
                        const increaseAmount = Number((Number(recommendation.suggestedAmount || 0) * 1.1).toFixed(2));
                        const decreaseAmount = Number((Number(recommendation.suggestedAmount || 0) * 0.9).toFixed(2));

                        return (
                          <div
                            key={recommendation.head}
                            style={{
                              border: "1px solid #c7d2fe",
                              borderRadius: "8px",
                              backgroundColor: "#ffffff",
                              padding: "0.75rem",
                              display: "grid",
                              gap: "0.45rem",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                              <strong style={{ color: "#1e1b4b" }}>{headLabel}</strong>
                              <span style={{ color: "#4338ca", fontWeight: 700 }}>
                                Suggested: {formatINR(Number(recommendation.suggestedAmount || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>

                            <p style={{ margin: 0, color: "#334155" }}>{recommendation.reason}</p>
                            <p style={{ margin: 0, color: "#6366f1", fontSize: "0.86rem" }}>
                              Confidence: {(Number(recommendation.confidence || 0) * 100).toFixed(0)}% • Source: {(recommendation.source || "heuristic").toUpperCase()}
                            </p>

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                              <button
                                onClick={() => applyExpenseRecommendation(recommendation.head, "increase")}
                                disabled={isUiLocked}
                                style={pageStyles.primaryBtn}
                              >
                                Increase ({formatINR(increaseAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </button>
                              <button
                                onClick={() => applyExpenseRecommendation(recommendation.head, "decrease")}
                                disabled={isUiLocked}
                                style={pageStyles.secondaryBtn}
                              >
                                Decrease ({formatINR(decreaseAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </button>
                              <button
                                onClick={() => applyExpenseRecommendation(recommendation.head, "base")}
                                disabled={isUiLocked}
                                style={pageStyles.secondaryBtn}
                              >
                                0% Base ({formatINR(Number(recommendation.suggestedAmount || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </button>
                              <button
                                onClick={() => ignoreExpenseRecommendation(recommendation.head)}
                                disabled={isUiLocked}
                                style={pageStyles.secondaryBtn}
                              >
                                Ignore
                              </button>
                            </div>

                            {recommendation.decision && (
                              <p style={{ margin: "0.2rem 0 0", color: "#334155", fontWeight: 600 }}>
                                Decision: {recommendation.decision === "ignored" ? "Ignored" : recommendation.decision === "increase" ? "Accepted • +10%" : recommendation.decision === "decrease" ? "Accepted • -10%" : "Accepted • 0% Base"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: "2rem" }}>
                <h3 style={{ ...pageStyles.subtitle, marginTop: 0 }}>
                  BOQ Items & Pricing
                </h3>
                <TableWrapper>
                  <table style={pageStyles.table}>
                    <thead>
                      <tr>
                        <th style={pageStyles.th}>#</th>
                        <th style={pageStyles.th}>Item Description</th>
                        <th className="num-header" style={pageStyles.th}>Quantity</th>
                        <th style={pageStyles.th}>UOM</th>
                        <th className="amount-header" style={pageStyles.th}>Rate (₹)</th>
                        <th style={pageStyles.th}>Rate Source</th>
                        <th className="amount-header" style={pageStyles.th}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricedItems.map((item, index) => {
                        const llmSuggestion = llmSuggestionByBoqItem.get(item.id);
                        return (
                          <Fragment key={item.id}>
                            <tr style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                              <td className="num-cell" style={pageStyles.td}>{index + 1}</td>
                              <td style={pageStyles.td}>{item.item}</td>
                              <td className="num-cell" style={pageStyles.td}>{item.qty}</td>
                              <td style={pageStyles.td}>{item.uom}</td>
                              <td className="amount-cell" style={pageStyles.td}>
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
                              <td style={pageStyles.td}>{item.rateSource || "PWD"}</td>
                              <td className="amount-cell" style={pageStyles.td}>{formatINR(item.total, { minimumFractionDigits: 2, maximumFractionDigits: 2, withSymbol: false })}</td>
                            </tr>

                            {llmSuggestion && (
                              <tr style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                                <td style={pageStyles.td} colSpan={7}>
                                  <div
                                    style={{
                                      border: "1px solid #99f6e4",
                                      backgroundColor: "#f0fdfa",
                                      borderRadius: "8px",
                                      padding: "0.6rem 0.75rem",
                                      display: "grid",
                                      gap: "0.4rem",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                                      <strong style={{ color: "#0f766e" }}>LLM Recommendation</strong>
                                      <span style={{ color: "#334155", fontWeight: 600 }}>
                                        Rate: {formatINR(llmSuggestion.oldRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → {formatINR(llmSuggestion.newRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>

                                    <p style={{ margin: 0, color: "#334155" }}>{llmSuggestion.reason}</p>

                                    {llmSuggestion.qualityValidation && (
                                      <p style={{ margin: 0, color: "#0f766e", fontWeight: 500 }}>
                                        Quality validation: {llmSuggestion.qualityValidation}
                                      </p>
                                    )}

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                      <span style={{ color: "#0f766e", fontWeight: 500 }}>
                                        Total impact: {formatINR(llmSuggestion.totalDelta, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • Confidence: {(llmSuggestion.confidence * 100).toFixed(0)}%
                                      </span>

                                      {llmSuggestion.blocked ? (
                                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                                          Guardrail: {llmSuggestion.blockReason || "Blocked"}
                                        </span>
                                      ) : (
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                          <button
                                            type="button"
                                            onClick={() => handleSuggestionDecision(llmSuggestion.suggestionId, "accepted")}
                                            disabled={isUiLocked || llmSuggestion.decision === "accepted"}
                                            style={pageStyles.primaryBtn}
                                          >
                                            {llmSuggestion.decision === "accepted" ? "Accepted" : "Accept"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSuggestionDecision(llmSuggestion.suggestionId, "declined")}
                                            disabled={isUiLocked || llmSuggestion.decision === "declined"}
                                            style={pageStyles.secondaryBtn}
                                          >
                                            {llmSuggestion.decision === "declined" ? "Declined" : "Decline"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrapper>

                <div style={{ marginTop: "1.5rem", border: "1px solid #ccfbf1", borderRadius: "10px", overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "#f0fdfa",
                      borderBottom: "1px solid #ccfbf1",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ color: "#0f172a" }}>Basic Material List (Editable)</strong>
                    <span style={{ color: "#475569", fontSize: "0.85rem" }}>
                      Update basic material rates before submitting your estimate.
                    </span>
                  </div>

                  <div style={{ maxHeight: "300px", overflow: "auto" }}>
                    <table style={{ ...pageStyles.table, margin: 0, border: "none" }}>
                      <thead>
                        <tr>
                          <th style={pageStyles.th}>Material</th>
                          <th style={pageStyles.th}>Brand</th>
                          <th className="amount-header" style={pageStyles.th}>Rate (₹)</th>
                          <th style={pageStyles.th}>UOM</th>
                          <th style={pageStyles.th}>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketRates.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={pageStyles.empty}>
                              No market rates found for this project location.
                            </td>
                          </tr>
                        ) : (
                          marketRates.slice(0, 120).map((rate, idx) => (
                            <tr
                              key={`${normalizeText(rate.materialName)}|${normalizeText(rate.brandName || "")}|${normalizeText(rate.unit)}|${idx}`}
                              style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                            >
                              <td style={pageStyles.td}>{rate.materialName || "-"}</td>
                              <td style={pageStyles.td}>{rate.brandName || "-"}</td>
                              <td className="amount-cell" style={pageStyles.td}>
                                <input
                                  type="number"
                                  min="0"
                                  value={Number.isFinite(rate.price) ? rate.price : 0}
                                  disabled={isUiLocked}
                                  onChange={(e) => handleMarketRateChange(idx, Number(e.target.value))}
                                  style={{
                                    ...pageStyles.input,
                                    width: "130px",
                                    padding: "0.45rem",
                                  }}
                                />
                              </td>
                              <td style={pageStyles.td}>{rate.unit || "-"}</td>
                              <td style={pageStyles.td}>{resolveRateLabel(rate.source || "manual")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
                    {loading ? "Submitting..." : isUiLocked ? "AI Processing..." : "Submit Estimation"}
                  </button>
                </div>
                {!isLandscapeWide && renderCostBreakdownPanel({ marginTop: "1.25rem" })}
            </div>
            </div>

            {isLandscapeWide &&
              renderCostBreakdownPanel({
                position: "fixed",
                right: "clamp(12px, 4vw, 32px)",
                top: "108px",
                width: `${isFloatingBreakdownCollapsed ? FLOATING_BREAKDOWN_COLLAPSED_WIDTH : FLOATING_BREAKDOWN_WIDTH}px`,
                maxHeight: "calc(100vh - 132px)",
                overflowY: "auto",
                zIndex: 60,
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                transition: "width 0.2s ease",
              }, {
                collapsible: true,
                collapsed: isFloatingBreakdownCollapsed,
                onToggleCollapse: () => setIsFloatingBreakdownCollapsed((prev) => !prev),
              })}

            {activeRecommendation && (
              <div
                role="dialog"
                aria-modal="true"
                onClick={() => setActiveRecommendationId(null)}
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 120,
                  padding: "1rem",
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "min(620px, 100%)",
                    border: "1px solid #99f6e4",
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                    padding: "1rem",
                    display: "grid",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "#0f172a" }}>LLM Recommendation</strong>
                    <button
                      type="button"
                      onClick={() => setActiveRecommendationId(null)}
                      aria-label="Close recommendation"
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

                  <p style={{ margin: 0, color: "#0f172a", fontWeight: 600 }}>
                    {activeRecommendation.itemDescription || "(No item description)"}
                  </p>

                  <p style={{ margin: 0, color: "#334155" }}>{activeRecommendation.reason}</p>

                  <p style={{ margin: 0, color: "#0f766e", fontWeight: 600 }}>
                    Rate: {formatINR(activeRecommendation.oldRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → {formatINR(activeRecommendation.newRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>

                  <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                    Total impact: {formatINR(activeRecommendation.totalDelta, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • Confidence: {(activeRecommendation.confidence * 100).toFixed(0)}%
                  </p>

                  {activeRecommendation.qualityValidation && (
                    <p style={{ margin: 0, color: "#0f766e", fontWeight: 500 }}>
                      Quality validation: {activeRecommendation.qualityValidation}
                    </p>
                  )}

                  {activeRecommendation.blocked ? (
                    <p style={{ margin: 0, color: "#b91c1c", fontWeight: 600 }}>
                      Guardrail blocked: {activeRecommendation.blockReason || "Blocked"}
                    </p>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSuggestionDecision(activeRecommendation.suggestionId, "accepted");
                          setActiveRecommendationId(null);
                        }}
                        disabled={isUiLocked || activeRecommendation.decision === "accepted"}
                        style={pageStyles.primaryBtn}
                      >
                        {activeRecommendation.decision === "accepted" ? "Accepted" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSuggestionDecision(activeRecommendation.suggestionId, "declined");
                          setActiveRecommendationId(null);
                        }}
                        disabled={isUiLocked || activeRecommendation.decision === "declined"}
                        style={pageStyles.secondaryBtn}
                      >
                        {activeRecommendation.decision === "declined" ? "Declined" : "Decline"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && selectedProjectId && pricedItems.length === 0 && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            No BOQ items found for this project.
          </p>
        )}

        {!selectedProjectId && !loading && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            Please select a project to start replacing BOQ rates with PWD rates.
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
