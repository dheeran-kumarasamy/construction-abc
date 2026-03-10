import { useEffect, useMemo, useState } from "react";
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
  fetchDistrictPrices,
  fetchDistricts,
  fetchHistory,
  removeBookmark,
} from "./priceTracker.api";
import type {
  Bookmark,
  CompareResponse,
  District,
  MaterialCategory,
  PriceAlert,
  PriceHistoryPoint,
  PriceRecord,
} from "./types";
import "./priceTracker.css";

export default function PriceTrackerPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDistrictIds, setCompareDistrictIds] = useState<string[]>([]);

  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [historyMaterialId, setHistoryMaterialId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistoryPoint[]>([]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  const selectedDistrict = useMemo(
    () => districts.find((district) => district.id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

  const bookmarkedDistrictIds = useMemo(() => new Set(bookmarks.map((item) => item.districtId)), [bookmarks]);

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

  return (
    <div className="pt-page page-container">
      <AddToHomeScreenBanner />
      <h1>TN Construction Material Price Tracker</h1>

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
        <label>
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

      <div className="pt-main-grid">
        <TamilNaduMap
          districts={districts}
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
