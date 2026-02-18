import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(520px, 100%)" }}>
        <h2 style={pageStyles.title}>Submit Estimate to Architect</h2>

        {grandTotal !== null ? (
          <>
            <p>
              Grand Total: <strong>{grandTotal.toLocaleString()}</strong>
            </p>

            {!submitted ? (
              <button style={pageStyles.primaryBtn} onClick={handleSubmit}>
                Submit Estimate
              </button>
            ) : (
              <div style={pageStyles.success}>
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

// remove local styles object
