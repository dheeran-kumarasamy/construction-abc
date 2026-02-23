import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

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
  const [boqPreview, setBoqPreview] = useState<Record<string, any[]> >({});

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
        // Fetch BOQ preview for each project
        for (const p of data) {
          if (p.boq_id) {
            const resBoq = await fetch(apiUrl(`/api/boq/${p.id}`), {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const boqData = await resBoq.json();
            setBoqPreview(prev => ({ ...prev, [p.id]: boqData.items || [] }));
          }
        }
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
          <ConstructionIllustration type="building" size={80} />
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
                      <div>
                        <a
                          href={apiUrl(`/api/boq/${p.id}/download`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0f766e', textDecoration: 'underline' }}
                        >
                          Download BOQ
                        </a>
                        {boqPreview[p.id]?.length > 0 && (
                          <details style={{ marginTop: 8 }}>
                            <summary>Preview</summary>
                            <table style={{ fontSize: 14, marginTop: 8 }}>
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Quantity</th>
                                  <th>UOM</th>
                                </tr>
                              </thead>
                              <tbody>
                                {boqPreview[p.id].map((row, idx) => (
                                  <tr key={idx}>
                                    <td>{row.item}</td>
                                    <td>{row.qty}</td>
                                    <td>{row.uom}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate('/architect/boq-upload')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0f766e',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          font: 'inherit',
                          fontWeight: 500
                        }}
                        title={`Upload BOQ for ${p.name}`}
                      >
                        Upload BOQ
                      </button>
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