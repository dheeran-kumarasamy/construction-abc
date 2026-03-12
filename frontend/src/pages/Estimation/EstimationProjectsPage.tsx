import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import * as api from "./estimation.api";
import type { BOQProject } from "./types";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  in_progress: "#d97706",
  completed: "#059669",
  submitted: "#2563eb",
  estimated: "#8b5cf6",
};

interface ProjectWithType extends BOQProject {
  project_type?: "own" | "invited";
  invitation_status?: string;
}

export default function EstimationProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", client_name: "", project_location: "", terrain: "plains" as const });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const [ownProjects, invitedProjects] = await Promise.all([
        api.fetchProjects(),
        api.fetchInvitedProjects().catch(() => []),
      ]);
      
      // Mark own projects
      const marked = ownProjects.map((p) => ({ ...p, project_type: "own" as const }));
      // Mark invited projects
      const invitedMarked = invitedProjects.map((p) => ({ ...p, project_type: "invited" as const }));
      
      // Combine and sort by updated_at
      const combined = [...marked, ...invitedMarked].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setProjects(combined);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const project = await api.createProject(form);
      navigate(`/estimation/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its items?")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  const fmt = (n?: number) => (n != null ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—");

  return (
    <div style={{ ...pageStyles.page, alignItems: "flex-start", paddingTop: 32 }}>
      <div style={{ ...pageStyles.card, width: "min(1100px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h1 style={pageStyles.title}>Rate Analysis & BOQ Estimation</h1>
            <p style={pageStyles.subtitle}>TN PWD Schedule of Rates 2025-2026</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={pageStyles.secondaryBtn} onClick={() => navigate("templates")}>
              Template Editor
            </button>
            <button style={pageStyles.primaryBtn} onClick={() => setShowCreate(!showCreate)}>
              + New Project
            </button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} style={{ ...pageStyles.formGrid, background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Project Name *</label>
              <input
                style={pageStyles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. G+2 Residential Building"
                required
              />
            </div>
            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Client Name</label>
              <input
                style={pageStyles.input}
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Client name"
              />
            </div>
            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Location</label>
              <input
                style={pageStyles.input}
                value={form.project_location}
                onChange={(e) => setForm({ ...form, project_location: e.target.value })}
                placeholder="City / District"
              />
            </div>
            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Terrain</label>
              <select
                style={pageStyles.select}
                value={form.terrain}
                onChange={(e) => setForm({ ...form, terrain: e.target.value as any })}
              >
                <option value="plains">Plains</option>
                <option value="hills">Hills</option>
              </select>
            </div>
            <div style={{ ...pageStyles.actions, gridColumn: "1/-1" }}>
              <button type="button" style={pageStyles.secondaryBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" style={pageStyles.primaryBtn}>Create Project</button>
            </div>
          </form>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>No estimation projects yet</p>
            <p>Create your first project to start building a BOQ with TN PWD rates.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Project</th>
                  <th style={pageStyles.th}>Location</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Items</th>
                  <th style={pageStyles.th}>Total</th>
                  <th style={pageStyles.th}>Updated</th>
                  <th style={pageStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id} style={i % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                    <td style={{ ...pageStyles.td, fontWeight: 600, cursor: "pointer", color: "var(--accent)" }}
                      onClick={() => navigate(`/estimation/${p.id}`)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {p.name}
                        {p.project_type === "invited" && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#dbeafe",
                            color: "#0c4a6e",
                          }}>
                            From Architect
                          </span>
                        )}
                      </div>
                      {p.client_name && <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{p.client_name}</div>}
                    </td>
                    <td style={pageStyles.td}>{p.project_location || "—"}</td>
                    <td style={pageStyles.td}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status],
                      }}>
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ ...pageStyles.td, textAlign: "center" }}>{p.item_count ?? 0}</td>
                    <td style={{ ...pageStyles.td, textAlign: "right", fontFamily: "monospace" }}>{fmt(p.total_amount)}</td>
                    <td style={{ ...pageStyles.td, fontSize: 13, color: "var(--muted)" }}>
                      {new Date(p.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td style={pageStyles.td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...pageStyles.secondaryBtn, height: 32, fontSize: 13, padding: "0 12px" }}
                          onClick={() => navigate(`/estimation/${p.id}`)}>Open</button>
                        {p.project_type === "own" && (
                          <button style={{ ...pageStyles.secondaryBtn, height: 32, fontSize: 13, padding: "0 12px", color: "#dc2626" }}
                            onClick={() => handleDelete(p.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
