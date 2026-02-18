import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";

export default function ArchitectDashboard() {
  const navigate = useNavigate();

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(860px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Architect Dashboard</h2>
            <p style={pageStyles.subtitle}>
              Create projects, upload BOQs, invite builders, review estimates, and
              export reports.
            </p>
          </div>
        </div>
        <div style={pageStyles.buttonRow}>
          <button
            onClick={() => navigate("/architect/create")}
            style={pageStyles.primaryBtn}
          >
            Create Project
          </button>
          <button
            onClick={() => navigate("/architect/boq-upload")}
            style={pageStyles.primaryBtn}
          >
            Upload BOQ
          </button>
          <button
            onClick={() => navigate("/architect/comparison")}
            style={pageStyles.primaryBtn}
          >
            Compare Builder Estimates
          </button>
          <button
            onClick={() => navigate("/architect/invite")}
            style={pageStyles.primaryBtn}
          >
            Invite Builders
          </button>
          <button
            onClick={() => navigate("/architect/received")}
            style={pageStyles.primaryBtn}
          >
            View Submitted Estimates
          </button>
          <button
            onClick={() => navigate("/architect/audit")}
            style={pageStyles.secondaryBtn}
          >
            View Audit Trail
          </button>
          <button
            onClick={() => navigate("/architect/projects")}
            style={pageStyles.secondaryBtn}
          >
            View Projects
          </button>
        </div>
      </div>
    </div>
  );
}
