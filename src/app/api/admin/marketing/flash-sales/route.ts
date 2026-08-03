import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateFlashSales } from "@/lib/cache/revalidate";
import {
  flashSaleAdminInclude,
  parseFlashSaleBody,
  replaceFlashSaleScope,
  serializeFlashSaleRow,
} from "@/lib/admin/flashSaleBody";

export const dynamic = "force-dynamic";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.flash_sales.findMany({
      orderBy: { updated_at: "desc" },
      include: flashSaleAdminInclude,
    });
    return NextResponse.json(rows.map(serializeFlashSaleRow), {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
        expires: "0",
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_mflash_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const bodyParsed = parseFlashSaleBody(parsed.body as Record<string, unknown>);
    if (!bodyParsed.ok) return NextResponse.json({ error: bodyParsed.error }, { status: 400 });
    const data = bodyParsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.flash_sales.create({
        data: {
          name: data.name,
          sale_tag: data.sale_tag,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          is_active: data.is_active,
          active_from: data.active_from,
          active_until: data.active_until,
        },
      });
      await replaceFlashSaleScope(row.id, data, tx);
      return tx.flash_sales.findUniqueOrThrow({
        where: { id: row.id },
        include: flashSaleAdminInclude,
      });
    });

    await revalidateFlashSales();
    return NextResponse.json(
      { ok: true, id: created.id, item: serializeFlashSaleRow(created) },
      { status: 201 }
    );
  });
}
