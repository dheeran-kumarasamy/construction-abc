import { pageStyles } from "../../layouts/pageStyles";

export default function ClientView() {
  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(760px, 100%)" }}>
        <h2 style={pageStyles.title}>Client View</h2>
        <p style={pageStyles.subtitle}>
          View approved estimates, summaries, and downloadable reports. This page is read-only for clients.
        </p>
      </div>
    </div>
  );
}
