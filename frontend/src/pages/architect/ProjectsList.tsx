import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import FingerInAirEstimator from "../../components/FingerInAirEstimator";
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
  const [boqPreview, setBoqPreview] = useState<Record<string, any[]>>({});
  const [previewProjectId, setPreviewProjectId] = useState("");
  const [previewLoadingId, setPreviewLoadingId] = useState("");

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

  async function handleViewBoq(project: ProjectRow) {
    if (!project.boq_id) return;

    if (previewProjectId === project.id) {
      setPreviewProjectId("");
      return;
    }

    if (!boqPreview[project.id]) {
      try {
        setPreviewLoadingId(project.id);
        const token = localStorage.getItem("token");
        const resBoq = await fetch(apiUrl(`/api/boq/${project.id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const boqData = await resBoq.json();
        if (!resBoq.ok) {
          throw new Error(boqData.error || "Failed to load BOQ preview");
        }
        setBoqPreview((prev) => ({ ...prev, [project.id]: boqData.items || [] }));
      } catch (err: any) {
        setError(err.message || "Failed to load BOQ preview");
        setPreviewLoadingId("");
        return;
      } finally {
        setPreviewLoadingId("");
      }
    }

    setPreviewProjectId(project.id);
  }

  function uploadRoute(projectId: string) {
    return `/architect/boq-upload?projectId=${encodeURIComponent(projectId)}`;
  }

  function submittedEstimatesRoute(projectId: string) {
    return `/architect/received?projectId=${encodeURIComponent(projectId)}`;
  }

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>View Projects</h2>
            <p style={pageStyles.subtitle}>
              Default architect workspace for project access, BOQ actions, submitted estimates, and self-estimation.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <ConstructionIllustration type="building" size={80} />
            <button style={pageStyles.primaryBtn} onClick={() => navigate("/architect/create")}>
              New Project
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <button type="button" style={pageStyles.primaryBtn} onClick={() => navigate("/architect")}>View Projects</button>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => navigate("/architect/estimation")}>Rate Analysis & BOQ Estimation</button>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => navigate("/architect/prices")}>Material Rates</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <FingerInAirEstimator />
        </div>

        {loading && <div>Loading projects...</div>}
        {error && <div style={pageStyles.error}>{error}</div>}

        {!loading && !error && projects.length === 0 && (
          <div>No projects yet. Create your first project.</div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Name</th>
                  <th style={pageStyles.th}>Site</th>
                  <th style={pageStyles.th}>Start</th>
                  <th style={pageStyles.th}>Duration (mo)</th>
                  <th style={pageStyles.th}>Created</th>
                  <th style={pageStyles.th}>View BOQ</th>
                  <th style={pageStyles.th}>Download BOQ</th>
                  <th style={pageStyles.th}>Upload New BOQ</th>
                  <th style={pageStyles.th}>View Submitted Estimates</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => {
                  const previewRows = boqPreview[p.id] || [];
                  const isPreviewOpen = previewProjectId === p.id;

                  return (
                    <Fragment key={p.id}>
                      <tr style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{p.name}</td>
                        <td style={pageStyles.td}>{p.site_address || "-"}</td>
                        <td style={pageStyles.td}>{p.tentative_start_date ? new Date(p.tentative_start_date).toLocaleDateString() : "-"}</td>
                        <td style={pageStyles.td}>{p.duration_months ?? "-"}</td>
                        <td style={pageStyles.td}>{new Date(p.created_at).toLocaleDateString()}</td>
                        <td style={pageStyles.td}>
                          <button
                            type="button"
                            style={pageStyles.secondaryBtn}
                            onClick={() => handleViewBoq(p)}
                            disabled={!p.boq_id || previewLoadingId === p.id}
                          >
                            {previewLoadingId === p.id ? "Loading..." : isPreviewOpen ? "Hide BOQ" : "View BOQ"}
                          </button>
                        </td>
                        <td style={pageStyles.td}>
                          {p.boq_id ? (
                            <a
                              href={apiUrl(`/api/boq/${p.id}/download`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#0f766e", textDecoration: "underline", fontWeight: 600 }}
                            >
                              Download BOQ
                            </a>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>No BOQ</span>
                          )}
                        </td>
                        <td style={pageStyles.td}>
                          <button
                            type="button"
                            style={pageStyles.secondaryBtn}
                            onClick={() => navigate(uploadRoute(p.id))}
                          >
                            Upload New BOQ
                          </button>
                        </td>
                        <td style={pageStyles.td}>
                          <button
                            type="button"
                            style={pageStyles.secondaryBtn}
                            onClick={() => navigate(submittedEstimatesRoute(p.id))}
                          >
                            View Submitted Estimates
                          </button>
                        </td>
                      </tr>
                      {isPreviewOpen && (
                        <tr>
                          <td style={pageStyles.td} colSpan={9}>
                            {previewRows.length > 0 ? (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Item</th>
                                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Quantity</th>
                                      <th style={{ textAlign: "left", padding: "8px 10px" }}>UOM</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewRows.map((row, previewIndex) => (
                                      <tr key={`${p.id}-${previewIndex}`}>
                                        <td style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0" }}>{row.item || row.description || "-"}</td>
                                        <td style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0" }}>{row.qty || row.quantity || "-"}</td>
                                        <td style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0" }}>{row.uom || row.unit || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ color: "#64748b" }}>No parsed BOQ preview available for this project.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}