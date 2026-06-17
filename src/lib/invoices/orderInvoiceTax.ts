import { prisma } from "@/lib/prisma";
import { splitInclusiveGstAmount } from "@/lib/tax/productTaxFields";

export type OrderItemForInvoiceTax = {
  product_id: string;
  quantity: number;
  unit_price: number | string | { toString(): string };
  subtotal_amount: number | string | { toString(): string };
};

export type OrderInvoiceTaxLine = {
  productId: string;
  hsn: string;
  gstPercent: number;
  quantity: number;
  unitPriceInclusive: number;
  lineTotalInclusive: number;
  taxableTotal: number;
  gstTotal: number;
  taxableUnit: number;
  gstUnit: number;
};

function money(n: number) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export async function loadOrderInvoiceTaxLines(
  items: OrderItemForInvoiceTax[]
): Promise<OrderInvoiceTaxLine[]> {
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const hsnById = new Map<string, string>();
  const gstById = new Map<string, number>();

  if (productIds.length > 0) {
    const rows = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, hsn_code: true, gst_percent: true },
    });
    for (const row of rows) {
      hsnById.set(row.id, row.hsn_code?.trim() || "--");
      gstById.set(row.id, row.gst_percent ?? 0);
    }
  }

  return items.map((it) => {
    const gstPercent = gstById.get(it.product_id) ?? 0;
    const quantity = Number(it.quantity) || 1;
    const unitPriceInclusive = money(Number(it.unit_price));
    const lineTotalInclusive = money(Number(it.subtotal_amount));
    const lineSplit = splitInclusiveGstAmount(lineTotalInclusive, gstPercent);
    const unitSplit = splitInclusiveGstAmount(unitPriceInclusive, gstPercent);
    return {
      productId: it.product_id,
      hsn: hsnById.get(it.product_id) || "--",
      gstPercent,
      quantity,
      unitPriceInclusive,
      lineTotalInclusive,
      taxableTotal: lineSplit.taxable,
      gstTotal: lineSplit.gst,
      taxableUnit: unitSplit.taxable,
      gstUnit: unitSplit.gst,
    };
  });
}

export function sumOrderInvoiceTax(lines: OrderInvoiceTaxLine[]) {
  return lines.reduce(
    (acc, line) => ({
      taxable: money(acc.taxable + line.taxableTotal),
      gst: money(acc.gst + line.gstTotal),
      inclusive: money(acc.inclusive + line.lineTotalInclusive),
    }),
    { taxable: 0, gst: 0, inclusive: 0 }
  );
}
