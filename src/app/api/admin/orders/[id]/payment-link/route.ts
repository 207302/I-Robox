import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { attachRazorpayPaymentLinkToOrder } from "@/lib/orders/attachRazorpayPaymentLinkToOrder";
import { isHttpError } from "@/lib/orders/createAdminManualOrder";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_order_plink:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireSuperAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { id } = await ctx.params;
      if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

      try {
        const link = await attachRazorpayPaymentLinkToOrder(id);
        return NextResponse.json({ ok: true, paymentLink: link });
      } catch (err) {
        if (isHttpError(err)) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Could not generate payment link";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    },
    { name: "POST /api/admin/orders/[id]/payment-link", timeoutMs: 25_000 }
  );
}
