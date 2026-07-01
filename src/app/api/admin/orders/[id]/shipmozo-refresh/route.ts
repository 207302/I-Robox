import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { refreshShipmozoOrderFromPanel } from "@/lib/shipping/shipmozoTracking";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_shipmozo_refresh:${req.ip ?? "unknown"}`, 1);
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

      const result = await refreshShipmozoOrderFromPanel(id);

      if (!result.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: result.error ?? "Could not refresh from ShipMozo",
            panelOrders: result.panelOrders,
            duplicateCount: result.duplicateCount,
          },
          { status: 400 }
        );
      }

      const duplicateNote =
        result.duplicateCount > 0
          ? ` Found ${result.panelOrders.length} ShipMozo order(s) for this ref (${result.duplicateCount} duplicate).`
          : "";

      let message = "Checked ShipMozo — no AWB assigned yet.";
      if (result.reason === "awb_synced" && result.awb) {
        message = `AWB synced from ShipMozo: ${result.awb}.${duplicateNote}`;
      } else if (result.panelOrders.length > 0) {
        message = `Found ${result.panelOrders.length} ShipMozo order(s) for this ref. Assign a courier on the scheduled shipment if AWB is still empty.${duplicateNote}`;
      }

      return NextResponse.json({
        ok: true,
        reason: result.reason,
        awb: "awb" in result ? result.awb : undefined,
        panelOrders: result.panelOrders,
        duplicateCount: result.duplicateCount,
        message,
      });
    },
    { name: "POST /api/admin/orders/[id]/shipmozo-refresh", timeoutMs: 60_000 }
  );
}
