import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";
import { formatINR } from "../../services/currency";
import { formatDate, formatTime } from "../../services/dateTime";

interface Estimate {
  estimate_id: string;
  revision_id?: string | null;
  revision_number?: number | null;
  revision_count?: number;
  builder_name: string;
  basic_material_cost?: number | null;
  grand_total: number | null;
  submitted_at: string;
  pricing_snapshot?: any;
  notes?: string | null;
  latest_review_status?: "commented" | "changes_requested" | "approved" | null;
  latest_review_comment?: string | null;
}

interface Project {
  id: string;
  name: string;
}

export default function ReceivedEstimates() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
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
      const requestedProjectId = searchParams.get("projectId") || "";
      const matchedProject = data.find((project: Project) => project.id === requestedProjectId);
      if (matchedProject) {
        setSelectedProjectId(matchedProject.id);
      } else if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
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
      setSelectedForCompare([]);
      setSelectedEstimate(null);
    } catch (err) {
      console.error("Load estimates error:", err);
    }
  }

  function toggleCompareSelection(estimateId: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(estimateId)) {
        return prev.filter((id) => id !== estimateId);
      }
      return [...prev, estimateId];
    });
  }

  function toggleEstimateReview(estimate: Estimate) {
    if (selectedEstimate?.estimate_id === estimate.estimate_id) {
      setSelectedEstimate(null);
      setHistoryData(null);
      setReviewComment("");
      return;
    }

    setSelectedEstimate(estimate);
    setReviewComment(estimate.latest_review_comment || "");
    fetchEstimateHistory(estimate.estimate_id);
  }

  async function fetchEstimateHistory(estimateId: string) {
    if (!selectedProjectId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/estimates/${estimateId}/history`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load estimate history");
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      console.error("Load estimate history error:", err);
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitReview(status: "commented" | "changes_requested" | "approved") {
    if (!selectedEstimate || !selectedProjectId) return;
    if ((status === "commented" || status === "changes_requested") && !reviewComment.trim()) {
      alert("Please enter a comment");
      return;
    }

    setReviewLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/estimates/${selectedEstimate.estimate_id}/review`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            comment: reviewComment,
            revisionId: selectedEstimate.revision_id || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit review");

      setReviewComment("");
      await fetchEstimates();
      await fetchEstimateHistory(selectedEstimate.estimate_id);
      alert(status === "approved" ? "Estimate approved" : "Review feedback sent to builder");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setReviewLoading(false);
    }
  }

  function formatReviewStatus(status?: string | null) {
    if (!status) return "Awaiting review";
    if (status === "changes_requested") return "Changes requested";
    if (status === "approved") return "Approved";
    if (status === "commented") return "Commented";
    return status;
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

  function getPricingItems(estimate: Estimate) {
    const snapshot = parseJson(estimate.pricing_snapshot);
    return Array.isArray(snapshot) ? snapshot : [];
  }

  function getGrandTotal(estimate: Estimate) {
    return Number(estimate.grand_total ?? 0);
  }

  function renderDateTime(value?: string | null) {
    if (!value) return "-";
    const datePart = formatDate(value);
    const timePart = formatTime(value);
    if (datePart === "-" || timePart === "-") return "-";
    return (
      <span>
        <span style={pageStyles.dateLine}>{datePart}</span>
        <span style={pageStyles.timeLine}>{timePart}</span>
      </span>
    );
  }

  const lowest =
    estimates.length > 0
      ? Math.min(...estimates.map((e) => getGrandTotal(e)))
      : null;

  const selectedComparisonEstimates = estimates.filter((estimate) =>
    selectedForCompare.includes(estimate.estimate_id)
  );

  const builderHeaders = selectedComparisonEstimates.map(
    (estimate) => `${estimate.builder_name} (Rev ${estimate.revision_number || 1})`
  );

  const comparisonItemsByName = selectedComparisonEstimates.reduce(
    (acc, estimate) => {
      const builderKey = `${estimate.builder_name} (Rev ${estimate.revision_number || 1})`;
      const items = getPricingItems(estimate);

      for (const item of items) {
        const name = String(item.item ?? item.Item ?? item.description ?? "Unnamed item").trim() || "Unnamed item";
        const qty = Number(item.qty ?? item.Qty ?? 0);
        const rate = Number(item.rate ?? item.Rate ?? 0);
        const total = Number(item.total ?? qty * rate);

        if (!acc[name]) {
          acc[name] = {};
        }

        acc[name][builderKey] = total;
      }

      return acc;
    },
    {} as Record<string, Record<string, number>>
  );

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
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
          <>
            <div style={{ marginBottom: "0.75rem", color: "#0f766e", fontWeight: 500 }}>
              Select two or more estimates to compare them side by side.
            </div>

            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Compare</th>
                  <th style={pageStyles.th}>Builder</th>
                  <th className="amount-header" style={pageStyles.th}>Basic Material Cost</th>
                  <th className="amount-header" style={pageStyles.th}>Grand Total</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Submitted At</th>
                  <th style={pageStyles.th}>Approve</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e, index) => (
                  <tr
                    key={e.estimate_id || `${e.builder_name}-${e.submitted_at}-${index}`}
                    style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                  >
                    <td style={pageStyles.td}>
                      <input
                        type="checkbox"
                        checked={selectedForCompare.includes(e.estimate_id)}
                        onChange={() => toggleCompareSelection(e.estimate_id)}
                      />
                    </td>
                    <td style={pageStyles.td}>{e.builder_name}</td>

                    <td className="amount-cell" style={pageStyles.td}>
                      {e.basic_material_cost != null
                        ? formatINR(e.basic_material_cost, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                        : "-"}
                    </td>

                    <td
                      className="amount-cell"
                      style={{
                        ...pageStyles.td,
                        fontWeight: getGrandTotal(e) === lowest ? "bold" : "normal",
                        color: getGrandTotal(e) === lowest ? "#16A34A" : "inherit",
                      }}
                    >
                      {formatINR(getGrandTotal(e), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>

                    <td style={pageStyles.td}>{formatReviewStatus(e.latest_review_status)}</td>

                    <td style={{ ...pageStyles.td, ...pageStyles.tdDateTime }}>{renderDateTime(e.submitted_at)}</td>

                    <td style={{ ...pageStyles.td, ...pageStyles.tdCenter }}>
                      <button
                        style={pageStyles.primaryBtn}
                        onClick={() => toggleEstimateReview(e)}
                      >
                        {selectedEstimate?.estimate_id === e.estimate_id ? "Close Review" : "Review"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedComparisonEstimates.length >= 2 && (
              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "1rem",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ ...pageStyles.subtitle, marginTop: 0, marginBottom: "0.5rem" }}>
                  Estimate Comparison ({selectedComparisonEstimates.length} selected)
                </h3>

                <div style={{ overflowX: "auto" }}>
                  <table style={pageStyles.table}>
                    <thead>
                      <tr>
                        <th style={pageStyles.th}>Builder</th>
                        <th className="amount-header" style={pageStyles.th}>Grand Total</th>
                        <th style={pageStyles.th}>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedComparisonEstimates.map((estimate, idx) => (
                        <tr key={estimate.estimate_id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                          <td style={pageStyles.td}>{estimate.builder_name}</td>
                          <td className="amount-cell" style={pageStyles.td}>{formatINR(getGrandTotal(estimate), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                          <td style={{ ...pageStyles.td, ...pageStyles.tdDateTime }}>{renderDateTime(estimate.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
                  <table style={pageStyles.table}>
                    <thead>
                      <tr>
                        <th style={pageStyles.th}>BOQ Item</th>
                        {builderHeaders.map((header) => (
                          <th key={header} className="amount-header" style={pageStyles.th}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(comparisonItemsByName).map((itemName, idx) => (
                        <tr key={itemName} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                          <td style={pageStyles.td}>{itemName}</td>
                          {builderHeaders.map((header) => {
                            const value = comparisonItemsByName[itemName]?.[header];
                            return (
                              <td key={`${itemName}-${header}`} className="amount-cell" style={pageStyles.td}>
                                {value != null ? formatINR(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
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
              <strong>Submission Count:</strong> {selectedEstimate.revision_count || selectedEstimate.revision_number || 1}
            </p>
            <p>
              <strong>Submitted:</strong>{" "}
              {renderDateTime(selectedEstimate.submitted_at)}
            </p>
            <p>
              <strong>Grand Total:</strong> {formatINR(getGrandTotal(selectedEstimate), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </p>
            <p>
              <strong>Basic Material Cost:</strong>{" "}
              {selectedEstimate.basic_material_cost != null
                ? formatINR(selectedEstimate.basic_material_cost, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                : "-"}
            </p>
            {selectedEstimate.notes && (
              <p>
                <strong>Notes:</strong> {selectedEstimate.notes}
              </p>
            )}

            <div style={{ marginTop: "1rem", border: "1px solid #99f6e4", borderRadius: "8px", padding: "0.75rem", background: "#ffffff" }}>
              <p style={{ marginTop: 0 }}>
                <strong>Review Status:</strong> {formatReviewStatus(selectedEstimate.latest_review_status)}
              </p>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder="Write feedback for builder..."
                style={{ ...pageStyles.input, width: "100%", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button
                  style={pageStyles.secondaryBtn}
                  disabled={reviewLoading}
                  onClick={() => submitReview("commented")}
                >
                  {reviewLoading ? "Saving..." : "Send Comment"}
                </button>
                <button
                  style={pageStyles.primaryBtn}
                  disabled={reviewLoading}
                  onClick={() => submitReview("changes_requested")}
                >
                  {reviewLoading ? "Saving..." : "Request Changes"}
                </button>
                <button
                  style={pageStyles.primaryBtn}
                  disabled={reviewLoading}
                  onClick={() => submitReview("approved")}
                >
                  {reviewLoading ? "Saving..." : "Approve"}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
              <table style={pageStyles.table}>
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
                  {getPricingItems(selectedEstimate).map((item: any, idx: number) => {
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
                        <td className="amount-cell" style={pageStyles.td}>{formatINR(rate, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                        <td className="amount-cell" style={pageStyles.td}>{formatINR(total, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>Resubmission History</h4>
              {historyLoading ? (
                <p>Loading history...</p>
              ) : historyData ? (
                <>
                  <p style={{ marginTop: 0 }}>Total revisions submitted: {historyData.revisionCount || 0}</p>
                  <table style={pageStyles.table}>
                    <thead>
                      <tr>
                        <th style={pageStyles.th}>Revision</th>
                        <th className="amount-header" style={pageStyles.th}>Grand Total</th>
                        <th style={pageStyles.th}>Submitted At</th>
                        <th style={pageStyles.th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historyData.revisions || []).map((revision: any, idx: number) => (
                        <tr key={revision.revision_id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                          <td style={pageStyles.td}>Rev {revision.revision_number}</td>
                          <td className="amount-cell" style={pageStyles.td}>{formatINR(revision.grand_total || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                          <td style={{ ...pageStyles.td, ...pageStyles.tdDateTime }}>{renderDateTime(revision.submitted_at)}</td>
                          <td style={pageStyles.td}>{revision.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {(historyData.reviews || []).length > 0 && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <h4 style={{ marginBottom: "0.5rem" }}>Review Trail</h4>
                      <table style={pageStyles.table}>
                        <thead>
                          <tr>
                            <th style={pageStyles.th}>Status</th>
                            <th style={pageStyles.th}>Comment</th>
                            <th style={pageStyles.th}>Revision Ref</th>
                            <th style={pageStyles.th}>At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.reviews.map((review: any, idx: number) => (
                            <tr key={review.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                              <td style={pageStyles.td}>{formatReviewStatus(review.status)}</td>
                              <td style={pageStyles.td}>{review.comment || "-"}</td>
                              <td style={pageStyles.td}>{review.revision_id || "-"}</td>
                              <td style={{ ...pageStyles.td, ...pageStyles.tdDateTime }}>{renderDateTime(review.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p>No history available.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
