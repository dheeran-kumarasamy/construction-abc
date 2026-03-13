import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type UserRow = {
  id: string;
  email: string;
  role: string;
  org_role: string | null;
  organization_id: string | null;
  organization_name: string | null;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
};

type UserDetailResponse = {
  user: UserRow;
  projects: Array<{ id: string; name: string; description: string | null; created_at: string }>;
  invites: Array<{ id: string; email: string; role: string; created_at: string; expires_at: string | null; accepted_at: string | null }>;
  dealerProfile: { id: string; shop_name: string; city: string | null; state: string | null; is_approved: boolean } | null;
};

const roles = ["", "admin", "architect", "builder", "client", "dealer"];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminUsersPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState<PaginatedResponse<UserRow> | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<UserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [editState, setEditState] = React.useState({ role: "", orgRole: "", organizationId: "", isActive: true });

  async function loadUsers(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "20" });
      if (roleFilter) params.set("role", roleFilter);
      if (search.trim()) params.set("search", search.trim());
      const response = await adminFetch<PaginatedResponse<UserRow>>(`/api/admin/users?${params.toString()}`);
      setUsers(response);
      setPage(nextPage);

      if (response.items.length && !selectedUserId) {
        setSelectedUserId(response.items[0].id);
      }
      if (!response.items.find((item) => item.id === selectedUserId) && response.items[0]) {
        setSelectedUserId(response.items[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(userId: string) {
    try {
      setDetailLoading(true);
      setError("");
      const response = await adminFetch<UserDetailResponse>(`/api/admin/users/${userId}`);
      setDetail(response);
      setEditState({
        role: response.user.role,
        orgRole: response.user.org_role || "",
        organizationId: response.user.organization_id || "",
        isActive: response.user.is_active,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load user detail");
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    loadUsers(1);
  }, []);

  React.useEffect(() => {
    if (selectedUserId) {
      loadDetail(selectedUserId);
    } else {
      setDetail(null);
    }
  }, [selectedUserId]);

  async function saveUser() {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await adminFetch(`/api/admin/users/${selectedUserId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: editState.role,
          orgRole: editState.orgRole || null,
          organizationId: editState.organizationId || null,
          isActive: editState.isActive,
        }),
      });
      setSuccess("User updated");
      await Promise.all([loadUsers(page), loadDetail(selectedUserId)]);
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      setError("");
      const response = await adminFetch<{ tempPassword: string }>(`/api/admin/users/${selectedUserId}/reset-password`, {
        method: "POST",
      });
      setSuccess(`Temporary password: ${response.tempPassword}`);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(mode: "soft" | "hard") {
    if (!selectedUserId) return;
    const confirmed = window.confirm(
      mode === "hard"
        ? "Hard delete this user? This may cascade across related records."
        : "Disable this user account?"
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await adminFetch(`/api/admin/users/${selectedUserId}?mode=${mode}`, {
        method: "DELETE",
      });
      setSuccess(mode === "hard" ? "User hard-deleted" : "User disabled");
      setSelectedUserId("");
      setDetail(null);
      await loadUsers(1);
    } catch (err: any) {
      setError(err.message || "Failed to update user state");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = users ? Math.max(1, Math.ceil(users.pagination.total / users.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="User Management"
      subtitle="Search, inspect, update, disable, reset, and remove users across all roles."
      actions={
        <>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => loadUsers(page)} disabled={loading}>
            Refresh
          </button>
        </>
      }
    >
      <AdminCard>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12 }}>
          <input
            style={pageStyles.input}
            placeholder="Search by email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select style={pageStyles.select} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            {roles.map((role) => (
              <option key={role || "all"} value={role}>
                {role || "All roles"}
              </option>
            ))}
          </select>
          <button type="button" style={pageStyles.primaryBtn} onClick={() => loadUsers(1)}>
            Apply Filters
          </button>
        </div>
      </AdminCard>

      {error && <div style={{ ...pageStyles.error, marginTop: 12 }}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginTop: 12 }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 16, marginTop: 16 }}>
        <AdminCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>Users</strong>
            <span style={pageStyles.subtext}>{users?.pagination.total || 0} total</span>
          </div>
          <AdminTable>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Email</th>
                  <th style={pageStyles.th}>Role</th>
                  <th style={pageStyles.th}>Org</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {(users?.items || []).map((user, index) => (
                  <tr
                    key={user.id}
                    style={{ ...(index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd), cursor: "pointer", outline: user.id === selectedUserId ? "2px solid #0f766e" : "none" }}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td style={pageStyles.td}>{user.email}</td>
                    <td style={pageStyles.td}>{user.role}</td>
                    <td style={pageStyles.td}>{user.organization_name || "—"}</td>
                    <td style={pageStyles.td}>
                      <StatusPill label={user.is_active ? "active" : "disabled"} tone={user.is_active ? "success" : "danger"} />
                    </td>
                    <td style={pageStyles.td}>{formatDate(user.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
          {!loading && !(users?.items.length) && <div style={pageStyles.empty}>No users found.</div>}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <button type="button" style={pageStyles.secondaryBtn} onClick={() => loadUsers(Math.max(1, page - 1))} disabled={page <= 1 || loading}>
              Previous
            </button>
            <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
            <button type="button" style={pageStyles.secondaryBtn} onClick={() => loadUsers(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>
              Next
            </button>
          </div>
        </AdminCard>

        <AdminCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>User Detail</strong>
            {detailLoading && <span style={pageStyles.subtext}>Loading…</span>}
          </div>
          {!detail && <div style={pageStyles.empty}>Select a user to inspect.</div>}
          {detail && (
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{detail.user.email}</div>
                <div style={pageStyles.subtext}>Created {formatDate(detail.user.created_at)}</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <label style={pageStyles.label}>Role</label>
                <select style={pageStyles.select} value={editState.role} onChange={(event) => setEditState((current) => ({ ...current, role: event.target.value }))}>
                  {roles.filter(Boolean).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                <label style={pageStyles.label}>Organization Role</label>
                <select style={pageStyles.select} value={editState.orgRole} onChange={(event) => setEditState((current) => ({ ...current, orgRole: event.target.value }))}>
                  <option value="">None</option>
                  <option value="head">head</option>
                  <option value="member">member</option>
                </select>

                <label style={pageStyles.label}>Organization Id</label>
                <input style={pageStyles.input} value={editState.organizationId} onChange={(event) => setEditState((current) => ({ ...current, organizationId: event.target.value }))} placeholder="Organization UUID" />

                <label style={{ ...pageStyles.checkboxRow, fontWeight: 600 }}>
                  <input type="checkbox" checked={editState.isActive} onChange={(event) => setEditState((current) => ({ ...current, isActive: event.target.checked }))} />
                  Account active
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" style={pageStyles.primaryBtn} onClick={saveUser} disabled={saving}>Save</button>
                <button type="button" style={pageStyles.secondaryBtn} onClick={resetPassword} disabled={saving}>Reset Password</button>
                <button type="button" style={pageStyles.secondaryBtn} onClick={() => deleteUser("soft")} disabled={saving}>Disable</button>
                <button type="button" style={{ ...pageStyles.secondaryBtn, borderColor: "#fecaca", color: "#b91c1c" }} onClick={() => deleteUser("hard")} disabled={saving}>Hard Delete</button>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Related Records</div>
                <div style={pageStyles.subtext}>Projects: {detail.projects.length}</div>
                <div style={pageStyles.subtext}>Invites: {detail.invites.length}</div>
                {detail.dealerProfile && (
                  <div style={pageStyles.subtext}>
                    Dealer: {detail.dealerProfile.shop_name} · {detail.dealerProfile.city || "—"}, {detail.dealerProfile.state || "—"}
                  </div>
                )}
              </div>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}
