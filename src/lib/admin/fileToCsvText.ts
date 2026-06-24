/**
 * Turn an uploaded spreadsheet into CSV text for existing import APIs.
 * - .csv / plain text: read as UTF-8 (strip BOM).
 * - .xlsx: first sheet only via ExcelJS (lazy-loaded).
 */
export async function fileToCsvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type || "";

  const looksCsv =
    name.endsWith(".csv") ||
    type === "text/csv" ||
    type === "text/plain" ||
    type === "application/csv";

  if (looksCsv) {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text;
  }

  const looksExcel =
    name.endsWith(".xlsx") ||
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (looksExcel) {
    const buf = await file.arrayBuffer();
    const { excelBufferToCsvText } = await import("@/lib/admin/spreadsheet");
    return excelBufferToCsvText(buf);
  }

  if (name.endsWith(".xls") || type === "application/vnd.ms-excel") {
    throw new Error("Legacy .xls files are not supported. Save as .xlsx or .csv and try again.");
  }

  throw new Error("Unsupported file type. Use .csv or .xlsx.");
}
