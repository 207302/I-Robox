import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody, isUuid } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import {
  createAdminManualOrder,
  isHttpError,
  type AdminManualOrderItemInput,
} from "@/lib/orders/createAdminManualOrder";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import { prisma } from "@/lib/prisma";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";

export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_manual_order:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireSuperAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const parsed = await readJsonBody(req);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      const body = parsed.body as Record<string, unknown>;

      const itemsRaw = Array.isArray(body.items) ? body.items : [];
      const items: AdminManualOrderItemInput[] = [];
      for (const row of itemsRaw) {
        if (!row || typeof row !== "object") continue;
        const rec = row as Record<string, unknown>;
        items.push({
          productId: String(rec.productId ?? ""),
          quantity: Number(rec.quantity),
          unitPrice: rec.unitPrice == null || rec.unitPrice === "" ? undefined : Number(rec.unitPrice),
        });
      }

      const address = (body.address ?? {}) as Record<string, unknown>;
      const newCustomer =
        body.newCustomer && typeof body.newCustomer === "object"
          ? (body.newCustomer as Record<string, unknown>)
          : null;

      try {
        const created = await createAdminManualOrder({
          adminUserId: auth.session.sub,
          customerId: typeof body.customerId === "string" && isUuid(body.customerId) ? body.customerId : null,
          newCustomer: newCustomer
            ? {
                name: String(newCustomer.name ?? ""),
                phone: String(newCustomer.phone ?? ""),
                email: newCustomer.email != null ? String(newCustomer.email) : null,
              }
            : null,
          items,
          address: {
            full_name: String(address.full_name ?? ""),
            phone: String(address.phone ?? ""),
            line1: String(address.line1 ?? ""),
            line2: address.line2 != null ? String(address.line2) : null,
            city: String(address.city ?? ""),
            state: String(address.state ?? ""),
            postal_code: String(address.postal_code ?? ""),
            country: String(address.country ?? "India"),
          },
          generatePaymentLink: body.generatePaymentLink === true,
        });

        if (created.paymentStatus === "SUCCEEDED") {
          const customer = await prisma.customers.findUnique({
            where: { id: created.customerId },
            select: { email: true },
          });
          const checkoutFormEmail = displayEmailForCustomer(customer?.email ?? "") ?? "";
          after(async () => {
            try {
              await runPostOrderFulfillment({
                orderId: created.orderId,
                productIds: created.productIds,
                checkoutFormEmail,
                accountEmail: checkoutFormEmail || null,
                audit: {
                  customerId: created.customerId,
                  ipAddress: req.ip ?? null,
                  userAgent: req.headers.get("user-agent"),
                  action: "ADMIN_MANUAL_ORDER_PAID",
                  newValues: { payment_provider: "manual", payment_status: "SUCCEEDED" },
                },
              });
              const shipped = await prisma.orders.findUnique({
                where: { id: created.orderId },
                select: { awb_number: true, status: true },
              });
              if (shipped?.awb_number && shipped.status === "PENDING") {
                await prisma.orders.update({
                  where: { id: created.orderId },
                  data: { status: "CONFIRMED" },
                });
              }
            } catch (err) {
              console.error("[admin-manual-order] fulfillment failed", err);
            }
          });
        }

        return NextResponse.json({ ok: true, ...created }, { status: 201 });
      } catch (err) {
        if (isHttpError(err)) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Could not create order";
        if (String(message).startsWith("OUT_OF_STOCK:")) {
          return NextResponse.json({ error: message.replace("OUT_OF_STOCK:", "") + " is out of stock" }, { status: 409 });
        }
        console.error("[admin-manual-order] create failed", err);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    },
    { name: "POST /api/admin/orders/manual", timeoutMs: 25_000 }
  );
}
