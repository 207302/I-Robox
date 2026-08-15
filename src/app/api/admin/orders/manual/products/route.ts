import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import { cleanText, hasSuspiciousInput } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import {
  getFreeShippingExcludedBrandIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = cleanText(req.nextUrl.searchParams.get("q") ?? "", 120);
    if (q && hasSuspiciousInput(q)) {
      return NextResponse.json({ error: "Invalid search" }, { status: 400 });
    }

    const where =
      q.length > 0
        ? {
            is_active: true,
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : { is_active: true };

    const [products, freeShippingThresholdInr, freeShippingExcludedBrandIds] = await Promise.all([
      prisma.products.findMany({
        where,
        orderBy: { updated_at: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          sku: true,
          base_price: true,
          discounted_price: true,
          shipping_per_unit: true,
          brand_id: true,
          product_images: adminProductImageSelect,
          inventory: {
            where: { product_variant_id: null },
            select: { available_quantity: true },
            take: 1,
          },
        },
      }),
      getFreeShippingThresholdInr(),
      getFreeShippingExcludedBrandIds(),
    ]);

    return NextResponse.json({
      freeShippingThresholdInr,
      freeShippingExcludedBrandIds,
      products: products.map((p) => {
        const catalogUnit = Number(p.discounted_price ?? p.base_price);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          catalogUnit,
          shippingPerUnit: Math.max(0, Number(p.shipping_per_unit ?? 0)),
          brandId: p.brand_id,
          available: p.inventory[0]?.available_quantity ?? 0,
          imageUrl: firstProductImageUrl(p),
        };
      }),
    });
  });
}
