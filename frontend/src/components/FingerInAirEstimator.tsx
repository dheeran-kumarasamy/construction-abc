import React from "react";
import { apiUrl } from "../services/api";
import { pageStyles } from "../layouts/pageStyles";

type EstimateResult = {
  status: string;
  message: string;
  per_sqft_rate: number | null;
  per_sqm_rate: number | null;
  total_project_cost: number | null;
  total_area_sqft: number | null;
  total_area_sqm: number | null;
  breakup?: {
    base_cost: number;
    services_amount: number;
    external_works_amount: number;
    contingency_amount: number;
    escalation_amount: number;
  };
};

function formatINR(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function FingerInAirEstimator() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<EstimateResult | null>(null);

  const [buildingClass, setBuildingClass] = React.useState("");
  const [roofType, setRoofType] = React.useState("");
  const [plinthAreaSqm, setPlinthAreaSqm] = React.useState("");
  const [numFloors, setNumFloors] = React.useState("");
  const [locationZone, setLocationZone] = React.useState("");
  const [qualityGrade, setQualityGrade] = React.useState("");
  const [includeServices, setIncludeServices] = React.useState(true);
  const [includeExternalWorks, setIncludeExternalWorks] = React.useState(true);
  const [contingencyPercent, setContingencyPercent] = React.useState("");
  const [escalationPercent, setEscalationPercent] = React.useState("");

  async function runEstimate() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      const payload: Record<string, unknown> = {
        include_services: includeServices,
        include_external_works: includeExternalWorks,
      };

      if (buildingClass.trim()) payload.building_class = buildingClass.trim();
      if (roofType.trim()) payload.roof_type = roofType.trim();
      if (plinthAreaSqm.trim()) payload.plinth_area_sqm = Number(plinthAreaSqm);
      if (numFloors.trim()) payload.num_floors = Number(numFloors);
      if (locationZone.trim()) payload.location_zone = locationZone;
      if (qualityGrade.trim()) payload.quality_grade = qualityGrade;
      if (contingencyPercent.trim()) payload.contingency_percent = Number(contingencyPercent);
      if (escalationPercent.trim()) payload.escalation_percent = Number(escalationPercent);

      const res = await fetch(apiUrl("/api/estimation/quick/finger-in-air"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to compute quick estimate");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to compute quick estimate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #bae6fd",
        borderRadius: 14,
        background: "#f0f9ff",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Finger-in-the-Air Estimate</h3>
        <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 14 }}>
          Quick PWD-based per sq.ft and total project cost estimate from high-level inputs.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input style={pageStyles.input} placeholder="Building class (default A1)" value={buildingClass} onChange={(e) => setBuildingClass(e.target.value)} />
        <input style={pageStyles.input} placeholder="Roof type (default RCC)" value={roofType} onChange={(e) => setRoofType(e.target.value)} />
        <input style={pageStyles.input} type="number" placeholder="Plinth area sqm (default 111.48)" value={plinthAreaSqm} onChange={(e) => setPlinthAreaSqm(e.target.value)} />
        <input style={pageStyles.input} type="number" placeholder="Floors (default 2)" value={numFloors} onChange={(e) => setNumFloors(e.target.value)} />

        <select style={pageStyles.select} value={locationZone} onChange={(e) => setLocationZone(e.target.value)}>
          <option value="">Location zone (default normal)</option>
          <option value="normal">Normal</option>
          <option value="urban">Urban</option>
          <option value="metro">Metro</option>
          <option value="rural">Rural</option>
        </select>

        <select style={pageStyles.select} value={qualityGrade} onChange={(e) => setQualityGrade(e.target.value)}>
          <option value="">Quality grade (default standard)</option>
          <option value="economy">Economy</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>

        <input style={pageStyles.input} type="number" placeholder="Contingency % (default 5)" value={contingencyPercent} onChange={(e) => setContingencyPercent(e.target.value)} />
        <input style={pageStyles.input} type="number" placeholder="Escalation % (default 0)" value={escalationPercent} onChange={(e) => setEscalationPercent(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#0f172a" }}>
          <input type="checkbox" checked={includeServices} onChange={(e) => setIncludeServices(e.target.checked)} />
          Include services
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#0f172a" }}>
          <input type="checkbox" checked={includeExternalWorks} onChange={(e) => setIncludeExternalWorks(e.target.checked)} />
          Include external works
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={pageStyles.primaryBtn} onClick={runEstimate} disabled={loading}>
          {loading ? "Calculating..." : "Get Quick Estimate"}
        </button>
      </div>

      {error && <div style={pageStyles.error}>{error}</div>}

      {result && (
        <div style={{ borderTop: "1px solid #bae6fd", paddingTop: 12, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{result.message}</div>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Per sq.ft rate</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{formatINR(result.per_sqft_rate)}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Total project cost</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{formatINR(result.total_project_cost)}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Total area</div>
              <div style={{ fontWeight: 700 }}>
                {(result.total_area_sqft || 0).toLocaleString("en-IN")} sq.ft
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
