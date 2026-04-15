import { useEffect, useMemo, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import { apiUrl } from "../../services/api";
import { formatDateTime } from "../../services/dateTime";
import { useAuth } from "../../auth/AuthContext";

interface TeamApprovalLogEntry {
  id: string;
  project_id: string;
  project_name: string;
  estimate_id: string | null;
  comment: string | null;
  reviewer_user_id: string;
  reviewer_email: string;
  reviewer_org_role: "head" | "member" | null;
  approved_at: string;
  head_sms_sent: boolean;
  head_sms_reason: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function AuditTrail() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const [entries, setEntries] = useState<TeamApprovalLogEntry[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);
  const [savePhoneMessage, setSavePhoneMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isArchitectHead = user?.role === "architect" && user?.orgRole === "head";

  useEffect(() => {
    if (!isArchitectHead || !token) {
      setLoading(false);
      return;
    }

    async function loadMyProfile() {
      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok) {
          setPhoneNumber(String(data?.phoneNumber || ""));
        }
      } catch {
        // Non-blocking for audit view.
      }
    }

    async function loadProjects() {
      try {
        const res = await fetch(apiUrl("/projects"), {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setProjects(data.map((row: any) => ({ id: String(row.id), name: String(row.name || "Project") })));
        }
      } catch {
        // Non-blocking for logs table.
      }
    }

    void loadMyProfile();
    void loadProjects();
  }, [isArchitectHead, token]);

  async function savePhoneNumber() {
    if (!token) return;

    try {
      setSavePhoneLoading(true);
      setSavePhoneMessage("");

      const res = await fetch(apiUrl("/auth/me/phone"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save phone number");
      }

      setPhoneNumber(String(data?.phoneNumber || phoneNumber));
      setSavePhoneMessage("Phone number saved for SMS notifications.");
    } catch (err) {
      setSavePhoneMessage(err instanceof Error ? err.message : "Failed to save phone number");
    } finally {
      setSavePhoneLoading(false);
    }
  }

  useEffect(() => {
    if (!isArchitectHead || !token) return;

    async function loadApprovalLogs() {
      try {
        setLoading(true);
        setError("");
        const query = projectFilter !== "all" ? `?projectId=${encodeURIComponent(projectFilter)}` : "";
        const res = await fetch(apiUrl(`/architect/team-approvals${query}`), {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch team approval logs");
        }
        setEntries(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch team approval logs");
      } finally {
        setLoading(false);
      }
    }

    void loadApprovalLogs();
  }, [isArchitectHead, projectFilter, token]);

  const totalApprovals = useMemo(() => entries.length, [entries]);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <h2 style={pageStyles.title}>Team Approval Log</h2>

        {!isArchitectHead && (
          <p style={pageStyles.subtitle}>Only Architect Head can view team approval tracking.</p>
        )}

        {isArchitectHead && (
          <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#475569" }}>Head Phone Number (SMS)</span>
                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+919876543210"
                  style={{ ...pageStyles.input, minWidth: 260 }}
                />
              </label>
              <button
                type="button"
                onClick={savePhoneNumber}
                disabled={savePhoneLoading}
                style={pageStyles.primaryBtn}
              >
                {savePhoneLoading ? "Saving..." : "Save Phone"}
              </button>
              {savePhoneMessage && (
                <div style={{ fontSize: 13, color: savePhoneMessage.toLowerCase().includes("failed") ? "#dc2626" : "#0f766e" }}>
                  {savePhoneMessage}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Project Filter</span>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                style={{ ...pageStyles.input, minWidth: 260 }}
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ color: "#475569", fontSize: 14, fontWeight: 600 }}>
              Total approvals by team members: {totalApprovals}
            </div>
            </div>
          </div>
        )}

        {error && <div style={pageStyles.error}>{error}</div>}
        {loading && isArchitectHead && <p>Loading team approval logs...</p>}

        {!loading && isArchitectHead && entries.length === 0 && <p>No team approval records found.</p>}

        {!loading && isArchitectHead && entries.length > 0 && (
          <TableWrapper>
            <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Project</th>
                <th style={pageStyles.th}>Estimate</th>
                <th style={pageStyles.th}>Team Member</th>
                <th style={pageStyles.th}>Comment</th>
                <th style={pageStyles.th}>Approved At</th>
                <th style={pageStyles.th}>Head SMS</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{entry.project_name || entry.project_id}</td>
                  <td style={pageStyles.td}>{entry.estimate_id || "-"}</td>
                  <td style={pageStyles.td}>{entry.reviewer_email}</td>
                  <td style={pageStyles.td}>{entry.comment || "-"}</td>
                  <td style={pageStyles.td}>{entry.approved_at ? formatDateTime(entry.approved_at) : "-"}</td>
                  <td style={pageStyles.td}>{entry.head_sms_sent ? "Sent" : entry.head_sms_reason || "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
