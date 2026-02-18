import { useNavigate } from "react-router-dom";

export default function BuilderDashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 40 }}>
      <h1>Builder Dashboard</h1>
      <p>
        Manage base pricing, apply pricing to BOQ, and configure margins &
        uplifts.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => navigate("/builder/base-pricing")}
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
          Manage Base Pricing
        </button>

        <button
          onClick={() => navigate("/builder/apply-pricing")}
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
          Apply Pricing to BOQ
        </button>

        <button
          onClick={() => navigate("/builder/margins")}
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
          Configure Margins & Uplifts
        </button>
        <button
          onClick={() => navigate("/builder/submit")}
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
          Submit Estimate to Architect
        </button>


      </div>
    </div>
  );
}
