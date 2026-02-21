import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

interface Estimate {
  id: string;
  builder_name: string;
  grandTotal: number;
  submitted_at: string;
  margin_config?: any;
}

interface Project {
  id: string;
  name: string;
}

export default function ReceivedEstimates() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
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

  async function fetchEstimates() {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(
        `http://localhost:4000/projects/${selectedProjectId}/estimates`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to load estimates");
      const data = await res.json();
      setEstimates(data);
    } catch (err) {
      console.error("Load estimates error:", err);
    }
  }

  const lowest =
    estimates.length > 0
      ? Math.min(...estimates.map((e) => e.grandTotal))
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
                <tr key={e.id || `${e.builder_name}-${e.submitted_at}-${index}`}>
                  <td>{e.builder_name}</td>

                  <td
                    style={{
                      fontWeight: e.grandTotal === lowest ? "bold" : "normal",
                      color: e.grandTotal === lowest ? "#16A34A" : "inherit",
                    }}
                  >
                    ₹{(e.grandTotal || 0).toLocaleString()}
                  </td>

                  <td>{new Date(e.submitted_at).toLocaleString()}</td>

                  <td>
                    <button style={pageStyles.primaryBtn}>
                      Review
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
