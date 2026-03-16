import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

// Existing pages (kept for compatibility)
import CreateProject from "./pages/architect/CreateProject";
import BOQUpload from "./pages/architect/BOQUploadWithParsing";
import BOQMapping from "./pages/architect/BOQMapping";
import PricingEngine from "./pages/architect/PricingEngine";
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
import PriceTrackerPage from "./pages/PriceTracker/PriceTrackerPage";
import EstimationProjectsPage from "./pages/Estimation/EstimationProjectsPage";
import BOQWorkspacePage from "./pages/Estimation/BOQWorkspacePage";
import TemplateEditorPage from "./pages/Estimation/TemplateEditorPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminOrganizationsPage from "./pages/admin/AdminOrganizationsPage";
import AdminProjectsPage from "./pages/admin/AdminProjectsPage";
import AdminInvitesPage from "./pages/admin/AdminInvitesPage";
import AdminDealersPage from "./pages/admin/AdminDealersPage";
import AdminPricesPage from "./pages/admin/AdminPricesPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";
import AdminBOQsPage from "./pages/admin/AdminBOQsPage";
import AdminEstimationProjectsPage from "./pages/admin/AdminEstimationProjectsPage";
import AdminEstimatesPage from "./pages/admin/AdminEstimatesPage";
import FingerInAirEstimator from "./components/FingerInAirEstimator";

// Auth
import LoginPage from "./pages/Login";
import { RequireAuth, useAuth } from "./auth/AuthContext";
import { AuthProvider } from "./auth/AuthContext";
import { pageStyles } from "./layouts/pageStyles";

// --- Client View ---
function ClientView() {
  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <h1 style={pageStyles.title}>Client Dashboard</h1>
        <p style={pageStyles.subtitle}>View approved estimates and run quick order-of-magnitude project pricing.</p>
        <FingerInAirEstimator />
      </div>
    </div>
  );
}

function DashboardButton() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onArchitectScreen = location.pathname.startsWith("/architect");
  const onBuilderScreen = location.pathname.startsWith("/builder");

  const dashboardPath = onArchitectScreen
    ? "/architect"
    : onBuilderScreen
    ? "/builder"
    : null;

  const showBackToDashboard = !!dashboardPath && location.pathname !== dashboardPath;

  if (!user || location.pathname === "/login") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: onArchitectScreen || onBuilderScreen ? 78 : 16,
        right: 16,
        zIndex: 1200,
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        background: "rgba(2, 6, 23, 0.72)",
        border: "1px solid rgba(148, 163, 184, 0.5)",
        borderRadius: "12px",
        padding: "8px",
        boxShadow: "0 8px 22px rgba(2, 6, 23, 0.35)",
      }}
    >
      {showBackToDashboard ? (
        <button
          type="button"
          style={{
            ...pageStyles.primaryBtn,
            height: "38px",
            padding: "0 14px",
            fontSize: "13px",
            background: "#0f766e",
          }}
          onClick={() => navigate(dashboardPath)}
        >
          Back to Dashboard
        </button>
      ) : null}

      <button
        type="button"
        style={{
          ...pageStyles.primaryBtn,
          height: "38px",
          padding: "0 14px",
          fontSize: "13px",
          background: "#b91c1c",
          boxShadow: "0 6px 16px rgba(127, 29, 29, 0.45)",
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
    </div>
  );
}

function FlowBackgroundController() {
  return null;
}

function ArchitectWorkflowBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || user.role !== "architect" || !location.pathname.startsWith("/architect")) {
    return null;
  }

  const flowSteps = [
    { label: "Projects", path: "/architect", step: 1 },
    { label: "Create Project", path: "/architect/create", step: 2 },
    { label: "Upload BOQ", path: "/architect/boq-upload", step: 3 },
    { label: "Invite Builders", path: "/architect/invite", step: 4 },
    { label: "Received Estimates", path: "/architect/received", step: 5 },
    { label: "Material Rates", path: "/architect/prices", step: 6 },
  ];

  const roleLabel = "Architect";

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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
        <span
          style={{
            background: "#ecfeff",
            border: "1px solid #99f6e4",
            color: "#0f766e",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 10px",
          }}
        >
          {roleLabel}
        </span>
      </div>
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
          const isProjectsRoute =
            step.path === "/architect" &&
            (location.pathname === "/architect" || location.pathname === "/architect/projects");
          const isActive = isProjectsRoute || location.pathname === step.path;

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
    { label: "View Submission", path: "/builder/submit", step: 4 },
  ];

  const roleLabel = "Builder";

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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
        <span
          style={{
            background: "#ecfeff",
            border: "1px solid #99f6e4",
            color: "#0f766e",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 10px",
          }}
        >
          {roleLabel}
        </span>
      </div>
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
        <FlowBackgroundController />
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
            path="/admin"
            element={
              <RequireAuth role="admin">
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth role="admin">
                <AdminUsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/organizations"
            element={
              <RequireAuth role="admin">
                <AdminOrganizationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <RequireAuth role="admin">
                <AdminProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invites"
            element={
              <RequireAuth role="admin">
                <AdminInvitesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/dealers"
            element={
              <RequireAuth role="admin">
                <AdminDealersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/prices"
            element={
              <RequireAuth role="admin">
                <AdminPricesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/boqs"
            element={
              <RequireAuth role="admin">
                <AdminBOQsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/estimation-projects"
            element={
              <RequireAuth role="admin">
                <AdminEstimationProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/estimates"
            element={
              <RequireAuth role="admin">
                <AdminEstimatesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequireAuth role="admin">
                <AdminAuditPage />
              </RequireAuth>
            }
          />

          <Route
            path="/architect"
            element={
              <RequireAuth role="architect">
                <ProjectsList />
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

          <Route
            path="/architect/prices"
            element={
              <RequireAuth role="architect">
                <PriceTrackerPage />
              </RequireAuth>
            }
          />

          <Route
            path="/builder/prices"
            element={
              <RequireAuth role="builder">
                <PriceTrackerPage />
              </RequireAuth>
            }
          />

          <Route
            path="/prices"
            element={
              <RequireAuth>
                <PriceTrackerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/market-prices"
            element={
              <RequireAuth>
                <PriceTrackerPage />
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

          {/* Estimation / BOQ */}
          <Route
            path="/estimation"
            element={
              <RequireAuth>
                <EstimationProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/estimation/:projectId"
            element={
              <RequireAuth>
                <BOQWorkspacePage />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/estimation"
            element={
              <RequireAuth role="architect">
                <EstimationProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/estimation/:projectId"
            element={
              <RequireAuth role="architect">
                <BOQWorkspacePage />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/estimation"
            element={
              <RequireAuth role="builder">
                <EstimationProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/estimation/:projectId"
            element={
              <RequireAuth role="builder">
                <BOQWorkspacePage />
              </RequireAuth>
            }
          />

          {/* Template Editor */}
          <Route
            path="/estimation/templates"
            element={
              <RequireAuth>
                <TemplateEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/architect/estimation/templates"
            element={
              <RequireAuth role="architect">
                <TemplateEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/estimation/templates"
            element={
              <RequireAuth role="builder">
                <TemplateEditorPage />
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
