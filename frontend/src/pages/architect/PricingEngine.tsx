import { useEffect, useState } from "react";
import ExportButtons from "../../components/ExportButtons";
import { pageStyles } from "../../layouts/pageStyles";

interface BOQRow {
  [key: string]: any;
}

interface Totals {
  material: number;
  labor: number;
  machinery: number;
  other: number;
  grandTotal: number;
}

export default function PricingEngine() {
  const [rows, setRows] = useState<BOQRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    material: 0,
    labor: 0,
    machinery: 0,
    other: 0,
    grandTotal: 0,
  });

  const [margin, setMargin] = useState<number>(10);

  useEffect(() => {
    const storedRows = sessionStorage.getItem("boqRows");

    if (storedRows) {
      const parsed: BOQRow[] = JSON.parse(storedRows);
      setRows(parsed);
      calculateTotals(parsed, margin);
    }
  }, []);

  function calculateTotals(data: BOQRow[], marginPercent: number) {
    let material = 0;
    let labor = 0;
    let machinery = 0;
    let other = 0;

    data.forEach((row) => {
      const qty = Number(row.Quantity || row.Qty || 0);
      const rate = Number(row.Rate || row["Unit Price"] || 0);
      const category = String(row.Category || "Material").toLowerCase();

      const value = qty * rate;

      if (category.includes("labor")) labor += value;
      else if (category.includes("mach")) machinery += value;
      else if (category.includes("other")) other += value;
      else material += value;
    });

    const subtotal = material + labor + machinery + other;
    const grandTotal = subtotal * (1 + marginPercent / 100);

    setTotals({ material, labor, machinery, other, grandTotal });
  }

  function handleMarginChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    setMargin(value);
    calculateTotals(rows, value);
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(640px, 100%)" }}>
        <h2 style={pageStyles.title}>Pricing Summary</h2>

        <div style={pageStyles.marginRow}>
          <label>Overall Margin (%)</label>
          <input
            type="number"
            value={margin}
            onChange={handleMarginChange}
            style={pageStyles.inputSm}
          />
        </div>

        <table style={pageStyles.table}>
          <tbody>
            <tr>
              <td>Material</td>
              <td>{totals.material.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Labor</td>
              <td>{totals.labor.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Machinery</td>
              <td>{totals.machinery.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Other</td>
              <td>{totals.other.toFixed(2)}</td>
            </tr>
            <tr style={pageStyles.grandRow}>
              <td>Grand Total</td>
              <td>{totals.grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <ExportButtons totals={totals} />
      </div>
    </div>
  );
}

// remove local styles object