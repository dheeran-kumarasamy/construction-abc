import { useEffect, useState } from "react";

interface Estimate {
  builderEmail: string;
  grandTotal: number;
  submittedAt: string;
}

const STORAGE_KEY = "submitted_estimates";

export default function ReceivedEstimates() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [approved, setApproved] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setEstimates(JSON.parse(stored));
  }, []);

  function approveEstimate(email: string) {
    setApproved(email);
  }

  const lowest =
    estimates.length > 0
      ? Math.min(...estimates.map((e) => e.grandTotal))
      : null;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Received Builder Estimates</h2>

        {estimates.length === 0 ? (
          <p>No estimates submitted yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Builder</th>
                <th>Grand Total</th>
                <th>Submitted At</th>
                <th>Approve</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.builderEmail}>
                  <td>{e.builderEmail}</td>

                  <td
                    style={{
                      fontWeight: e.grandTotal === lowest ? "bold" : "normal",
                      color: e.grandTotal === lowest ? "#16A34A" : "inherit",
                    }}
                  >
                    {e.grandTotal.toLocaleString()}
                  </td>

                  <td>{new Date(e.submittedAt).toLocaleString()}</td>

                  <td>
                    <button
                      style={styles.approveBtn}
                      onClick={() => approveEstimate(e.builderEmail)}
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {approved && (
          <div style={styles.result}>
            ✅ Approved Builder: <strong>{approved}</strong>
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
    width: "900px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  approveBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  result: {
    marginTop: "12px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#111827",
  },
};
