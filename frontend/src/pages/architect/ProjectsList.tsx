import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";

interface ProjectRow {
  id: string; // UUID
  name: string;
  description?: string | null;
  site_address?: string | null;
  tentative_start_date?: string | null;
  duration_months?: number | null;
  created_at: string;
  boq_id?: string | null; // UUID
}

export default function ProjectsList() {
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
        const res = await fetch("http://localhost:4000/projects", {
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
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <div style={pageStyles.header}>
          <h2 style={pageStyles.title}>Projects</h2>
          <button style={pageStyles.primaryBtn} onClick={() => navigate("/architect/create")}>
            New Project
          </button>
        </div>

        {loading && <div>Loading projects...</div>}
        {error && <div style={pageStyles.error}>{error}</div>}

        {!loading && !error && projects.length === 0 && (
          <div>No projects yet. Create your first project.</div>
        )}

        {!loading && !error && projects.length > 0 && (
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Name</th>
                <th style={pageStyles.th}>Site</th>
                <th style={pageStyles.th}>Start</th>
                <th style={pageStyles.th}>Duration (mo)</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>BOQ</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, idx) => (
                <tr key={p.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{p.name}</td>
                  <td style={pageStyles.td}>{p.site_address || "-"}</td>
                  <td style={pageStyles.td}>{p.tentative_start_date ? new Date(p.tentative_start_date).toLocaleDateString() : "-"}</td>
                  <td style={pageStyles.td}>{p.duration_months ?? "-"}</td>
                  <td style={pageStyles.td}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td style={pageStyles.td}>
                    {p.boq_id ? (
                      <a
                        href={`http://localhost:4000/api/boq/${p.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0f766e', textDecoration: 'underline' }}
                      >
                        Download BOQ
                      </a>
                    ) : (
                      <span style={{ color: '#aaa' }}>No BOQ</span>
                    )}
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