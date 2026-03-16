import { pageStyles } from "../../layouts/pageStyles";
import { useNavigate } from "react-router-dom";

export default function ArchitectDashboard() {
  const navigate = useNavigate();

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Architect Dashboard</h2>
            <p style={pageStyles.subtitle}>Manage projects, pricing analysis, and tender comparisons.</p>
          </div>
        </div>
        <div style={pageStyles.result}>
          Open the next workspace from the actions below.
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
