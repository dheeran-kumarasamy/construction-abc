import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";

const BUILDING_TYPES = ["Residential", "Commercial", "Industrial"] as const;
const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const DEFAULT_MAP_ZOOM = 5;
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 68.0],
  [37.8, 97.5],
];

type ReverseGeocodeResponse = {
  display_name?: string;
};

type SearchLocationResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function LocationSelectionHandler({
  latitude,
  longitude,
  onSelect,
}: {
  latitude: number | null;
  longitude: number | null;
  onSelect: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.75 });
  }, [latitude, longitude, map]);

  return latitude != null && longitude != null ? (
    <CircleMarker
      center={[latitude, longitude]}
      radius={10}
      pathOptions={{
        fillColor: "#0f766e",
        color: "#0b5c56",
        weight: 2,
        fillOpacity: 0.85,
      }}
    />
  ) : null;
}

export default function CreateProject() {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(1);
  const [buildingType, setBuildingType] = useState<(typeof BUILDING_TYPES)[number] | "">("");
  const [floorsAboveGround, setFloorsAboveGround] = useState(1);
  const [floorsBelowGround, setFloorsBelowGround] = useState(0);

  const [currency, setCurrency] = useState("INR");
  const [confirmDollar, setConfirmDollar] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const latestLookupIdRef = useRef(0);
  const addressEditVersionRef = useRef(0);

  async function searchLocations(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    setSearchingLocations(true);
    setError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&addressdetails=1&q=${encodeURIComponent(trimmedQuery)}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": "en-IN",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to search locations on the map");
      }

      const data = (await response.json()) as SearchLocationResult[];
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setSearchResults([]);
      setError(err.message || "Unable to search locations on the map");
    } finally {
      setSearchingLocations(false);
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    const lookupId = Date.now();
    const addressEditVersionAtRequest = addressEditVersionRef.current;
    latestLookupIdRef.current = lookupId;
    setResolvingAddress(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to fetch address for the selected map location");
      }

      const data = (await response.json()) as ReverseGeocodeResponse;
      if (latestLookupIdRef.current !== lookupId) return;
      if (data.display_name && addressEditVersionRef.current === addressEditVersionAtRequest) {
        setSiteAddress(data.display_name);
      }
    } catch (err: any) {
      if (latestLookupIdRef.current !== lookupId) return;
      setError(err.message || "Unable to fetch address for the selected map location");
    } finally {
      if (latestLookupIdRef.current === lookupId) {
        setResolvingAddress(false);
      }
    }
  }

  function handleMapSelection(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setError("");
    void reverseGeocode(lat, lng);
  }

  function handleSearchResultSelect(result: SearchLocationResult) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Unable to use the selected search result");
      return;
    }

    setLatitude(lat);
    setLongitude(lng);
    setSiteAddress(result.display_name);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    if (!siteAddress.trim()) {
      setError("Site address is required");
      return;
    }

    if (latitude == null || longitude == null) {
      setError("Site map location is required");
      return;
    }

    if (!startDate) {
      setError("Start date is required");
      return;
    }

    if (!durationMonths || durationMonths < 1) {
      setError("Duration must be at least 1 month");
      return;
    }

    if (!buildingType) {
      setError("Project type is required");
      return;
    }

    // Only validate floor inputs for non-industrial projects
    if (buildingType !== "Industrial") {
      if (!Number.isInteger(floorsAboveGround) || floorsAboveGround < 1) {
        setError("Floors above natural ground level must be at least 1");
        return;
      }

      if (!Number.isInteger(floorsBelowGround) || floorsBelowGround < 0) {
        setError("Floors below natural ground level must be 0 or more");
        return;
      }
    }

    if (currency === "USD" && !confirmDollar) {
      setError("Please confirm the dollar currency selection");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token || token === "undefined" || token === "null") {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("auth_user");
        localStorage.removeItem("builder_profile_complete");
        navigate("/login", { replace: true });
        return;
      }

      // For industrial projects, always use 1 floor above and 0 below
      const finalFloorsAbove = buildingType === "Industrial" ? 1 : floorsAboveGround;
      const finalFloorsBelow = buildingType === "Industrial" ? 0 : floorsBelowGround;

      const res = await fetch(apiUrl("/projects"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: description.trim() || undefined,
          siteAddress,
          latitude,
          longitude,
          startDate,
          durationMonths,
          buildingType,
          floorsAboveGround: finalFloorsAbove,
          floorsBelowGround: finalFloorsBelow,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      navigate("/architect/projects");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <h2 style={pageStyles.title}>Create Project</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={pageStyles.input}
              placeholder="Enter project name"
              required
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={pageStyles.input}
              placeholder="Short description"
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Site Map Location</label>
            <div
              style={{
                position: "relative",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 56,
                  right: 12,
                  zIndex: 1000,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    width: "min(620px, calc(100% - 8px))",
                    background: "rgba(255, 255, 255, 0.96)",
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(226, 232, 240, 0.95)",
                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
                  }}
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void searchLocations(searchQuery);
                      }
                    }}
                    style={{ ...pageStyles.input, height: 40, flex: 1, minWidth: 0 }}
                    placeholder="Search inside the map"
                  />
                  <button
                    type="button"
                    style={{ ...pageStyles.primaryBtn, height: 40, padding: "0 14px", flexShrink: 0 }}
                    onClick={() => void searchLocations(searchQuery)}
                    disabled={searchingLocations}
                  >
                    {searchingLocations ? "Searching..." : "Search"}
                  </button>
                </div>

                {searchResults.length > 0 ? (
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      background: "rgba(255, 255, 255, 0.98)",
                      borderRadius: 10,
                      border: "1px solid rgba(226, 232, 240, 0.95)",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
                    }}
                  >
                    {searchResults.map((result) => (
                      <button
                        key={result.place_id}
                        type="button"
                        onClick={() => handleSearchResultSelect(result)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          borderBottom: "1px solid #e2e8f0",
                          background: "transparent",
                          color: "#0f172a",
                          cursor: "pointer",
                          fontSize: 13,
                          lineHeight: 1.4,
                        }}
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <MapContainer
                center={INDIA_CENTER}
                zoom={DEFAULT_MAP_ZOOM}
                scrollWheelZoom
                maxBounds={INDIA_BOUNDS}
                maxBoundsViscosity={0.85}
                style={{ height: 320, width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <LocationSelectionHandler
                  latitude={latitude}
                  longitude={longitude}
                  onSelect={handleMapSelection}
                />
              </MapContainer>
            </div>
            <div style={{ ...pageStyles.formGrid, marginTop: 8 }}>
              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Latitude</label>
                <input
                  type="text"
                  value={latitude == null ? "" : latitude.toFixed(6)}
                  readOnly
                  style={{ ...pageStyles.input, background: "#f8fafc" }}
                  placeholder="Select a point on the map"
                />
              </div>
              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Longitude</label>
                <input
                  type="text"
                  value={longitude == null ? "" : longitude.toFixed(6)}
                  readOnly
                  style={{ ...pageStyles.input, background: "#f8fafc" }}
                  placeholder="Select a point on the map"
                />
              </div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              Click on the map to pick the project location. The site address will auto-fill and can still be edited manually.
            </span>
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Site Address</label>
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => {
                addressEditVersionRef.current += 1;
                setSiteAddress(e.target.value);
              }}
              style={pageStyles.input}
              placeholder={resolvingAddress ? "Fetching address from selected location..." : "Enter site address"}
              required
            />
            {resolvingAddress ? (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                Resolving address from the selected map location...
              </span>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                You can edit the auto-filled address if needed.
              </span>
            )}
          </div>

          <div style={pageStyles.formGrid}>
            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Project Type</label>
              <select
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value as (typeof BUILDING_TYPES)[number] | "")}
                style={pageStyles.select}
                required
              >
                <option value="">Select project type</option>
                {BUILDING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={pageStyles.input}
                required
              />
            </div>

            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Duration (months)</label>
              <input
                type="number"
                min={1}
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                style={pageStyles.input}
                required
              />
            </div>

{buildingType !== "Industrial" && (
              <>
                <div style={pageStyles.field}>
                  <label style={pageStyles.label}>Floors Above Natural Ground Level</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={floorsAboveGround}
                    onChange={(e) => setFloorsAboveGround(Number(e.target.value))}
                    style={pageStyles.input}
                    required
                  />
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    Excluding stilt and underground floors.
                  </span>
                </div>

                <div style={pageStyles.field}>
                  <label style={pageStyles.label}>Floors Below Natural Ground Level</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={floorsBelowGround}
                    onChange={(e) => setFloorsBelowGround(Number(e.target.value))}
                    style={pageStyles.input}
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Currency</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setConfirmDollar(false);
              }}
              style={pageStyles.input}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {currency === "USD" && (
            <div style={pageStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={confirmDollar}
                onChange={(e) => setConfirmDollar(e.target.checked)}
              />
              <span>Confirm project currency is US Dollar</span>
            </div>
          )}

          {error && <div style={pageStyles.error}>{error}</div>}

          <div style={pageStyles.actions}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={pageStyles.secondaryBtn}
              disabled={loading}
            >
              Cancel
            </button>

            <button type="submit" style={pageStyles.primaryBtn} disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
