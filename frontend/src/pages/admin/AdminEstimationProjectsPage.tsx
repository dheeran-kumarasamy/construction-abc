import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

const ESTIMATION_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "submitted",
  "estimated",
] as const;
type EstimationStatus = (typeof ESTIMATION_STATUSES)[number];

type EstimationProjectRow = {
  id: string;
  name: string;
  status: EstimationStatus;
  terrain: string | null;
  project_type: string | null;
  user_email: string | null;
  item_count: number;
  total_amount: number;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const statusTone = (
  s: string
): "success" | "warning" | "neutral" | "danger" => {
  if (s === "completed" || s === "estimated") return "success";
  if (s === "submitted") return "warning";
  return "neutral";
};

export default function AdminEstimationProjectsPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] =
    React.useState<PaginatedResponse<EstimationProjectRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<
        PaginatedResponse<EstimationProjectRow>
      >(`/api/admin/estimation-projects?page=${nextPage}&pageSize=20`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load estimation projects");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function editEstimationProject(project: EstimationProjectRow) {
    const nextName = window.prompt("Project name", project.name);
    if (nextName === null) return;

    const nextStatus = window.prompt(
      `Status (${ESTIMATION_STATUSES.join(", ")})`,
      project.status
    );
    if (nextStatus === null) return;

    if (!ESTIMATION_STATUSES.includes(nextStatus as EstimationStatus)) {
      setError(
        `Invalid status: "${nextStatus}". Allowed: ${ESTIMATION_STATUSES.join(", ")}`
      );
      return;
    }

    try {
      setSavingId(project.id);
      setError("");
      await adminFetch(`/api/admin/estimation-projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName.trim(), status: nextStatus }),
      });
      setSuccess(`Updated "${nextName.trim()}"`);
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to update estimation project");
    } finally {
      setSavingId("");
    }
  }

  async function deleteEstimationProject(project: EstimationProjectRow) {
    const confirmed = window.confirm(
      `Delete estimation project "${project.name}"?\n\nThis will permanently remove ${project.item_count} BOQ item(s) and all rate computations.`
    );
    if (!confirmed) return;

    try {
      setSavingId(project.id);
      setError("");
      await adminFetch(`/api/admin/estimation-projects/${project.id}`, {
        method: "DELETE",
      });
      setSuccess(`Deleted "${project.name}"`);
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete estimation project");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize))
    : 1;

  return (
    <AdminShell
      title="Estimation Projects"
      subtitle="Builder SOR-based estimation workspaces — manage status and clean stale drafts."
      actions={
        <button
          type="button"
          style={pageStyles.secondaryBtn}
          onClick={() => load(page)}
        >
          Refresh
        </button>
      }
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && (
        <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>
      )}

      <AdminCard>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <strong>Estimation Projects</strong>
          <span style={pageStyles.subtext}>
            {data?.pagination.total || 0} total
          </span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Name</th>
                <th style={pageStyles.th}>User</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Terrain</th>
                <th style={pageStyles.th}>Items</th>
                <th style={pageStyles.th}>Total Amount</th>
                <th style={pageStyles.th}>Type</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((project, index) => (
                <tr
                  key={project.id}
                  style={
                    index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd
                  }
                >
                  <td style={pageStyles.td}>
                    <div style={{ fontWeight: 700 }}>{project.name}</div>
                  </td>
                  <td style={pageStyles.td}>{project.user_email || "—"}</td>
                  <td style={pageStyles.td}>
                    <StatusPill
                      label={project.status}
                      tone={statusTone(project.status)}
                    />
                  </td>
                  <td style={pageStyles.td}>{project.terrain || "—"}</td>
                  <td style={pageStyles.td}>{project.item_count}</td>
                  <td style={pageStyles.td}>
                    {formatCurrency(project.total_amount || 0)}
                  </td>
                  <td style={pageStyles.td}>{project.project_type || "—"}</td>
                  <td style={pageStyles.td}>
                    {formatDate(project.created_at)}
                  </td>
                  <td style={pageStyles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={pageStyles.secondaryBtn}
                        onClick={() => editEstimationProject(project)}
                        disabled={savingId === project.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={{
                          ...pageStyles.secondaryBtn,
                          color: "#b91c1c",
                          borderColor: "#fecaca",
                        }}
                        onClick={() => deleteEstimationProject(project)}
                        disabled={savingId === project.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !data?.items.length && (
          <div style={pageStyles.empty}>No estimation projects found.</div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => load(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <span style={pageStyles.subtext}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => load(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
