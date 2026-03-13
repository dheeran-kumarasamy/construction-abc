import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  architect_email: string | null;
  client_email: string | null;
  boq_count: number;
  estimate_count: number;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminProjectsPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<ProjectRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<PaginatedResponse<ProjectRow>>(`/api/admin/projects?page=${nextPage}&pageSize=20`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function editProject(project: ProjectRow) {
    const nextName = window.prompt("Project name", project.name);
    if (nextName === null) return;

    const nextDescription = window.prompt("Project description", project.description || "");
    if (nextDescription === null) return;

    try {
      setSavingId(project.id);
      setError("");
      await adminFetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName, description: nextDescription }),
      });
      setSuccess(`Updated ${nextName}`);
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to update project");
    } finally {
      setSavingId("");
    }
  }

  async function deleteProject(project: ProjectRow) {
    const confirmed = window.confirm(
      `Delete project ${project.name}? This will remove ${project.boq_count} BOQ uploads and ${project.estimate_count} estimates.`
    );
    if (!confirmed) return;

    try {
      setSavingId(project.id);
      setError("");
      await adminFetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      setSuccess(`Deleted ${project.name}`);
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="Project Management"
      subtitle="Cross-project visibility into ownership, BOQ presence, and estimate activity."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Projects</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Name</th>
                <th style={pageStyles.th}>Architect</th>
                <th style={pageStyles.th}>Client</th>
                <th style={pageStyles.th}>BOQ</th>
                <th style={pageStyles.th}>Estimates</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((project, index) => (
                <tr key={project.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>
                    <div style={{ fontWeight: 700 }}>{project.name}</div>
                    <div style={pageStyles.subtext}>{project.description || "No description"}</div>
                  </td>
                  <td style={pageStyles.td}>{project.architect_email || "—"}</td>
                  <td style={pageStyles.td}>{project.client_email || "—"}</td>
                  <td style={pageStyles.td}>
                    <StatusPill label={project.boq_count > 0 ? `${project.boq_count} uploaded` : "none"} tone={project.boq_count > 0 ? "success" : "warning"} />
                  </td>
                  <td style={pageStyles.td}>{project.estimate_count}</td>
                  <td style={pageStyles.td}>{formatDate(project.created_at)}</td>
                  <td style={pageStyles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" style={pageStyles.secondaryBtn} onClick={() => editProject(project)} disabled={savingId === project.id}>Edit</button>
                      <button type="button" style={{ ...pageStyles.secondaryBtn, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => deleteProject(project)} disabled={savingId === project.id}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No projects found.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>Next</button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
