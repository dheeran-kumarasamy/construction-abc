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
          style={primaryBtn}
        >
          Manage Base Pricing
        </button>

        <button
          onClick={() => navigate("/builder/apply-pricing")}
          style={successBtn}
        >
          Apply Pricing to BOQ
        </button>

        <button
          onClick={() => navigate("/builder/margins")}
          style={warningBtn}
        >
          Configure Margins & Uplifts
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "#3B5BDB",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const successBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "#16A34A",
};

const warningBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "#F59E0B",
};
