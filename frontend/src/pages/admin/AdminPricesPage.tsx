import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";
import { formatINR } from "../../services/currency";
import { formatDateTime } from "../../services/dateTime";

type PriceRecord = {
  id: string;
  material_id: string;
  district_id: string;
  material_name: string;
  material_unit: string;
  district_name: string;
  price: number;
  source: string;
  scraped_at: string;
  flagged: boolean;
};

type PriceAlert = {
  id: string;
  user_email: string;
  material_name: string;
  district_name: string;
  condition: string;
  threshold: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
};

type PriceReference = {
  materials: Array<{ id: string; name: string; unit: string }>;
  districts: Array<{ id: string; name: string; region: string }>;
};

type ProductInquiry = {
  id: string;
  user_id: string;
  material_id: string;
  district_id: string;
  requester_name: string;
  requester_contact_number: string | null;
  user_email: string;
  material_name: string;
  material_unit: string;
  district_name: string;
  requested_quantity: number;
  specification: string;
  requested_location: string;
  status: "pending" | "resolved";
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

export default function AdminPricesPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"records" | "alerts" | "inquiries">("records");
  const [records, setRecords] = React.useState<PaginatedResponse<PriceRecord> | null>(null);
  const [alerts, setAlerts] = React.useState<PaginatedResponse<PriceAlert> | null>(null);
  const [inquiries, setInquiries] = React.useState<PaginatedResponse<ProductInquiry> | null>(null);
  const [selectedInquiry, setSelectedInquiry] = React.useState<ProductInquiry | null>(null);
  const [reference, setReference] = React.useState<PriceReference | null>(null);
  const [createForm, setCreateForm] = React.useState({
    materialId: "",
    districtId: "",
    price: "",
    source: "manual_admin",
    scrapedAt: new Date().toISOString().slice(0, 16),
    flagged: false,
  });

  async function load() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const [recordResponse, alertResponse, inquiryResponse, referenceResponse] = await Promise.all([
        adminFetch<PaginatedResponse<PriceRecord>>(`/api/admin/prices/records?page=1&pageSize=25`),
        adminFetch<PaginatedResponse<PriceAlert>>(`/api/admin/prices/alerts?page=1&pageSize=25`),
        adminFetch<PaginatedResponse<ProductInquiry>>(`/api/admin/prices/inquiries?page=1&pageSize=25`),
        adminFetch<PriceReference>(`/api/admin/prices/reference`),
      ]);
      setRecords(recordResponse);
      setAlerts(alertResponse);
      setInquiries(inquiryResponse);
      setReference(referenceResponse);
      setCreateForm((current) => ({
        ...current,
        materialId: current.materialId || referenceResponse.materials[0]?.id || "",
        districtId: current.districtId || referenceResponse.districts[0]?.id || "",
      }));
    } catch (err: any) {
      setError(err.message || "Failed to load price admin data");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function createRecord() {
    try {
      setSavingId("create");
      setError("");
      await adminFetch(`/api/admin/prices/records`, {
        method: "POST",
        body: JSON.stringify({
          materialId: createForm.materialId,
          districtId: createForm.districtId,
          price: Number(createForm.price),
          source: createForm.source,
          scrapedAt: new Date(createForm.scrapedAt).toISOString(),
          flagged: createForm.flagged,
        }),
      });
      setSuccess("Price record created");
      setCreateForm((current) => ({ ...current, price: "", source: "manual_admin", flagged: false }));
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to create price record");
    } finally {
      setSavingId("");
    }
  }

  async function editRecord(record: PriceRecord) {
    const nextPrice = window.prompt("Price", String(record.price));
    if (nextPrice === null) return;
    const nextSource = window.prompt("Source", record.source);
    if (nextSource === null) return;
    const nextFlagged = window.confirm("Flag this price record?");

    try {
      setSavingId(record.id);
      setError("");
      await adminFetch(`/api/admin/prices/records/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          price: Number(nextPrice),
          source: nextSource,
          flagged: nextFlagged,
        }),
      });
      setSuccess(`Updated ${record.material_name} in ${record.district_name}`);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update price record");
    } finally {
      setSavingId("");
    }
  }

  async function deleteRecord(record: PriceRecord) {
    const confirmed = window.confirm(`Delete ${record.material_name} price for ${record.district_name}?`);
    if (!confirmed) return;

    try {
      setSavingId(record.id);
      setError("");
      await adminFetch(`/api/admin/prices/records/${record.id}`, { method: "DELETE" });
      setSuccess(`Deleted ${record.material_name} in ${record.district_name}`);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to delete price record");
    } finally {
      setSavingId("");
    }
  }

  async function updateInquiryStatus(inquiry: ProductInquiry, nextStatus: "pending" | "resolved") {
    try {
      setSavingId(inquiry.id);
      setError("");
      await adminFetch(`/api/admin/prices/inquiries/${inquiry.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          adminNotes:
            nextStatus === "resolved"
              ? `Resolved by admin on ${new Date().toLocaleString()}`
              : "Re-opened by admin",
        }),
      });
      setSuccess(`Inquiry for ${inquiry.material_name} marked as ${nextStatus}`);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update inquiry status");
    } finally {
      setSavingId("");
    }
  }

  function closeInquiryOverlay() {
    setSelectedInquiry(null);
  }

  React.useEffect(() => {
    if (!selectedInquiry) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeInquiryOverlay();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedInquiry]);

  return (
    <AdminShell
      title="Price Tracker Administration"
      subtitle="Review market records and live alert subscriptions across districts and materials."
      actions={<button type="button" style={pageStyles.secondaryBtn} onClick={load} disabled={loading}>Refresh</button>}
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}
      <AdminCard>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button type="button" style={activeTab === "records" ? pageStyles.primaryBtn : pageStyles.secondaryBtn} onClick={() => setActiveTab("records")}>Price Records</button>
          <button type="button" style={activeTab === "alerts" ? pageStyles.primaryBtn : pageStyles.secondaryBtn} onClick={() => setActiveTab("alerts")}>Price Alerts</button>
          <button type="button" style={activeTab === "inquiries" ? pageStyles.primaryBtn : pageStyles.secondaryBtn} onClick={() => setActiveTab("inquiries")}>Product Inquiries</button>
        </div>

        {activeTab === "records" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr auto", gap: 10, marginBottom: 14 }}>
              <select style={pageStyles.select} value={createForm.materialId} onChange={(event) => setCreateForm((current) => ({ ...current, materialId: event.target.value }))}>
                {(reference?.materials || []).map((material) => (
                  <option key={material.id} value={material.id}>{material.name} / {material.unit}</option>
                ))}
              </select>
              <select style={pageStyles.select} value={createForm.districtId} onChange={(event) => setCreateForm((current) => ({ ...current, districtId: event.target.value }))}>
                {(reference?.districts || []).map((district) => (
                  <option key={district.id} value={district.id}>{district.name} ({district.region})</option>
                ))}
              </select>
              <input style={pageStyles.input} type="number" min="0" step="0.01" placeholder="Price" value={createForm.price} onChange={(event) => setCreateForm((current) => ({ ...current, price: event.target.value }))} />
              <input style={pageStyles.input} placeholder="Source" value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value }))} />
              <input style={pageStyles.input} type="datetime-local" value={createForm.scrapedAt} onChange={(event) => setCreateForm((current) => ({ ...current, scrapedAt: event.target.value }))} />
              <button type="button" style={pageStyles.primaryBtn} onClick={createRecord} disabled={savingId === "create" || !createForm.materialId || !createForm.districtId || !createForm.price}>
                {savingId === "create" ? "Saving…" : "Add"}
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Recent Price Records</strong>
              <span style={pageStyles.subtext}>{records?.pagination.total || 0} total</span>
            </div>
            <AdminTable>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Material</th>
                    <th style={pageStyles.th}>District</th>
                    <th style={pageStyles.th}>Price</th>
                    <th style={pageStyles.th}>Source</th>
                    <th style={pageStyles.th}>Flag</th>
                    <th style={pageStyles.th}>Scraped</th>
                    <th style={pageStyles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(records?.items || []).map((record, index) => (
                    <tr key={record.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                      <td style={pageStyles.td}>{record.material_name} <span style={pageStyles.subtext}>/{record.material_unit}</span></td>
                      <td style={pageStyles.td}>{record.district_name}</td>
                      <td style={pageStyles.td}>{formatINR(record.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={pageStyles.td}>{record.source}</td>
                      <td style={pageStyles.td}><StatusPill label={record.flagged ? "flagged" : "clean"} tone={record.flagged ? "warning" : "success"} /></td>
                      <td style={pageStyles.td}>{formatDate(record.scraped_at)}</td>
                      <td style={pageStyles.td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={pageStyles.secondaryBtn} onClick={() => editRecord(record)} disabled={savingId === record.id}>Edit</button>
                          <button type="button" style={{ ...pageStyles.secondaryBtn, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => deleteRecord(record)} disabled={savingId === record.id}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>
          </>
        )}

        {activeTab === "alerts" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Active and Historical Alerts</strong>
              <span style={pageStyles.subtext}>{alerts?.pagination.total || 0} total</span>
            </div>
            <AdminTable>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>User</th>
                    <th style={pageStyles.th}>Material</th>
                    <th style={pageStyles.th}>District</th>
                    <th style={pageStyles.th}>Condition</th>
                    <th style={pageStyles.th}>Threshold</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Last Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {(alerts?.items || []).map((alert, index) => (
                    <tr key={alert.id} style={index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                      <td style={pageStyles.td}>{alert.user_email}</td>
                      <td style={pageStyles.td}>{alert.material_name}</td>
                      <td style={pageStyles.td}>{alert.district_name}</td>
                      <td style={pageStyles.td}>{alert.condition}</td>
                      <td style={pageStyles.td}>{formatINR(alert.threshold, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={pageStyles.td}><StatusPill label={alert.is_active ? "active" : "inactive"} tone={alert.is_active ? "success" : "neutral"} /></td>
                      <td style={pageStyles.td}>{formatDate(alert.last_triggered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>
          </>
        )}

        {activeTab === "inquiries" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>Dealer Price Inquiries</strong>
              <span style={pageStyles.subtext}>{inquiries?.pagination.total || 0} total</span>
            </div>
            <AdminTable>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Requester</th>
                    <th style={pageStyles.th}>Product</th>
                    <th style={pageStyles.th}>District</th>
                    <th style={pageStyles.th}>Quantity</th>
                    <th style={pageStyles.th}>Specification</th>
                    <th style={pageStyles.th}>Location</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Created</th>
                    <th style={pageStyles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(inquiries?.items || []).map((inquiry, index) => (
                    <tr
                      key={inquiry.id}
                      style={{ ...(index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd), cursor: "pointer" }}
                      onClick={() => setSelectedInquiry(inquiry)}
                    >
                      <td style={pageStyles.td}>
                        <div style={{ fontWeight: 700 }}>{inquiry.requester_name}</div>
                        <div style={pageStyles.subtext}>{inquiry.requester_contact_number || "No contact number"}</div>
                        <div style={pageStyles.subtext}>{inquiry.user_email}</div>
                      </td>
                      <td style={pageStyles.td}>{inquiry.material_name} <span style={pageStyles.subtext}>/{inquiry.material_unit}</span></td>
                      <td style={pageStyles.td}>{inquiry.district_name}</td>
                      <td style={pageStyles.td}>{inquiry.requested_quantity}</td>
                      <td style={pageStyles.td}>{inquiry.specification}</td>
                      <td style={pageStyles.td}>{inquiry.requested_location}</td>
                      <td style={pageStyles.td}>
                        <StatusPill
                          label={inquiry.status}
                          tone={inquiry.status === "resolved" ? "success" : "warning"}
                        />
                      </td>
                      <td style={pageStyles.td}>{formatDate(inquiry.created_at)}</td>
                      <td style={pageStyles.td}>
                        {inquiry.status === "pending" ? (
                          <button
                            type="button"
                            style={pageStyles.primaryBtn}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateInquiryStatus(inquiry, "resolved");
                            }}
                            disabled={savingId === inquiry.id}
                          >
                            {savingId === inquiry.id ? "Updating..." : "Mark Resolved"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={pageStyles.secondaryBtn}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateInquiryStatus(inquiry, "pending");
                            }}
                            disabled={savingId === inquiry.id}
                          >
                            {savingId === inquiry.id ? "Updating..." : "Re-open"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>
          </>
        )}
      </AdminCard>

      {selectedInquiry ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={closeInquiryOverlay}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 14,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
              padding: 18,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Inquiry Details</h3>
              <button type="button" style={pageStyles.secondaryBtn} onClick={closeInquiryOverlay}>Close</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1", padding: "10px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Inquiry ID</div>
                <div style={{ fontFamily: "monospace", fontSize: 13 }}>{selectedInquiry.id}</div>
              </div>

              <div>
                <strong>Requester</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.requester_name}</div>
                <div style={pageStyles.subtext}>{selectedInquiry.requester_contact_number || "No contact number"}</div>
                <div style={pageStyles.subtext}>{selectedInquiry.user_email}</div>
              </div>
              <div>
                <strong>Status</strong>
                <div style={{ marginTop: 6 }}>
                  <StatusPill
                    label={selectedInquiry.status}
                    tone={selectedInquiry.status === "resolved" ? "success" : "warning"}
                  />
                </div>
              </div>

              <div>
                <strong>User ID</strong>
                <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>{selectedInquiry.user_id}</div>
              </div>

              <div>
                <strong>Product</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.material_name} / {selectedInquiry.material_unit}</div>
                <div style={pageStyles.subtext}>Material ID: {selectedInquiry.material_id}</div>
              </div>
              <div>
                <strong>District</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.district_name}</div>
                <div style={pageStyles.subtext}>District ID: {selectedInquiry.district_id}</div>
              </div>
              <div>
                <strong>Requested Quantity</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.requested_quantity}</div>
              </div>
              <div>
                <strong>Requested Location</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.requested_location}</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Specification</strong>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                {selectedInquiry.specification}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <strong>Created At</strong>
                <div style={{ marginTop: 4 }}>{formatDate(selectedInquiry.created_at)}</div>
              </div>
              <div>
                <strong>Last Updated</strong>
                <div style={{ marginTop: 4 }}>{formatDate(selectedInquiry.updated_at)}</div>
              </div>
              <div>
                <strong>Resolved At</strong>
                <div style={{ marginTop: 4 }}>{formatDate(selectedInquiry.resolved_at)}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Admin Notes</strong>
                <div style={{ marginTop: 4 }}>{selectedInquiry.admin_notes || "—"}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              {selectedInquiry.status === "pending" ? (
                <button
                  type="button"
                  style={pageStyles.primaryBtn}
                  onClick={async () => {
                    await updateInquiryStatus(selectedInquiry, "resolved");
                    setSelectedInquiry((prev) => prev ? { ...prev, status: "resolved", resolved_at: new Date().toISOString() } : prev);
                  }}
                  disabled={savingId === selectedInquiry.id}
                >
                  {savingId === selectedInquiry.id ? "Updating..." : "Mark Resolved"}
                </button>
              ) : (
                <button
                  type="button"
                  style={pageStyles.secondaryBtn}
                  onClick={async () => {
                    await updateInquiryStatus(selectedInquiry, "pending");
                    setSelectedInquiry((prev) => prev ? { ...prev, status: "pending", resolved_at: null } : prev);
                  }}
                  disabled={savingId === selectedInquiry.id}
                >
                  {savingId === selectedInquiry.id ? "Updating..." : "Re-open"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
