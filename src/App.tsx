import React from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import CreateProject from "./pages/architect/CreateProject";
import BOQUpload from "./pages/architect/BOQUploadWithParsing";
import BOQMapping from "./pages/architect/BOQMapping";
import PricingEngine from "./pages/architect/PricingEngine";
import ArchitectDashboard from "./pages/architect/ArchitectDashboard";
import BuilderDashboard from "./pages/builder/BuilderDashboard";
import BuilderBasePricing from "./pages/builder/BuilderBasePricing";
import ApplyBasePricing from "./pages/builder/ApplyBasePricing";
import MarginEngine from "./pages/builder/MarginEngine";
import ComparisonDashboard from "./pages/architect/ComparisonDashboard";
import LoginPage from "./pages/LoginPage";
import { RequireAuth } from "./auth/AuthContext";
import InviteBuilders from "./pages/architect/InviteBuilders";
import SubmitEstimate from "./pages/builder/SubmitEstimate";
import ReceivedEstimates from "./pages/architect/ReceivedEstimates";
import AuditTrail from "./pages/architect/AuditTrail";

// --- Landing Page ---
function Landing() {
  const navigate = useNavigate();

  const roles = [
    { id: "architect", label: "Architect" },
    { id: "builder", label: "Builder" },
    { id: "client", label: "Client" },
  ];

  return (
    <div style={styles.centered}>
      <div style={styles.grid}>
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/${r.id}`)}
            style={styles.card}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}


// --- Client View ---
function ClientView() {
  return (
    <div style={styles.page}>
      <h1>Client View</h1>
      <p>View approved estimates, summaries, and downloadable reports.</p>
    </div>
  );
}

// --- Main App ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/architect" element={<ArchitectDashboard />} />
        <Route path="/builder" element={<BuilderDashboard />} />
        <Route path="/client" element={<ClientView />} />
        <Route path="/architect/create" element={<CreateProject />} />
        <Route path="/architect/boq-upload" element={<BOQUpload />} />
        <Route path="/architect/boq-mapping" element={<BOQMapping />} />
        <Route path="/architect/pricing" element={<PricingEngine />} />
        <Route path="/builder/base-pricing" element={<BuilderBasePricing />} />
        <Route path="/builder/apply-pricing" element={<ApplyBasePricing />} />
        <Route path="/builder/margins" element={<MarginEngine />} />
        <Route path="/architect/comparison" element={<ComparisonDashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/architect"
          element={
            <RequireAuth role="architect">
              <ArchitectDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/builder"
          element={
            <RequireAuth role="builder">
              <BuilderDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/client"
          element={
            <RequireAuth role="client">
              <ClientView />
            </RequireAuth>
          }
        />
        <Route
          path="/architect/invite"
          element={
            <RequireAuth role="architect">
            <InviteBuilders />
            </RequireAuth>
          }
        />
        <Route
          path="/builder/submit"
          element={
          <RequireAuth role="builder">
          <SubmitEstimate />
          </RequireAuth>
          }
        />
        <Route
          path="/architect/received"
          element={
            <RequireAuth role="architect">
              <ReceivedEstimates />
            </RequireAuth>
          }
        />
        <Route
          path="/architect/audit"
          element={
            <RequireAuth role="architect">
              <AuditTrail />
            </RequireAuth>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

// --- Inline styles (temporary) ---
const styles: Record<string, React.CSSProperties> = {
  centered: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8F9FB",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "24px",
    width: "720px",
  },
  card: {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "40px",
    fontSize: "20px",
    fontWeight: 600,
    border: "1px solid #E5E7EB",
    cursor: "pointer",
  },
  page: {
    padding: "40px",
    fontFamily: "Inter, sans-serif",
  },
};
