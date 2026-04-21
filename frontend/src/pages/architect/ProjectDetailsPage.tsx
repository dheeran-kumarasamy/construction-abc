import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import TableWrapper from "../../components/TableWrapper";
import { apiUrl } from "../../services/api";
import { formatDate } from "../../services/dateTime";

interface ProjectDetails {
  id: string;
  name: string;
  building_type?: string | null;
  buildingType?: string | null;
  description?: string | null;
  site_address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  tentative_start_date?: string | null;
  duration_months?: number | null;
  floors_above_ground?: number | null;
  floors_below_ground?: number | null;
  currency_code?: string | null;
  created_at: string;
  client_name?: string | null;
  project_location?: string | null;
  status?: string | null;
}

function formatProjectType(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function formatCoordinate(value: number | string | null | undefined) {
  if (value == null || value === "") return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : String(value);
}

function formatStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function formatCurrency(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "INR") return "INR (Rs)";
  if (normalized === "USD") return "USD ($)";
  return normalized;
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
          (() => {
            const projectTypeValue = project.building_type || project.buildingType;
            const detailRows = [
              { label: "Name", value: project.name },
              { label: "Description", value: project.description || "-" },
              { label: "Client", value: project.client_name || "-" },
              { label: "Project Type", value: formatProjectType(projectTypeValue) },
              { label: "Location", value: project.project_location || "-" },
              { label: "Site Address", value: project.site_address || "-" },
              { label: "Latitude", value: formatCoordinate(project.latitude) },
              { label: "Longitude", value: formatCoordinate(project.longitude) },
              { label: "Start Date", value: project.tentative_start_date ? formatDate(project.tentative_start_date) : "-" },
              { label: "Duration (months)", value: project.duration_months ?? "-" },
              { label: "Floors Above Natural Ground Level", value: project.floors_above_ground ?? "-" },
              { label: "Floors Below Natural Ground Level", value: project.floors_below_ground ?? "-" },
              { label: "Currency", value: formatCurrency(project.currency_code) },
              { label: "Status", value: formatStatus(project.status) },
              { label: "Created At", value: formatDate(project.created_at) },
            ];
            return (
          <TableWrapper>
            <table style={{ ...pageStyles.table, maxWidth: 600 }}>
            <tbody>
              {detailRows.map((row) => (
                <tr key={row.label}>
                  <th style={pageStyles.th}>{row.label}</th>
                  <td style={pageStyles.td}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableWrapper>
            );
          })()
        )}
      </div>
    </div>
  );
}
