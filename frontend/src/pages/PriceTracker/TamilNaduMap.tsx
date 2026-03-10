import type { District } from "./types";

interface Props {
  districts: District[];
  selectedDistrictId: string | null;
  compareMode: boolean;
  compareDistrictIds: string[];
  bookmarkedDistrictIds: Set<string>;
  onDistrictClick: (districtId: string) => void;
}

const MIN_LAT = 8.05;
const MAX_LAT = 13.6;
const MIN_LNG = 76.5;
const MAX_LNG = 80.5;

function toXY(lat: number, lng: number) {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * 100;
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
}

export default function TamilNaduMap({
  districts,
  selectedDistrictId,
  compareMode,
  compareDistrictIds,
  bookmarkedDistrictIds,
  onDistrictClick,
}: Props) {
  return (
    <div className="pt-map-wrap">
      <svg viewBox="0 0 100 120" className="pt-map" role="img" aria-label="Tamil Nadu District Map">
        <path
          d="M35,6 L53,7 L69,18 L75,30 L71,44 L79,61 L74,77 L66,95 L54,112 L43,113 L37,104 L27,96 L24,82 L18,69 L21,56 L16,41 L23,27 L30,18 Z"
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="0.8"
        />

        {districts.map((district) => {
          const { x, y } = toXY(district.lat, district.lng);
          const isSelected = district.id === selectedDistrictId;
          const isCompared = compareDistrictIds.includes(district.id);
          const isBookmarked = bookmarkedDistrictIds.has(district.id);

          return (
            <g key={district.id} onClick={() => onDistrictClick(district.id)} style={{ cursor: "pointer" }}>
              <circle
                cx={x}
                cy={y}
                r={isSelected || isCompared ? 2.4 : 1.7}
                fill={isSelected ? "#0f766e" : isCompared ? "#2563eb" : "#334155"}
              />
              {isBookmarked ? (
                <text x={x + 1.8} y={y - 1.8} fontSize="2.8" fill="#eab308">
                  ★
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <p className="pt-map-hint">
        {compareMode ? "Compare mode: select up to 4 districts" : "Tap any district point to view prices"}
      </p>
    </div>
  );
}
