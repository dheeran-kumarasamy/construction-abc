import { useEffect, useState } from "react";
import {
  type BasePriceItem,
  getBasePricing,
  addBasePrice,
  clearBasePricing,
} from "../../services/basePricingStore";

export default function BuilderBasePricing() {
  const [items, setItems] = useState<BasePriceItem[]>([]);

  const [form, setForm] = useState<BasePriceItem>({
    item: "",
    rate: 0,
    category: "Material",
  });

  useEffect(() => {
    setItems(getBasePricing());
  }, []);

  function handleAdd() {
    if (!form.item || form.rate <= 0) return;

    addBasePrice(form);
    setItems(getBasePricing());

    setForm({ item: "", rate: 0, category: "Material" });
  }

  function handleClear() {
    clearBasePricing();
    setItems([]);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Builder Base Pricing</h2>

        {/* Form */}
        <div style={styles.formRow}>
          <input
            placeholder="Item name"
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
            style={styles.input}
          />

          <input
            type="number"
            placeholder="Rate"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
            style={styles.input}
          />

          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as BasePriceItem["category"] })
            }
            style={styles.input}
          >
            <option>Material</option>
            <option>Labor</option>
            <option>Machinery</option>
            <option>Other</option>
          </select>

          <button onClick={handleAdd} style={styles.primaryBtn}>
            Add
          </button>
        </div>

        {/* Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Rate</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>{it.item}</td>
                <td>{it.rate}</td>
                <td>{it.category}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={handleClear} style={styles.secondaryBtn}>
          Clear All
        </button>
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
    width: "720px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto",
    gap: "8px",
  },
  input: {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
  },
  primaryBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
  },
  secondaryBtn: {
    alignSelf: "flex-end",
    background: "white",
    border: "1px solid #D1D5DB",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};
