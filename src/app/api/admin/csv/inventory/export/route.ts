import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { escapeCsvField, inventoryCsvHeaderLine } from "@/lib/admin/csvFormats";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    const products = await prisma.products.findMany({
      orderBy: { slug: "asc" },
      select: {
        slug: true,
        inventory: {
          where: { product_variant_id: null },
          take: 1,
          select: { available_quantity: true, low_stock_threshold: true },
        },
      },
    });
  
    const lines: string[] = [inventoryCsvHeaderLine()];
    for (const p of products) {
      const inv = p.inventory[0];
      const available = inv?.available_quantity ?? 0;
      const threshold = inv?.low_stock_threshold ?? 5;
      const cells = [escapeCsvField(p.slug), String(available), String(threshold)];
      lines.push(cells.join(","));
    }
  
    const csv = "\uFEFF" + lines.join("\n") + "\n";
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-export-${date}.csv"`,
      },
    });
  
  });}
