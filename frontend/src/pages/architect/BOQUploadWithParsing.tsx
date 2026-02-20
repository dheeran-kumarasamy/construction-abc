
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseBOQFile } from "../../services/excelParser";
import { pageStyles } from "../../layouts/pageStyles";


interface ProjectRow {
  id: string; // UUID
  name: string;
}

const BOQUploadWithParsing = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f || null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select a file.");
      return;
    }
    if (!selectedProject) {
      setError("Please select a project.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("boq", file); // 'boq' must match backend multer.single("boq")
      const token = localStorage.getItem("token");
      // Use projectId as string (UUID)
      const projectId = selectedProject;
      if (!projectId) {
        setError("Invalid project ID.");
        setLoading(false);
        return;
      }
      const res = await fetch(`http://localhost:4000/api/boq/${projectId}/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      // Optionally parse for mapping after upload
      const parsed = await parseBOQFile(file);
      sessionStorage.setItem("boqHeaders", JSON.stringify(parsed.headers));
      sessionStorage.setItem("boqRows", JSON.stringify(parsed.rows));
      sessionStorage.setItem("boqProjectId", projectId);
      navigate("/architect/boq-mapping");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(520px, 100%)" }}>
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

        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />

        <button
          style={{ ...pageStyles.primaryBtn, marginTop: 16 }}
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload BOQ"}
        </button>

        {loading && <div>Uploading and parsing file...</div>}
        {error && <div style={pageStyles.error}>{error}</div>}
      </div>
    </div>
  );
};

export default BOQUploadWithParsing;
