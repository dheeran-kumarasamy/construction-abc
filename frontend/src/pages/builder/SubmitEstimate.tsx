import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";

interface Estimate {
  estimate_id: string;
  project_id: string;
  project_name: string;
  revision_id: string;
  revision_number: number;
  grand_total: number;
  submitted_at: string;
  notes?: string | null;
  margin_percent?: number;
}

export default function SubmitEstimate() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmittedEstimates();
  }, []);

  async function fetchSubmittedEstimates() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/builder/submitted-estimates", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch submitted estimates");

      const data = await response.json();
      setEstimates(data);
    } catch (error) {
      console.error("Fetch submitted estimates error:", error);
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <h2 style={pageStyles.title}>Submit Estimate to Architect</h2>

        {loading ? (
          <p>Loading submitted estimates...</p>
        ) : estimates.length === 0 ? (
          <div>
            <p>No submitted estimates found.</p>
            <button
              style={{ ...pageStyles.primaryBtn, marginTop: "1rem" }}
              onClick={() => navigate("/builder/apply-pricing")}
            >
              Go to Apply Pricing to BOQ
            </button>
          </div>
        ) : (
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Revision</th>
                <th>Margin %</th>
                <th>Grand Total</th>
                <th>Submitted At</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => (
                <tr key={estimate.revision_id || estimate.estimate_id}>
                  <td>{estimate.project_name}</td>
                  <td>Rev {estimate.revision_number || 1}</td>
                  <td>{Number(estimate.margin_percent || 0)}%</td>
                  <td>₹{Number(estimate.grand_total || 0).toLocaleString()}</td>
                  <td>
                    {estimate.submitted_at
                      ? new Date(estimate.submitted_at).toLocaleString()
                      : "-"}
                  </td>
                  <td>{estimate.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// remove local styles object
