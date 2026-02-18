import { useNavigate } from "react-router-dom";

export default function ArchitectDashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 40 }}>
      <h1>Architect Dashboard</h1>
      <p>
        Create projects, upload BOQs, invite builders, review estimates, and
        export reports.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: 16 }}>
        <button
          onClick={() => navigate("/architect/create")}
          style={{
            background: "#3B5BDB",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Create Project
        </button>
        <button
          onClick={() => navigate("/architect/boq-upload")}
          style={{
            background: "#16A34A",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Upload BOQ
        </button>
        <button
          onClick={() => navigate("/architect/comparison")}
          style={{
            background: "#16A34A",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Compare Builder Estimates
        </button>
        <button
          onClick={() => navigate("/architect/invite")}
          style={{
            background: "#8B5CF6",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Invite Builders
        </button>
        <button
          onClick={() => navigate("/architect/received")}
          style={{
            background: "#F59E0B",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          View Submitted Estimates
        </button>
        <button
          onClick={() => navigate("/architect/audit")}
          style={{
            background: "#111827",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          View Audit Trail
        </button>
        <button
          onClick={() => navigate("/architect/projects")}
          style={{
            background: "#111827",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          View Projects
        </button>
      </div>
    </div>
  );
}
