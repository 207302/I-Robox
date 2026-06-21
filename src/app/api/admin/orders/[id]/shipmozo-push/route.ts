import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { bookShipmozoShipmentForOrder } from "@/lib/shipping/shipmozo";
import { syncShipmozoAwbForOrder } from "@/lib/shipping/shipmozoTracking";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_shipmozo_push:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await bookShipmozoShipmentForOrder(id, { force: true });
    await syncShipmozoAwbForOrder(id, { force: true });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Could not push order to ShipMozo", reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      reason: result.reason,
      message:
        result.reason === "booked"
          ? "Order pushed to ShipMozo and AWB synced."
          : "Order pushed to ShipMozo. Assign a courier in the ShipMozo panel if AWB is still empty.",
    });
  });
}
