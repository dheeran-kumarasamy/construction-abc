import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";

interface BuilderProfile {
  id: string;
  userId: string;
  companyName: string | null;
  contactPhone: string | null;
  serviceLocations: string | null;
  specialties: string | null;
  pastProjects: string | null;
  portfolioLinks: string | null;
  teamSize: number | null;
  minProjectBudget: number | null;
}

export default function ArchitectBuilderDirectory() {
  const [builders, setBuilders] = useState<BuilderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  useEffect(() => {
    void loadBuilders();
  }, []);

  async function loadBuilders() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl("/api/builder/directory"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: BuilderProfile[] = await res.json();
      setBuilders(data);
    } catch (err: any) {
      setError(err.message || "Failed to load builders");
    } finally {
      setLoading(false);
    }
  }

  const filtered = builders.filter((b) => {
    const spec = filterSpecialty.trim().toLowerCase();
    const loc = filterLocation.trim().toLowerCase();
    if (spec && !(b.specialties?.toLowerCase().includes(spec))) return false;
    if (loc && !(b.serviceLocations?.toLowerCase().includes(loc))) return false;
    return true;
  });

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        {/* Header */}
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Builder Directory</h2>
            <p style={pageStyles.subtitle}>
              Builders in your organisation who have shared their profiles.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            style={{ ...pageStyles.input, flex: 1, minWidth: 160 }}
            type="text"
            placeholder="Filter by specialty…"
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
          />
          <input
            style={{ ...pageStyles.input, flex: 1, minWidth: 160 }}
            type="text"
            placeholder="Filter by location…"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          />
        </div>

        {/* Content */}
        {loading && <p style={pageStyles.subtitle}>Loading builders…</p>}
        {error && <div style={pageStyles.error}>{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <p style={pageStyles.subtitle}>
            No builders found{filterSpecialty || filterLocation ? " for this filter" : " in your organisation yet"}.
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.map((b) => (
              <BuilderCard key={b.id} builder={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuilderCard({ builder: b }: { builder: BuilderProfile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {b.companyName || "—"}
        </h3>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{b.contactPhone || ""}</span>
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {b.specialties?.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
          <Tag key={s} label={s} color="#d1fae5" />
        ))}
        {b.serviceLocations?.split(",").map((l) => l.trim()).filter(Boolean).map((l) => (
          <Tag key={l} label={l} color="#dbeafe" />
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#4b5563" }}>
        {b.teamSize != null && (
          <span>Team size: <strong>{b.teamSize}</strong></span>
        )}
        {b.minProjectBudget != null && (
          <span>Min budget: <strong>₹{Number(b.minProjectBudget).toLocaleString("en-IN")}</strong></span>
        )}
      </div>

      {/* Expand/collapse for extra info */}
      {(b.pastProjects || b.portfolioLinks) && (
        <button
          style={expandBtnStyle}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "▲ Hide details" : "▼ Show details"}
        </button>
      )}

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {b.pastProjects && (
            <div>
              <span style={detailLabel}>Past Projects</span>
              <p style={detailText}>{b.pastProjects}</p>
            </div>
          )}
          {b.portfolioLinks && (
            <div>
              <span style={detailLabel}>Portfolio Links</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {b.portfolioLinks.split(",").map((link) => link.trim()).filter(Boolean).map((link) => (
                  <a
                    key={link}
                    href={link.startsWith("http") ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "#0f766e", wordBreak: "break-all" }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {label}
    </span>
  );
}

const expandBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  color: "#0f766e",
  fontWeight: 600,
  padding: 0,
  alignSelf: "flex-start",
};

const detailLabel: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  color: "#6b7280",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 2,
};

const detailText: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.5,
};
