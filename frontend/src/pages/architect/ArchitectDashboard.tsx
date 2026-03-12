import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";

export default function ArchitectDashboard() {
  const navigate = useNavigate();

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(860px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Architect Dashboard</h2>
            <p style={pageStyles.subtitle}>
              Use the workflow bar at the top to navigate each step in one click.
            </p>
          </div>
        </div>
        <div style={pageStyles.result}>
          Select any step from the top workflow to continue.
        </div>
        <div style={pageStyles.buttonRow}>
          <button
            type="button"
            style={pageStyles.primaryBtn}
            onClick={() => navigate("/architect/prices")}
          >
            Open Material Prices
          </button>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => navigate("/architect/estimation")}
          >
            Rate Analysis & BOQ
          </button>
        </div>
      </div>
    </div>
  );
}
