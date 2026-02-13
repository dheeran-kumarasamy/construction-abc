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
      <div style={{ display: "flex", gap: "12px", marginTop: 16 }}>
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
      </div>
    </div>
  );
}
