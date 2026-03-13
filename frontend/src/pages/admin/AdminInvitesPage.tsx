import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  project_name: string | null;
  organization_name: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function toneForStatus(status: string): "neutral" | "success" | "danger" | "warning" {
  if (status === "accepted") return "success";
  if (status === "expired") return "danger";
  return "warning";
}

export default function AdminInvitesPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<InviteRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<PaginatedResponse<InviteRow>>(`/api/admin/invites?page=${nextPage}&pageSize=20`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function resendInvite(invite: InviteRow) {
    try {
      setSavingId(invite.id);
      setError("");
      const response = await adminFetch<{ inviteLink: string; expiresAt: string }>(`/api/admin/invites/${invite.id}/resend`, {
        method: "POST",
      });
      setSuccess(`Invite resent to ${invite.email}. Expires ${formatDate(response.expiresAt)}.`);
      window.prompt("Invite link", response.inviteLink);
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to resend invite");
    } finally {
      setSavingId("");
    }
  }

  async function deleteInvite(invite: InviteRow) {
    const confirmed = window.confirm(`Delete invite for ${invite.email}?`);
    if (!confirmed) return;

    try {
      setSavingId(invite.id);
      setError("");
      await adminFetch(`/api/admin/invites/${invite.id}`, { method: "DELETE" });
      setSuccess(`Deleted invite for ${invite.email}`);
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete invite");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="Invite Management"
      subtitle="Monitor invitation state across organizations and project onboarding flows."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Invites</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Email</th>
                <th style={pageStyles.th}>Role</th>
                <th style={pageStyles.th}>Project</th>
                <th style={pageStyles.th}>Organization</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Accepted</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((invite, index) => (
                <tr key={invite.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{invite.email}</td>
                  <td style={pageStyles.td}>{invite.role}</td>
                  <td style={pageStyles.td}>{invite.project_name || "—"}</td>
                  <td style={pageStyles.td}>{invite.organization_name || "—"}</td>
                  <td style={pageStyles.td}><StatusPill label={invite.status} tone={toneForStatus(invite.status)} /></td>
                  <td style={pageStyles.td}>{formatDate(invite.created_at)}</td>
                  <td style={pageStyles.td}>{formatDate(invite.accepted_at)}</td>
                  <td style={pageStyles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" style={pageStyles.secondaryBtn} onClick={() => resendInvite(invite)} disabled={savingId === invite.id}>Resend</button>
                      <button type="button" style={{ ...pageStyles.secondaryBtn, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => deleteInvite(invite)} disabled={savingId === invite.id}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No invites found.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>Next</button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
