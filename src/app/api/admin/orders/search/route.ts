import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { looksLikeTxnId } from "@/lib/admin/orderTxnSearch";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { compactOrderId } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { rateLimitStrict } from "@/lib/security/rateLimit";

const TXN_MAX_LEN = 255;

export async function GET(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        await rateLimitStrict(`admin_orders_txn_search:${ip}`, 30);
      } catch {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const txn = (req.nextUrl.searchParams.get("txn") ?? "").trim();
      if (!txn) {
        return NextResponse.json({ error: "txn query parameter is required" }, { status: 400 });
      }
      if (txn.length > TXN_MAX_LEN) {
        return NextResponse.json({ error: "txn is too long" }, { status: 400 });
      }
      if (!looksLikeTxnId(txn)) {
        return NextResponse.json({ error: "txn does not look like a transaction id" }, { status: 400 });
      }

      const order = await prisma.orders.findFirst({
        where: {
          OR: [{ external_payment_id: txn }, { refund_transaction_id: txn }],
        },
        select: { id: true, order_number: true },
        orderBy: { created_at: "desc" },
      });

      if (!order) {
        return NextResponse.json({ found: false as const }, { status: 200 });
      }

      return NextResponse.json(
        {
          found: true as const,
          id: order.id,
          orderId: compactOrderId(order.order_number),
        },
        { status: 200 }
      );
    },
    { name: "GET /api/admin/orders/search" }
  );
}
