import { useEffect, useState } from "react";
import {
  type BasePriceItem,
  getBasePricing,
  addBasePrice,
  clearBasePricing,
} from "../../services/basePricingStore";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(900px, 100%)" }}>
        <h2 style={pageStyles.title}>Builder Base Pricing</h2>

        {/* Form */}
        <div style={pageStyles.formGrid}>
          <input
            placeholder="Item name"
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
            style={pageStyles.input}
          />

          <input
            type="number"
            placeholder="Rate"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
            style={pageStyles.input}
          />

          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as BasePriceItem["category"] })
            }
            style={pageStyles.select}
          >
            <option>Material</option>
            <option>Labor</option>
            <option>Machinery</option>
            <option>Other</option>
          </select>

          <button onClick={handleAdd} style={pageStyles.primaryBtn}>
            Add
          </button>
        </div>

        {/* Table */}
        <table style={pageStyles.table}>
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

        <button onClick={handleClear} style={pageStyles.secondaryBtn}>
          Clear All
        </button>
      </div>
    </div>
  );
}
