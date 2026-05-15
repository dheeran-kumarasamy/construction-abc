import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";
import { formatINR } from "../../services/currency";

interface Project {
  id: string;
  name: string;
}

interface Estimate {
  builder_name: string;
  grand_total: number | null;
  rank: number;
  revision_id: string;
  award_id?: string | null;
  awarded_revision_id?: string | null;
  awarded_at?: string | null;
}

function getGrandTotal(estimate: Estimate) {
  return Number(estimate.grand_total ?? 0);
}

export default function ComparisonDashboard() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;
    fetchProjects();
  }, [token]);

  useEffect(() => {
    if (!selectedProjectId || !token) return;
    fetchComparison();
  }, [selectedProjectId, token]);

  async function fetchProjects() {
    try {
      const res = await fetch(apiUrl("/projects"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data);
      const requestedProjectId = searchParams.get("projectId") || "";
      const matchedProject = data.find((project: Project) => project.id === requestedProjectId);
      if (matchedProject) {
        setSelectedProjectId(matchedProject.id);
      } else if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error("Load projects error:", err);
      setLoading(false);
    }
  }

  async function fetchComparison() {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/comparison`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to load comparison");
      const data = await res.json();
      setEstimates(data);
    } catch (err) {
      console.error("Load comparison error:", err);
    }
  }

  async function handleAward(revisionId: string) {
    if (!selectedProjectId) return;
    const awardedRevisionId = estimates.find((estimate) => estimate.awarded_revision_id)?.awarded_revision_id || null;
    const isChangingAward = Boolean(awardedRevisionId && awardedRevisionId !== revisionId);
    const confirmationMessage = isChangingAward
      ? "This project is already awarded to another builder. Are you sure you want to change the award to this builder?"
      : "Are you sure you want to award this builder?";

    if (!confirm(confirmationMessage)) return;

    try {
      const res = await fetch(
        apiUrl(`/projects/${selectedProjectId}/award`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ estimateRevisionId: revisionId }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Award failed");
      alert(data?.replaced ? "Award updated successfully" : "Project awarded successfully");
      fetchComparison();
    } catch (err: any) {
      alert(err.message || "Failed to award project");
    }
  }

  const awardedRevisionId = estimates.find((estimate) => estimate.awarded_revision_id)?.awarded_revision_id || null;
  const awardedEstimate = awardedRevisionId
    ? estimates.find((estimate) => estimate.revision_id === awardedRevisionId) || null
    : null;

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
          <h2 style={{ margin: 0, fontSize: "clamp(27px, 3.3vw, 34px)", fontWeight: 700, color: "#3f2d5c", letterSpacing: "-0.3px" }}>
            Builder Estimate Comparison
          </h2>
          <div style={{ width: "340px", maxWidth: "100%", opacity: 0.34, filter: "grayscale(100%)", marginRight: "0.2rem" }}>
            <ConstructionIllustration type="blueprint" />
          </div>
        </div>

        <div style={contentPadStyle}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#0f766e",
              fontWeight: 500,
            }}
          >
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ ...pageStyles.select, width: "100%" }}
          >
            <option value="">-- Select a Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>{/* end contentPadStyle */}
      </div>
    </div>
  );
}
