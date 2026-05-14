import { useEffect, useMemo, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../services/api";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

interface BuilderProject {
  id: string;
  name: string;
  description?: string;
  site_address?: string;
  estimate_status?: string | null;
}

interface SubmittedEstimate {
  project_id: string;
  project_name: string;
}

export default function BuilderDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [submitted, setSubmitted] = useState<SubmittedEstimate[]>([]);

  useEffect(() => {
    loadPipeline();
  }, []);

  async function loadPipeline() {
    const token = localStorage.getItem("token");
    const requestOptions = token
      ? ({ headers: { Authorization: `Bearer ${token}` } } as const)
      : undefined;

    const [projectsRes, submittedRes] = await Promise.all([
      fetch(apiUrl("/api/builder/available-projects"), requestOptions),
      fetch(apiUrl("/api/builder/submitted-estimates"), requestOptions),
    ]);

    const projectsData = projectsRes.ok ? await projectsRes.json() : [];
    const submittedData = submittedRes.ok ? await submittedRes.json() : [];

    setProjects(Array.isArray(projectsData) ? projectsData : []);
    setSubmitted(Array.isArray(submittedData) ? submittedData : []);
  }

  function normalizeEstimateStatus(value: string | null | undefined) {
    return String(value || "").trim().toLowerCase();
  }

  const submittedProjectIds = useMemo(
    () =>
      new Set([
        ...submitted.map((item) => item.project_id),
        ...projects
          .filter((project) => {
            const status = normalizeEstimateStatus(project.estimate_status);
            return status === "submitted" || status === "approved" || status === "awarded";
          })
          .map((project) => project.id),
      ]),
    [submitted, projects]
  );

  const invitedProjects = useMemo(
    () =>
      projects.filter((project) => {
        const status = normalizeEstimateStatus(project.estimate_status);
        return !submittedProjectIds.has(project.id) && (!status || status === "invited");
      }),
    [projects, submittedProjectIds]
  );

  const inProgressProjects = useMemo(
    () =>
      projects.filter((project) => {
        const status = normalizeEstimateStatus(project.estimate_status);
        if (submittedProjectIds.has(project.id)) {
          return false;
        }

        return status === "draft" || status === "in_progress";
      }),
    [projects, submittedProjectIds]
  );

  const submittedProjects = useMemo(
    () => projects.filter((project) => submittedProjectIds.has(project.id)),
    [projects, submittedProjectIds]
  );

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
    background: "linear-gradient(120deg, rgba(229, 246, 245, 0.95), rgba(248, 252, 255, 0.9))",
    borderBottom: "1px solid #d9e2ec",
  };
  const insightsBandStyle = {
    padding: "0.75rem 1.35rem",
    borderBottom: "1px solid #d9e2ec",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
  };
  const metricCardStyle = {
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0.55rem 0.75rem",
    minWidth: 138,
  };
  const panelStyle = {
    border: "1px solid #d9e2ec",
    borderRadius: 12,
    background: "#ffffff",
    padding: "0.9rem",
  };
  const actionPrimaryBtnStyle = {
    ...pageStyles.primaryBtn,
    borderRadius: 8,
    height: 40,
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)",
  };
  const actionSecondaryBtnStyle = {
    ...pageStyles.secondaryBtn,
    borderRadius: 8,
    height: 40,
    border: "1px solid #9fb3c8",
    background: "#ffffff",
    color: "#243b53",
  };

  function renderProjectBlock(title: string, rows: BuilderProject[], tone: "invited" | "progress" | "submitted") {
    const toneStyles =
      tone === "invited"
        ? { background: "#eff6ff", border: "#bfdbfe", badge: "#1d4ed8" }
        : tone === "progress"
        ? { background: "#fefce8", border: "#fde68a", badge: "#a16207" }
        : { background: "#ecfdf5", border: "#99f6e4", badge: "#0f766e" };

    return (
      <div
        style={{
          border: `1px solid ${toneStyles.border}`,
          borderRadius: 12,
          padding: 12,
          background: toneStyles.background,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#0f172a" }}>{title}</strong>
          <span style={{ fontSize: 12, fontWeight: 700, color: toneStyles.badge }}>{rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 14 }}>No projects in this stage.</div>
        ) : (
          rows.map((project) => (
            <div
              key={project.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#ffffff",
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{project.name}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{project.site_address || "No site address"}</div>
              </div>
              <button
                type="button"
                style={actionPrimaryBtnStyle}
                onClick={() => navigate(`/builder/apply-pricing?projectId=${encodeURIComponent(project.id)}`)}
              >
                Apply Pricing
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="builder-theme builder-page" style={pageStyles.page}>
      <div className="builder-surface" style={shellStyle}>
        <div style={heroStyle}>
          <h2 style={{ margin: 0, fontSize: "clamp(27px, 3.3vw, 34px)", fontWeight: 700, color: "#102a43", letterSpacing: "-0.3px" }}>
            Builder Dashboard
          </h2>
          <div style={{ width: "340px", maxWidth: "100%", opacity: 0.34, filter: "grayscale(100%)", marginRight: "0.2rem" }}>
            <ConstructionIllustration type="tools" />
          </div>
        </div>

        <div style={insightsBandStyle}>
          <div>
            <p style={{ margin: 0, color: "#334e68", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>INSIGHTS</p>
          </div>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            <div style={metricCardStyle}>
              <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>Invited</p>
              <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#227c9d", lineHeight: 1 }}>{invitedProjects.length}</p>
            </div>
            <div style={metricCardStyle}>
              <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>In Progress</p>
              <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#b7791f", lineHeight: 1 }}>{inProgressProjects.length}</p>
            </div>
            <div style={metricCardStyle}>
              <p style={{ margin: 0, color: "#486581", fontSize: 12, fontWeight: 600 }}>Submitted</p>
              <p style={{ margin: "0.1rem 0 0", fontWeight: 700, fontSize: "1.9rem", color: "#2f855a", lineHeight: 1 }}>{submittedProjects.length}</p>
            </div>
          </div>
          <button type="button" style={actionPrimaryBtnStyle} onClick={loadPipeline}>
            Refresh
          </button>
        </div>

        <div style={{ padding: "0.85rem 1.35rem 1.15rem", display: "grid", gap: 12 }}>
          <div style={{ ...panelStyle, display: "grid", gap: 10 }}>
            <div style={{ color: "#334e68", fontSize: 14, fontWeight: 600 }}>
              Track invited projects, pricing progress, and submitted estimates.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                style={actionPrimaryBtnStyle}
                onClick={() => navigate("/builder/profile")}
              >
                Manage Builder Profile
              </button>
              <button
                type="button"
                style={actionSecondaryBtnStyle}
                onClick={() => navigate("/builder/base-pricing")}
              >
                Manage Base Pricing Overrides
              </button>
              <button
                type="button"
                style={actionSecondaryBtnStyle}
                onClick={() => navigate("/builder/submit")}
              >
                View Submissions
              </button>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Project Pipeline</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {renderProjectBlock("Invited", invitedProjects, "invited")}
                {renderProjectBlock("In Progress", inProgressProjects, "progress")}
                {renderProjectBlock("Submitted", submittedProjects, "submitted")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
