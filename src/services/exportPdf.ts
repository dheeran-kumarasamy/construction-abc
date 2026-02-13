// PDF export using pdf-lib
// Install first: npm install pdf-lib

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function exportEstimatePDF(totals: {
  material: number;
  labor: number;
  machinery: number;
  other: number;
  grandTotal: number;
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { height } = page.getSize();

    let y = height - 40;

    function drawText(text: string, size = 12) {
      page.drawText(text, {
        x: 50,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 20;
    }

    drawText("Construction Estimate Summary", 18);
    y -= 10;

    drawText(`Material: ${totals.material.toFixed(2)}`);
    drawText(`Labor: ${totals.labor.toFixed(2)}`);
    drawText(`Machinery: ${totals.machinery.toFixed(2)}`);
    drawText(`Other: ${totals.other.toFixed(2)}`);

    y -= 10;
    drawText(`Grand Total: ${totals.grandTotal.toFixed(2)}`, 14);

    const pdfBytes = await pdfDoc.save();

    // Create blob from PDF bytes - convert to regular array to avoid type issues
    const bytesArray = Array.from(pdfBytes);
    const blob = new Blob([new Uint8Array(bytesArray)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error("PDF export error:", error);
    throw error;
  }
}
