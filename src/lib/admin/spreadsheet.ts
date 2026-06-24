import ExcelJS from "exceljs";

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** First worksheet → CSV text (admin uploads). */
export async function excelBufferToCsvText(buffer: ArrayBuffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("This spreadsheet has no sheets.");

  const lines: string[] = [];
  sheet.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    lines.push(values.map(escapeCsvCell).join(","));
  });
  return lines.join("\n");
}

/** JSON rows → XLSX download buffer (admin exports). */
export async function jsonRowsToXlsxBuffer(
  rows: Record<string, string>[],
  sheetName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  if (rows.length === 0) {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  const headers = Object.keys(rows[0]!);
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((key) => row[key] ?? ""));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
