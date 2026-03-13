import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";

type DealerRow = {
  id: string;
  shop_name: string;
  email: string;
  city: string | null;
  state: string | null;
  is_approved: boolean;
  approval_date: string | null;
  price_count: number;
  created_at: string;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminDealersPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedResponse<DealerRow> | null>(null);

  async function load(nextPage = page) {
    try {
      setLoading(true);
      setError("");
      const response = await adminFetch<PaginatedResponse<DealerRow>>(`/api/admin/dealers?page=${nextPage}&pageSize=20`);
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load dealers");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1);
  }, []);

  async function toggleApproval(dealer: DealerRow, isApproved: boolean) {
    try {
      setSavingId(dealer.id);
      setError("");
      await adminFetch(`/api/admin/dealers/${dealer.id}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ isApproved }),
      });
      await load(page);
    } catch (err: any) {
      setError(err.message || "Failed to update dealer approval");
    } finally {
      setSavingId("");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

  return (
    <AdminShell
      title="Dealer Management"
      subtitle="Approve or review dealers before they surface to pricing consumers."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page)}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Dealers</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>
        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Shop</th>
                <th style={pageStyles.th}>Location</th>
                <th style={pageStyles.th}>Prices</th>
                <th style={pageStyles.th}>Approval</th>
                <th style={pageStyles.th}>Created</th>
                <th style={pageStyles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((dealer, index) => (
                <tr key={dealer.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>
                    <div style={{ fontWeight: 700 }}>{dealer.shop_name}</div>
                    <div style={pageStyles.subtext}>{dealer.email}</div>
                  </td>
                  <td style={pageStyles.td}>{dealer.city || "—"}, {dealer.state || "—"}</td>
                  <td style={pageStyles.td}>{dealer.price_count}</td>
                  <td style={pageStyles.td}>
                    <div><StatusPill label={dealer.is_approved ? "approved" : "pending"} tone={dealer.is_approved ? "success" : "warning"} /></div>
                    <div style={{ ...pageStyles.subtext, marginTop: 4 }}>{formatDate(dealer.approval_date)}</div>
                  </td>
                  <td style={pageStyles.td}>{formatDate(dealer.created_at)}</td>
                  <td style={pageStyles.td}>
                    <button
                      type="button"
                      style={dealer.is_approved ? pageStyles.secondaryBtn : pageStyles.primaryBtn}
                      onClick={() => toggleApproval(dealer, !dealer.is_approved)}
                      disabled={savingId === dealer.id}
                    >
                      {savingId === dealer.id ? "Saving…" : dealer.is_approved ? "Reject" : "Approve"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No dealers found.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}>Next</button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
