import { exportEstimatePDF } from "../services/exportPdf";

interface Props {
  totals: {
    material: number;
    labor: number;
    machinery: number;
    other: number;
    grandTotal: number;
  };
}

export default function ExportButtons({ totals }: Props) {
  async function handleExportPDF() {
    try {
      await exportEstimatePDF(totals);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    }
  }

  return (
    <div style={styles.row}>
      <button style={styles.primary} onClick={handleExportPDF}>
        Export PDF
      </button>

      <button style={styles.secondary} onClick={() => exportExcel(totals)}>
        Export Excel
      </button>
    </div>
  );
}

// Simple Excel export (CSV for MVP)
function exportExcel(totals: Props["totals"]) {
  const rows = [
    ["Category", "Amount"],
    ["Material", totals.material],
    ["Labor", totals.labor],
    ["Machinery", totals.machinery],
    ["Other", totals.other],
    ["Grand Total", totals.grandTotal],
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "estimate.csv";
  a.click();

  URL.revokeObjectURL(url);
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  primary: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondary: {
    background: "white",
    border: "1px solid #D1D5DB",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
  },
};
