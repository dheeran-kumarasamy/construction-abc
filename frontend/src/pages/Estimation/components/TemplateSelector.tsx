import { useState, useEffect } from "react";
import { pageStyles } from "../../../layouts/pageStyles";
import * as api from "../estimation.api";
import type { RateTemplate } from "../types";

interface Props {
  onSelect: (template: RateTemplate) => void;
  onClose: () => void;
}

const CATEGORIES = [
  "All", "Earthwork", "Concrete Work", "Masonry", "Plastering",
  "Flooring", "Painting", "Steel Work", "Formwork",
  "Waterproofing", "Plumbing", "Roofing", "Demolition",
];

export default function TemplateSelector({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api.fetchTemplates(
          category !== "All" ? { category } : undefined
        );
        setTemplates(data);
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select Rate Template</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>×</button>
      </div>

      <input
        style={{ ...pageStyles.input, height: 34, fontSize: 13, marginBottom: 8 }}
        placeholder="Search templates..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
              border: "1px solid var(--border)",
              background: category === cat ? "var(--accent)" : "transparent",
              color: category === cat ? "#fff" : "var(--ink)",
              fontWeight: category === cat ? 600 : 400,
            }}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No templates found</p>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelect(t)}
              style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                border: "1px solid var(--border)", marginBottom: 6,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", fontFamily: "monospace" }}>{t.code}</span>
                <span style={{ fontSize: 10, color: "var(--muted)", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{t.unit}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.4 }}>{t.name}</p>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {t.category}{t.sub_category ? ` / ${t.sub_category}` : ""} — OH {t.overhead_percent}% / P {t.profit_percent}% / GST {t.gst_percent}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
