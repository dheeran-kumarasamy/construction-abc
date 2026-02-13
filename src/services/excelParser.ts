// Excel parsing service using SheetJS (xlsx)
// Install first:
// npm install xlsx

import * as XLSX from "xlsx";

export interface ParsedBOQ {
  headers: string[];
  rows: Record<string, any>[];
}

export function parseBOQFile(file: File): Promise<ParsedBOQ> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        const headers = Object.keys(json[0] || {});

        resolve({ headers, rows: json });
      } catch (err) {
        reject("Failed to parse Excel file");
      }
    };

    reader.onerror = () => reject("File reading error");

    reader.readAsArrayBuffer(file);
  });
}
