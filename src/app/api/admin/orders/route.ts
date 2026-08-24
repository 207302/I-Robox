import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  ADMIN_ORDERS_MAX_PAGE_SIZE,
  ADMIN_ORDERS_PAGE_SIZE,
  listAdminOrders,
} from "@/lib/admin/orderList";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { cleanText, hasSuspiciousInput } from "@/lib/validation/input";

export async function GET(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      const auth = await requireAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const q = cleanText(req.nextUrl.searchParams.get("q") ?? "", 120);
      if (q && hasSuspiciousInput(q)) {
        return NextResponse.json({ error: "Invalid search" }, { status: 400 });
      }

      const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
      const limit = Math.min(
        ADMIN_ORDERS_MAX_PAGE_SIZE,
        Math.max(
          1,
          Number(req.nextUrl.searchParams.get("limit") ?? String(ADMIN_ORDERS_PAGE_SIZE)) ||
            ADMIN_ORDERS_PAGE_SIZE
        )
      );

      const result = await listAdminOrders({ page, limit, q });
      return NextResponse.json(result);
    },
    { name: "GET /api/admin/orders" }
  );
}
