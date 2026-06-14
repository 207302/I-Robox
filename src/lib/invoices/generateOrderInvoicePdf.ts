import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { embedInvoiceBrandLogo } from "@/lib/invoices/invoiceBrandLogo";

const SELLER_NAME = "I-Robox";
const SELLER_EMAIL = "info@i-robox.com";
const SELLER_GSTIN = process.env.SELLER_GSTIN || process.env.SHIPMOZO_GSTIN || "";

export type OrderInvoicePdf = {
  filename: string;
  data: Uint8Array;
};

function formatDateDdMmYy(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function compactNameForFile(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || "Customer";
}

function money(n: number) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toWordsUnder1000(n: number): string {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  return `${ones[Math.floor(n / 100)]} HUNDRED${n % 100 ? ` ${toWordsUnder1000(n % 100)}` : ""}`;
}

function numberToWordsInr(n: number): string {
  const value = Math.max(0, Math.floor(n));
  if (value === 0) return "ZERO RUPEES ONLY";
  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${toWordsUnder1000(crore)} CRORE`);
  if (lakh) parts.push(`${toWordsUnder1000(lakh)} LAKH`);
  if (thousand) parts.push(`${toWordsUnder1000(thousand)} THOUSAND`);
  if (rest) parts.push(toWordsUnder1000(rest));
  return `${parts.join(" ")} RUPEES ONLY`;
}

function drawLine(
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

const orderInvoiceSelect = {
  id: true,
  order_number: true,
  created_at: true,
  total_amount: true,
  order_items: {
    select: {
      id: true,
      product_id: true,
      product_name: true,
      quantity: true,
      unit_price: true,
      subtotal_amount: true,
    },
  },
  customers: { select: { email: true, phone: true } },
  addresses_orders_billing_address_idToaddresses: {
    select: {
      full_name: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postal_code: true,
      country: true,
    },
  },
  addresses_orders_shipping_address_idToaddresses: {
    select: {
      full_name: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postal_code: true,
      country: true,
    },
  },
} as const;

export async function generateOrderInvoicePdf(orderId: string): Promise<OrderInvoicePdf | null> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: orderInvoiceSelect,
  });
  if (!order) return null;

  const hsnByProductId = new Map<string, string>();
  const productIds = Array.from(new Set(order.order_items.map((i) => i.product_id)));
  if (productIds.length > 0) {
    const productRows = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, hsn_code: true },
    });
    for (const row of productRows) hsnByProductId.set(row.id, row.hsn_code ?? "--");
  }

  const billing = order.addresses_orders_billing_address_idToaddresses;
  const shipping = order.addresses_orders_shipping_address_idToaddresses;
  const customerName = billing?.full_name || shipping?.full_name || "Customer";
  const customerPhone = billing?.phone || shipping?.phone || order.customers?.phone || "";
  const customerEmail = order.customers?.email || "";
  const filename = `Invoice_${compactNameForFile(customerName)}.pdf`;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const brandLogo = await embedInvoiceBrandLogo(pdfDoc);
  const { height, width } = page.getSize();
  let y = height - 40;

  const drawText = (text: string, x: number, yy: number, opts?: { bold?: boolean; size?: number }) => {
    page.drawText(text, {
      x,
      y: yy,
      font: opts?.bold ? fontBold : font,
      size: opts?.size ?? 10,
      color: rgb(0, 0, 0),
    });
  };

  const drawWrapped = (
    text: string,
    x: number,
    yy: number,
    maxWidth: number,
    opts?: { bold?: boolean; size?: number; lineHeight?: number }
  ) => {
    const size = opts?.size ?? 10;
    const lineHeight = opts?.lineHeight ?? size + 2;
    const useBold = Boolean(opts?.bold);
    const useFont = useBold ? fontBold : font;
    const lines = wrapText(text, useFont, size, maxWidth);
    let cy = yy;
    for (const line of lines) {
      drawText(line, x, cy, { bold: useBold, size });
      cy -= lineHeight;
    }
    return cy;
  };

  const drawRightAligned = (
    text: string,
    rightEdge: number,
    yy: number,
    opts?: { bold?: boolean; size?: number; lineHeight?: number }
  ) => {
    const size = opts?.size ?? 10;
    const lineHeight = opts?.lineHeight ?? size + 2;
    const useBold = Boolean(opts?.bold);
    const useFont = useBold ? fontBold : font;
    const textWidth = useFont.widthOfTextAtSize(text, size);
    drawText(text, rightEdge - textWidth, yy, { bold: useBold, size });
    return yy - lineHeight;
  };

  const marginX = 40;
  const leftX = marginX;
  const rightEdge = width - marginX;
  const detailSize = 10;
  const detailLineHeight = 12;

  const logoSize = 36;
  const brandFontSize = 20;
  const brandGap = 10;
  const brandNameWidth = fontBold.widthOfTextAtSize(SELLER_NAME, brandFontSize);
  const brandBlockWidth = (brandLogo ? logoSize + brandGap : 0) + brandNameWidth;
  const brandStartX = (width - brandBlockWidth) / 2;
  const leftW = Math.max(120, brandStartX - leftX - 12);

  // One header row — left (contact), center (logo + name), right (order meta) top-aligned.
  const headerStartY = y;
  const headerRowHeight = 4 * detailLineHeight + 4;

  let yLeft = headerStartY;
  yLeft = drawWrapped(`Email: ${SELLER_EMAIL}`, leftX, yLeft, leftW, {
    size: detailSize,
    lineHeight: detailLineHeight,
  });
  yLeft = drawWrapped(`GSTIN ${SELLER_GSTIN || "--"}`, leftX, yLeft, leftW, {
    size: detailSize,
    lineHeight: detailLineHeight,
  });

  const orderRef = formatOrderReference(order);
  let yRight = headerStartY;
  yRight = drawRightAligned(`Order ${orderRef}`, rightEdge, yRight, {
    bold: true,
    size: detailSize,
    lineHeight: detailLineHeight,
  });
  yRight = drawRightAligned(
    `Order Date ${formatDateDdMmYy(order.created_at)}`,
    rightEdge,
    yRight,
    { size: detailSize, lineHeight: detailLineHeight }
  );
  yRight = drawRightAligned(`Invoice No ${orderRef.replace(/-/g, "")}`, rightEdge, yRight, {
    size: detailSize,
    lineHeight: detailLineHeight,
  });
  yRight = drawRightAligned(`Invoice Date ${formatDateDdMmYy(new Date())}`, rightEdge, yRight, {
    size: detailSize,
    lineHeight: detailLineHeight,
  });

  const brandCenterY = headerStartY - headerRowHeight / 2;
  const brandTextBaseline = brandCenterY + brandFontSize * 0.32;
  const logoY = brandCenterY - logoSize / 2;

  if (brandLogo) {
    page.drawImage(brandLogo, {
      x: brandStartX,
      y: logoY,
      width: logoSize,
      height: logoSize,
    });
  }
  drawText(SELLER_NAME, brandStartX + (brandLogo ? logoSize + brandGap : 0), brandTextBaseline, {
    bold: true,
    size: brandFontSize,
  });

  y = Math.min(yLeft, yRight, headerStartY - headerRowHeight) - 8;
  drawLine(page, 40, y, width - 40, y);
  y -= 18;

  const addressLines = (a: typeof billing | null | undefined) => [
    a?.full_name || "--",
    customerPhone || "--",
    customerEmail || "--",
    [a?.line1, a?.line2].filter(Boolean).join(", ") || "--",
    `${a?.city || ""}${a?.city ? ", " : ""}${a?.state || ""}`.trim() || "--",
    `${a?.postal_code || ""}${a?.country ? ` ${a.country}` : ""}`.trim() || "--",
  ];

  const drawAddressBlock = (title: string, x: number, startY: number, lines: string[]) => {
    let cy = startY;
    drawText(title, x, cy, { bold: true, size: 10 });
    cy -= 13;
    for (const line of lines) {
      cy = drawWrapped(line, x, cy, 240, { size: 9, lineHeight: 11 });
    }
    return cy;
  };

  const billingLines = addressLines(billing);
  const shippingLines = addressLines(shipping);
  const yBillingEnd = drawAddressBlock("BILLING ADDRESS", 40, y, billingLines);
  const yShippingEnd = drawAddressBlock("SHIPPING ADDRESS", 300, y, shippingLines);
  y = Math.min(yBillingEnd, yShippingEnd) - 6;

  y -= 8;
  drawLine(page, 40, y, width - 40, y);
  y -= 16;

  const cols = {
    sr: 40,
    item: 68,
    hsn: 300,
    qty: 350,
    unitHeader: 385,
    unitValue: 390,
    discountHeader: 450,
    discountValue: 460,
    taxableHeader: 505,
    taxableValue: 535,
  };
  drawText("SR", cols.sr, y, { bold: true, size: 9 });
  drawText("ITEM DESCRIPTION", cols.item, y, { bold: true, size: 9 });
  drawText("HSN", cols.hsn, y, { bold: true, size: 9 });
  drawText("QTY.", cols.qty, y, { bold: true, size: 9 });
  drawText("UNIT PRICE", cols.unitHeader, y, { bold: true, size: 9 });
  drawText("DISCOUNT", cols.discountHeader, y, { bold: true, size: 9 });
  drawText("TAXABLE VALUE", cols.taxableHeader, y, { bold: true, size: 9 });
  y -= 10;
  drawLine(page, 40, y, width - 40, y);
  y -= 14;

  let grandTotal = 0;
  for (let i = 0; i < order.order_items.length; i += 1) {
    const it = order.order_items[i];
    const subtotal = money(Number(it.subtotal_amount));
    grandTotal += subtotal;
    const nameLines = wrapText(it.product_name, font, 9, cols.hsn - cols.item - 8);
    const rowHeight = Math.max(14, nameLines.length * 11 + 2);
    drawText(`${i + 1}.`, cols.sr, y, { size: 9 });
    for (let j = 0; j < nameLines.length; j += 1) {
      drawText(nameLines[j], cols.item, y - j * 11, { size: 9 });
    }
    drawText(hsnByProductId.get(it.product_id) || "--", cols.hsn, y, { size: 9 });
    drawText(String(it.quantity), cols.qty, y, { size: 9 });
    drawText(String(money(Number(it.unit_price))), cols.unitValue, y, { size: 9 });
    drawText("0", cols.discountValue, y, { size: 9 });
    drawText(String(subtotal), cols.taxableValue, y, { size: 9 });
    y -= rowHeight;
  }

  y -= 4;
  drawLine(page, 40, y, width - 40, y);
  y -= 16;
  drawText(`Grand Total ${money(Number(order.total_amount || grandTotal))}`, 40, y, { bold: true, size: 11 });
  y -= 18;
  drawText(`IN WORDS ${numberToWordsInr(money(Number(order.total_amount || grandTotal)))}`, 40, y, {
    bold: true,
    size: 10,
  });
  y -= 18;
  drawText("Notes For AI LEAD VISION PRIVATE LIMITED", 40, y, { size: 9 });
  y -= 14;
  drawText("-- --", 40, y, { size: 9 });

  drawText("-- 1 of 1 --", width / 2 - 25, 24, { size: 9 });

  const data = await pdfDoc.save();
  return { filename, data };
}
