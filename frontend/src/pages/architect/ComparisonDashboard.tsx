import { useEffect, useState } from "react";

interface Estimate {
  builder: string;
  grandTotal: number;
}

export default function ComparisonDashboard() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // MVP: simulate multiple builder estimates
    const mock: Estimate[] = [
      { builder: "Builder A", grandTotal: 1250000 },
      { builder: "Builder B", grandTotal: 1195000 },
      { builder: "Builder C", grandTotal: 1312000 },
    ];

    setEstimates(mock);
  }, []);

  function selectBuilder(name: string) {
    setSelected(name);
  }

  const lowest = Math.min(...estimates.map((e) => e.grandTotal));

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Builder Estimate Comparison</h2>

        <table style={styles.table}>
          <thead>
            <tr>
              <th>Builder</th>
              <th>Grand Total</th>
              <th>Select</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((e) => (
              <tr key={e.builder}>
                <td>{e.builder}</td>

                <td
                  style={{
                    fontWeight: e.grandTotal === lowest ? "bold" : "normal",
                    color: e.grandTotal === lowest ? "#16A34A" : "inherit",
                  }}
                >
                  {e.grandTotal.toLocaleString()}
                </td>

                <td>
                  <button
                    onClick={() => selectBuilder(e.builder)}
                    style={styles.selectBtn}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && (
          <div style={styles.result}>
            ✅ Selected Estimate: <strong>{selected}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8F9FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    padding: "32px",
    borderRadius: "16px",
    width: "720px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  selectBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
  },
  result: {
    marginTop: "12px",
    fontSize: "16px",
    color: "#111827",
  },
};
