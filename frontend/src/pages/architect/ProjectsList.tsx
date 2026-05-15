import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

interface ProjectRow {
  id: string; // UUID
  name: string;
  building_type?: string | null;
  description?: string | null;
  site_address?: string | null;
  tentative_start_date?: string | null;
  duration_months?: number | null;
  created_at: string;
  notes?: string | null;
  source_project_id?: string | null;
  resolved_source_project_id?: string | null;
  boq_id?: string | null; // UUID
}

function resolveProjectRef(project: ProjectRow): string {
  if (project.resolved_source_project_id) return project.resolved_source_project_id;
  if (project.source_project_id) return project.source_project_id;

  const notes = String(project.notes || "");
  const marker = "source_project_id:";
  const idx = notes.indexOf(marker);
  if (idx >= 0) {
    const raw = notes.slice(idx + marker.length).trim();
    if (raw) return raw;
  }

  return project.id;
}

function getBoqEntryPath(project: ProjectRow) {
  const projectRef = resolveProjectRef(project);
  const isResidential = String(project.building_type || "").toLowerCase() === "residential";
  return isResidential ? `/estimation/${projectRef}?template=residential` : `/estimation/${projectRef}`;
}

function formatProjectType(value?: string | null): string {
  if (!value) return "-";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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
  // Removed unused previewLoadingId state
        const token = localStorage.getItem("token");
        const res = await fetch(apiUrl("/api/estimation/projects"), {
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



  // Removed uploadRoute - BOQ upload is no longer supported



  const outerStyle = pageStyles.page;
  const shellStyle = {
    ...pageStyles.card,
    padding: 0,
    borderRadius: 14,
    overflow: "hidden" as const,
  };
  const heroStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1.1rem 1.35rem",
    background: "linear-gradient(120deg, rgba(243, 232, 255, 0.95), rgba(248, 252, 255, 0.9))",
    borderBottom: "1px solid #e5d7f7",
  };
  const contentPadStyle = { padding: "0.85rem 1.35rem 1.15rem" };

  return (
    <div className="architect-theme architect-page" style={outerStyle}>
      <div className="architect-surface" style={shellStyle}>
        <div style={heroStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: "clamp(27px, 3.3vw, 34px)", fontWeight: 700, color: "#3f2d5c", letterSpacing: "-0.3px" }}>
              View Projects
            </h2>
            <p style={{ margin: "0.4rem 0 0", color: "#6b5b7f", fontSize: 15 }}>
              Default architect workspace for project access, BOQ actions, submitted estimates, and self-estimation.
            </p>
          </div>
          <div style={{ width: "340px", maxWidth: "100%", opacity: 0.34, filter: "grayscale(100%)", marginRight: "0.2rem" }}>
            <ConstructionIllustration type="building" />
          </div>
        </div>
        <div style={contentPadStyle}>
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
                    <th style={pageStyles.th}>Project Name</th>
                    <th style={pageStyles.th}>Project Type</th>
                    <th style={pageStyles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const projectRef = resolveProjectRef(p);
                    const hasSubmittedBoq = Boolean(p.boq_id);
                    return (
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
                        <td style={pageStyles.td}>{formatProjectType(p.building_type)}</td>
                        <td style={pageStyles.td}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              style={hasSubmittedBoq ? pageStyles.secondaryBtn : pageStyles.primaryBtn}
                              onClick={() => navigate(getBoqEntryPath(p))}
                            >
                              Enter New BOQ
                            </button>

                            {p.boq_id && (
                              <>
                                <button
                                  type="button"
                                  style={pageStyles.primaryBtn}
                                  onClick={() => navigate(`/estimation/${projectRef}?mode=view`)}
                                >
                                  View Existing BOQ
                                </button>

                                <button
                                  type="button"
                                  style={pageStyles.primaryBtn}
                                  onClick={() => navigate(`/architect/invite?projectId=${encodeURIComponent(projectRef)}`)}
                                >
                                  Invite Builders
                                </button>

                                <button
                                  type="button"
                                  style={pageStyles.secondaryBtn}
                                  onClick={() => navigate(`/architect/received?projectId=${encodeURIComponent(p.id)}`)}
                                >
                                  View Submissions
                                </button>

                                <button
                                  type="button"
                                  style={pageStyles.secondaryBtn}
                                  onClick={() => navigate(`/architect/comparison?projectId=${encodeURIComponent(p.id)}`)}
                                >
                                  Compare & Award
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                </tbody>
              </table>
            </div>
          )}
        </div>{/* end contentPadStyle */}
      </div>
    </div>
  );
}