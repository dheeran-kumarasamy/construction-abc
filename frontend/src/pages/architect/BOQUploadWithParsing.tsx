import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseBOQFile } from "../../services/excelParser";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(520px, 100%)" }}>
        <h2 style={pageStyles.title}>Upload BOQ</h2>
        <p style={pageStyles.subtext}>Upload Excel or CSV to begin mapping.</p>

        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />

        {loading && <div>Parsing file...</div>}
        {error && <div style={pageStyles.error}>{error}</div>}
      </div>
    </div>
  );
}
