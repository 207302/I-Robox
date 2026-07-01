import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { bookShipmozoShipmentForOrder } from "@/lib/shipping/shipmozo";
import { refreshShipmozoOrderFromPanel } from "@/lib/shipping/shipmozoTracking";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runAdminApiRoute(
    async () => {
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

      const refresh = await refreshShipmozoOrderFromPanel(id);
      if (refresh.ok && refresh.reason === "awb_synced") {
        return NextResponse.json({
          ok: true,
          reason: "awb_synced",
          message: `AWB already in ShipMozo and synced: ${refresh.awb}.`,
          panelOrders: refresh.panelOrders,
          duplicateCount: refresh.duplicateCount,
        });
      }

      if (refresh.ok && refresh.panelOrders.length > 0) {
        return NextResponse.json({
          ok: true,
          reason: "order_already_in_shipmozo_panel",
          message:
            refresh.duplicateCount > 0
              ? `${refresh.panelOrders.length} ShipMozo orders already exist for this ref. Assign a courier on the scheduled shipment or cancel duplicates in the panel.`
              : "Order is already in ShipMozo. Assign a courier in the panel if AWB is still empty.",
          panelOrders: refresh.panelOrders,
          duplicateCount: refresh.duplicateCount,
        });
      }

      const result = await bookShipmozoShipmentForOrder(id, { force: false });

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
            : "Order is in ShipMozo. Assign a courier in the ShipMozo panel if AWB is still empty.",
      });
    },
    { name: "POST /api/admin/orders/[id]/shipmozo-push", timeoutMs: 60_000 }
  );
}
