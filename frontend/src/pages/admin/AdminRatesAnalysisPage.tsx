import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable, StatusPill } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";
import { formatINR } from "../../services/currency";
import { formatDateTime } from "../../services/dateTime";

type RateTemplate = {
  id: string;
  code: string;
  name: string;
  category: string;
  sub_category?: string;
  unit: string;
  owner_organization_id: string | null;
  organization_name?: string | null;
  created_by_email?: string | null;
  approval_status: string;
  submitted_for_global: boolean;
  is_system: boolean;
  overhead_percent: number;
  profit_percent: number;
  gst_percent: number;
  line_item_count: number;
  created_at: string;
  updated_at: string;
};

type ApprovalRequest = {
  id: string;
  code: string;
  owner_organization_id: string | null;
  approval_status: string;
  submitted_for_global: boolean;
  created_at: string;
  lineItemCount?: number;
};

type PriceRecord = {
  id: string;
  material_id: string;
  district_id: string;
  material_name: string;
  material_unit: string;
  district_name: string;
  price: number | string;
  source: string;
  scraped_at: string;
  flagged: boolean;
};

type PriceAnalysis = {
  totalRecords: number;
  averagePrice: number;
  materialCount: number;
  districtCount: number;
  sourceCount: Record<string, number>;
  flaggedCount: number;
};

type TemplateEditForm = {
  code: string;
  name: string;
  category: string;
  sub_category: string;
  unit: string;
  overhead_percent: string;
  profit_percent: string;
  gst_percent: string;
};

function formatDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

function getStatusColor(status: string): "success" | "warning" | "danger" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "warning";
}

export default function AdminRatesAnalysisPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingTemplateId, setSavingTemplateId] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [editingTemplate, setEditingTemplate] = React.useState<RateTemplate | null>(null);
  const [editForm, setEditForm] = React.useState<TemplateEditForm>({
    code: "",
    name: "",
    category: "",
    sub_category: "",
    unit: "",
    overhead_percent: "0",
    profit_percent: "0",
    gst_percent: "0",
  });
  const [activeTab, setActiveTab] = React.useState<"overview" | "templates" | "approvals" | "prices">("overview");
  const [templates, setTemplates] = React.useState<PaginatedResponse<RateTemplate> | null>(null);
  const [approvalRequests, setApprovalRequests] = React.useState<ApprovalRequest[]>([]);
  const [priceRecords, setPriceRecords] = React.useState<PaginatedResponse<PriceRecord> | null>(null);
  const [analysis, setAnalysis] = React.useState<PriceAnalysis | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      const [templatesResponse, approvalsResponse, pricesResponse] = await Promise.all([
        adminFetch<PaginatedResponse<RateTemplate>>(`/api/admin/rate-templates?page=1&pageSize=50`)
          .catch(() => null),
        adminFetch<ApprovalRequest[]>(`/api/admin/template-approval-requests`)
          .catch(() => []),
        adminFetch<PaginatedResponse<PriceRecord>>(`/api/admin/prices/records?page=1&pageSize=20`)
          .catch(() => null),
      ]);

      if (templatesResponse) {
        setTemplates(templatesResponse);
      }
      
      if (Array.isArray(approvalsResponse)) {
        setApprovalRequests(approvalsResponse.filter((r: any) => r.approval_status === "pending"));
      }
      
      if (pricesResponse) {
        setPriceRecords(pricesResponse);
        
        // Calculate analysis metrics
        const allPrices = pricesResponse.items.map((p: any) => Number(p.price));
        const avgPrice = allPrices.length > 0 
          ? allPrices.reduce((a: number, b: number) => a + b, 0) / allPrices.length 
          : 0;
        
        const sourceMap: Record<string, number> = {};
        pricesResponse.items.forEach((p: any) => {
          sourceMap[p.source || "unknown"] = (sourceMap[p.source || "unknown"] || 0) + 1;
        });
        
        setAnalysis({
          totalRecords: pricesResponse.pagination.total || 0,
          averagePrice: avgPrice,
          materialCount: new Set(pricesResponse.items.map((p: any) => p.material_id)).size,
          districtCount: new Set(pricesResponse.items.map((p: any) => p.district_id)).size,
          sourceCount: sourceMap,
          flaggedCount: pricesResponse.items.filter((p: any) => p.flagged).length,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load rates and analysis data");
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(template: RateTemplate) {
    setError("");
    setSuccess("");
    setEditingTemplate(template);
    setEditForm({
      code: String(template.code || ""),
      name: String(template.name || ""),
      category: String(template.category || ""),
      sub_category: String(template.sub_category || ""),
      unit: String(template.unit || ""),
      overhead_percent: String(template.overhead_percent ?? "0"),
      profit_percent: String(template.profit_percent ?? "0"),
      gst_percent: String(template.gst_percent ?? "0"),
    });
  }

  function closeEditModal() {
    if (savingTemplateId) return;
    setEditingTemplate(null);
  }

  async function saveTemplateChanges() {
    if (!editingTemplate) return;

    const overheadPercent = Number(editForm.overhead_percent);
    const profitPercent = Number(editForm.profit_percent);
    const gstPercent = Number(editForm.gst_percent);

    if (!Number.isFinite(overheadPercent) || !Number.isFinite(profitPercent) || !Number.isFinite(gstPercent)) {
      setError("Overhead, Profit and GST must be valid numbers.");
      return;
    }

    if (!editForm.code.trim() || !editForm.name.trim() || !editForm.category.trim() || !editForm.unit.trim()) {
      setError("Code, Name, Category and Unit are required.");
      return;
    }

    try {
      setSavingTemplateId(editingTemplate.id);
      setError("");
      setSuccess("");

      await adminFetch(`/api/admin/rate-templates/${editingTemplate.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: editForm.code.trim(),
          name: editForm.name.trim(),
          category: editForm.category.trim(),
          sub_category: editForm.sub_category.trim() || null,
          unit: editForm.unit.trim(),
          overhead_percent: overheadPercent,
          profit_percent: profitPercent,
          gst_percent: gstPercent,
        }),
      });

      setSuccess(`Updated template ${editingTemplate.code}`);
      setEditingTemplate(null);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update template");
    } finally {
      setSavingTemplateId("");
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell
      title="Rates & Analysis"
      subtitle="Rate templates, approval workflows, and market pricing analysis across all materials and districts."
      actions={
        <button type="button" style={pageStyles.secondaryBtn} onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      {success && <div style={{ ...pageStyles.success, marginBottom: 10 }}>{success}</div>}

      <AdminCard>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            style={activeTab === "overview" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            style={activeTab === "templates" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => setActiveTab("templates")}
          >
            Rate Templates
          </button>
          <button
            type="button"
            style={activeTab === "approvals" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => setActiveTab("approvals")}
          >
            Approval Requests ({approvalRequests.length})
          </button>
          <button
            type="button"
            style={activeTab === "prices" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => setActiveTab("prices")}
          >
            Price Records
          </button>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Rates & Pricing Analysis</h3>
            {analysis ? (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Total Price Records</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {analysis.totalRecords.toLocaleString()}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Average Price (₹)</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {formatINR(analysis.averagePrice, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Unique Materials</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {analysis.materialCount}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Districts Covered</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {analysis.districtCount}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Flagged Records</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {analysis.flaggedCount}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Pending Approvals</div>
                  <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {approvalRequests.length}
                  </div>
                </AdminCard>
              </div>
            ) : (
              <div style={pageStyles.empty}>Loading analysis data...</div>
            )}

            {analysis && Object.keys(analysis.sourceCount).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4>Price Sources Distribution</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {Object.entries(analysis.sourceCount).map(([source, count]) => (
                    <div
                      key={source}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 10,
                        background: "#f8fafc",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{source}</span>
                      <span style={{ color: "#64748b" }}>{count} records</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>PWD Rate Templates</h3>
              <span style={pageStyles.subtext}>{templates?.pagination.total || 0} total</span>
            </div>
            {templates?.items && templates.items.length > 0 ? (
              <AdminTable>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Code</th>
                      <th style={pageStyles.th}>Name</th>
                      <th style={pageStyles.th}>Category</th>
                      <th style={pageStyles.th}>Unit</th>
                      <th style={pageStyles.th}>Overhead</th>
                      <th style={pageStyles.th}>Profit</th>
                      <th style={pageStyles.th}>GST</th>
                      <th style={pageStyles.th}>Items</th>
                      <th style={pageStyles.th}>Status</th>
                      <th style={pageStyles.th}>Type</th>
                      <th style={pageStyles.th}>Created</th>
                      <th style={pageStyles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.items.map((template, idx) => (
                      <tr key={template.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{template.code}</td>
                        <td style={pageStyles.td}>{template.name}</td>
                        <td style={pageStyles.td}>{template.category}</td>
                        <td style={pageStyles.td}>{template.unit}</td>
                        <td style={pageStyles.td}>{template.overhead_percent}%</td>
                        <td style={pageStyles.td}>{template.profit_percent}%</td>
                        <td style={pageStyles.td}>{template.gst_percent}%</td>
                        <td style={pageStyles.td}>{template.line_item_count}</td>
                        <td style={pageStyles.td}>
                          <StatusPill
                            label={template.approval_status}
                            tone={getStatusColor(template.approval_status)}
                          />
                        </td>
                        <td style={pageStyles.td}>{template.is_system ? "System" : "Custom"}</td>
                        <td style={pageStyles.td}>{formatDate(template.created_at)}</td>
                        <td style={pageStyles.td}>
                          <button
                            type="button"
                            style={pageStyles.secondaryBtn}
                            onClick={() => openEditModal(template)}
                            disabled={savingTemplateId === template.id}
                          >
                            {savingTemplateId === template.id ? "Saving..." : "Edit"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTable>
            ) : (
              <div style={pageStyles.empty}>No rate templates found</div>
            )}
          </div>
        )}

        {/* APPROVALS TAB */}
        {activeTab === "approvals" && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Pending Approval Requests ({approvalRequests.length})</h3>
            {approvalRequests.length > 0 ? (
              <AdminTable>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Code</th>
                      <th style={pageStyles.th}>Submitted For</th>
                      <th style={pageStyles.th}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRequests.map((request, idx) => (
                      <tr key={request.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{request.code}</td>
                        <td style={pageStyles.td}>
                          {request.submitted_for_global ? "Global" : "Organization"}
                        </td>
                        <td style={pageStyles.td}>{formatDate(request.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTable>
            ) : (
              <div style={pageStyles.empty}>No pending approval requests</div>
            )}
          </div>
        )}

        {/* PRICES TAB */}
        {activeTab === "prices" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Scraped Price Records</h3>
              <span style={pageStyles.subtext}>{priceRecords?.pagination.total || 0} total</span>
            </div>
            {priceRecords?.items && priceRecords.items.length > 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {priceRecords.items.map((record, idx) => (
                      <tr key={record.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>
                          {record.material_name}{" "}
                          <span style={pageStyles.subtext}>/{record.material_unit}</span>
                        </td>
                        <td style={pageStyles.td}>{record.district_name}</td>
                        <td style={pageStyles.td}>
                          {formatINR(Number(record.price), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={pageStyles.td}>{record.source}</td>
                        <td style={pageStyles.td}>
                          <StatusPill
                            label={record.flagged ? "flagged" : "clean"}
                            tone={record.flagged ? "warning" : "success"}
                          />
                        </td>
                        <td style={pageStyles.td}>{formatDate(record.scraped_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTable>
            ) : (
              <div style={pageStyles.empty}>No price records found</div>
            )}
          </div>
        )}
      </AdminCard>

      {editingTemplate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
          onClick={closeEditModal}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.22)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, color: "#0f172a" }}>Edit Rate Template</h3>
              <button
                type="button"
                style={pageStyles.secondaryBtn}
                onClick={closeEditModal}
                disabled={!!savingTemplateId}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Code</span>
                <input
                  style={pageStyles.input}
                  value={editForm.code}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Name</span>
                <input
                  style={pageStyles.input}
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Category</span>
                <input
                  style={pageStyles.input}
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Sub Category</span>
                <input
                  style={pageStyles.input}
                  value={editForm.sub_category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sub_category: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Unit</span>
                <input
                  style={pageStyles.input}
                  value={editForm.unit}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Overhead %</span>
                <input
                  type="number"
                  step="0.01"
                  style={pageStyles.input}
                  value={editForm.overhead_percent}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, overhead_percent: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>Profit %</span>
                <input
                  type="number"
                  step="0.01"
                  style={pageStyles.input}
                  value={editForm.profit_percent}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, profit_percent: e.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={pageStyles.subtext}>GST %</span>
                <input
                  type="number"
                  step="0.01"
                  style={pageStyles.input}
                  value={editForm.gst_percent}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, gst_percent: e.target.value }))}
                />
              </label>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                style={pageStyles.secondaryBtn}
                onClick={closeEditModal}
                disabled={!!savingTemplateId}
              >
                Cancel
              </button>
              <button
                type="button"
                style={pageStyles.primaryBtn}
                onClick={saveTemplateChanges}
                disabled={!!savingTemplateId}
              >
                {savingTemplateId ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
