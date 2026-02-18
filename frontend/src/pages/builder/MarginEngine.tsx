import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

interface PricedRow {
  item?: string;
  category?: string;
  total?: number;
}

interface Totals {
  material: number;
  labor: number;
  machinery: number;
  other: number;
  grandTotal: number;
}

export default function MarginEngine() {
  const [rows, setRows] = useState<PricedRow[]>([]);

  const [overallMargin, setOverallMargin] = useState(10);
  const [laborUplift, setLaborUplift] = useState(5);
  const [machineryUplift, setMachineryUplift] = useState(5);

  const [totals, setTotals] = useState<Totals>({
    material: 0,
    labor: 0,
    machinery: 0,
    other: 0,
    grandTotal: 0,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem("pricedRows");
    const storedMargin = sessionStorage.getItem("overallMargin");
    const storedLaborUplift = sessionStorage.getItem("laborUplift");
    const storedMachineryUplift = sessionStorage.getItem("machineryUplift");
    
    // Load stored values or use defaults (10, 5, 5) and save them
    const defaultMargin = 10;
    const defaultLaborUplift = 5;
    const defaultMachineryUplift = 5;
    
    const margin = storedMargin ? Number(storedMargin) : defaultMargin;
    const laborUp = storedLaborUplift ? Number(storedLaborUplift) : defaultLaborUplift;
    const machUp = storedMachineryUplift ? Number(storedMachineryUplift) : defaultMachineryUplift;
    
    if (!storedMargin) sessionStorage.setItem("overallMargin", String(defaultMargin));
    if (!storedLaborUplift) sessionStorage.setItem("laborUplift", String(defaultLaborUplift));
    if (!storedMachineryUplift) sessionStorage.setItem("machineryUplift", String(defaultMachineryUplift));
    
    setOverallMargin(margin);
    setLaborUplift(laborUp);
    setMachineryUplift(machUp);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      setRows(parsed);
      calculate(parsed, margin, laborUp, machUp);
    }
  }, []);

  function calculate(
    data: PricedRow[],
    margin: number,
    laborUp: number,
    machUp: number
  ) {
    let material = 0;
    let labor = 0;
    let machinery = 0;
    let other = 0;

    data.forEach((r) => {
      const value = Number(r.total || 0);
      const cat = String(r.category || "Material").toLowerCase();

      if (cat.includes("labor")) labor += value;
      else if (cat.includes("mach")) machinery += value;
      else if (cat.includes("other")) other += value;
      else material += value;
    });

    // Apply uplifts
    labor = labor * (1 + laborUp / 100);
    machinery = machinery * (1 + machUp / 100);

    const subtotal = material + labor + machinery + other;
    const grandTotal = subtotal * (1 + margin / 100);

    const calculatedTotals = { material, labor, machinery, other, grandTotal };
    setTotals(calculatedTotals);
    
    // Save totals to sessionStorage for dashboard display
    sessionStorage.setItem("calculatedTotals", JSON.stringify(calculatedTotals));
  }

  function recalc(
    newMargin = overallMargin,
    newLabor = laborUplift,
    newMach = machineryUplift
  ) {
    calculate(rows, newMargin, newLabor, newMach);
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(720px, 100%)" }}>
        <h2 style={pageStyles.title}>Margin & Uplift Engine</h2>

        <div style={pageStyles.controls}>
          <label>
            Overall Margin %
            <input
              type="number"
              value={overallMargin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOverallMargin(v);
                sessionStorage.setItem("overallMargin", String(v));
                recalc(v, laborUplift, machineryUplift);
              }}
              style={pageStyles.inputSm}
            />
          </label>

          <label>
            Labor Uplift %
            <input
              type="number"
              value={laborUplift}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLaborUplift(v);
                sessionStorage.setItem("laborUplift", String(v));
                recalc(overallMargin, v, machineryUplift);
              }}
              style={pageStyles.inputSm}
            />
          </label>

          <label>
            Machinery Uplift %
            <input
              type="number"
              value={machineryUplift}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMachineryUplift(v);
                sessionStorage.setItem("machineryUplift", String(v));
                recalc(overallMargin, laborUplift, v);
              }}
              style={pageStyles.inputSm}
            />
          </label>
        </div>

        <table style={pageStyles.table}>
          <tbody>
            <tr>
              <td>Material</td>
              <td>{totals.material.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Labor (with uplift)</td>
              <td>{totals.labor.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Machinery (with uplift)</td>
              <td>{totals.machinery.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Other</td>
              <td>{totals.other.toFixed(2)}</td>
            </tr>
            <tr style={pageStyles.grandRow}>
              <td>Grand Total (with margin)</td>
              <td>{totals.grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}