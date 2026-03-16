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
        <p style={pageStyles.subtitle}>View approved estimates and project updates.</p>
      </div>
    </div>
  );
}

function DashboardButton() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickEstimateOpen, setQuickEstimateOpen] = React.useState(false);
  const onArchitectScreen = location.pathname.startsWith("/architect");
  const onBuilderScreen = location.pathname.startsWith("/builder");
  const roleLabel = String(user?.role || "").toUpperCase();

  const dashboardPath = onArchitectScreen
    ? "/architect"
    : onBuilderScreen
    ? "/builder"
    : null;

  const showBackToDashboard = !!dashboardPath && location.pathname !== dashboardPath;
  const canOpenQuickEstimate = user?.role === "architect" || user?.role === "builder" || user?.role === "client";

  React.useEffect(() => {
    if (!quickEstimateOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickEstimateOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickEstimateOpen]);

  if (!user || location.pathname === "/login") {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1200,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "stretch",
          background: "rgba(2, 6, 23, 0.72)",
          border: "1px solid rgba(148, 163, 184, 0.5)",
          borderRadius: "12px",
          padding: "8px",
          boxShadow: "0 8px 22px rgba(2, 6, 23, 0.35)",
          width: "fit-content",
          maxWidth: "min(220px, calc(100vw - 24px))",
        }}
      >
        {roleLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "38px",
              padding: "0 12px",
              borderRadius: "999px",
              border: "1px solid #cbd5e1",
              background: "#e2e8f0",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.4px",
              cursor: "default",
              userSelect: "none",
              marginBottom: "4px",
              pointerEvents: "auto",
            }}
          >
            {roleLabel}
          </span>
        ) : null}

        {showBackToDashboard ? (
          <button
            type="button"
            style={{
              ...pageStyles.primaryBtn,
              height: "36px",
              padding: "0 14px",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.2px",
              background: "#0f766e",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              width: "100%",
              pointerEvents: "auto",
            }}
            onClick={() => navigate(dashboardPath)}
          >
            Dashboard
          </button>
        ) : null}

        {canOpenQuickEstimate ? (
          <button
            type="button"
            style={{
              ...pageStyles.primaryBtn,
              height: "36px",
              padding: "0 14px",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.2px",
              background: "#1d4ed8",
              color: "#ffffff",
              border: "1px solid #1e40af",
              boxShadow: "0 8px 18px rgba(30, 64, 175, 0.28)",
              width: "100%",
              pointerEvents: "auto",
            }}
            onClick={() => setQuickEstimateOpen(true)}
          >
            Quick Estimate
          </button>
        ) : null}

        <button
          type="button"
          style={{
            ...pageStyles.primaryBtn,
            height: "36px",
            padding: "0 14px",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.2px",
            background: "#b91c1c",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 6px 16px rgba(127, 29, 29, 0.45)",
            width: "100%",
            pointerEvents: "auto",
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

      {quickEstimateOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.6)",
            zIndex: 1300,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
          onClick={() => setQuickEstimateOpen(false)}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "92vh",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              padding: "14px",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Quick Estimate</h3>
              <button
                type="button"
                aria-label="Close quick estimate"
                style={{
                  ...pageStyles.secondaryBtn,
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: 999,
                  fontSize: 18,
                  lineHeight: 1,
                }}
                onClick={() => setQuickEstimateOpen(false)}
              >
                ×
              </button>
            </div>
            <FingerInAirEstimator />
          </div>
        </div>
      ) : null}
    </>
  );
}

function FlowBackgroundController() {
  return null;
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
