import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <h2 style={pageStyles.title}>Received Builder Estimates</h2>

        {estimates.length === 0 ? (
          <p>No estimates submitted yet.</p>
        ) : (
          <table style={pageStyles.table}>
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
                      style={pageStyles.primaryBtn}
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
          <div style={pageStyles.result}>
            ✅ Approved Builder: <strong>{approved}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
