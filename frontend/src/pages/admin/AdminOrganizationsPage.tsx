import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type OrganizationRow = {
  id: string;
  name: string;
  type: string | null;
  member_count: number;
  project_count: number;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminOrganizationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<OrganizationRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<PaginatedResponse<OrganizationRow>>(`/api/admin/organizations?page=${nextPage}&pageSize=20`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function editOrganization(org: OrganizationRow) {
    const nextName = window.prompt("Organization name", org.name);
    if (nextName === null) return;

    const nextType = window.prompt("Organization type: architect, builder, or client", org.type || "architect");
    if (nextType === null) return;

    try {
      setSavingId(org.id);
      setError("");
      await adminFetch(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName, type: nextType }),
      });
      setSuccess(`Updated ${nextName}`);
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to update organization");
    } finally {
      setSavingId("");
    }
  }

  async function deleteOrganization(org: OrganizationRow) {
    const confirmed = window.confirm(
      `Delete organization ${org.name}? This will unlink ${org.member_count} users and affect ${org.project_count} projects.`
    );
    if (!confirmed) return;

    try {
      setSavingId(org.id);
      setError("");
      await adminFetch(`/api/admin/organizations/${org.id}`, { method: "DELETE" });
      setSuccess(`Deleted ${org.name}`);
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete organization");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="Organization Management"
      subtitle="Audit organization footprint across membership and project ownership."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Organizations</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Name</th>
                <th style={pageStyles.th}>Type</th>
                <th style={pageStyles.th}>Members</th>
                <th style={pageStyles.th}>Projects</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((org, index) => (
                <tr key={org.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{org.name}</td>
                  <td style={pageStyles.td}>{org.type || "—"}</td>
                  <td style={pageStyles.td}>{org.member_count}</td>
                  <td style={pageStyles.td}>{org.project_count}</td>
                  <td style={pageStyles.td}>{formatDate(org.created_at)}</td>
                  <td style={pageStyles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" style={pageStyles.secondaryBtn} onClick={() => editOrganization(org)} disabled={savingId === org.id}>Edit</button>
                      <button type="button" style={{ ...pageStyles.secondaryBtn, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => deleteOrganization(org)} disabled={savingId === org.id}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No organizations found.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>Next</button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
