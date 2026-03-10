import type { District, Material, PriceHistoryPoint, PriceRecord } from "./types";
import BookmarkButton from "./BookmarkButton";
import PriceHistoryChart from "./PriceHistoryChart";

interface Props {
  district: District | null;
  prices: PriceRecord[];
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onHistoryClick: (materialId: string) => Promise<void>;
  historyMaterialId: string | null;
  historyData: PriceHistoryPoint[];
  materialsForAlerts: Material[];
  onOpenAlertDialog: () => void;
}

export default function DistrictPricePanel({
  district,
  prices,
  isBookmarked,
  onBookmarkToggle,
  onHistoryClick,
  historyMaterialId,
  historyData,
  onOpenAlertDialog,
}: Props) {
  if (!district) {
    return (
      <div className="pt-card">
        <h3>District Prices</h3>
        <p>Select a district on the map.</p>
      </div>
    );
  }

  return (
    <div className="pt-card">
      <div className="pt-panel-header">
        <h3>{district.name} Prices</h3>
        <BookmarkButton isBookmarked={isBookmarked} onToggle={onBookmarkToggle} />
      </div>

      <button type="button" className="pt-alert-open-btn" onClick={onOpenAlertDialog}>Create Alert</button>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Trend</th>
              <th>Last Updated</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((item) => (
              <tr key={item.materialId}>
                <td>{item.materialName}</td>
                <td>{item.unit}</td>
                <td>{item.price ? `₹${item.price.toFixed(2)}` : "-"}</td>
                <td>
                  {item.trend === "up" ? "🔺" : item.trend === "down" ? "🔻" : "⏺"} {item.percentChange}%
                </td>
                <td>{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : "-"}</td>
                <td>
                  <button type="button" onClick={() => onHistoryClick(item.materialId)}>
                    📈 History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historyMaterialId ? (
        <div className="pt-history-block">
          <PriceHistoryChart data={historyData} />
        </div>
      ) : null}
    </div>
  );
}
