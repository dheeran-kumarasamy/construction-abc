import React from "react";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch } from "./adminApi";
import { pageStyles } from "../../layouts/pageStyles";
import { formatDateTime } from "../../services/dateTime";

// Must stay in sync with backend ALL_MODULE_KEYS
const ALL_MODULES = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "organizations", label: "Organizations" },
  { key: "projects", label: "Projects" },
  { key: "boqs", label: "BOQs" },
  { key: "invites", label: "Invites" },
  { key: "dealers", label: "Dealers" },
  { key: "estimation-projects", label: "Est. Projects" },
  { key: "estimates", label: "Estimates" },
  { key: "deviations", label: "Deviation Alerts" },
  { key: "rates-analysis", label: "Rates & Analysis" },
  { key: "prices", label: "Prices" },
  { key: "audit", label: "Audit" },
];

type TeamUser = {
  id: string;
  email: string;
  admin_role: "super_admin" | "admin_team";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  modules: string[];
};

function ModuleSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {ALL_MODULES.map((m) => {
        const active = selected.includes(m.key);
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => toggle(m.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
              background: active ? "#0f766e" : "#f8fafc",
              color: active ? "#fff" : "#334155",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function PermissionsDrawer({
  user,
  onClose,
  onSaved,
}: {
  user: TeamUser;
  onClose: () => void;
  onSaved: (userId: string, modules: string[]) => void;
}) {
  const [selected, setSelected] = React.useState<string[]>(user.modules);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await adminFetch(`/api/admin/team/${user.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ modules: selected }),
      });
      onSaved(user.id, selected);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          width: "min(520px, 95vw)",
          boxShadow: "0 24px 64px rgba(15,23,42,0.22)",
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a" }}>Module Access</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>
          Configure which modules <strong>{user.email}</strong> can access.
        </p>

        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            style={{ fontSize: 12, color: "#0f766e", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, marginRight: 12 }}
            onClick={() => setSelected(ALL_MODULES.map((m) => m.key))}
          >
            Select all
          </button>
          <button
            type="button"
            style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
            onClick={() => setSelected([])}
          >
            Clear all
          </button>
        </div>

        <ModuleSelector selected={selected} onChange={setSelected} />

        {error && <div style={{ ...pageStyles.error, marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" style={pageStyles.primaryBtn} onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTeamUserForm({ onCreated }: { onCreated: (user: TeamUser) => void }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [modules, setModules] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const user = await adminFetch<TeamUser>("/api/admin/team", {
        method: "POST",
        body: JSON.stringify({ email, password, modules }),
      });
      onCreated(user);
      setEmail("");
      setPassword("");
      setModules([]);
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" style={pageStyles.primaryBtn} onClick={() => setOpen(true)}>
        + Add Admin Team User
      </button>
    );
  }

  return (
    <AdminCard>
      <form onSubmit={handleCreate}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "#0f172a" }}>New Admin Team User</h3>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...pageStyles.input, margin: 0 }}
              placeholder="admin@example.com"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Temporary password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...pageStyles.input, margin: 0 }}
              placeholder="Min 6 characters"
            />
          </label>
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Module access</span>
        </div>
        <div style={{ marginBottom: 4 }}>
          <button
            type="button"
            style={{ fontSize: 12, color: "#0f766e", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, marginRight: 12 }}
            onClick={() => setModules(ALL_MODULES.map((m) => m.key))}
          >
            Select all
          </button>
          <button
            type="button"
            style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
            onClick={() => setModules([])}
          >
            Clear all
          </button>
        </div>
        <ModuleSelector selected={modules} onChange={setModules} />

        {error && <div style={{ ...pageStyles.error, marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" style={pageStyles.primaryBtn} disabled={saving}>
            {saving ? "Creating..." : "Create user"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}

export default function AdminTeamPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [users, setUsers] = React.useState<TeamUser[]>([]);
  const [editingUser, setEditingUser] = React.useState<TeamUser | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<{ items: TeamUser[] }>("/api/admin/team");
      setUsers(data.items);
    } catch (err: any) {
      setError(err.message || "Failed to load admin team");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  function handleCreated(user: TeamUser) {
    setUsers((prev) => [...prev, user]);
  }

  function handlePermissionsSaved(userId: string, modules: string[]) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, modules } : u)));
  }

  async function handleDelete(user: TeamUser) {
    if (!window.confirm(`Remove admin team access for ${user.email}? This will permanently delete their account.`)) return;
    setDeletingId(user.id);
    try {
      await adminFetch(`/api/admin/team/${user.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  }

  const superAdmins = users.filter((u) => u.admin_role === "super_admin");
  const teamUsers = users.filter((u) => u.admin_role === "admin_team");

  return (
    <AdminShell
      title="Admin Team"
      subtitle="Manage admin users. Super admins have full access; admin team users have access only to the modules you configure."
      actions={
        <button type="button" style={pageStyles.secondaryBtn} onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      }
    >
      {error && <div style={{ ...pageStyles.error, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gap: 18 }}>
        <CreateTeamUserForm onCreated={handleCreated} />

        {/* Super Admins */}
        <AdminCard>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a" }}>
            Super Admins <span style={{ fontWeight: 400, color: "#64748b" }}>({superAdmins.length})</span>
          </h3>
          <AdminTable>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Email", "Status", "Last login", "Created"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", color: "#475569", fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {superAdmins.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: "10px", color: "#0f172a", fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: "10px" }}>
                      <StatusPill label={u.is_active ? "Active" : "Inactive"} tone={u.is_active ? "success" : "danger"} />
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                    <td style={{ padding: "10px", color: "#64748b" }}>{formatDateTime(u.created_at)}</td>
                  </tr>
                ))}
                {superAdmins.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, color: "#94a3b8", textAlign: "center" }}>No super admins found</td></tr>
                )}
              </tbody>
            </table>
          </AdminTable>
        </AdminCard>

        {/* Admin Team Users */}
        <AdminCard>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a" }}>
            Admin Team Users <span style={{ fontWeight: 400, color: "#64748b" }}>({teamUsers.length})</span>
          </h3>
          <AdminTable>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Email", "Status", "Modules", "Last login", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", color: "#475569", fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: "10px", color: "#0f172a", fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: "10px" }}>
                      <StatusPill label={u.is_active ? "Active" : "Inactive"} tone={u.is_active ? "success" : "danger"} />
                    </td>
                    <td style={{ padding: "10px" }}>
                      {u.modules.length === 0 ? (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No access</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {u.modules.map((key) => {
                            const mod = ALL_MODULES.find((m) => m.key === key);
                            return (
                              <span
                                key={key}
                                style={{ background: "#e0f2fe", color: "#0369a1", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}
                              >
                                {mod?.label ?? key}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={{ ...pageStyles.secondaryBtn, fontSize: 12, padding: "6px 12px" }}
                          onClick={() => setEditingUser(u)}
                        >
                          Edit access
                        </button>
                        <button
                          type="button"
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "1px solid #fca5a5",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {teamUsers.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 16, color: "#94a3b8", textAlign: "center" }}>No admin team users yet. Use "Add Admin Team User" above to create one.</td></tr>
                )}
              </tbody>
            </table>
          </AdminTable>
        </AdminCard>
      </div>

      {editingUser && (
        <PermissionsDrawer
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handlePermissionsSaved}
        />
      )}
    </AdminShell>
  );
}
