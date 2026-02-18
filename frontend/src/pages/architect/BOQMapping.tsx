import { useState } from "react";

// NOTE: Excel parsing library (SheetJS) will be connected in the next step.
// This screen focuses on column detection + user mapping UI.

const REQUIRED_FIELDS = ["Item", "Quantity", "Unit", "Rate"] as const;

type Field = (typeof REQUIRED_FIELDS)[number];

export default function BOQMapping() {
  // Simulated detected columns (will come from Excel later)
  const [detectedColumns] = useState<string[]>([
    "Description",
    "Qty",
    "UOM",
    "Unit Price",
  ]);

  const [mapping, setMapping] = useState<Record<Field, string | "">>({
    Item: "",
    Quantity: "",
    Unit: "",
    Rate: "",
  });

  const [error, setError] = useState<string>("");

  function handleChange(field: Field, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value }));
  }

  function handleApprove() {
    const incomplete = REQUIRED_FIELDS.some((f) => !mapping[f]);

    if (incomplete) {
      setError("Please map all required fields before approving.");
      return;
    }

    setError("");

    // Future: save mapping + continue to pricing engine
    console.log("Approved mapping:", mapping);

    window.location.href = "/architect/pricing";
}

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>BOQ Column Mapping</h2>
        <p style={styles.subtext}>
          Match your spreadsheet columns to the required BOQ fields.
        </p>

        {REQUIRED_FIELDS.map((field) => (
          <div key={field} style={styles.row}>
            <label style={styles.label}>{field}</label>

            <select
              value={mapping[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              style={styles.select}
            >
              <option value="">Select column</option>
              {detectedColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        ))}

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={handleApprove}>
            Approve Mapping
          </button>
        </div>
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
    width: "520px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  subtext: {
    fontSize: "14px",
    color: "#6B7280",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  label: {
    fontWeight: 600,
    width: "120px",
  },
  select: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
  },
  error: {
    color: "#DC2626",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
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
};
