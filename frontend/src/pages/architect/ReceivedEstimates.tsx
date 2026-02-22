import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

interface Estimate {
  estimate_id: string;
  revision_id?: string | null;
  revision_number?: number | null;
  builder_name: string;
  grand_total: number | null;
  submitted_at: string;
  margin_config?: any;
  pricing_snapshot?: any;
  notes?: string | null;
}

interface Project {
  id: string;
  name: string;
}

export default function ReceivedEstimates() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId || !token) return;
    fetchEstimates();
  }, [selectedProjectId]);

  async function fetchProjects() {
    try {
      const res = await fetch(apiUrl("/projects"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(data[0].id);
      setLoading(false);
    } catch (err) {
      console.error("Load projects error:", err);
      setLoading(false);
    }
  }

  async function fetchEstimates() {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/estimates`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to load estimates");
      const data = await res.json();
      setEstimates(data);
      setSelectedEstimate(null);
    } catch (err) {
      console.error("Load estimates error:", err);
    }
  }

  function parseJson(value: any) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  }

  function getMarginPercent(estimate: Estimate) {
    const config = parseJson(estimate.margin_config);
    return Number(config?.marginPercent ?? 0);
  }

  function getPricingItems(estimate: Estimate) {
    const snapshot = parseJson(estimate.pricing_snapshot);
    return Array.isArray(snapshot) ? snapshot : [];
  }

  function getGrandTotal(estimate: Estimate) {
    return Number(estimate.grand_total ?? 0);
  }

  const lowest =
    estimates.length > 0
      ? Math.min(...estimates.map((e) => getGrandTotal(e)))
      : null;

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
          <h2 style={pageStyles.title}>Received Builder Estimates</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="tools" />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#0f766e",
              fontWeight: 500,
            }}
          >
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedEstimate(null);
            }}
            style={{ ...pageStyles.select, width: "100%" }}
          >
            <option value="">-- Select a Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : estimates.length === 0 ? (
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
              {estimates.map((e, index) => (
                <tr
                  key={e.estimate_id || `${e.builder_name}-${e.submitted_at}-${index}`}
                >
                  <td>{e.builder_name}</td>

                  <td
                    style={{
                      fontWeight: getGrandTotal(e) === lowest ? "bold" : "normal",
                      color: getGrandTotal(e) === lowest ? "#16A34A" : "inherit",
                    }}
                  >
                    ₹{getGrandTotal(e).toLocaleString()}
                  </td>

                  <td>{new Date(e.submitted_at).toLocaleString()}</td>

                  <td>
                    <button
                      style={pageStyles.primaryBtn}
                      onClick={() => setSelectedEstimate(e)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedEstimate && (
          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              border: "1px solid #ccfbf1",
              borderRadius: "10px",
              background: "#f0fdfa",
            }}
          >
            <h3 style={{ ...pageStyles.subtitle, marginTop: 0 }}>Estimate Review</h3>
            <p>
              <strong>Builder:</strong> {selectedEstimate.builder_name}
            </p>
            <p>
              <strong>Revision:</strong> {selectedEstimate.revision_number || 1}
            </p>
            <p>
              <strong>Submitted:</strong>{" "}
              {selectedEstimate.submitted_at
                ? new Date(selectedEstimate.submitted_at).toLocaleString()
                : "-"}
            </p>
            <p>
              <strong>Margin:</strong> {getMarginPercent(selectedEstimate)}%
            </p>
            <p>
              <strong>Grand Total:</strong> ₹{getGrandTotal(selectedEstimate).toLocaleString()}
            </p>
            {selectedEstimate.notes && (
              <p>
                <strong>Notes:</strong> {selectedEstimate.notes}
              </p>
            )}

            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>UOM</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {getPricingItems(selectedEstimate).map((item: any, idx: number) => {
                    const qty = Number(item.qty ?? item.Qty ?? 0);
                    const rate = Number(item.rate ?? item.Rate ?? 0);
                    const total = Number(item.total ?? qty * rate);
                    const name = item.item ?? item.Item ?? item.description ?? "-";
                    const uom = item.uom ?? item.UOM ?? item.unit ?? "-";

                    return (
                      <tr key={`${name}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td>{name}</td>
                        <td>{qty}</td>
                        <td>{uom}</td>
                        <td>₹{rate.toLocaleString()}</td>
                        <td>₹{total.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
