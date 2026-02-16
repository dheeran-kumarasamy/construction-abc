import { useEffect, useState } from "react";

interface Estimate {
  builderEmail: string;
  grandTotal: number;
  submittedAt: string;
}

const STORAGE_KEY = "submitted_estimates";

export default function SubmitEstimate() {
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Pull grand total from margin engine result
    const storedTotals = sessionStorage.getItem("margin_grand_total");
    if (storedTotals) setGrandTotal(Number(storedTotals));
  }, []);

  function handleSubmit() {
    if (!grandTotal) return;

    const builderEmail = localStorage.getItem("auth_user")
      ? JSON.parse(localStorage.getItem("auth_user") as string).email
      : "unknown";

    const newEstimate: Estimate = {
      builderEmail,
      grandTotal,
      submittedAt: new Date().toISOString(),
    };

    const existing: Estimate[] = localStorage.getItem(STORAGE_KEY)
      ? JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
      : [];

    existing.push(newEstimate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    setSubmitted(true);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Submit Estimate to Architect</h2>

        {grandTotal !== null ? (
          <>
            <p>
              Grand Total: <strong>{grandTotal.toLocaleString()}</strong>
            </p>

            {!submitted ? (
              <button style={styles.primaryBtn} onClick={handleSubmit}>
                Submit Estimate
              </button>
            ) : (
              <div style={styles.success}>
                ✅ Estimate submitted successfully
              </div>
            )}
          </>
        ) : (
          <p>No calculated total found. Please complete pricing first.</p>
        )}
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
    width: "420px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    textAlign: "center",
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
  success: {
    color: "#16A34A",
    fontWeight: 600,
  },
};
