import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";

interface ProjectRow {
  id: string;
  name: string;
  boq_id?: string | null;
}

export default function ArchitectDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");
        const res = await fetch(apiUrl("/projects"), {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load projects");
        }
        setProjects(data);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <div style={pageStyles.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", flexWrap: "wrap" }}>
            <h2 style={pageStyles.title}>Architect Dashboard</h2>
            <button
              type="button"
              style={pageStyles.secondaryBtn}
              onClick={() => navigate("/architect/plan-requirements")}
            >
              2D Plan & Requirements
            </button>
          </div>
        </div>
        {loading && <div>Loading projects...</div>}
        {error && <div style={{ color: "#dc2626" }}>{error}</div>}
        {!loading && !error && projects.length === 0 && (
          <div>No projects yet. Create your first project.</div>
        )}
        {!loading && !error && projects.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Project Name</th>
                  <th style={pageStyles.th}>View BOQ</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td style={pageStyles.td}>
                      <a
                        href="#"
                        style={{ color: "#0f766e", textDecoration: "underline", fontWeight: 600 }}
                        onClick={e => {
                          e.preventDefault();
                          navigate(`/architect/project/${p.id}`);
                        }}
                      >
                        {p.name}
                      </a>
                    </td>
                    <td style={pageStyles.td}>
                      <button
                        type="button"
                        style={pageStyles.secondaryBtn}
                        onClick={() => navigate(`/estimation/boq/${p.id}`)}
                        disabled={!p.boq_id}
                      >
                        View BOQ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
