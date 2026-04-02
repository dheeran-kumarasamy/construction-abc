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

function formatDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

export default function AdminPricesPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"records" | "alerts">("records");
  const [records, setRecords] = React.useState<PaginatedResponse<PriceRecord> | null>(null);
  const [alerts, setAlerts] = React.useState<PaginatedResponse<PriceAlert> | null>(null);
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
      const [recordResponse, alertResponse, referenceResponse] = await Promise.all([
        adminFetch<PaginatedResponse<PriceRecord>>(`/api/admin/prices/records?page=1&pageSize=25`),
        adminFetch<PaginatedResponse<PriceAlert>>(`/api/admin/prices/alerts?page=1&pageSize=25`),
        adminFetch<PriceReference>(`/api/admin/prices/reference`),
      ]);
      setRecords(recordResponse);
      setAlerts(alertResponse);
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
      </AdminCard>
    </AdminShell>
  );
}
