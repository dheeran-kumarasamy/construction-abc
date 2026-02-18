import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateProject() {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(1);

  const [currency, setCurrency] = useState("INR");
  const [confirmDollar, setConfirmDollar] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    if (!siteAddress.trim()) {
      setError("Site address is required");
      return;
    }

    if (!startDate) {
      setError("Start date is required");
      return;
    }

    if (!durationMonths || durationMonths < 1) {
      setError("Duration must be at least 1 month");
      return;
    }

    if (currency === "USD" && !confirmDollar) {
      setError("Please confirm the dollar currency selection");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:4000/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: projectName,
          description: description.trim() || undefined,
          siteAddress,
          startDate,
          durationMonths,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      navigate("/architect/projects");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Create Project</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={styles.input}
              placeholder="Enter project name"
              required
            />
          </div>

          <div style={styles.field}>
            <label>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.input}
              placeholder="Short description"
            />
          </div>

          <div style={styles.field}>
            <label>Site Address</label>
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              style={styles.input}
              placeholder="Enter site address"
              required
            />
          </div>

          <div style={styles.field}>
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label>Duration (months)</label>
            <input
              type="number"
              min={1}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              style={styles.input}
              required
            />
          </div>

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

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={styles.secondaryBtn}
              disabled={loading}
            >
              Cancel
            </button>

            <button type="submit" style={styles.primaryBtn} disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
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
