import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

// Existing pages (kept for compatibility)
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
import InviteBuilders from "./pages/architect/InviteBuilders";
import SubmitEstimate from "./pages/builder/SubmitEstimate";
import ReceivedEstimates from "./pages/architect/ReceivedEstimates";
import AuditTrail from "./pages/architect/AuditTrail";
import ProjectsList from "./pages/architect/ProjectsList";
import ComparisonScreen from "./pages/architect/ComparisonScreen";
import AcceptInvite from "./pages/auth/AcceptInvite";

// Auth
import LoginPage from "./pages/Login";
import { RequireAuth, useAuth } from "./auth/AuthContext";
import { AuthProvider } from "./auth/AuthContext";
import { pageStyles } from "./layouts/pageStyles";

// --- Client View ---
function ClientView() {
  return (
    <div style={styles.page}>
      <h1>Client View</h1>
      <p>View approved estimates, summaries, and downloadable reports.</p>
    </div>
  );
}

function DashboardButton() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || location.pathname === "/login") {
    return null;
  }

  const dashboardPath = `/${user.role}`;

  if (location.pathname === dashboardPath) {
    return (
      <button
        type="button"
        style={{
          ...pageStyles.secondaryBtn,
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          height: "40px",
        }}
        onClick={() => {
          logout();
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          navigate("/login");
        }}
      >
        Logout
      </button>
    );
  }

  return (
    <button
      type="button"
      style={{
        ...pageStyles.primaryBtn,
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
        height: "40px",
      }}
      onClick={() => navigate(dashboardPath)}
    >
      Go to {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
    </button>
  );
}

function ArchitectWorkflowBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || user.role !== "architect" || !location.pathname.startsWith("/architect")) {
    return null;
  }

  const flowSteps = [
    { label: "Create Project", path: "/architect/create", step: 1 },
    { label: "Upload BOQ", path: "/architect/boq-upload", step: 2 },
    { label: "Invite Builders", path: "/architect/invite", step: 3 },
    { label: "View Submitted Estimates", path: "/architect/received", step: 4 },
    { label: "Compare Builder Estimates", path: "/architect/comparison", step: 5 },
    { label: "View Projects", path: "/architect/projects", step: 6 },
    { label: "View Audit Trail", path: "/architect/audit", step: 7 },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 900,
        padding: "12px clamp(12px, 5vw, 32px)",
        background: "rgba(255, 253, 248, 0.96)",
        borderBottom: "1px solid #e5e7eb",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {flowSteps.map((step, idx) => {
          const isActive = location.pathname === step.path;
          return (
            <React.Fragment key={step.path}>
              <button
                type="button"
                onClick={() => navigate(step.path)}
                style={{
                  ...pageStyles.primaryBtn,
                  background: isActive ? "#0f766e" : "#115e59",
                  opacity: isActive ? 1 : 0.9,
                  height: "38px",
                  padding: "0 12px",
                  fontSize: "13px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <span style={{ fontWeight: 700 }}>{step.step}.</span>
                <span>{step.label}</span>
              </button>
              {idx < flowSteps.length - 1 && (
                <span style={{ color: "#0f766e", fontWeight: 700 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BuilderWorkflowBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || user.role !== "builder" || !location.pathname.startsWith("/builder")) {
    return null;
  }

  const flowSteps = [
    { label: "Manage Base Pricing", path: "/builder/base-pricing", step: 1 },
    { label: "Apply Pricing to BOQ", path: "/builder/apply-pricing", step: 2 },
    { label: "Configure Margins & Uplifts", path: "/builder/margins", step: 3 },
    { label: "Submit Estimate", path: "/builder/submit", step: 4 },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 900,
        padding: "12px clamp(12px, 5vw, 32px)",
        background: "rgba(255, 253, 248, 0.96)",
        borderBottom: "1px solid #e5e7eb",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {flowSteps.map((step, idx) => {
          const isActive = location.pathname === step.path;
          return (
            <React.Fragment key={step.path}>
              <button
                type="button"
                onClick={() => navigate(step.path)}
                style={{
                  ...pageStyles.primaryBtn,
                  background: isActive ? "#0f766e" : "#115e59",
                  opacity: isActive ? 1 : 0.9,
                  height: "38px",
                  padding: "0 12px",
                  fontSize: "13px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <span style={{ fontWeight: 700 }}>{step.step}.</span>
                <span>{step.label}</span>
              </button>
              {idx < flowSteps.length - 1 && (
                <span style={{ color: "#0f766e", fontWeight: 700 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Wrapper to extract projectId route param and pass to ComparisonScreen
function ComparisonScreenWithParams() {
  const { projectId } = useParams();
  return <ComparisonScreen projectId={projectId || ""} />;
}

// --- Main App ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DashboardButton />
        <ArchitectWorkflowBar />
        <BuilderWorkflowBar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* Architect */}
          <Route
            path="/architect"
            element={
              <RequireAuth role="architect">
                <ArchitectDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/create"
            element={
              <RequireAuth role="architect">
                <CreateProject />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/boq-upload"
            element={
              <RequireAuth role="architect">
                <BOQUpload />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/boq-mapping"
            element={
              <RequireAuth role="architect">
                <BOQMapping />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/pricing"
            element={
              <RequireAuth role="architect">
                <PricingEngine />
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
            path="/architect/comparison"
            element={
              <RequireAuth role="architect">
                <ComparisonDashboard />
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

          <Route
            path="/architect/projects"
            element={
              <RequireAuth role="architect">
                <ProjectsList />
              </RequireAuth>
            }
          />

          {/* Builder */}
          <Route
            path="/builder"
            element={
              <RequireAuth role="builder">
                <BuilderDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/base-pricing"
            element={
              <RequireAuth role="builder">
                <BuilderBasePricing />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/apply-pricing"
            element={
              <RequireAuth role="builder">
                <ApplyBasePricing />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/margins"
            element={
              <RequireAuth role="builder">
                <MarginEngine />
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

          {/* Client */}
          <Route
            path="/client"
            element={
              <RequireAuth role="client">
                <ClientView />
              </RequireAuth>
            }
          />

          <Route
            path="/architect/comparison/:projectId"
            element={<ComparisonScreenWithParams />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
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
