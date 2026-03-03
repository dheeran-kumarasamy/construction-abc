import { pageStyles } from "../../layouts/pageStyles";

export default function BuilderDashboard() {
  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(860px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Builder Dashboard</h2>
            <p style={pageStyles.subtitle}>
              Use the workflow bar at the top to navigate each step in one click.
            </p>
          </div>
        </div>
        <div style={pageStyles.result}>
          Select any step from the top workflow to continue.
        </div>
      </div>
    </div>
  );
}
