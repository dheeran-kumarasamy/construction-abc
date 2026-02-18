import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";

export default function BuilderDashboard() {
  const navigate = useNavigate();

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(860px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Builder Dashboard</h2>
            <p style={pageStyles.subtitle}>
              Manage base pricing, apply pricing to BOQ, and configure margins &
              uplifts.
            </p>
          </div>
        </div>
        <div style={pageStyles.buttonRow}>
          <button
            onClick={() => navigate("/builder/base-pricing")}
            style={pageStyles.primaryBtn}
          >
            Manage Base Pricing
          </button>

          <button
            onClick={() => navigate("/builder/apply-pricing")}
            style={pageStyles.primaryBtn}
          >
            Apply Pricing to BOQ
          </button>

          <button
            onClick={() => navigate("/builder/margins")}
            style={pageStyles.primaryBtn}
          >
            Configure Margins & Uplifts
          </button>
          <button
            onClick={() => navigate("/builder/submit")}
            style={pageStyles.primaryBtn}
          >
            Submit Estimate to Architect
          </button>
        </div>
      </div>
    </div>
  );
}
