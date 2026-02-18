import { useEffect, useState } from "react";
import { getBasePricing, type BasePriceItem } from "../../services/basePricingStore";
import { pageStyles } from "../../layouts/pageStyles";

interface BOQRow {
  [key: string]: any;
  rate?: number;
  category?: string;
  total?: number;
}

export default function ApplyBasePricing() {
  const [rows, setRows] = useState<BOQRow[]>([]);
  const [pricing, setPricing] = useState<BasePriceItem[]>([]);

  useEffect(() => {
    const storedRows = sessionStorage.getItem("boqRows");
    if (storedRows) setRows(JSON.parse(storedRows));

    setPricing(getBasePricing());
  }, []);

  function applyPricing() {
    const updated = rows.map((row) => {
      const itemName = String(row.Item || row.Description || "").toLowerCase();

      const match = pricing.find((p) =>
        itemName.includes(p.item.toLowerCase())
      );

      if (!match) return row;

      const qty = Number(row.Quantity || row.Qty || 0);
      const total = qty * match.rate;

      return {
        ...row,
        rate: match.rate,
        category: match.category,
        total,
      };
    });

    setRows(updated);
    sessionStorage.setItem("pricedRows", JSON.stringify(updated));
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <h2 style={pageStyles.title}>Apply Base Pricing</h2>

        <button style={pageStyles.primaryBtn} onClick={applyPricing}>
          Apply Stored Pricing
        </button>

        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Category</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.Item || r.Description}</td>
                <td>{r.Quantity || r.Qty}</td>
                <td>{r.rate ?? "-"}</td>
                <td>{r.category ?? "-"}</td>
                <td>{r.total ? r.total.toFixed(2) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
