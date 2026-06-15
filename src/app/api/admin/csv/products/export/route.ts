import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { escapeCsvField, productsCsvHeaderLine } from "@/lib/admin/csvFormats";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    const products = await prisma.products.findMany({
      orderBy: { name: "asc" },
      include: {
        diecast_scales: { select: { ratio: true } },
        inventory: {
          where: { product_variant_id: null },
          take: 1,
          select: { available_quantity: true, low_stock_threshold: true },
        },
      },
    });
  
    const lines: string[] = [productsCsvHeaderLine()];
    for (const p of products) {
      const inv = p.inventory[0];
      const available = inv?.available_quantity ?? 0;
      const threshold = inv?.low_stock_threshold ?? 5;
      const discounted =
        p.discounted_price != null ? String(Number(p.discounted_price)) : "";
      const cells = [
        escapeCsvField(p.name),
        escapeCsvField(p.slug),
        escapeCsvField(String(Number(p.base_price))),
        discounted === "" ? "" : escapeCsvField(discounted),
        escapeCsvField(String(Number(p.shipping_per_unit ?? 0))),
        String(p.max_order_quantity ?? 99),
        p.sku ? escapeCsvField(p.sku) : "",
        p.hsn_code ? escapeCsvField(p.hsn_code) : "",
        p.weight_g != null ? String(p.weight_g) : "",
        p.diecast_scales?.ratio ? escapeCsvField(p.diecast_scales.ratio) : "",
        p.is_active ? "true" : "false",
        String(available),
        String(threshold),
      ];
      lines.push(cells.join(","));
    }
  
    const csv = "\uFEFF" + lines.join("\n") + "\n";
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-export-${date}.csv"`,
      },
    });
  
  });}
