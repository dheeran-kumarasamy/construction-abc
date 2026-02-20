import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";


interface ProjectRow {
  id: string; // UUID
  name: string;
}

interface PreviewItem {
  item: string;
  qty: number | string;
  uom: string;
  rate?: string;
}

interface ParsedResult {
  columns: string[];
  mapping: Record<string, string>;
  items: PreviewItem[];
  preview: PreviewItem[];
}

const BOQUploadWithParsing = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [showMappingConfirmation, setShowMappingConfirmation] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:4000/projects", {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (res.ok) setProjects(data);
      } catch {}
    }
    loadProjects();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setParsedData(null);
    setShowMappingConfirmation(false);
    setError("");
    
    if (!selectedFile) return;
    
    if (!selectedProject) {
      setError("Please select a project first");
      return;
    }
    
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("boq", selectedFile);
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:4000/api/boq/parse", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse BOQ file");
      }

      setParsedData(data);
      setColumnMapping(data.mapping || {});
      setShowMappingConfirmation(true);
    } catch (err: any) {
      setParsedData(null);
      setError(err.message || "Failed to parse BOQ file");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!file || !selectedProject) return;
    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("boq", file);
      formData.append("columnMapping", JSON.stringify(columnMapping));
      
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:4000/api/boq/${selectedProject}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setParsedData(null);
      setFile(null);
      setSelectedProject("");
      setShowMappingConfirmation(false);
      navigate("/architect/projects");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(720px, 100%)" }}>
        <h2 style={pageStyles.title}>Upload BOQ</h2>
        <p style={pageStyles.subtext}>Select a project and upload Excel or CSV.</p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>Project:</label>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            style={pageStyles.select}
          >
            <option value="">Select project</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>

        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />

        {showMappingConfirmation && parsedData && (
          <div style={{ margin: "24px 0", padding: "16px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h3 style={{ marginBottom: 16 }}>Confirm Column Mapping</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              We detected the following columns in your file. Please confirm or adjust the mapping:
            </p>

            <div style={{ display: "grid", gap: "12px", marginBottom: 16 }}>
              {["item", "qty", "uom", "rate"].map(field => (
                <div key={field} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <label style={{ minWidth: "100px", fontWeight: 500, textTransform: "capitalize" }}>
                    {field === "qty" ? "Quantity" : field === "uom" ? "Unit (UOM)" : field}:
                  </label>
                  <select
                    value={columnMapping[field] || ""}
                    onChange={e => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    style={{ ...pageStyles.select, flex: 1 }}
                  >
                    <option value="">-- Not mapped --</option>
                    {parsedData.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {parsedData.preview.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 8 }}>Preview (First 5 Rows)</h4>
                <table style={{ ...pageStyles.table, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Item</th>
                      <th style={pageStyles.th}>Quantity</th>
                      <th style={pageStyles.th}>UOM</th>
                      <th style={pageStyles.th}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.preview.map((row, idx) => (
                      <tr key={idx} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                        <td style={pageStyles.td}>{row.item || "-"}</td>
                        <td style={pageStyles.td}>{row.qty || "-"}</td>
                        <td style={pageStyles.td}>{row.uom || "-"}</td>
                        <td style={pageStyles.td}>{row.rate || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: "12px" }}>
              <button
                style={{ ...pageStyles.primaryBtn }}
                onClick={handleConfirmUpload}
                disabled={loading || !columnMapping.item || !columnMapping.qty || !columnMapping.uom}
              >
                {loading ? "Uploading..." : "Confirm & Upload"}
              </button>
              <button
                style={{ ...pageStyles.secondaryBtn }}
                onClick={() => {
                  setShowMappingConfirmation(false);
                  setParsedData(null);
                  setFile(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <div>Processing file...</div>}
        {error && <div style={pageStyles.error}>{error}</div>}
      </div>
    </div>
  );
};

export default BOQUploadWithParsing;
