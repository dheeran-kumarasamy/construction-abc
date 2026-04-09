import React from "react";
import { Link, useLocation } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { useAuth } from "../../auth/AuthContext";
import { adminFetch } from "./adminApi";

type PermissionsResponse = { adminRole: string; modules: string[] };

// Module key → nav item mapping (key must match backend ALL_MODULE_KEYS)
const ALL_NAV_ITEMS = [
  { label: "Overview", path: "/admin", moduleKey: "overview" },
  { label: "Users", path: "/admin/users", moduleKey: "users" },
  { label: "Organizations", path: "/admin/organizations", moduleKey: "organizations" },
  { label: "Projects", path: "/admin/projects", moduleKey: "projects" },
  { label: "BOQs", path: "/admin/boqs", moduleKey: "boqs" },
  { label: "Invites", path: "/admin/invites", moduleKey: "invites" },
  { label: "Dealers", path: "/admin/dealers", moduleKey: "dealers" },
  { label: "Est. Projects", path: "/admin/estimation-projects", moduleKey: "estimation-projects" },
  { label: "Estimates", path: "/admin/estimates", moduleKey: "estimates" },
  { label: "Deviation Alerts", path: "/admin/deviations", moduleKey: "deviations" },
  { label: "Rates & Analysis", path: "/admin/rates-analysis", moduleKey: "rates-analysis" },
  { label: "Prices", path: "/admin/prices", moduleKey: "prices" },
  { label: "Audit", path: "/admin/audit", moduleKey: "audit" },
];

export function AdminShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = !user?.adminRole || user.adminRole === "super_admin";

  const [allowedModules, setAllowedModules] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (isSuperAdmin) {
      setAllowedModules(ALL_NAV_ITEMS.map((n) => n.moduleKey));
      return;
    }
    adminFetch<PermissionsResponse>("/api/admin/my-permissions")
      .then((data) => setAllowedModules(data.modules))
      .catch(() => setAllowedModules([]));
  }, [isSuperAdmin]);

  const navItems = React.useMemo(() => {
    const filtered = allowedModules === null
      ? [] // loading — show nothing until resolved
      : ALL_NAV_ITEMS.filter((n) => allowedModules.includes(n.moduleKey));

    // Super admin gets the Admin Team management entry too
    if (isSuperAdmin && allowedModules !== null) {
      filtered.push({ label: "Admin Team", path: "/admin/team", moduleKey: "admin_team" });
    }

    return filtered;
  }, [allowedModules, isSuperAdmin]);

  return (
    <div
      style={{
        ...pageStyles.page,
        alignItems: "stretch",
        justifyContent: "flex-start",
        padding: "24px",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        style={{
          width: "min(1400px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "rgba(255, 253, 248, 0.95)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "18px 20px", background: "linear-gradient(135deg, rgba(15,118,110,0.14), rgba(255,253,248,0.96))", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#0f766e", fontWeight: 700 }}>
                    Construction ABC Admin
                  </div>
                  {user?.adminRole && (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      background: user.adminRole === "super_admin" ? "#0f766e" : "#7c3aed",
                      color: "#fff",
                    }}>
                      {user.adminRole === "super_admin" ? "SUPER ADMIN" : "ADMIN TEAM"}
                    </span>
                  )}
                </div>
                <h1 style={{ margin: "8px 0 0", fontSize: "clamp(24px, 4vw, 34px)", lineHeight: 1.05, color: "#0f172a" }}>{title}</h1>
                {subtitle && <p style={{ margin: "8px 0 0", color: "#475569", maxWidth: 780 }}>{subtitle}</p>}
              </div>
              {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
            </div>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "rgba(248, 250, 252, 0.92)" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      textDecoration: "none",
                      padding: "10px 14px",
                      borderRadius: 999,
                      border: active ? "1px solid #0f766e" : "1px solid var(--border)",
                      background: active ? "#0f766e" : "#ffffff",
                      color: active ? "#ffffff" : "#0f172a",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "18px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AdminCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
      }}
    >
      {children}
    </div>
  );
}

export function AdminTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrapper" style={{ color: "#0f172a" }}>
      {children}
    </div>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "danger" | "warning" }) {
  const toneMap = {
    neutral: { background: "#e2e8f0", color: "#334155" },
    success: { background: "#dcfce7", color: "#166534" },
    danger: { background: "#fee2e2", color: "#991b1b" },
    warning: { background: "#fef3c7", color: "#92400e" },
  } as const;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...toneMap[tone],
      }}
    >
      {label}
    </span>
  );
}
