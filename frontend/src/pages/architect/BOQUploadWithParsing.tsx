import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";
import { apiUrl } from "../../services/api";

interface ProjectRow {
  id: string;
  name: string;
}

interface PreviewItem {
  item: string;
  qty: number | string;
  uom: string;
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
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [parsedData, setParsedData] = useState<ParsedResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const [showMappingConfirmation, setShowMappingConfirmation] = useState(false);
  const [showOverrideConfirmation, setShowOverrideConfirmation] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(apiUrl("/api/projects"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : data.projects ?? []);
      } catch (e: any) {
        setError(e.message || "Unable to load projects");
      }
    };

    loadProjects();
  }, []);

  const checkExistingBOQ = async (projectId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl(`/api/boq/${projectId}/check`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        return;
      }

      await res.json();
    } catch {
    }
  };

  const handleProjectChange = async (projectId: string) => {
    setSelectedProject(projectId);
    setParsedData(null);
    setColumnMapping({});
    setShowMappingConfirmation(false);
    setShowOverrideConfirmation(false);
    setError("");

    if (projectId) await checkExistingBOQ(projectId);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setParsedData(null);
    setColumnMapping({});
    setShowMappingConfirmation(false);
    setShowOverrideConfirmation(false);
    setError("");
  };

  const handleUploadAndParse = async () => {
    if (!selectedProject || !selectedFile) {
      setError("Please select a project and file");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("boq", selectedFile);

      const res = await fetch(apiUrl("/api/boq/parse"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Parse failed");

      const parsed: ParsedResult = {
        columns: data.columns ?? [],
        mapping: data.mapping ?? {},
        items: data.items ?? [],
        preview: data.preview ?? [],
      };

      setParsedData(parsed);
      setColumnMapping(parsed.mapping);
      setShowMappingConfirmation(true);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpload = async (override = false) => {
    if (!selectedProject || !selectedFile) {
      setError("Please select a project and file");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("boq", selectedFile);
      formData.append("columnMapping", JSON.stringify(columnMapping));

      const url = apiUrl(`/api/boq/${selectedProject}/upload${override ? "?override=true" : ""}`);

      const res = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setShowOverrideConfirmation(true);
          throw new Error(data?.error || "BOQ already exists for this project");
        }
        throw new Error(data?.error || "Upload failed");
      }

      setParsedData(null);
      setSelectedFile(null);
      setSelectedProject("");
      setColumnMapping({});
      setShowMappingConfirmation(false);
      setShowOverrideConfirmation(false);

      navigate("/architect/projects");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedWithOverride = async () => {
    setShowOverrideConfirmation(false);
    await handleConfirmUpload(true);
  };

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <h2 style={pageStyles.title}>Upload BOQ</h2>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <ConstructionIllustration type="crane" size={100} />
        </div>

        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <label style={pageStyles.field}>
            Select Project
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              style={pageStyles.select}
            >
              <option value="">-- Choose --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label style={pageStyles.field}>
            Select BOQ file
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={pageStyles.input}
            />
          </label>

          <button style={pageStyles.primaryBtn} disabled={loading} onClick={handleUploadAndParse}>
            {loading ? "Processing..." : "Parse File"}
          </button>
        </div>

        {showMappingConfirmation && parsedData && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Confirm Column Mapping</h3>
            {(["item", "qty", "uom"] as const).map((field) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <label style={pageStyles.label}>
                  {field.toUpperCase()}:
                  <select
                    value={columnMapping[field] ?? ""}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    style={{ ...pageStyles.select, marginLeft: 8 }}
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}

            {parsedData.preview.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 8 }}>Preview (First 5 Rows)</h4>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Item</th>
                      <th style={pageStyles.th}>Qty</th>
                      <th style={pageStyles.th}>UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.preview.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td style={pageStyles.td}>{row.item || "-"}</td>
                        <td style={pageStyles.td}>{row.qty || "-"}</td>
                        <td style={pageStyles.td}>{row.uom || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              style={{ ...pageStyles.primaryBtn, marginTop: 12 }}
              disabled={loading}
              onClick={() => handleConfirmUpload(false)}
            >
              {loading ? "Processing..." : "Confirm Upload"}
            </button>
          </div>
        )}

        {showOverrideConfirmation && (
          <div style={{ marginTop: 16 }}>
            <p>A BOQ already exists for this project. Override it?</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={pageStyles.primaryBtn} disabled={loading} onClick={handleProceedWithOverride}>
                {loading ? "Processing..." : "Yes, Override"}
              </button>
              <button
                style={pageStyles.secondaryBtn}
                onClick={() => setShowOverrideConfirmation(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <div style={pageStyles.error}>{error}</div>}
      </div>
    </div>
  );
};

export default BOQUploadWithParsing;
