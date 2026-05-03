import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";
import { formatINR } from "../../services/currency";

interface Project {
  id: string;
  name: string;
}

interface Estimate {
  builder_name: string;
  grand_total: number | null;
  rank: number;
  revision_id: string;
  award_id?: string | null;
  awarded_revision_id?: string | null;
  awarded_at?: string | null;
}

function getGrandTotal(estimate: Estimate) {
  return Number(estimate.grand_total ?? 0);
}

export default function ComparisonDashboard() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;
    fetchProjects();
  }, [token]);

  useEffect(() => {
    if (!selectedProjectId || !token) return;
    fetchComparison();
  }, [selectedProjectId, token]);

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

  async function fetchComparison() {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/comparison`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to load comparison");
      const data = await res.json();
      setEstimates(data);
    } catch (err) {
      console.error("Load comparison error:", err);
    }
  }

  async function handleAward(revisionId: string) {
    if (!selectedProjectId) return;
    const awardedRevisionId = estimates.find((estimate) => estimate.awarded_revision_id)?.awarded_revision_id || null;
    const isChangingAward = Boolean(awardedRevisionId && awardedRevisionId !== revisionId);
    const confirmationMessage = isChangingAward
      ? "This project is already awarded to another builder. Are you sure you want to change the award to this builder?"
      : "Are you sure you want to award this builder?";

    if (!confirm(confirmationMessage)) return;

    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/award`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ estimateRevisionId: revisionId }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Award failed");
      alert(data?.replaced ? "Award updated successfully" : "Project awarded successfully");
      fetchComparison();
    } catch (err: any) {
      alert(err.message || "Failed to award project");
    }
  }

  const awardedRevisionId = estimates.find((estimate) => estimate.awarded_revision_id)?.awarded_revision_id || null;
  const awardedEstimate = awardedRevisionId
    ? estimates.find((estimate) => estimate.revision_id === awardedRevisionId) || null
    : null;

  return (
    <div className="architect-theme architect-page" style={pageStyles.page}>
      <div className="architect-surface" style={pageStyles.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
          <h2 style={pageStyles.title}>Builder Estimate Comparison</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="blueprint" />
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
            onChange={(e) => setSelectedProjectId(e.target.value)}
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
          <p>No submitted estimates for this project yet.</p>
        ) : (
          <TableWrapper>
            {awardedEstimate ? (
              <div
                style={{
                  marginBottom: "0.9rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid #99f6e4",
                  background: "#f0fdfa",
                  color: "#115e59",
                  fontWeight: 600,
                }}
              >
                Currently awarded builder: {awardedEstimate.builder_name}
              </div>
            ) : null}
            <table style={pageStyles.table}>
            <thead>
              <tr>
                <th className="num-header" style={pageStyles.th}>Rank</th>
                <th style={pageStyles.th}>Builder</th>
                <th className="amount-header" style={pageStyles.th}>Grand Total</th>
                <th style={pageStyles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e, idx) => (
                <tr
                  key={e.revision_id}
                  style={
                    e.rank === 1
                      ? { ...(idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd), backgroundColor: "#f0fdfa" }
                      : (idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd)
                  }
                >
                  <td className="num-cell" style={{ ...pageStyles.td, fontWeight: "bold" }}>#{e.rank}</td>
                  <td style={pageStyles.td}>{e.builder_name}</td>
                  <td
                    className="amount-cell"
                    style={{
                      ...pageStyles.td,
                      fontWeight: e.rank === 1 ? "bold" : "normal",
                      color: e.rank === 1 ? "#16A34A" : "inherit",
                    }}
                  >
                    {formatINR(getGrandTotal(e), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td style={pageStyles.td}>
                    <button
                      onClick={() => handleAward(e.revision_id)}
                      disabled={e.revision_id === awardedRevisionId}
                      style={{
                        ...pageStyles.primaryBtn,
                        ...(e.revision_id === awardedRevisionId
                          ? { opacity: 0.55, cursor: "not-allowed" }
                          : {}),
                      }}
                    >
                      {e.revision_id === awardedRevisionId ? "Awarded" : "Award"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
