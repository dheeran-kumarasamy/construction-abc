import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(820px, 100%)" }}>
        <h2 style={pageStyles.title}>Builder Estimate Comparison</h2>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <ConstructionIllustration type="blueprint" size={90} />
        </div>

        <table style={pageStyles.table}>
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
                    style={pageStyles.primaryBtn}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && (
          <div style={pageStyles.result}>
            ✅ Selected Estimate: <strong>{selected}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
