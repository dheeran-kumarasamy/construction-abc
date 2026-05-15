import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

interface Project {
  id: string;
  name: string;
}

export default function ComparisonDashboard() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;
    fetchProjects();
  }, [token]);

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
    } catch (err) {
      console.error("Load projects error:", err);
    }
  }

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
