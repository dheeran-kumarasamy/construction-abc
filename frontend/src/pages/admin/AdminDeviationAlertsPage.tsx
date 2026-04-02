import React from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { AdminCard, AdminShell, AdminTable } from "./AdminShell";
import { adminFetch, type PaginatedResponse } from "./adminApi";
import { formatDateTime } from "../../services/dateTime";

type DeviationAlertRow = {
  id: string;
  user_email: string | null;
  action: string;
  metadata: {
    projectId?: string;
    projectName?: string;
    estimateId?: string;
    revisionNumber?: number;
    thresholdPercent?: number;
    deviationCount?: number;
    maxDeviationPercent?: number;
    maxAboveDeviationPercent?: number;
    maxBelowDeviationPercent?: number;
    aboveMarketCount?: number;
    belowMarketCount?: number;
    deviationDirection?: "above_market" | "below_market" | "mixed";
    items?: Array<{
      boqItemName?: string;
      builderRate?: number;
      marketRate?: number;
      deviationPercent?: number;
      deviationPercentSigned?: number;
      deviationDirection?: "above_market" | "below_market";
    }>;
  } | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by_email?: string | null;
  resolved_note?: string | null;
};

type DeviationAlertsResponse = PaginatedResponse<DeviationAlertRow> & {
  directionCounts?: {
    all?: number;
    above_market?: number;
    below_market?: number;
    mixed?: number;
  };
};

function formatDate(value: string) {
  return formatDateTime(value);
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getDirectionInfo(directionRaw?: string) {
  const direction = String(directionRaw || "above_market") as "above_market" | "below_market" | "mixed";
  if (direction === "below_market") {
    return {
      label: "Below Market",
      badgeStyle: {
        background: "#e0f2fe",
        border: "1px solid #0284c7",
        color: "#075985",
      },
      rowTint: "#f0f9ff",
    };
  }

  if (direction === "mixed") {
    return {
      label: "Mixed",
      badgeStyle: {
        background: "#f1f5f9",
        border: "1px solid #64748b",
        color: "#334155",
      },
      rowTint: "#f8fafc",
    };
  }

  return {
    label: "Above Market",
    badgeStyle: {
      background: "#fff7ed",
      border: "1px solid #ea580c",
      color: "#9a3412",
    },
    rowTint: "#fffaf5",
  };
}

export default function AdminDeviationAlertsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [minDeviationPercent, setMinDeviationPercent] = React.useState(20);
  const [statusFilter, setStatusFilter] = React.useState<"open" | "resolved" | "all">("open");
  const [directionFilter, setDirectionFilter] = React.useState<"all" | "above_market" | "below_market" | "mixed">("all");
  const [data, setData] = React.useState<DeviationAlertsResponse | null>(null);

  async function load(
    nextPage = page,
    threshold = minDeviationPercent,
    status: "open" | "resolved" | "all" = statusFilter,
    direction: "all" | "above_market" | "below_market" | "mixed" = directionFilter
  ) {
    try {
      setLoading(true);
      setError("");
      const response = await adminFetch<DeviationAlertsResponse>(
        `/api/admin/deviation-alerts?page=${nextPage}&pageSize=25&minDeviationPercent=${threshold}&status=${status}&direction=${direction}`
      );
      setData(response);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load deviation alerts");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(1, minDeviationPercent, statusFilter, directionFilter);
  }, []);

  async function resolveAlert(alertId: string) {
    const note = window.prompt("Optional resolution note:", "") || "";
    try {
      await adminFetch(`/api/admin/deviation-alerts/${alertId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      await load(page, minDeviationPercent, statusFilter, directionFilter);
    } catch (err: any) {
      setError(err.message || "Failed to resolve alert");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;
  const directionCounts = {
    all: Number(data?.directionCounts?.all || 0),
    above_market: Number(data?.directionCounts?.above_market || 0),
    below_market: Number(data?.directionCounts?.below_market || 0),
    mixed: Number(data?.directionCounts?.mixed || 0),
  };

  return (
    <AdminShell
      title="Market Deviation Alerts"
      subtitle="Builder submissions where quoted material rates deviated from market benchmarks beyond threshold."
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ color: "#334155", fontSize: 13 }}>Direction</label>
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All", activeBg: "#e2e8f0", activeColor: "#0f172a", count: directionCounts.all },
              { key: "above_market", label: "Above", activeBg: "#ffedd5", activeColor: "#9a3412", count: directionCounts.above_market },
              { key: "below_market", label: "Below", activeBg: "#e0f2fe", activeColor: "#075985", count: directionCounts.below_market },
              { key: "mixed", label: "Mixed", activeBg: "#e2e8f0", activeColor: "#334155", count: directionCounts.mixed },
            ].map((chip) => {
              const isActive = directionFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    const nextDirection = chip.key as "all" | "above_market" | "below_market" | "mixed";
                    setDirectionFilter(nextDirection);
                    load(1, minDeviationPercent, statusFilter, nextDirection);
                  }}
                  style={{
                    borderRadius: 999,
                    border: isActive ? "1px solid transparent" : "1px solid #cbd5e1",
                    background: isActive ? chip.activeBg : "#ffffff",
                    color: isActive ? chip.activeColor : "#334155",
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {chip.label} ({chip.count})
                </button>
              );
            })}
          </div>
          <label style={{ color: "#334155", fontSize: 13 }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value as "open" | "resolved" | "all") || "open")}
            style={{ ...pageStyles.input, width: 130, padding: "8px 10px" }}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <label style={{ color: "#334155", fontSize: 13 }}>Min %</label>
          <input
            type="number"
            min={0}
            value={minDeviationPercent}
            onChange={(e) => setMinDeviationPercent(Math.max(0, Number(e.target.value || 0)))}
            style={{ ...pageStyles.input, width: 90, padding: "8px 10px" }}
          />
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(1, minDeviationPercent, statusFilter, directionFilter)}>
            Apply
          </button>
          <button type="button" style={pageStyles.secondaryBtn} onClick={() => load(page, minDeviationPercent, statusFilter, directionFilter)}>
            Refresh
          </button>
        </div>
      }
    >
      {error && <div style={pageStyles.error}>{error}</div>}
      <AdminCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Deviation Events</strong>
          <span style={pageStyles.subtext}>{data?.pagination.total || 0} total</span>
        </div>

        <AdminTable>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>When</th>
                <th style={pageStyles.th}>Project</th>
                <th style={pageStyles.th}>Submitted By</th>
                <th style={pageStyles.th}>Type</th>
                <th style={pageStyles.th}>Threshold</th>
                <th style={pageStyles.th}>Max Deviation</th>
                <th style={pageStyles.th}>Items</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((row, index) => {
                const metadata = row.metadata || {};
                const firstItem = metadata.items?.[0] || null;
                const isResolved = Boolean(row.resolved_at);
                const directionInfo = getDirectionInfo(metadata.deviationDirection);
                const rowStyle = {
                  ...(index % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd),
                  background: directionInfo.rowTint,
                };

                return (
                  <tr key={row.id} style={rowStyle}>
                    <td style={pageStyles.td}>{formatDate(row.created_at)}</td>
                    <td style={pageStyles.td}>{metadata.projectName || metadata.projectId || "-"}</td>
                    <td style={pageStyles.td}>{row.user_email || "system"}</td>
                    <td style={pageStyles.td}>
                      <span style={{
                        ...directionInfo.badgeStyle,
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "2px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}>
                        {directionInfo.label}
                      </span>
                    </td>
                    <td style={pageStyles.td}>{toNumber(metadata.thresholdPercent).toFixed(2)}%</td>
                    <td style={pageStyles.td}>{toNumber(metadata.maxDeviationPercent).toFixed(2)}%</td>
                    <td style={pageStyles.td}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span>
                          {toNumber(metadata.deviationCount)} flagged
                          {toNumber(metadata.aboveMarketCount) > 0 ? `, ${toNumber(metadata.aboveMarketCount)} above` : ""}
                          {toNumber(metadata.belowMarketCount) > 0 ? `, ${toNumber(metadata.belowMarketCount)} below` : ""}
                        </span>
                        {firstItem ? (
                          <span style={{ color: "#475569", fontSize: 12 }}>
                            Top: {firstItem.boqItemName || "item"} ({toNumber(firstItem.deviationPercentSigned ?? firstItem.deviationPercent).toFixed(2)}%)
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 12 }}>No item details</span>
                        )}
                      </div>
                    </td>
                    <td style={pageStyles.td}>
                      {isResolved ? (
                        <div style={{ display: "grid", gap: 3 }}>
                          <span style={{ color: "#166534", fontWeight: 700 }}>Resolved</span>
                          <span style={{ color: "#475569", fontSize: 12 }}>
                            by {row.resolved_by_email || "admin"} at {row.resolved_at ? formatDate(row.resolved_at) : "-"}
                          </span>
                          {row.resolved_note ? (
                            <span style={{ color: "#475569", fontSize: 12 }}>Note: {row.resolved_note}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ color: "#b45309", fontWeight: 700 }}>Open</span>
                      )}
                    </td>
                    <td style={pageStyles.td}>
                      {isResolved ? (
                        <span style={{ color: "#64748b", fontSize: 12 }}>Closed</span>
                      ) : (
                        <button
                          type="button"
                          style={pageStyles.primaryBtn}
                          onClick={() => resolveAlert(row.id)}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTable>

        {!loading && !(data?.items.length) && <div style={pageStyles.empty}>No deviation alerts found.</div>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => load(Math.max(1, page - 1), minDeviationPercent, statusFilter, directionFilter)}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <span style={pageStyles.subtext}>Page {page} of {totalPages}</span>
          <button
            type="button"
            style={pageStyles.secondaryBtn}
            onClick={() => load(Math.min(totalPages, page + 1), minDeviationPercent, statusFilter, directionFilter)}
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
        </div>
      </AdminCard>
    </AdminShell>
  );
}
