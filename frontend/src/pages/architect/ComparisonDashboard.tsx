import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

interface Project {
  id: string;
  name: string;
}

interface Estimate {
  builder_name: string;
  grand_total: number | null;
  rank: number;
  revision_id: string;
}

function getGrandTotal(estimate: Estimate) {
  return Number(estimate.grand_total ?? 0);
}

export default function ComparisonDashboard() {
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
      if (data.length > 0) setSelectedProjectId(data[0].id);
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
    if (!confirm("Are you sure you want to award this builder?")) return;

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

      if (!res.ok) throw new Error("Award failed");
      alert("Project awarded successfully");
      fetchComparison();
    } catch (err: any) {
      alert(err.message || "Failed to award project");
    }
  }

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
                    ₹{getGrandTotal(e).toLocaleString()}
                  </td>
                  <td style={pageStyles.td}>
                    <button
                      onClick={() => handleAward(e.revision_id)}
                      style={{
                        ...pageStyles.primaryBtn,
                        ...(e.rank === 1 ? {} : { opacity: 0.6 }),
                      }}
                    >
                      {e.rank === 1 ? "Award" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
