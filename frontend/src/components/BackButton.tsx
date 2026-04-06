import { useLocation, useNavigate } from "react-router-dom";

export function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  // Dashboard paths where back button should not appear
  const dashboardPaths = [
    "/",
    "/login",
    "/accept-invite",
    "/architect",
    "/builder",
    "/admin",
    "/client",
    "/estimation",
    "/architect/estimation",
    "/builder/estimation",
  ];

  // Check if current path is a dashboard
  const isDashboard = dashboardPaths.includes(location.pathname);

  if (isDashboard) {
    return null;
  }

  const handleGoBack = () => {
    // Try to go back in browser history, fallback to navigate home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        zIndex: 1100,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        aria-label="Go back"
        title="Go back"
        onClick={handleGoBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(10px)",
          color: "#f1f5f9",
          fontSize: "22px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          boxShadow: "0 2px 8px rgba(2, 6, 23, 0.2)",
          padding: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(15, 23, 42, 0.95)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(148, 163, 184, 0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(15, 23, 42, 0.8)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(148, 163, 184, 0.3)";
        }}
      >
        ←
      </button>
    </div>
  );
}
