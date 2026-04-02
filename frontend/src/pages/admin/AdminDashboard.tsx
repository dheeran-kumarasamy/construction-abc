import React from "react";
import { Link } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { adminFetch } from "./adminApi";
import { AdminCard, AdminShell } from "./AdminShell";
import { formatDateTime } from "../../services/dateTime";

type DashboardResponse = {
  summary: {
    users: number;
    organizations: number;
    projects: number;
    estimates: number;
    boqUploads: number;
    dealers: number;
    activePriceAlerts: number;
    marketDeviationAlerts: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    user_email: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
  systemHealth: {
    database: string;
    lastScraperRunAt: string | null;
  };
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <AdminCard>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value.toLocaleString()}</div>
    </AdminCard>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<DashboardResponse | null>(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const body = await adminFetch<DashboardResponse>("/api/admin/dashboard");
      setData(body);
    } catch (err: any) {
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <AdminShell
      title="Admin Dashboard"
      subtitle="System controls, operational visibility, and high-level activity across Construction ABC."
      actions={
        <button type="button" style={pageStyles.secondaryBtn} onClick={loadDashboard} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >

      {error && <div style={{ ...pageStyles.error, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 18 }}>
        <StatCard label="Users" value={data?.summary.users || 0} />
        <StatCard label="Organizations" value={data?.summary.organizations || 0} />
        <StatCard label="Projects" value={data?.summary.projects || 0} />
        <StatCard label="Estimates" value={data?.summary.estimates || 0} />
        <StatCard label="BOQ Uploads" value={data?.summary.boqUploads || 0} />
        <StatCard label="Dealers" value={data?.summary.dealers || 0} />
        <StatCard label="Active Price Alerts" value={data?.summary.activePriceAlerts || 0} />
        <StatCard label="Market Deviation Alerts" value={data?.summary.marketDeviationAlerts || 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
        <AdminCard>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recent Activity</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {(data?.recentActivity || []).map((item) => (
              <div key={item.id} style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: "10px 12px", background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{item.action}</div>
                <div style={{ color: "#334155", fontSize: 12, marginTop: 4 }}>
                  by {item.user_email || "system"} · {formatDateTime(item.created_at)}
                </div>
              </div>
            ))}
            {!loading && (data?.recentActivity || []).length === 0 && (
              <div style={{ color: "#64748b", fontSize: 13 }}>No activity logs found.</div>
            )}
          </div>
        </AdminCard>

        <AdminCard>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>System Health</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Database</span>
              <strong style={{ color: data?.systemHealth.database === "connected" ? "#059669" : "#dc2626" }}>
                {data?.systemHealth.database || "unknown"}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#64748b" }}>Last Scraper Run</span>
              <strong style={{ color: "#0f172a", textAlign: "right" }}>
                {data?.systemHealth.lastScraperRunAt
                  ? formatDateTime(data.systemHealth.lastScraperRunAt)
                  : "Never"}
              </strong>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />

          <h4 style={{ margin: "0 0 8px", color: "#0f172a" }}>Admin Modules</h4>
          <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.5 }}>
            Users · Organizations · Projects · BOQs · Estimation Projects · Estimates · Invites · Dealers · Prices · Audit
          </div>

          <div style={{ marginTop: 12 }}>
            <Link
              to="/admin/deviations"
              style={{
                ...pageStyles.primaryBtn,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              Open Deviation Alerts
            </Link>
          </div>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
