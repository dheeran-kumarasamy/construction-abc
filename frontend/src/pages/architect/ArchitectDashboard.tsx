import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

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
  const insightsBandStyle = {
    padding: "0.75rem 1.35rem",
    borderBottom: "1px solid #e5d7f7",
    background: "#faf5ff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
  };
  const metricCardStyle = {
    border: "1px solid #e5d7f7",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0.55rem 0.75rem",
    minWidth: 138,
  };
  const contentPadStyle = { padding: "0.85rem 1.35rem 1.15rem" };
  const actionPrimaryBtnStyle = {
    ...pageStyles.primaryBtn,
    borderRadius: 8,
    height: 40,
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)",
  };

  return (
    <div className="architect-theme architect-page" style={outerStyle}>
      <div className="architect-surface" style={shellStyle}>
        {/* Hero Header */}
        <div style={heroStyle}>
          <h2 style={{ margin: 0, fontSize: "clamp(27px, 3.3vw, 34px)", fontWeight: 700, color: "#3f2d5c", letterSpacing: "-0.3px" }}>
            Architect Dashboard
          </h2>
          <div style={{ width: "340px", maxWidth: "100%", opacity: 0.34, filter: "grayscale(100%)", marginRight: "0.2rem" }}>
            <ConstructionIllustration type="blueprint" />
          </div>
        </div>

        {/* Insights Band */}
        <div style={insightsBandStyle}>
          <div style={metricCardStyle}>
            <div style={{ color: "#6b5b7f", fontSize: "0.82rem" }}>Total Projects</div>
            <div style={{ color: "#1a1626", fontWeight: 700, fontSize: "1.05rem" }}>{projects.length}</div>
          </div>
          <div style={metricCardStyle}>
            <div style={{ color: "#6b5b7f", fontSize: "0.82rem" }}>With BOQ</div>
            <div style={{ color: "#1a1626", fontWeight: 700, fontSize: "1.05rem" }}>{projects.filter(p => p.boq_id).length}</div>
          </div>
          <button
            type="button"
            style={actionPrimaryBtnStyle}
            onClick={() => navigate("/architect/plan-requirements")}
          >
            2D Plan & Requirements
          </button>
        </div>

        {/* Content Section */}
        <div style={contentPadStyle}>
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
                  <th style={pageStyles.th}>Builder Submissions</th>
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
                    <td style={pageStyles.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={pageStyles.primaryBtn}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>{/* end contentPadStyle */}
      </div>
    </div>
  );
}
