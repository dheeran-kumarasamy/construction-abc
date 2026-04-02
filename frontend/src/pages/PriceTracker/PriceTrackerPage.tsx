import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AlertDialog from "./AlertDialog";
import AddToHomeScreenBanner from "./AddToHomeScreenBanner";
import CategoryTabs from "./CategoryTabs";
import CompareTable from "./CompareTable";
import DistrictPricePanel from "./DistrictPricePanel";
import PriceAlertsList from "./PriceAlertsList";
import TamilNaduMap from "./TamilNaduMap";
import {
  addBookmark,
  createAlert,
  deleteAlert,
  fetchAlerts,
  fetchBookmarks,
  fetchCategories,
  fetchCompare,
  fetchDealerOwnPrices,
  fetchDistrictPrices,
  fetchDistricts,
  fetchHistory,
  removeBookmark,
  setDealerMaterialPrice,
} from "./priceTracker.api";
import type {
  Bookmark,
  CompareResponse,
  DealerOwnPrice,
  District,
  MaterialCategory,
  PriceAlert,
  PriceHistoryPoint,
  PriceRecord,
} from "./types";
import "./priceTracker.css";
import { useAuth } from "../../auth/AuthContext";
import { formatINR } from "../../services/currency";

export default function PriceTrackerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isDealer = user?.role === "dealer";
  const isPublicMarketPricesPage = location.pathname === "/market-prices";

  const [districts, setDistricts] = useState<District[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [compareMode, setCompareMode] = useState(false);
  const [compareDistrictIds, setCompareDistrictIds] = useState<string[]>([]);

  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [historyMaterialId, setHistoryMaterialId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistoryPoint[]>([]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  const [dealerMaterialId, setDealerMaterialId] = useState("");
  const [dealerPrice, setDealerPrice] = useState("");
  const [dealerUom, setDealerUom] = useState("");
  const [dealerMinimumQty, setDealerMinimumQty] = useState("1");
  const [dealerSpecs, setDealerSpecs] = useState("");
  const [dealerSaving, setDealerSaving] = useState(false);
  const [dealerError, setDealerError] = useState("");
  const [dealerSuccess, setDealerSuccess] = useState("");
  const [dealerOwnPrices, setDealerOwnPrices] = useState<DealerOwnPrice[]>([]);

  const selectedDistrict = useMemo(
    () => districts.find((district) => district.id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const availableStates = useMemo(() => {
    const values = Array.from(
      new Set(
        districts.map((district) => {
          const raw = String(district.state || "").trim();
          return raw || "Tamil Nadu";
        })
      )
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [districts]);

  const filteredDistricts = useMemo(() => {
    if (selectedState === "all") return districts;
    return districts.filter((district) => {
      const districtState = String(district.state || "Tamil Nadu").trim();
      return districtState === selectedState;
    });
  }, [districts, selectedState]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

  const bookmarkedDistrictIds = useMemo(() => new Set(bookmarks.map((item) => item.districtId)), [bookmarks]);
  const selectedDealerMaterial = useMemo(
    () => prices.find((p) => p.materialId === dealerMaterialId) || null,
    [prices, dealerMaterialId]
  );
  const dealerMaterialOptions = useMemo(() => {
    const unique = new Map<string, PriceRecord>();
    for (const price of prices) {
      if (!unique.has(price.materialId)) {
        unique.set(price.materialId, price);
      }
    }
    return Array.from(unique.values());
  }, [prices]);

  useEffect(() => {
    (async () => {
      try {
        const [districtData, categoryData, bookmarkData, alertData] = await Promise.all([
          fetchDistricts(),
          fetchCategories(),
          fetchBookmarks().catch(() => []),
          fetchAlerts().catch(() => []),
        ]);

        setDistricts(districtData);
        setCategories(categoryData);
        setBookmarks(bookmarkData);
        setAlerts(alertData);

        if (categoryData[0]?.id) {
          setActiveCategoryId(categoryData[0].id);
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedDistrictId || !activeCategory?.name || compareMode) return;
      const districtPrices = await fetchDistrictPrices(selectedDistrictId, activeCategory.name);
      setPrices(districtPrices);
      setHistoryMaterialId(null);
      setHistoryData([]);
    })().catch(console.error);
  }, [selectedDistrictId, activeCategory?.name, compareMode]);

  useEffect(() => {
    (async () => {
      if (!compareMode || compareDistrictIds.length < 2 || !activeCategory?.name) {
        setCompareData(null);
        return;
      }

      const data = await fetchCompare(compareDistrictIds, activeCategory.name);
      setCompareData(data);
    })().catch(console.error);
  }, [compareMode, compareDistrictIds, activeCategory?.name]);

  useEffect(() => {
    if (!districts.length) return;
    if (selectedState === "all") return;

    const isSelectedDistrictInState = districts.some((district) => {
      const districtState = String(district.state || "Tamil Nadu").trim();
      return district.id === selectedDistrictId && districtState === selectedState;
    });

    if (!isSelectedDistrictInState) {
      setSelectedDistrictId(null);
      setPrices([]);
      setHistoryMaterialId(null);
      setHistoryData([]);
    }

    setCompareDistrictIds((prev) =>
      prev.filter((districtId) =>
        districts.some((district) => {
          const districtState = String(district.state || "Tamil Nadu").trim();
          return district.id === districtId && districtState === selectedState;
        })
      )
    );
  }, [districts, selectedState, selectedDistrictId]);

  useEffect(() => {
    if (!isDealer) return;

    fetchDealerOwnPrices()
      .then(setDealerOwnPrices)
      .catch((error) => setDealerError(error.message || "Failed to load your prices"));
  }, [isDealer]);

  useEffect(() => {
    if (!isDealer || !selectedDistrict || compareMode || !prices.length) return;

    const exists = prices.some((p) => p.materialId === dealerMaterialId);
    if (!dealerMaterialId || !exists) {
      setDealerMaterialId(prices[0].materialId);
      setDealerUom(prices[0].unit || "");
    }
  }, [isDealer, selectedDistrict, compareMode, prices, dealerMaterialId]);

  const onDistrictClick = (districtId: string) => {
    setSelectedDistrictId(districtId);

    if (!compareMode) return;

    setCompareDistrictIds((prev) => {
      if (prev.includes(districtId)) {
        return prev.filter((id) => id !== districtId);
      }

      if (prev.length >= 4) return prev;
      return [...prev, districtId];
    });
  };

  const onDistrictDropdownChange = (value: string) => {
    if (value === "map") {
      setSelectedDistrictId(null);
      setHistoryMaterialId(null);
      setHistoryData([]);
      if (!compareMode) {
        setPrices([]);
      }
      return;
    }

    setSelectedDistrictId(value);
    if (compareMode) {
      setCompareDistrictIds((prev) => (prev.includes(value) ? prev : [...prev, value].slice(-4)));
    }
  };

  const toggleBookmark = async () => {
    if (!selectedDistrict) return;

    const existing = bookmarks.find((bookmark) => bookmark.districtId === selectedDistrict.id);
    if (existing) {
      await removeBookmark(existing.id);
      setBookmarks((prev) => prev.filter((item) => item.id !== existing.id));
      return;
    }

    await addBookmark(selectedDistrict.id);
    const updated = await fetchBookmarks();
    setBookmarks(updated);
  };

  const openHistory = async (materialId: string) => {
    if (!selectedDistrictId) return;
    setHistoryMaterialId(materialId);
    const data = await fetchHistory(materialId, selectedDistrictId, "90d");
    setHistoryData(data);
  };

  const saveAlert = async (payload: {
    materialId: string;
    districtId: string;
    condition: "above" | "below";
    threshold: number;
  }) => {
    await createAlert(payload);
    const updated = await fetchAlerts();
    setAlerts(updated);
  };

  const onDeleteAlert = async (id: string) => {
    await deleteAlert(id);
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  };

  const saveDealerPrice = async (e: React.FormEvent) => {
    e.preventDefault();

    setDealerError("");
    setDealerSuccess("");

    if (!selectedDistrictId) {
      setDealerError("Please select a district first.");
      return;
    }

    if (compareMode) {
      setDealerError("Turn off compare mode and select one district to enter dealer prices.");
      return;
    }

    if (!dealerMaterialId) {
      setDealerError("Please choose a product/material.");
      return;
    }

    if (!dealerPrice || Number(dealerPrice) <= 0) {
      setDealerError("Please enter a valid price.");
      return;
    }

    if (!dealerUom.trim()) {
      setDealerError("UOM is required.");
      return;
    }

    setDealerSaving(true);
    try {
      await setDealerMaterialPrice({
        materialId: dealerMaterialId,
        price: Number(dealerPrice),
        minimumQuantity: Number(dealerMinimumQty) || 1,
        unitOfSale: dealerUom.trim(),
        notes: dealerSpecs.trim() || undefined,
      });

      setDealerSuccess("Price saved successfully.");
      setDealerPrice("");
      setDealerSpecs("");
      const updated = await fetchDealerOwnPrices();
      setDealerOwnPrices(updated);
    } catch (error: any) {
      setDealerError(error.message || "Failed to save price.");
    } finally {
      setDealerSaving(false);
    }
  };

  const exitMarketPrices = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/login");
  };

  return (
    <div className="pt-page page-container">
      <AddToHomeScreenBanner />
      {isPublicMarketPricesPage ? (
        <button
          type="button"
          aria-label="Exit"
          title="Exit"
          onClick={exitMarketPrices}
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            width: 54,
            height: 54,
            minWidth: 54,
            borderRadius: "999px",
            padding: 0,
            fontSize: "24px",
            fontWeight: 900,
            lineHeight: 1,
            color: "#ffffff",
            background: "#b91c1c",
            border: "1px solid rgba(255, 255, 255, 0.24)",
            boxShadow: "0 10px 24px rgba(2, 6, 23, 0.38)",
            cursor: "pointer",
            zIndex: 999,
          }}
        >
          ✕
        </button>
      ) : null}
      <h1>TN Construction Material Price Tracker</h1>

      {isDealer ? (
        <section className="pt-card pt-dealer-form-wrap">
          <h2 className="pt-dealer-title">Dealer Product Pricing</h2>
          <p className="pt-dealer-subtitle">
            Select a district on the map. Then enter your own price for products shown in that district. UOM defaults from district rate and can be changed.
          </p>

          <div className="pt-map-hint" style={{ marginBottom: 10 }}>
            {compareMode
              ? "Compare mode is ON. Turn it OFF to enter dealer prices for a single district."
              : selectedDistrict
              ? `Selected district: ${selectedDistrict.name}`
              : "Select a district to start entering prices."}
          </div>

          <form className="pt-dealer-form" onSubmit={saveDealerPrice}>
            <label>
              Product / Material (from selected district rates)
              <select
                value={dealerMaterialId}
                onChange={(e) => {
                  const materialId = e.target.value;
                  setDealerMaterialId(materialId);
                  const picked = prices.find((p) => p.materialId === materialId);
                  if (picked) {
                    setDealerUom(picked.unit || "");
                  }
                }}
                required
                disabled={!selectedDistrict || compareMode || prices.length === 0}
              >
                {dealerMaterialOptions.map((material) => (
                  <option key={material.materialId} value={material.materialId}>
                    {material.materialName} ({material.unit})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Price
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={dealerPrice}
                onChange={(e) => setDealerPrice(e.target.value)}
                placeholder="e.g. 420.50"
                disabled={!selectedDistrict || compareMode}
                required
              />
            </label>

            <label>
              UOM (required)
              <input
                type="text"
                value={dealerUom}
                onChange={(e) => setDealerUom(e.target.value)}
                placeholder="e.g. bag, ton, kg, piece"
                disabled={!selectedDistrict || compareMode}
                required
              />
            </label>

            <label>
              Minimum Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={dealerMinimumQty}
                onChange={(e) => setDealerMinimumQty(e.target.value)}
                disabled={!selectedDistrict || compareMode}
              />
            </label>

            <label className="pt-dealer-spec-label">
              Product Specification (free text)
              <textarea
                value={dealerSpecs}
                onChange={(e) => setDealerSpecs(e.target.value)}
                rows={3}
                placeholder="Example: Ultratech OPC 53 Grade, fresh stock, moisture-resistant packing"
                disabled={!selectedDistrict || compareMode}
              />
            </label>

            {selectedDealerMaterial ? (
              <div className="pt-map-hint" style={{ gridColumn: "1 / -1" }}>
                District reference rate for {selectedDealerMaterial.materialName}: ₹
                {selectedDealerMaterial.price ? formatINR(selectedDealerMaterial.price, { minimumFractionDigits: 2, maximumFractionDigits: 2, withSymbol: false }) : "-"} per {selectedDealerMaterial.unit}
              </div>
            ) : null}

            {dealerError ? <div className="pt-dealer-error">{dealerError}</div> : null}
            {dealerSuccess ? <div className="pt-dealer-success">{dealerSuccess}</div> : null}

            <button
              type="submit"
              className="pt-dealer-save-btn"
              disabled={dealerSaving || !selectedDistrict || compareMode || prices.length === 0}
            >
              {dealerSaving ? "Saving..." : "Save Product Price"}
            </button>
          </form>

          <div className="pt-dealer-price-list">
            <h3>Your Saved Prices</h3>
            {dealerOwnPrices.length === 0 ? (
              <p className="pt-map-hint">No product prices saved yet.</p>
            ) : (
              <div className="pt-dealer-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>UOM</th>
                      <th>Specification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerOwnPrices.map((row) => (
                      <tr key={row.id}>
                        <td>{row.materialName || row.materialId}</td>
                        <td>{formatINR(row.price, { minimumFractionDigits: 2, maximumFractionDigits: 2, withSymbol: false })}</td>
                        <td>{row.unitOfSale || "-"}</td>
                        <td>{row.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <CategoryTabs
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelect={(id) => {
          setActiveCategoryId(id);
          setCompareData(null);
          setPrices([]);
        }}
      />

      <div className="pt-controls">
        <div className="pt-selector-grid">
          <label>
            State
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            >
              <option value="all">All States</option>
              {availableStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label>
            District
            <select
              value={selectedDistrictId || "map"}
              onChange={(e) => onDistrictDropdownChange(e.target.value)}
              disabled={compareMode}
            >
              <option value="map">Select on map</option>
              {filteredDistricts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </label>

          <label className="pt-compare-toggle">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => {
                setCompareMode(e.target.checked);
                setCompareDistrictIds([]);
              }}
            />
            Compare Mode
          </label>
        </div>
      </div>

      <div className="pt-main-grid">
        <TamilNaduMap
          districts={filteredDistricts}
          selectedDistrictId={selectedDistrictId}
          compareMode={compareMode}
          compareDistrictIds={compareDistrictIds}
          bookmarkedDistrictIds={bookmarkedDistrictIds}
          onDistrictClick={onDistrictClick}
        />

        <DistrictPricePanel
          district={selectedDistrict}
          prices={prices}
          isBookmarked={!!(selectedDistrict && bookmarkedDistrictIds.has(selectedDistrict.id))}
          onBookmarkToggle={toggleBookmark}
          onHistoryClick={openHistory}
          historyMaterialId={historyMaterialId}
          historyData={historyData}
          materialsForAlerts={activeCategory?.materials || []}
          onOpenAlertDialog={() => setAlertDialogOpen(true)}
        />
      </div>

      {compareMode ? <CompareTable data={compareData} /> : null}

      <PriceAlertsList alerts={alerts} onDelete={onDeleteAlert} />

      <AlertDialog
        open={alertDialogOpen}
        district={selectedDistrict}
        materials={activeCategory?.materials || []}
        onClose={() => setAlertDialogOpen(false)}
        onSave={saveAlert}
      />
    </div>
  );
}
