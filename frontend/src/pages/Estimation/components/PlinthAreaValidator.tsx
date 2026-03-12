import { useState, useEffect } from "react";
import { pageStyles } from "../../../layouts/pageStyles";
import * as api from "../estimation.api";
import type { PlinthAreaRate } from "../types";
import type { PlinthValidationResult } from "../estimation.api";

const BUILDING_CLASSES = [
  { code: "I-A", label: "Class I-A — RCC Framed, Multi-storey" },
  { code: "I-B", label: "Class I-B — RCC Framed, Single-storey" },
  { code: "II-A", label: "Class II-A — Load Bearing, Multi-storey" },
  { code: "II-B", label: "Class II-B — Load Bearing, Single-storey" },
  { code: "III-A", label: "Class III-A — Semi-pucca, Tiled roof" },
  { code: "III-B", label: "Class III-B — Semi-pucca, Sheet roof" },
  { code: "IV-A", label: "Class IV-A — Kutcha, Tiled" },
  { code: "IV-B", label: "Class IV-B — Kutcha, Thatched" },
];

interface Props {
  projectId: string;
}

export default function PlinthAreaValidator({ projectId }: Props) {
  const [plinthRates, setPlinthRates] = useState<PlinthAreaRate[]>([]);
  const [form, setForm] = useState({
    plinth_area_sqm: 100,
    building_class: "I-A",
    num_floors: 1,
  });
  const [result, setResult] = useState<PlinthValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.fetchPlinthAreaRates().then(setPlinthRates).catch(console.error);
  }, []);

  async function handleValidate() {
    try {
      setLoading(true);
      const res = await api.validatePlinthArea(projectId, form);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    pass: { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
    warning: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
    fail: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
    no_benchmark: { bg: "#f1f5f9", border: "#64748b", text: "#475569" },
  };

  return (
    <div style={{ ...pageStyles.card, padding: 20 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Plinth Area Validation</h3>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
        Compare your project estimate against TN PWD plinth area benchmark rates
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ ...pageStyles.field, flex: "1 1 200px" }}>
          <label style={{ ...pageStyles.label, fontSize: 12 }}>Building Class</label>
          <select
            style={{ ...pageStyles.select, fontSize: 13 }}
            value={form.building_class}
            onChange={(e) => setForm({ ...form, building_class: e.target.value })}
          >
            {BUILDING_CLASSES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div style={{ ...pageStyles.field, flex: "0 0 120px" }}>
          <label style={{ ...pageStyles.label, fontSize: 12 }}>Plinth Area (m²)</label>
          <input
            type="number"
            style={{ ...pageStyles.input, fontSize: 13 }}
            value={form.plinth_area_sqm}
            onChange={(e) => setForm({ ...form, plinth_area_sqm: Number(e.target.value) })}
            min={1}
          />
        </div>
        <div style={{ ...pageStyles.field, flex: "0 0 80px" }}>
          <label style={{ ...pageStyles.label, fontSize: 12 }}>Floors</label>
          <input
            type="number"
            style={{ ...pageStyles.input, fontSize: 13 }}
            value={form.num_floors}
            onChange={(e) => setForm({ ...form, num_floors: Number(e.target.value) })}
            min={1}
            max={20}
          />
        </div>
        <button
          style={{ ...pageStyles.primaryBtn, height: 38, fontSize: 13 }}
          onClick={handleValidate}
          disabled={loading}
        >
          {loading ? "Validating..." : "Validate"}
        </button>
      </div>

      {result && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `2px solid ${statusColors[result.status]?.border || "#ccc"}`,
          background: statusColors[result.status]?.bg || "#fff",
          color: statusColors[result.status]?.text || "#000",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {result.status === "pass" ? "✓ PASS" : result.status === "warning" ? "⚠ WARNING" : result.status === "fail" ? "✕ FAIL" : "ℹ No Benchmark"}
            </div>
            <div style={{ fontSize: 13 }}>{result.message}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Project Total</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{fmt(result.project_total)}</div>
            </div>
            {result.benchmark_total != null && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Benchmark Total</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{fmt(result.benchmark_total)}</div>
              </div>
            )}
            {result.deviation_percent != null && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Deviation</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {result.deviation_percent > 0 ? "+" : ""}{result.deviation_percent}%
                </div>
              </div>
            )}
            {result.cost_per_sqft != null && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Cost per sq.ft</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>₹{result.cost_per_sqft}</div>
              </div>
            )}
            {result.benchmark_rate_per_sqm != null && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Benchmark Rate / m²</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>₹{result.benchmark_rate_per_sqm}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Total Built-up Area</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{result.total_area} m² ({(result.total_area * 10.764).toFixed(0)} sq.ft)</div>
            </div>
          </div>

          {result.flags.length > 0 && (
            <div style={{ marginTop: 12, padding: 10, background: "rgba(0,0,0,0.05)", borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Flags:</div>
              {result.flags.map((f, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>• {f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reference: Plinth Area Rates */}
      {plinthRates.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            Reference: PWD Plinth Area Rates
          </summary>
          <table style={{ ...pageStyles.table, fontSize: 12, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Class</th>
                <th style={pageStyles.th}>Description</th>
                <th style={pageStyles.th}>Floor</th>
                <th style={pageStyles.th}>Rate / m²</th>
                <th style={pageStyles.th}>Rate / sq.ft</th>
              </tr>
            </thead>
            <tbody>
              {plinthRates.map((r, i) => (
                <tr key={r.id} style={i % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{r.class_code}</td>
                  <td style={pageStyles.td}>{r.description}</td>
                  <td style={pageStyles.td}>{r.floor}</td>
                  <td style={pageStyles.td}>₹{Number(r.rate).toLocaleString("en-IN")}</td>
                  <td style={pageStyles.td}>₹{Math.round(Number(r.rate) / 10.764).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
