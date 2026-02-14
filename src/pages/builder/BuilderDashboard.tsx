import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Totals {
  material: number;
  labor: number;
  machinery: number;
  other: number;
  grandTotal: number;
}

export default function BuilderDashboard() {
  const navigate = useNavigate();
  const [overallMargin, setOverallMargin] = useState<number | null>(null);
  const [laborUplift, setLaborUplift] = useState<number | null>(null);
  const [machineryUplift, setMachineryUplift] = useState<number | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    // Load margin and uplift values
    const storedMargin = sessionStorage.getItem("overallMargin");
    const storedLaborUplift = sessionStorage.getItem("laborUplift");
    const storedMachineryUplift = sessionStorage.getItem("machineryUplift");
    const storedTotals = sessionStorage.getItem("calculatedTotals");

    if (storedMargin) setOverallMargin(Number(storedMargin));
    if (storedLaborUplift) setLaborUplift(Number(storedLaborUplift));
    if (storedMachineryUplift) setMachineryUplift(Number(storedMachineryUplift));
    if (storedTotals) setTotals(JSON.parse(storedTotals));
  }, []);

  return (
    <div style={styles.page}>
      <h1>Builder Dashboard</h1>
      <p>
        Upload base pricing, map BOQs, apply margins, review totals, and export
        estimates.
      </p>

      <button
        onClick={() => navigate("/builder/base-pricing")}
        style={styles.primaryBtn}
      >
        Manage Base Pricing
      </button>
      <button
        onClick={() => navigate("/builder/margins")}
        style={styles.secondaryBtn}
      >
        Configure Margins & Uplifts
      </button>

      {(overallMargin !== null || laborUplift !== null || machineryUplift !== null || totals) && (
        <div style={styles.summaryCard}>
          <h2 style={styles.summaryTitle}>Current Configuration & Totals</h2>
          
          {(overallMargin !== null || laborUplift !== null || machineryUplift !== null) && (
            <div style={styles.configSection}>
              <h3 style={styles.sectionTitle}>Margins & Uplifts</h3>
              <div style={styles.configGrid}>
                {overallMargin !== null && (
                  <div style={styles.configItem}>
                    <span style={styles.configLabel}>Overall Margin:</span>
                    <span style={styles.configValue}>{overallMargin}%</span>
                  </div>
                )}
                {laborUplift !== null && (
                  <div style={styles.configItem}>
                    <span style={styles.configLabel}>Labor Uplift:</span>
                    <span style={styles.configValue}>{laborUplift}%</span>
                  </div>
                )}
                {machineryUplift !== null && (
                  <div style={styles.configItem}>
                    <span style={styles.configLabel}>Machinery Uplift:</span>
                    <span style={styles.configValue}>{machineryUplift}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {totals && (
            <div style={styles.totalsSection}>
              <h3 style={styles.sectionTitle}>Totals</h3>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={styles.tableCell}>Material</td>
                    <td style={styles.tableCell}>{totals.material.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.tableCell}>Labor (with uplift)</td>
                    <td style={styles.tableCell}>{totals.labor.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.tableCell}>Machinery (with uplift)</td>
                    <td style={styles.tableCell}>{totals.machinery.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.tableCell}>Other</td>
                    <td style={styles.tableCell}>{totals.other.toFixed(2)}</td>
                  </tr>
                  <tr style={styles.grandRow}>
                    <td style={styles.tableCell}>Grand Total (with margin)</td>
                    <td style={styles.tableCell}>{totals.grandTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 40,
    fontFamily: "Inter, sans-serif",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  primaryBtn: {
    marginTop: 20,
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    display: "block",
  },
  secondaryBtn: {
    marginTop: 12,
    background: "#F59E0B",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    display: "block",
  },
  summaryCard: {
    marginTop: 32,
    background: "#FFFFFF",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  summaryTitle: {
    marginTop: 0,
    marginBottom: 20,
    fontSize: "20px",
    fontWeight: 600,
  },
  configSection: {
    marginBottom: 24,
  },
  totalsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: 12,
    color: "#374151",
  },
  configGrid: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
  },
  configItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  configLabel: {
    fontSize: "14px",
    color: "#6B7280",
  },
  configValue: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#111827",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableCell: {
    padding: "8px 12px",
    textAlign: "left",
    borderBottom: "1px solid #E5E7EB",
  },
  grandRow: {
    fontWeight: "bold",
    borderTop: "2px solid #111",
    paddingTop: "8px",
  },
};
