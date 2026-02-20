import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(520px, 100%)" }}>
        <h2 style={pageStyles.title}>Create Project</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={pageStyles.input}
              placeholder="Enter project name"
              required
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={pageStyles.input}
              placeholder="Short description"
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Site Address</label>
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              style={pageStyles.input}
              placeholder="Enter site address"
              required
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={pageStyles.input}
              required
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Duration (months)</label>
            <input
              type="number"
              min={1}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              style={pageStyles.input}
              required
            />
          </div>

          <div style={pageStyles.field}>
            <label style={pageStyles.label}>Currency</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setConfirmDollar(false);
              }}
              style={pageStyles.input}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {currency === "USD" && (
            <div style={pageStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={confirmDollar}
                onChange={(e) => setConfirmDollar(e.target.checked)}
              />
              <span>Confirm project currency is US Dollar</span>
            </div>
          )}

          {error && <div style={pageStyles.error}>{error}</div>}

          <div style={pageStyles.actions}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={pageStyles.secondaryBtn}
              disabled={loading}
            >
              Cancel
            </button>

            <button type="submit" style={pageStyles.primaryBtn} disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
