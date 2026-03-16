import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../services/api";
import TableWrapper from "../../components/TableWrapper";

interface Estimate {
  estimate_id: string;
  project_id: string;
  project_name: string;
  revision_id: string;
  revision_number: number;
  revision_count?: number;
  grand_total: number;
  submitted_at: string;
  notes?: string | null;
  margin_percent?: number;
  latest_review_status?: "commented" | "changes_requested" | "approved" | null;
  latest_review_comment?: string | null;
}

export default function SubmitEstimate() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");
  const [selectedRevision, setSelectedRevision] = useState<any | null>(null);

  useEffect(() => {
    fetchSubmittedEstimates();
  }, []);

  async function fetchSubmittedEstimates() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/builder/submitted-estimates"), {
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

  async function fetchEstimateHistory(estimateId: string) {
    setHistoryLoading(true);
    setSelectedEstimateId(estimateId);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        apiUrl(`/api/builder/submitted-estimates/${estimateId}/history`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch estimate history");
      const data = await response.json();
      setSelectedHistory(data);
    } catch (error) {
      console.error("Fetch estimate history error:", error);
      setSelectedHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  function formatReviewStatus(status?: string | null) {
    if (!status) return "Awaiting review";
    if (status === "changes_requested") return "Changes requested";
    if (status === "approved") return "Approved";
    if (status === "commented") return "Commented";
    return status;
  }

  function parseSnapshot(snapshot: any) {
    if (!snapshot) return [];
    if (Array.isArray(snapshot)) return snapshot;
    if (typeof snapshot === "string") {
      try {
        const parsed = JSON.parse(snapshot);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  const noWrapHeaderStyle = { ...pageStyles.th, whiteSpace: "nowrap" };
  const noWrapCellStyle = { ...pageStyles.td, whiteSpace: "nowrap" };
  const wrapCellStyle = {
    ...pageStyles.td,
    whiteSpace: "normal" as const,
    wordBreak: "break-word" as const,
    overflowWrap: "anywhere" as const,
    maxWidth: "260px",
  };

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <h2 style={pageStyles.title}>View Submission</h2>

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
          <TableWrapper>
            <table style={{ ...pageStyles.table, minWidth: "1460px" }}>
              <thead>
                <tr>
                  <th style={noWrapHeaderStyle}>Project</th>
                  <th style={noWrapHeaderStyle}>Review Status</th>
                  <th style={noWrapHeaderStyle}>Latest Architect Comment</th>
                  <th className="num-header" style={noWrapHeaderStyle}>Margin %</th>
                  <th className="amount-header" style={noWrapHeaderStyle}>Grand Total</th>
                  <th style={noWrapHeaderStyle}>Submitted At</th>
                  <th style={noWrapHeaderStyle}>Notes</th>
                  <th style={noWrapHeaderStyle}>History</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate, idx) => (
                  <tr key={estimate.revision_id || estimate.estimate_id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                    <td style={noWrapCellStyle}>{estimate.project_name}</td>
                    <td style={noWrapCellStyle}>{formatReviewStatus(estimate.latest_review_status)}</td>
                    <td style={wrapCellStyle}>{estimate.latest_review_comment || "-"}</td>
                    <td className="num-cell" style={noWrapCellStyle}>{Number(estimate.margin_percent || 0)}%</td>
                    <td className="amount-cell" style={noWrapCellStyle}>₹{Number(estimate.grand_total || 0).toLocaleString()}</td>
                    <td style={noWrapCellStyle}>
                      {estimate.submitted_at
                        ? new Date(estimate.submitted_at).toLocaleString()
                        : "-"}
                    </td>
                    <td style={wrapCellStyle}>{estimate.notes || "-"}</td>
                    <td style={noWrapCellStyle}>
                      <button
                        style={pageStyles.secondaryBtn}
                        onClick={() => fetchEstimateHistory(estimate.estimate_id)}
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}

        {selectedEstimateId && (
          <div style={{ marginTop: "1.25rem", border: "1px solid #ccfbf1", borderRadius: "8px", padding: "1rem", background: "#f0fdfa" }}>
            <h3 style={{ ...pageStyles.subtitle, marginTop: 0 }}>Resubmission History</h3>
            {historyLoading ? (
              <p>Loading history...</p>
            ) : !selectedHistory ? (
              <p>No history available.</p>
            ) : (
              <>
                <p>Total revisions: {selectedHistory.revisionCount || 0}</p>
                <TableWrapper>
                <table style={{ ...pageStyles.table, minWidth: "760px" }}>
                  <thead>
                    <tr>
                      <th style={noWrapHeaderStyle}>Revision</th>
                      <th className="amount-header" style={noWrapHeaderStyle}>Grand Total</th>
                      <th style={noWrapHeaderStyle}>Submitted At</th>
                      <th style={noWrapHeaderStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedHistory.revisions || []).map((revision: any, idx: number) => (
                      <tr key={revision.revision_id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={noWrapCellStyle}>
                          <button
                            type="button"
                            onClick={() => setSelectedRevision(revision)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#0f766e",
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                              font: "inherit",
                            }}
                          >
                            Rev {revision.revision_number}
                          </button>
                        </td>
                        <td className="amount-cell" style={noWrapCellStyle}>₹{Number(revision.grand_total || 0).toLocaleString()}</td>
                        <td style={noWrapCellStyle}>{revision.submitted_at ? new Date(revision.submitted_at).toLocaleString() : "-"}</td>
                        <td style={pageStyles.td}>{revision.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </TableWrapper>

                {(selectedHistory.reviews || []).length > 0 && (
                  <>
                    <h4 style={{ marginTop: "1rem" }}>Architect Feedback Trail</h4>
                    <TableWrapper>
                    <table style={{ ...pageStyles.table, minWidth: "760px" }}>
                      <thead>
                        <tr>
                          <th style={noWrapHeaderStyle}>Status</th>
                          <th style={noWrapHeaderStyle}>Comment</th>
                          <th style={noWrapHeaderStyle}>Revision Ref</th>
                          <th style={noWrapHeaderStyle}>At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedHistory.reviews.map((review: any, idx: number) => (
                          <tr key={review.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                            <td style={noWrapCellStyle}>{formatReviewStatus(review.status)}</td>
                            <td style={pageStyles.td}>{review.comment || "-"}</td>
                            <td style={noWrapCellStyle}>{review.revision_id || "-"}</td>
                            <td style={noWrapCellStyle}>{review.created_at ? new Date(review.created_at).toLocaleString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </TableWrapper>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {selectedRevision && (
          <div
            onClick={() => setSelectedRevision(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2, 6, 23, 0.45)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(1200px, 96vw)",
                maxHeight: "90vh",
                overflow: "auto",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                padding: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, color: "#0f172a" }}>Revision Details - Rev {selectedRevision.revision_number}</h3>
                <button style={pageStyles.secondaryBtn} onClick={() => setSelectedRevision(null)}>Close</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                <div><strong>Grand Total:</strong> ₹{Number(selectedRevision.grand_total || 0).toLocaleString()}</div>
                <div><strong>Submitted At:</strong> {selectedRevision.submitted_at ? new Date(selectedRevision.submitted_at).toLocaleString() : "-"}</div>
                <div><strong>Notes:</strong> {selectedRevision.notes || "-"}</div>
              </div>

              <TableWrapper>
                <table style={{ ...pageStyles.table, minWidth: "980px" }}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>#</th>
                      <th style={pageStyles.th}>Item</th>
                      <th className="num-header" style={pageStyles.th}>Qty</th>
                      <th style={pageStyles.th}>UOM</th>
                      <th className="amount-header" style={pageStyles.th}>Rate</th>
                      <th className="amount-header" style={pageStyles.th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseSnapshot(selectedRevision.pricing_snapshot).length === 0 ? (
                      <tr>
                        <td colSpan={6} style={pageStyles.empty}>No line-item snapshot found for this revision.</td>
                      </tr>
                    ) : (
                      parseSnapshot(selectedRevision.pricing_snapshot).map((item: any, idx: number) => {
                        const qty = Number(item.qty ?? item.Qty ?? 0);
                        const rate = Number(item.rate ?? item.Rate ?? 0);
                        const total = Number(item.total ?? qty * rate);
                        const name = item.item ?? item.Item ?? item.description ?? "-";
                        const uom = item.uom ?? item.UOM ?? item.unit ?? "-";

                        return (
                          <tr key={`${name}-${idx}`} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                            <td className="num-cell" style={pageStyles.td}>{idx + 1}</td>
                            <td style={pageStyles.td}>{name}</td>
                            <td className="num-cell" style={pageStyles.td}>{qty}</td>
                            <td style={pageStyles.td}>{uom}</td>
                            <td className="amount-cell" style={pageStyles.td}>₹{rate.toLocaleString()}</td>
                            <td className="amount-cell" style={pageStyles.td}>₹{total.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </TableWrapper>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// remove local styles object
