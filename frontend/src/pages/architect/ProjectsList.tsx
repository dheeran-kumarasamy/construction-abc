import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";
import { useAuth } from "../../auth/AuthContext";

interface ProjectRow {
  id: string; // UUID
  name: string;
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

export default function ProjectsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isArchitectHead = user?.role === "architect" && user?.orgRole === "head";
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
            <button style={pageStyles.secondaryBtn} onClick={() => navigate("/architect/builders")}>
              Browse Builders
            </button>
            <button style={pageStyles.secondaryBtn} onClick={() => navigate("/architect/plan-requirements")}>
              2D Plan & Requirements
            </button>
            {isArchitectHead ? (
              <button
                style={pageStyles.secondaryBtn}
                onClick={() => navigate("/architect/invite?role=architect")}
              >
                Invite Architects
              </button>
            ) : null}
            <button style={pageStyles.primaryBtn} onClick={() => navigate("/architect/create")}>
              New Project
            </button>
          </div>
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
                  <th style={pageStyles.th}>Project Name</th>
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
                    <td style={pageStyles.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={hasSubmittedBoq ? pageStyles.secondaryBtn : pageStyles.primaryBtn}
                          onClick={() => navigate(`/estimation/${projectRef}`)}
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
      </div>
    </div>
  );
}