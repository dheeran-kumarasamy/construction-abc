import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseBOQFile } from "../../services/excelParser";

export default function BOQUploadWithParsing() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);

    try {
      const result = await parseBOQFile(file);

      // Store parsed data temporarily in sessionStorage
      sessionStorage.setItem("boqHeaders", JSON.stringify(result.headers));
      sessionStorage.setItem("boqRows", JSON.stringify(result.rows));

      navigate("/architect/boq-mapping");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Upload BOQ</h2>
        <p style={styles.subtext}>Upload Excel or CSV to begin mapping.</p>

        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />

        {loading && <div>Parsing file...</div>}
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8F9FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    padding: "32px",
    borderRadius: "16px",
    width: "480px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  subtext: {
    fontSize: "14px",
    color: "#6B7280",
  },
  error: {
    color: "#DC2626",
  },
};
