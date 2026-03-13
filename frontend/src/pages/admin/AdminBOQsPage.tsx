import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type BOQRow = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  uploaded_by: string;
  uploaded_by_email: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  parsed_status: "parsed" | "pending";
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminBOQsPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<BOQRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await adminFetch<PaginatedResponse<BOQRow>>(
        `/api/admin/boqs?page=${nextPage}&pageSize=20`
      );
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load BOQs");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function deleteBOQ(boq: BOQRow) {
    const confirmed = window.confirm(
      `Delete BOQ "${boq.file_name}" (project: ${boq.project_name || "unknown"})?\n\nThis will permanently remove the file record and the uploaded file from disk.`
    );
    if (!confirmed) return;

    try {
      setSavingId(boq.id);
      setError("");
      await adminFetch(`/api/admin/boqs/${boq.id}`, { method: "DELETE" });
      setSuccess(`Deleted BOQ: ${boq.file_name}`);
      await load(1);
    } catch (err: any) {
      setError(err.message || "Failed to delete BOQ");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize))
    : 1;

  return (
    <AdminShell
      title="BOQ Management"
      subtitle="All uploaded Bills of Quantity — inspect parsed status and remove stale files."
      actions={
        <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>
          Refresh
        </button>
      }
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}

      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>BOQ Uploads</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>File</th>
                <th style={pageStyles.th}>Project</th>
                <th style={pageStyles.th}>Uploader</th>
                <th style={pageStyles.th}>Size</th>
                <th style={pageStyles.th}>Parsed</th>
                <th style={pageStyles.th}>Uploaded</th>
                <th style={pageStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((boq, index) => (
                <tr
                  key={boq.id}
                  style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                >
                  <td style={pageStyles.td}>
                    <div style={{ fontWeight: 700 }}>{boq.file_name}</div>
                    <div style={pageStyles.subtext}>{boq.file_type || "—"}</div>
                  </td>
                  <td style={pageStyles.td}>{boq.project_name || "—"}</td>
                  <td style={pageStyles.td}>{boq.uploaded_by_email || "—"}</td>
                  <td style={pageStyles.td}>{formatSize(boq.file_size)}</td>
                  <td style={pageStyles.td}>
                    <StatusPill
                      label={boq.parsed_status === "parsed" ? "Parsed" : "Pending"}
                      tone={boq.parsed_status === "parsed" ? "success" : "warning"}
                    />
                  </td>
                  <td style={pageStyles.td}>{formatDate(boq.created_at)}</td>
                  <td style={pageStyles.td}>
                    <button
                      type="button"
                      style={{
                        ...pageStyles.secondaryBtn,
                        color: "#b91c1c",
                        borderColor: "#fecaca",
                      }}
                      onClick={() => deleteBOQ(boq)}
                      disabled={savingId === boq.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !data?.items.length && (
          <div style={pageStyles.empty}>No BOQ uploads found.</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
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
