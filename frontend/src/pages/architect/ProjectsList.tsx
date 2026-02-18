import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProjectRow {
  id: string;
  name: string;
  description?: string | null;
  site_address?: string | null;
  tentative_start_date?: string | null;
  duration_months?: number | null;
  created_at: string;
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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>Projects</h2>
          <button style={styles.primaryBtn} onClick={() => navigate("/architect/create")}>
            New Project
          </button>
        </div>

        {loading && <div>Loading projects...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && !error && projects.length === 0 && (
          <div>No projects yet. Create your first project.</div>
        )}

        {!loading && !error && projects.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site</th>
                <th>Start</th>
                <th>Duration (mo)</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.site_address || "-"}</td>
                  <td>{p.tentative_start_date ? new Date(p.tentative_start_date).toLocaleDateString() : "-"}</td>
                  <td>{p.duration_months ?? "-"}</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8F9FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    padding: "32px",
    borderRadius: "16px",
    width: "900px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primaryBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  error: {
    color: "#DC2626",
    fontSize: "13px",
  },
};