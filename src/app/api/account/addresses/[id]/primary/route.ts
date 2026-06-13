import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapDbAddressToSaved } from "@/lib/account/savedAddress";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_address_primary:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        1
      );
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const owned = await prisma.addresses.findFirst({
      where: { id, customer_id: session.sub },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.addresses.updateMany({
        where: { customer_id: session.sub },
        data: { is_default_shipping: false, is_default_billing: false },
      });
      await tx.addresses.update({
        where: { id },
        data: { is_default_shipping: true, is_default_billing: true },
      });
    });

    const updated = await prisma.addresses.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        is_default_shipping: true,
      },
    });

    return NextResponse.json({
      ok: true,
      address: updated ? mapDbAddressToSaved(updated) : null,
    });
  });
}
