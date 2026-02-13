import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateProject() {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [confirmDollar, setConfirmDollar] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    if (currency === "USD" && !confirmDollar) {
      setError("Please confirm the dollar currency selection");
      return;
    }

    // Temporary: simulate save
    console.log({ projectName, currency });

    // Navigate to architect dashboard after creation
    navigate("/architect");
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Create Project</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Project Name */}
          <div style={styles.field}>
            <label>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={styles.input}
              placeholder="Enter project name"
            />
          </div>

          {/* Currency */}
          <div style={styles.field}>
            <label>Currency</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setConfirmDollar(false);
              }}
              style={styles.input}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {/* Dollar Confirmation */}
          {currency === "USD" && (
            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={confirmDollar}
                onChange={(e) => setConfirmDollar(e.target.checked)}
              />
              <span>Confirm project currency is US Dollar</span>
            </div>
          )}

          {/* Error */}
          {error && <div style={styles.error}>{error}</div>}

          {/* Actions */}
          <div style={styles.actions}>
            <button type="button" onClick={() => navigate(-1)} style={styles.secondaryBtn}>
              Cancel
            </button>

            <button type="submit" style={styles.primaryBtn}>
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Styles ---
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
    width: "420px",
    border: "1px solid #E5E7EB",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
    fontSize: "14px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
  },
  error: {
    color: "#DC2626",
    fontSize: "13px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "8px",
  },
  primaryBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryBtn: {
    background: "white",
    border: "1px solid #D1D5DB",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
  },
};
