import { useEffect, useMemo, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../services/api";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPipeline();
  }, []);

  async function loadPipeline() {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  }

  const submittedProjectIds = useMemo(
    () => new Set(submitted.map((item) => item.project_id)),
    [submitted]
  );

  const invitedProjects = useMemo(
    () =>
      projects.filter((project) => {
        const status = String(project.estimate_status || "").toLowerCase();
        return !status || status === "invited";
      }),
    [projects]
  );

  const inProgressProjects = useMemo(
    () =>
      projects.filter((project) => {
        const status = String(project.estimate_status || "").toLowerCase();
        return !!status && status !== "submitted" && status !== "approved";
      }),
    [projects]
  );

  const submittedProjects = useMemo(
    () => projects.filter((project) => submittedProjectIds.has(project.id)),
    [projects, submittedProjectIds]
  );

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
          padding: 14,
          background: toneStyles.background,
          display: "grid",
          gap: 10,
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
                style={pageStyles.primaryBtn}
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
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Builder Dashboard</h2>
            <p style={pageStyles.subtitle}>Track invited projects, pricing progress, and submitted estimates.</p>
          </div>
        </div>
        <div style={pageStyles.result}>
          Unified builder workspace for project invites, pricing, and submissions.
        </div>
        <div style={pageStyles.buttonRow}>
          <button
            type="button"
            style={pageStyles.primaryBtn}
            onClick={() => navigate("/builder/prices")}
          >
            Open Material Prices
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => navigate("/builder/estimation")}
          >
            Rate Analysis & BOQ
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => navigate("/builder/base-pricing")}
          >
            Manage Base Pricing
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => navigate("/builder/margins")}
          >
            Configure Margins & Uplifts
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => navigate("/builder/submit")}
          >
            View Submissions
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={loadPipeline}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Pipeline"}
          </button>
        </div>

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
  );
}
