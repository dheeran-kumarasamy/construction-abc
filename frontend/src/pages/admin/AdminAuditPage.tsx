import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type AuditRow = {
  id: string;
  user_email: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminAuditPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<AuditRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      const response = await adminFetch<PaginatedResponse<AuditRow>>(`/api/admin/audit?page=${nextPage}&pageSize=25`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="Audit Logs"
      subtitle="Track admin and workflow actions recorded across the system."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Audit Trail</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>When</th>
                <th style={pageStyles.th}>User</th>
                <th style={pageStyles.th}>Action</th>
                <th style={pageStyles.th}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((row, index) => (
                <tr key={row.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{formatDate(row.created_at)}</td>
                  <td style={pageStyles.td}>{row.user_email || "system"}</td>
                  <td style={pageStyles.td}>{row.action}</td>
                  <td style={pageStyles.td}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                      {row.metadata ? JSON.stringify(row.metadata, null, 2) : "{}"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No audit entries found.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>Next</button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
