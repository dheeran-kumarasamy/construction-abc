import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

interface Invite {
  email: string;
  projectId: string;
  status: "pending" | "sent" | "failed";
  inviteLink?: string;
  error?: string;
}

interface Project {
  id: string;
  name: string;
}

export default function InviteBuilders() {
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("http://localhost:4000/projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        setProjects(data);
        if (data.length > 0) setProjectId(data[0].id);
      } catch (err) {
        console.error("Load projects error:", err);
      }
    })();
  }, [token]);

  async function sendInvite() {
    if (!email.trim() || !projectId) return;

    const newInvite: Invite = { email, projectId, status: "pending" };
    setInvites((prev) => [...prev, newInvite]);

    try {
      const res = await fetch("http://localhost:4000/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role: "builder", projectId }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || "Invite failed");
      }

      setInvites((prev) =>
        prev.map((inv, idx) =>
          idx === prev.length - 1
            ? { ...inv, status: "sent", inviteLink: body.inviteLink }
            : inv
        )
      );
      setEmail("");
    } catch (err: any) {
      setInvites((prev) =>
        prev.map((inv, idx) =>
          idx === prev.length - 1
            ? { ...inv, status: "failed", error: err.message }
            : inv
        )
      );
    }
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(760px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Invite Builders</h2>
            <p style={pageStyles.subtitle}>
              Pick a project, add a builder email, and send the invite.
            </p>
          </div>
          <div style={pageStyles.meta}>Projects: {projects.length}</div>
        </div>

        <div style={pageStyles.formRow}>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={pageStyles.select}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Builder email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={pageStyles.input}
          />

          <button onClick={sendInvite} style={pageStyles.primaryBtn}>
            Send Invite
          </button>
        </div>

        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th style={pageStyles.th}>Email</th>
              <th style={pageStyles.th}>Project</th>
              <th style={pageStyles.th}>Status</th>
              <th style={pageStyles.th}>Invite Link</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={4} style={pageStyles.empty}>
                  No invites yet
                </td>
              </tr>
            ) : (
              invites.map((inv, idx) => (
                <tr
                  key={idx}
                  style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}
                >
                  <td style={pageStyles.td}>{inv.email}</td>
                  <td style={pageStyles.td}>
                    {projects.find((p) => p.id === inv.projectId)?.name || "-"}
                  </td>
                  <td style={pageStyles.td}>
                    <span
                      style={
                        inv.status === "sent"
                          ? pageStyles.statusSent
                          : inv.status === "failed"
                          ? pageStyles.statusFailed
                          : pageStyles.statusPending
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={pageStyles.td}>
                    {inv.inviteLink ? (
                      <a
                        href={inv.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                        style={pageStyles.link}
                      >
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