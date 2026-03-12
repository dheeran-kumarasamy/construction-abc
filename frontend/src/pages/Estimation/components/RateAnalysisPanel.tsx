import type { RateComputationResult } from "../types";
import { pageStyles } from "../../../layouts/pageStyles";

interface Props {
  result: RateComputationResult;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  material: "Material",
  labour: "Labour",
  equipment: "Equipment",
  work_rate: "Work Rate",
  head_load: "Head Load",
  conveyance: "Conveyance",
  sub_template: "Sub-Template",
};

const TYPE_COLORS: Record<string, string> = {
  material: "#2563eb",
  labour: "#d97706",
  equipment: "#7c3aed",
  work_rate: "#059669",
  head_load: "#dc2626",
  sub_template: "#6366f1",
};

export default function RateAnalysisPanel({ result, onClose }: Props) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Rate Analysis</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {result.template_code} — per {result.unit}
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>×</button>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>{result.template_name}</p>

      {/* Breakdown Table */}
      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        <table style={{ ...pageStyles.table, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...pageStyles.th, fontSize: 10 }}>Resource</th>
              <th style={{ ...pageStyles.th, fontSize: 10, width: 45 }}>Coeff</th>
              <th style={{ ...pageStyles.th, fontSize: 10, width: 65, textAlign: "right" }}>Rate</th>
              <th style={{ ...pageStyles.th, fontSize: 10, width: 70, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.breakdown.map((line, i) => (
              <tr key={line.line_item_id} style={i % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                <td style={{ ...pageStyles.td, padding: "6px 8px" }}>
                  <span style={{
                    display: "inline-block", fontSize: 9, padding: "1px 4px", borderRadius: 3, marginRight: 4,
                    background: `${TYPE_COLORS[line.resource_type] || "#6b7280"}15`,
                    color: TYPE_COLORS[line.resource_type] || "#6b7280",
                    fontWeight: 600,
                  }}>
                    {TYPE_LABELS[line.resource_type] || line.resource_type}
                  </span>
                  <span style={{ fontSize: 11 }}>{line.resource_name}</span>
                  {line.wastage_percent > 0 && (
                    <span style={{ fontSize: 9, color: "#d97706", marginLeft: 4 }}>+{line.wastage_percent}% waste</span>
                  )}
                </td>
                <td style={{ ...pageStyles.td, textAlign: "center", padding: "6px 4px", fontFamily: "monospace", fontSize: 11 }}>
                  {line.coefficient}
                </td>
                <td style={{ ...pageStyles.td, textAlign: "right", padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>
                  {fmt(line.effective_rate)}
                </td>
                <td style={{ ...pageStyles.td, textAlign: "right", padding: "6px 8px", fontFamily: "monospace", fontSize: 11, fontWeight: 600 }}>
                  {fmt(line.amount)}
                  {line.conveyance_amount > 0 && (
                    <div style={{ fontSize: 9, color: "#6b7280" }}>+{fmt(line.conveyance_amount)} conv.</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost Summary */}
      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        <SummaryRow label="Material Total" value={fmt(result.material_total)} color="#2563eb" />
        <SummaryRow label="Labour Total" value={fmt(result.labour_total)} color="#d97706" />
        {result.equipment_total > 0 && <SummaryRow label="Equipment Total" value={fmt(result.equipment_total)} color="#7c3aed" />}
        {result.conveyance_total > 0 && <SummaryRow label="Conveyance Total" value={fmt(result.conveyance_total)} color="#059669" />}
        {result.works_rate_total > 0 && <SummaryRow label="Works Rate Total" value={fmt(result.works_rate_total)} color="#059669" />}

        {result.location_extras && (
          <div style={{ padding: "6px 0", borderTop: "1px dashed var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Location Extras ({result.location_extras.zone_name})</div>
            <SummaryRow label="Location Extra" value={`+${fmt(result.location_extras.total_extra)}`} color="#6366f1" />
          </div>
        )}

        {result.lift_charges > 0 && <SummaryRow label="Lift Charges" value={`+${fmt(result.lift_charges)}`} color="#dc2626" />}

        <div style={{ borderTop: "2px solid var(--border)", paddingTop: 6 }}>
          <SummaryRow label="Direct Cost" value={fmt(result.direct_cost)} bold />
        </div>

        <SummaryRow label={`Overhead (${result.overhead_percent}%)`} value={`+${fmt(result.overhead_amount)}`} />
        <SummaryRow label={`Profit (${result.profit_percent}%)`} value={`+${fmt(result.profit_amount)}`} />

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          <SummaryRow label="Subtotal" value={fmt(result.subtotal_before_gst)} />
        </div>

        <SummaryRow label={`GST (${result.gst_percent}%)`} value={`+${fmt(result.gst_amount)}`} />

        <div style={{
          marginTop: 8, padding: "10px 12px", background: "#ccfbf1", borderRadius: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontWeight: 700, fontSize: 15, color: "#0f766e",
        }}>
          <span>Final Rate per {result.unit}</span>
          <span style={{ fontFamily: "monospace" }}>{fmt(result.final_rate)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: color || "var(--ink)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
