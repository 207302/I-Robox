import { readFile } from "fs/promises";
import path from "path";
import type { PDFDocument, PDFImage } from "pdf-lib";

const BRAND_LOGO_CANDIDATES = [
  path.join(process.cwd(), "public", "images", "favicon.png"),
  path.join(process.cwd(), "public", "images", "logo", "logo.png"),
];

export async function embedInvoiceBrandLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  for (const filePath of BRAND_LOGO_CANDIDATES) {
    try {
      const bytes = await readFile(filePath);
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        // Not PNG — skip (favicon/logo are PNG in this project).
      }
    } catch {
      // File missing — try next candidate.
    }
  }
  return null;
}
