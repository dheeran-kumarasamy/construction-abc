import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import { apiUrl } from "../../services/api";
import { formatDate } from "../../services/dateTime";

interface ProjectDetails {
  id: string;
  name: string;
  description?: string | null;
  site_address?: string | null;
  tentative_start_date?: string | null;
  duration_months?: number | null;
  created_at: string;
  client_name?: string | null;
  project_location?: string | null;
  status?: string | null;
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");
        const res = await fetch(apiUrl(`/api/estimation/projects/${id}`), {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load project");
        }
        setProject(data);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <button style={{ ...pageStyles.secondaryBtn, marginBottom: 16 }} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={pageStyles.title}>Project Details</h2>
        {loading && <div>Loading project...</div>}
        {error && <div style={{ color: "#dc2626" }}>{error}</div>}
        {project && !loading && !error && (
          <TableWrapper>
            <table style={{ ...pageStyles.table, maxWidth: 600 }}>
            <tbody>
              <tr>
                <th style={pageStyles.th}>Name</th>
                <td style={pageStyles.td}>{project.name}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Description</th>
                <td style={pageStyles.td}>{project.description || "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Client</th>
                <td style={pageStyles.td}>{project.client_name || "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Location</th>
                <td style={pageStyles.td}>{project.project_location || "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Site Address</th>
                <td style={pageStyles.td}>{project.site_address || "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Start Date</th>
                <td style={pageStyles.td}>{project.tentative_start_date ? formatDate(project.tentative_start_date) : "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Duration (months)</th>
                <td style={pageStyles.td}>{project.duration_months ?? "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Status</th>
                <td style={pageStyles.td}>{project.status || "-"}</td>
              </tr>
              <tr>
                <th style={pageStyles.th}>Created At</th>
                <td style={pageStyles.td}>{formatDate(project.created_at)}</td>
              </tr>
            </tbody>
          </table>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
