import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";
import { useAuth } from "../../auth/AuthContext";

interface Invite {
  id: string;
  email: string;
  role?: "builder" | "architect";
  projectId: string | null;
  projectName?: string;
  status: "open" | "accepted" | "expired" | "pending" | "failed";
  inviteLink?: string;
  error?: string;
  createdAt?: string;
}

interface Project {
  id: string;
  name: string;
}

export default function InviteBuilders() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get("projectId") || "";
  const isArchitectHead = user?.role === "architect" && user?.orgRole === "head";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"builder" | "architect">("builder");
  const [projectId, setProjectId] = useState<string>("");
  const [assignProject, setAssignProject] = useState<string>("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "accepted" | "expired">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState("");
  const [loadingInvites, setLoadingInvites] = useState(false);

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(apiUrl("/projects"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load projects");

        const data = (await res.json()) as Project[];
        setProjects(data);
        if (projectIdFromQuery && data.some((p) => p.id === projectIdFromQuery)) {
          setProjectId(projectIdFromQuery);
        } else if (data.length > 0) {
          setProjectId(data[0].id);
        }
      } catch (err) {
        console.error("Load projects error:", err);
      }
    })();
  }, [projectIdFromQuery, token]);

  useEffect(() => {
    if (!token) return;
    void loadInvites();
  }, [token]);

  async function loadInvites() {
    if (!token) return;

    setLoadingInvites(true);
    try {
      const res = await fetch(apiUrl("/auth/invites"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load invites");

      const data = (await res.json()) as Invite[];
      setInvites(data);
    } catch (err) {
      console.error("Load invites error:", err);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function sendInvite() {
    if (!email.trim()) return;
    if (!isArchitectHead && inviteRole === "architect") return;
    if (inviteRole === "builder" && !projectId) return;

    const assignedProjectId = inviteRole === "architect" ? assignProject : projectId;

    const optimisticInvite: Invite = {
      id: `tmp-${Date.now()}`,
      role: inviteRole,
      email,
      projectId: assignedProjectId || null,
      projectName: assignedProjectId
        ? projects.find((p) => p.id === assignedProjectId)?.name
        : inviteRole === "builder"
        ? projects.find((p) => p.id === projectId)?.name
        : "Architect Team",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setInvites((prev) => [...prev, optimisticInvite]);

    try {
      const res = await fetch(apiUrl("/auth/invite"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          inviteRole === "builder" || !isArchitectHead
            ? { email, role: "builder", projectId }
            : { email, role: "architect", projectId: assignProject || null }
        ),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Invite failed");
      }

      setInvites((prev) =>
        prev.map((inv, idx) =>
          idx === prev.length - 1 ? { ...inv, status: "open", inviteLink: body.inviteLink } : inv
        )
      );
      setEmail("");
    } catch (err: any) {
      setInvites((prev) =>
        prev.map((inv, idx) =>
          idx === prev.length - 1
            ? { ...inv, status: "failed", error: err?.message || "Invite failed" }
            : inv
        )
      );
    }
  }

  const filteredInvites = invites.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (projectFilter !== "all" && inv.projectId !== projectFilter) return false;
    if (emailFilter.trim() && !inv.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 24 }}>
      <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>{isArchitectHead ? "Invite Team & Builders" : "Invite Builders"}</h2>
            <p style={pageStyles.subtitle}>
              {isArchitectHead
                ? "Invite architect team members and builders. Team invites can be scoped to one project."
                : "Invite builders for projects in your architect organization."}
            </p>
          </div>
          <div style={pageStyles.meta}>Projects: {projects.length}</div>
        </div>

        <div style={pageStyles.formRow}>
          {isArchitectHead ? (
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "builder" | "architect")}
              style={pageStyles.select}
            >
              <option value="builder">Builder Invite</option>
              <option value="architect">Architect Team Invite</option>
            </select>
          ) : (
            <input
              value="Builder Invite"
              readOnly
              style={{ ...pageStyles.input, maxWidth: "180px", backgroundColor: "#f8fafc" }}
            />
          )}

          {inviteRole === "builder" && (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={pageStyles.select}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {inviteRole === "architect" && isArchitectHead && (
            <select value={assignProject} onChange={(e) => setAssignProject(e.target.value)} style={pageStyles.select}>
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <input
            placeholder={inviteRole === "builder" ? "Builder email" : "Architect team member email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={pageStyles.input}
          />

          <button onClick={sendInvite} style={pageStyles.primaryBtn}>
            Send Invite
          </button>
        </div>

        <div style={{ ...pageStyles.formRow, marginTop: "1rem" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "accepted" | "expired")}
            style={pageStyles.select}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
          </select>

          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={pageStyles.select}>
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Filter by email"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            style={pageStyles.input}
          />
        </div>

        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th style={pageStyles.th}>Email</th>
              <th style={pageStyles.th}>Role</th>
              <th style={pageStyles.th}>Project</th>
              <th style={pageStyles.th}>Status</th>
              <th style={pageStyles.th}>Invite Link</th>
            </tr>
          </thead>
          <tbody>
            {loadingInvites ? (
              <tr>
                <td colSpan={5} style={pageStyles.empty}>
                  Loading invites...
                </td>
              </tr>
            ) : filteredInvites.length === 0 ? (
              <tr>
                <td colSpan={5} style={pageStyles.empty}>
                  No invites found
                </td>
              </tr>
            ) : (
              filteredInvites.map((inv, idx) => (
                <tr key={inv.id || idx} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{inv.email}</td>
                  <td style={pageStyles.td}>{inv.role || "builder"}</td>
                  <td style={pageStyles.td}>
                    {inv.projectName || projects.find((p) => p.id === inv.projectId)?.name || "-"}
                  </td>
                  <td style={pageStyles.td}>
                    <span
                      style={
                        inv.status === "accepted" || inv.status === "open"
                          ? pageStyles.success
                          : inv.status === "failed"
                          ? pageStyles.error
                          : pageStyles.subtext
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={pageStyles.td}>
                    {inv.status === "open" && inv.inviteLink ? (
                      <a href={inv.inviteLink} target="_blank" rel="noreferrer" style={pageStyles.link}>
                        Open
                      </a>
                    ) : inv.error ? (
                      <span style={pageStyles.error}>{inv.error}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
