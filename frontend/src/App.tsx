import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

// Existing pages (kept for compatibility)
import CreateProject from "./pages/architect/CreateProject";
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
import ProjectDetailsPage from "./pages/architect/ProjectDetailsPage";
import ComparisonScreen from "./pages/architect/ComparisonScreen";
import PlanRequirementsModule from "./pages/architect/PlanRequirementsModule";
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
import AdminRatesAnalysisPage from "./pages/admin/AdminRatesAnalysisPage";
import AdminPricesPage from "./pages/admin/AdminPricesPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";
import AdminDeviationAlertsPage from "./pages/admin/AdminDeviationAlertsPage";
import AdminBOQsPage from "./pages/admin/AdminBOQsPage";
import AdminEstimationProjectsPage from "./pages/admin/AdminEstimationProjectsPage";
import AdminEstimatesPage from "./pages/admin/AdminEstimatesPage";
import AdminTeamPage from "./pages/admin/AdminTeamPage";
import FingerInAirEstimator from "./components/FingerInAirEstimator";
import { BackButton } from "./components/BackButton";

// Auth
import LoginPage from "./pages/Login";
import { RequireAuth, RequireBuilderProfile, useAuth } from "./auth/AuthContext";
import BuilderProfileSetupPage from "./pages/builder/BuilderProfileSetupPage";
import ArchitectBuilderDirectory from "./pages/architect/ArchitectBuilderDirectory";
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
  const [fabHovered, setFabHovered] = React.useState(false);
  const [actionsVisible, setActionsVisible] = React.useState(false);
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
  const showMaterialPrices = location.pathname !== "/prices";

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
          left: 16,
          top: 16,
          zIndex: 1200,
          pointerEvents: "none",
        }}
      >
        {roleLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "34px",
              padding: "0 10px",
              borderRadius: "999px",
              border: "1px solid #cbd5e1",
              background: "#e2e8f0",
              color: "#334155",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.4px",
              userSelect: "none",
              pointerEvents: "auto",
            }}
          >
            {roleLabel}
          </span>
        ) : null}
      </div>

      <div
        onMouseEnter={() => setActionsVisible(true)}
        onMouseLeave={() => setActionsVisible(false)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 1200,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          maxWidth: "min(240px, calc(100vw - 24px))",
        }}
      >
        {actionsVisible ? (
          <div
            style={{
              background: "rgba(2, 6, 23, 0.78)",
              border: "1px solid rgba(148, 163, 184, 0.52)",
              borderRadius: "12px",
              padding: "8px",
              boxShadow: "0 8px 22px rgba(2, 6, 23, 0.35)",
              width: "fit-content",
              minWidth: "178px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
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
                }}
                onClick={() => navigate(dashboardPath)}
              >
                Back to Dashboard
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
                }}
                onClick={() => setQuickEstimateOpen(true)}
              >
                Quick Estimate
              </button>
            ) : null}

            {showMaterialPrices ? (
              <button
                type="button"
                style={{
                  ...pageStyles.primaryBtn,
                  height: "36px",
                  padding: "0 14px",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.2px",
                  background: "#7c3aed",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  width: "100%",
                }}
                onClick={() => navigate("/prices")}
              >
                Material Prices
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Logout"
          title="Logout"
          onMouseEnter={() => setFabHovered(true)}
          onMouseLeave={() => setFabHovered(false)}
          onClick={() => {
            logout();
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            navigate("/login");
          }}
          style={{
            ...pageStyles.primaryBtn,
            width: 54,
            height: 54,
            minWidth: 54,
            borderRadius: "999px",
            padding: 0,
            fontSize: "22px",
            fontWeight: 900,
            lineHeight: 1,
            background: "#b91c1c",
            border: "1px solid rgba(255, 255, 255, 0.24)",
            boxShadow: fabHovered
              ? "0 0 0 4px rgba(248, 113, 113, 0.25), 0 0 26px rgba(239, 68, 68, 0.7), 0 12px 24px rgba(2, 6, 23, 0.48)"
              : "0 10px 24px rgba(2, 6, 23, 0.38)",
            transform: fabHovered ? "translateY(-1px) scale(1.03)" : "none",
            transition: "box-shadow 160ms ease, transform 160ms ease",
          }}
        >
          ⏻
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
        <BackButton />
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
            path="/admin/rates-analysis"
            element={
              <RequireAuth role="admin">
                <AdminRatesAnalysisPage />
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
            path="/admin/deviations"
            element={
              <RequireAuth role="admin">
                <AdminDeviationAlertsPage />
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
            path="/admin/team"
            element={
              <RequireAuth role="admin">
                <AdminTeamPage />
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
            // Removed BOQ upload route for architects
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

          <Route
            path="/architect/plan-requirements"
            element={
              <RequireAuth role="architect">
                <PlanRequirementsModule />
              </RequireAuth>
            }
          />

          <Route
            path="/architect/project/:id"
            element={
              <RequireAuth role="architect">
                <ProjectDetailsPage />
              </RequireAuth>
            }
          />

          {/* Builder */}
          {/* Builder — profile setup is outside the profile gate */}
          <Route
            path="/builder/profile/setup"
            element={
              <RequireAuth role="builder">
                <BuilderProfileSetupPage />
              </RequireAuth>
            }
          />
          <Route
            path="/builder/profile"
            element={
              <RequireAuth role="builder">
                <BuilderProfileSetupPage />
              </RequireAuth>
            }
          />

          {/* Builder — all other routes require a completed profile */}
          <Route
            path="/builder"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <BuilderDashboard />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />
          <Route
            path="/builder/base-pricing"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <BuilderBasePricing />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />
          <Route
            path="/builder/apply-pricing"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <ApplyBasePricing />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />
          <Route
            path="/builder/margins"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <MarginEngine />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />
          <Route
            path="/builder/submit"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <SubmitEstimate />
                </RequireBuilderProfile>
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
                <RequireBuilderProfile>
                  <PriceTrackerPage />
                </RequireBuilderProfile>
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
            element={<PriceTrackerPage />}
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
                <RequireBuilderProfile>
                  <EstimationProjectsPage />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />
          <Route
            path="/builder/estimation/:projectId"
            element={
              <RequireAuth role="builder">
                <RequireBuilderProfile>
                  <BOQWorkspacePage />
                </RequireBuilderProfile>
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
                <RequireBuilderProfile>
                  <TemplateEditorPage />
                </RequireBuilderProfile>
              </RequireAuth>
            }
          />

          <Route
            path="/architect/comparison/:projectId"
            element={<ComparisonScreenWithParams />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
                  <Route
                    path="/architect/builders"
                    element={
                      <RequireAuth role="architect">
                        <ArchitectBuilderDirectory />
                      </RequireAuth>
                    }
                  />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
