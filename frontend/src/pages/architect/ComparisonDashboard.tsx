import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

interface Project {
  id: string;
  name: string;
}

interface Estimate {
  builder_name: string;
  grandTotal: number;
  rank: number;
  revision_id: string;
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
      const res = await fetch("http://localhost:4000/projects", {
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
        `http://localhost:4000/projects/${selectedProjectId}/comparison`,
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
        `http://localhost:4000/projects/${selectedProjectId}/award`,
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
      <div style={{ ...pageStyles.card, width: "min(820px, 100%)" }}>
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
                <th>Rank</th>
                <th>Builder</th>
                <th>Grand Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr
                  key={e.revision_id}
                  style={e.rank === 1 ? { backgroundColor: "#f0fdfa" } : {}}
                >
                  <td style={{ fontWeight: "bold" }}>#{e.rank}</td>
                  <td>{e.builder_name}</td>
                  <td
                    style={{
                      fontWeight: e.rank === 1 ? "bold" : "normal",
                      color: e.rank === 1 ? "#16A34A" : "inherit",
                    }}
                  >
                    ₹{(e.grandTotal || 0).toLocaleString()}
                  </td>
                  <td>
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
