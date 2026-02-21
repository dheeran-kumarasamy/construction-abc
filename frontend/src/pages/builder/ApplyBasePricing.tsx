import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";
import { ConstructionIllustration } from "../../components/ConstructionIllustration";

interface Project {
  id: string;
  name: string;
  description: string;
  site_address: string;
  estimate_status: string | null;
}

interface BOQItem {
  id: number;
  item: string;
  qty: number;
  uom: string;
  rate: number;
  total: number;
}

interface BasePriceItem {
  item: string;
  rate: number;
  uom: string;
  category: string;
}

export default function ApplyBasePricing() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [basePricing, setBasePricing] = useState<BasePriceItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [pricedItems, setPricedItems] = useState<BOQItem[]>([]);
  const [marginPercent, setMarginPercent] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchBasePricing();
  }, []);

  async function fetchProjects() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/builder/available-projects", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error("Fetch projects error:", err);
      alert(err instanceof Error ? err.message : "Failed to fetch projects");
    }
  }

  async function fetchBasePricing() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/builder/base-pricing", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch base pricing");

      const data = await response.json();
      setBasePricing(data);
    } catch (err) {
      console.error("Fetch base pricing error:", err);
    }
  }

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    
    if (!projectId) {
      setPricedItems([]);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:4000/api/builder/projects/${projectId}/boq-items`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch BOQ items");

      const items = await response.json();
      
      // Auto-match pricing
      autoMatchPricing(items);
    } catch (err) {
      console.error("Fetch BOQ error:", err);
      alert(err instanceof Error ? err.message : "Failed to fetch BOQ");
    } finally {
      setLoading(false);
    }
  }

  function autoMatchPricing(items: BOQItem[]) {
    const matched = items.map((item) => {
      // Try to find exact match or partial match in base pricing
      const itemNameLower = item.item.toLowerCase();
      
      let match = basePricing.find(
        (bp) => bp.item.toLowerCase() === itemNameLower
      );

      if (!match) {
        // Try partial match
        match = basePricing.find((bp) =>
          itemNameLower.includes(bp.item.toLowerCase()) ||
          bp.item.toLowerCase().includes(itemNameLower)
        );
      }

      const rate = match ? match.rate : 0;
      const total = item.qty * rate;

      return {
        ...item,
        rate,
        total,
      };
    });

    setPricedItems(matched);
  }

  function handleRateChange(index: number, newRate: number) {
    const updated = [...pricedItems];
    updated[index].rate = newRate;
    updated[index].total = updated[index].qty * newRate;
    setPricedItems(updated);
  }

  async function handleSubmit() {
    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    if (pricedItems.some((item) => item.rate === 0)) {
      const confirm = window.confirm(
        "Some items have zero rate. Do you want to continue?"
      );
      if (!confirm) return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:4000/api/builder/projects/${selectedProjectId}/estimate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pricedItems,
            marginPercent,
            notes,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to submit estimate");

      const result = await response.json();
      alert(
        `Estimate submitted successfully!\nRevision: ${result.revisionNumber}\nGrand Total: ₹${result.grandTotal.toFixed(2)}`
      );

      // Refresh projects to update status
      fetchProjects();
      
      // Clear form
      setSelectedProjectId("");
      setPricedItems([]);
      setMarginPercent(0);
      setNotes("");
    } catch (err) {
      console.error("Submit estimate error:", err);
      alert(err instanceof Error ? err.message : "Failed to submit estimate");
    } finally {
      setLoading(false);
    }
  }

  const subtotal = pricedItems.reduce((sum, item) => sum + item.total, 0);
  const margin = (subtotal * marginPercent) / 100;
  const grandTotal = subtotal + margin;

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(1200px, 100%)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
          <h2 style={pageStyles.title}>Apply Base Pricing to Project</h2>
          <div style={{ width: "120px", opacity: 0.7 }}>
            <ConstructionIllustration type="blueprint" />
          </div>
        </div>

        {/* Project Selection */}
        <div style={{ marginBottom: "2rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#0f766e",
              fontWeight: 500,
            }}
          >
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{ ...pageStyles.select, width: "100%" }}
          >
            <option value="">-- Select a Project --</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name} - {proj.site_address}
                {proj.estimate_status ? ` (${proj.estimate_status})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading...</p>
        )}

        {!loading && pricedItems.length > 0 && (
          <>
            {/* BOQ Items with Pricing */}
            <h3 style={{ ...pageStyles.subtitle, marginTop: "2rem" }}>
              BOQ Items & Pricing
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Quantity</th>
                    <th>UOM</th>
                    <th>Rate (₹)</th>
                    <th>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.item}</td>
                      <td>{item.qty}</td>
                      <td>{item.uom}</td>
                      <td>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            handleRateChange(index, Number(e.target.value))
                          }
                          style={{
                            ...pageStyles.input,
                            width: "120px",
                            padding: "0.5rem",
                          }}
                        />
                      </td>
                      <td>{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div
              style={{
                marginTop: "2rem",
                padding: "1.5rem",
                backgroundColor: "#f0fdfa",
                borderRadius: "8px",
                border: "1px solid #ccfbf1",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  maxWidth: "600px",
                  marginLeft: "auto",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#0f766e",
                      fontWeight: 500,
                    }}
                  >
                    Subtotal:
                  </label>
                  <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f766e" }}>
                    ₹{subtotal.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#0f766e",
                      fontWeight: 500,
                    }}
                  >
                    Margin (%)
                  </label>
                  <input
                    type="number"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(Number(e.target.value))}
                    style={pageStyles.input}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#0f766e",
                      fontWeight: 500,
                    }}
                  >
                    Margin Amount:
                  </label>
                  <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f766e" }}>
                    ₹{margin.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#0f766e",
                      fontWeight: 500,
                    }}
                  >
                    Grand Total:
                  </label>
                  <p
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "#0f766e",
                    }}
                  >
                    ₹{grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#0f766e",
                    fontWeight: 500,
                  }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the architect..."
                  rows={3}
                  style={{
                    ...pageStyles.input,
                    width: "100%",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: "2rem", textAlign: "center" }}>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  ...pageStyles.primaryBtn,
                  fontSize: "1.125rem",
                  padding: "0.875rem 2rem",
                  ...(loading ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}
              >
                {loading ? "Submitting..." : "Submit Estimate to Architect"}
              </button>
            </div>
          </>
        )}

        {!loading && selectedProjectId && pricedItems.length === 0 && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            No BOQ items found for this project.
          </p>
        )}

        {!selectedProjectId && !loading && (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "2rem" }}>
            Please select a project to start applying base pricing.
          </p>
        )}
      </div>
    </div>
  );
}
