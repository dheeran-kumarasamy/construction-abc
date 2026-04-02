import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";
import { formatDateTime } from "../../services/dateTime";

const ESTIMATE_STATUSES = [
  "draft",
  "submitted",
  "awarded",
  "rejected",
] as const;
type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

type EstimateRow = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  builder_org_id: string | null;
  builder_org_name: string | null;
  status: EstimateStatus;
  revision_count: number;
  grand_total: number | null;
  submitted_at: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return formatDateTime(value);
}

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const statusTone = (
  s: string
): "success" | "warning" | "neutral" | "danger" => {
  if (s === "awarded") return "success";
  if (s === "submitted") return "warning";
  if (s === "rejected") return "danger";
  return "neutral";
};

export default function AdminEstimatesPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] =
    React.useState<PaginatedResponse<EstimateRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<PaginatedResponse<EstimateRow>>(
        `/api/admin/estimates?page=${nextPage}&pageSize=20`
      );
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load estimates");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function editEstimate(estimate: EstimateRow) {
    const nextStatus = window.prompt(
      `Status (${ESTIMATE_STATUSES.join(", ")})`,
      estimate.status
    );
    if (nextStatus === null) return;

    if (!ESTIMATE_STATUSES.includes(nextStatus as EstimateStatus)) {
      setError(
        `Invalid status: "${nextStatus}". Allowed: ${ESTIMATE_STATUSES.join(", ")}`
      );
      return;
    }

    try {
      setSavingId(estimate.id);
      setError("");
      await adminFetch(`/api/admin/estimates/${estimate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`Updated estimate status to "${nextStatus}"`);
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to update estimate");
    } finally {
      setSavingId("");
    }
  }

  async function deleteEstimate(estimate: EstimateRow) {
    const confirmed = window.confirm(
      `Delete estimate for project "${estimate.project_name || estimate.project_id}"?\n\nThis will remove ${estimate.revision_count} revision(s) and any associated awards.`
    );
    if (!confirmed) return;

    try {
      setSavingId(estimate.id);
      setError("");
      await adminFetch(`/api/admin/estimates/${estimate.id}`, {
        method: "DELETE",
      });
      setSuccess("Deleted estimate");
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete estimate");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize))
    : 1;

  return (
    <AdminShell
      title="Estimate Management"
      subtitle="Builder cost estimates by project — update status or remove stale records."
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
          <strong>Estimates</strong>
          <span style={pageStyles.subtext}>
            {data?.pagination.total || 0} total
          </span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Project</th>
                <th style={pageStyles.th}>Builder Org</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Revisions</th>
                <th style={pageStyles.th}>Grand Total</th>
                <th style={pageStyles.th}>Submitted</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((estimate, index) => (
                <tr
                  key={estimate.id}
                  style={
                    index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd
                  }
                >
                  <td style={pageStyles.td}>
                    {estimate.project_name || "—"}
                  </td>
                  <td style={pageStyles.td}>
                    {estimate.builder_org_name || "—"}
                  </td>
                  <td style={pageStyles.td}>
                    <StatusPill
                      label={estimate.status}
                      tone={statusTone(estimate.status)}
                    />
                  </td>
                  <td style={pageStyles.td}>{estimate.revision_count}</td>
                  <td style={pageStyles.td}>
                    {formatCurrency(estimate.grand_total)}
                  </td>
                  <td style={pageStyles.td}>
                    {formatDate(estimate.submitted_at)}
                  </td>
                  <td style={pageStyles.td}>
                    {formatDate(estimate.created_at)}
                  </td>
                  <td style={pageStyles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={pageStyles.secondaryBtn}
                        onClick={() => editEstimate(estimate)}
                        disabled={savingId === estimate.id}
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
                        onClick={() => deleteEstimate(estimate)}
                        disabled={savingId === estimate.id}
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
          <div style={pageStyles.empty}>No estimates found.</div>
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
