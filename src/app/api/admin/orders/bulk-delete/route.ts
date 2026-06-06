import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { deleteOrderById } from "@/lib/admin/deleteOrder";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { writeAuditLog } from "@/lib/audit";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { ORDERS_TAG } from "@/lib/cache/tags";
import { revalidateInventoryCatalog } from "@/lib/cache/revalidate";
import { revalidateTag } from "next/cache";

const MAX_BULK_DELETE = 50;

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

export async function POST(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_orders_bulk_delete:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireSuperAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const session = auth.session;

      const parsed = await readJsonBody(req);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

      const rawIds = parsed.body.ids;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return NextResponse.json({ error: "ids array is required" }, { status: 400 });
      }
      if (rawIds.length > MAX_BULK_DELETE) {
        return NextResponse.json(
          { error: `Delete at most ${MAX_BULK_DELETE} orders at a time` },
          { status: 400 }
        );
      }

      const ids = [...new Set(rawIds.map((id) => String(id).trim()).filter((id) => isUuid(id)))];
      if (ids.length === 0) {
        return NextResponse.json({ error: "No valid order ids" }, { status: 400 });
      }

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];
      const affectedProductIds = new Set<string>();

      for (const id of ids) {
        const result = await deleteOrderById(id);
        if (result.ok) {
          deleted.push(id);
          for (const productId of result.productIds) affectedProductIds.add(productId);
        } else {
          failed.push({ id, error: result.error });
        }
      }

      if (deleted.length > 0) {
        after(async () => {
          try {
            await writeAuditLog({
              adminUserId: session.sub,
              entityType: "ORDER",
              entityId: null,
              action: "ORDERS_BULK_DELETED",
              newValues: { deleted },
              ipAddress: req.ip ?? null,
              userAgent: req.headers.get("user-agent"),
            });
            await syncLowStockAlertsByProductIds([...affectedProductIds]);
            for (const productId of affectedProductIds) {
              revalidateInventoryCatalog({ productId });
            }
            revalidateTag(ORDERS_TAG);
          } catch (err) {
            console.error("[admin orders bulk-delete] background work failed", err);
          }
        });
      }

      return NextResponse.json(
        {
          ok: true,
          deleted,
          failed,
          deletedCount: deleted.length,
          failedCount: failed.length,
        },
        { status: 200 }
      );
    },
    { name: "POST /api/admin/orders/bulk-delete" }
  );
}
