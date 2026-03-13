import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { District } from "./types";

interface Props {
  districts: District[];
  selectedDistrictId: string | null;
  compareMode: boolean;
  compareDistrictIds: string[];
  bookmarkedDistrictIds: Set<string>;
  onDistrictClick: (districtId: string) => void;
}

/* Centre of Tamil Nadu & zoom that fits the state nicely */
const TN_CENTER: [number, number] = [10.85, 78.65];
const TN_ZOOM = 7;
const DEVICE_ZOOM = 10;

/* On first load, center map to current device location if permission is granted. */
function CenterOnDeviceLocation() {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (hasCentered.current) return;
    hasCentered.current = true;

    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.setView([coords.latitude, coords.longitude], DEVICE_ZOOM);
      },
      () => {
        /* Keep Tamil Nadu fallback center when location permission is denied/unavailable. */
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, [map]);

  return null;
}

/* Fly the map to the selected district smoothly */
function FlyToSelected({ districts, selectedDistrictId }: { districts: District[]; selectedDistrictId: string | null }) {
  const map = useMap();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedDistrictId && selectedDistrictId !== prevId.current) {
      const d = districts.find((x) => x.id === selectedDistrictId);
      if (d) map.flyTo([d.lat, d.lng], 9, { duration: 0.8 });
      prevId.current = selectedDistrictId;
    }
  }, [selectedDistrictId, districts, map]);
  return null;
}

function getMarkerStyle(
  isSelected: boolean,
  isCompared: boolean,
  isBookmarked: boolean,
): { radius: number; fillColor: string; color: string; weight: number; fillOpacity: number } {
  if (isSelected) return { radius: 12, fillColor: "#0f766e", color: "#064e3b", weight: 3, fillOpacity: 0.85 };
  if (isCompared) return { radius: 11, fillColor: "#2563eb", color: "#1e3a8a", weight: 3, fillOpacity: 0.8 };
  if (isBookmarked) return { radius: 9, fillColor: "#eab308", color: "#a16207", weight: 2, fillOpacity: 0.75 };
  return { radius: 8, fillColor: "#334155", color: "#1e293b", weight: 1.5, fillOpacity: 0.7 };
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
      <MapContainer
        center={TN_CENTER}
        zoom={TN_ZOOM}
        scrollWheelZoom
        className="pt-leaflet-map"
        zoomControl={true}
        attributionControl={false}
      >
        {/* CartoDB Voyager — clean, professional, label-friendly tile layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        <CenterOnDeviceLocation />
        <FlyToSelected districts={districts} selectedDistrictId={selectedDistrictId} />

        {/* Render unselected districts first so selected ones render on top */}
        {districts
          .slice()
          .sort((a, b) => {
            const aActive = a.id === selectedDistrictId || compareDistrictIds.includes(a.id) ? 1 : 0;
            const bActive = b.id === selectedDistrictId || compareDistrictIds.includes(b.id) ? 1 : 0;
            return aActive - bActive;
          })
          .map((district) => {
            const isSelected = district.id === selectedDistrictId;
            const isCompared = compareDistrictIds.includes(district.id);
            const isBookmarked = bookmarkedDistrictIds.has(district.id);
            const style = getMarkerStyle(isSelected, isCompared, isBookmarked);

            return (
              <CircleMarker
                key={district.id}
                center={[district.lat, district.lng]}
                radius={style.radius}
                pathOptions={{
                  fillColor: style.fillColor,
                  color: style.color,
                  weight: style.weight,
                  fillOpacity: style.fillOpacity,
                }}
                eventHandlers={{ click: () => onDistrictClick(district.id) }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -style.radius]}
                  className="pt-district-tooltip"
                >
                  <span className="pt-tooltip-name">{district.name}</span>
                  {isSelected && <span className="pt-tooltip-badge selected">Selected</span>}
                  {isCompared && !isSelected && <span className="pt-tooltip-badge compared">Comparing</span>}
                  {isBookmarked && <span className="pt-tooltip-badge bookmarked">★ Saved</span>}
                </Tooltip>
              </CircleMarker>
            );
          })}
      </MapContainer>

      <p className="pt-map-hint">
        {compareMode ? "Compare mode — click up to 4 districts" : "Click a district to view prices"}
      </p>
    </div>
  );
}
