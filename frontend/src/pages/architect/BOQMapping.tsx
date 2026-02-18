import { useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(600px, 100%)" }}>
        <h2 style={pageStyles.title}>BOQ Column Mapping</h2>
        <p style={pageStyles.subtext}>Match your spreadsheet columns to the required BOQ fields.</p>

        {REQUIRED_FIELDS.map((field) => (
          <div key={field} style={pageStyles.formRow}>
            <label style={{ ...pageStyles.label, width: "120px" }}>{field}</label>

            <select
              value={mapping[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              style={pageStyles.select}
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

        {error && <div style={pageStyles.error}>{error}</div>}

        <div style={pageStyles.actions}>
          <button style={pageStyles.primaryBtn} onClick={handleApprove}>
            Approve Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
