import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createOrderAccessToken } from "@/lib/security/orderAccess";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { cleanText, readJsonBody } from "@/lib/validation/input";
import { buildCheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { unsealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { getRazorpayClient, verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import { allocateNextOrderNumber } from "@/lib/orders/orderNumber";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`rzp_verify:${req.ip ?? "unknown"}`, 2);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body as Record<string, unknown>;
  
    const razorpayOrderId = cleanText(body.razorpayOrderId, 120);
    const razorpayPaymentId = cleanText(body.razorpayPaymentId, 120);
    const razorpaySignature = cleanText(body.razorpaySignature, 255);
  
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Payment verification data is incomplete" }, { status: 400 });
    }
  
    const validSig = verifyRazorpayPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (!validSig) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }
  
    const session = await getSession();
    try {
      const razorpay = getRazorpayClient();
      const payment = await razorpay.payments.fetch(razorpayPaymentId);
      if (payment.order_id !== razorpayOrderId) {
        return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
      }
      if (payment.status !== "captured" && payment.status !== "authorized") {
        return NextResponse.json({ error: "Payment is not successful" }, { status: 400 });
      }
  
      const existing = await prisma.orders.findFirst({
        where: { external_payment_id: razorpayPaymentId, payment_provider: "razorpay" },
        select: { id: true },
      });
      if (existing) {
        const accessToken = createOrderAccessToken(existing.id);
        return NextResponse.json(
          { ok: true, orderId: existing.id, accessToken, alreadyProcessed: true },
          { status: 200 }
        );
      }
  
      const checkoutSeal = cleanText(body.checkoutSeal, 32_000);
      let ctx =
        checkoutSeal.length > 0
          ? unsealCheckoutContext(checkoutSeal, razorpayOrderId)
          : null;
      if (!ctx) {
        ctx = await buildCheckoutContext({ body, session });
      }
  
      const expectedAmountPaise = Math.round(ctx.total * 100);
      if (Number(payment.amount) !== expectedAmountPaise) {
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }
  
      const created = await prisma.$transaction(async (tx) => {
        const addr = await tx.addresses.create({
          data: {
            customer_id: ctx.checkoutUserId,
            full_name: ctx.address.full_name,
            phone: ctx.address.phone,
            line1: ctx.address.line1,
            line2: ctx.address.line2,
            city: ctx.address.city,
            state: ctx.address.state,
            postal_code: ctx.address.postal_code,
            country: ctx.address.country,
            is_default_billing: false,
            is_default_shipping: false,
          },
          select: { id: true },
        });

        const order_number = await allocateNextOrderNumber(tx);

        const order = await tx.orders.create({
          data: {
            order_number,
            customer_id: ctx.checkoutUserId,
            status: "PENDING",
            payment_status: "SUCCEEDED",
            subtotal_amount: ctx.subtotal,
            discount_amount: ctx.discount,
            shipping_amount: ctx.shipping,
            tax_amount: 0,
            total_amount: ctx.total,
            currency: "INR",
            coupon_id: ctx.coupon?.id ?? null,
            shipping_address_id: addr.id,
            billing_address_id: addr.id,
            payment_provider: "razorpay",
            external_payment_id: razorpayPaymentId,
            is_gift: ctx.isGift,
            gift_message: ctx.giftMessage,
          },
          select: { id: true, customer_id: true, order_number: true },
        });
  
        for (const li of ctx.lineItems) {
          const oi = await tx.order_items.create({
            data: {
              order_id: order.id,
              product_id: li.productId,
              product_variant_id: null,
              product_name: li.productName,
              sku: li.sku,
              unit_price: li.unitPrice,
              quantity: li.quantity,
              subtotal_amount: li.subtotal,
            },
            select: { id: true },
          });
  
          const updated = await tx.inventory.updateMany({
            where: {
              product_id: li.productId,
              product_variant_id: null,
              available_quantity: { gte: li.quantity },
            },
            data: {
              available_quantity: { decrement: li.quantity },
              sold_quantity: { increment: li.quantity },
            },
          });
          if (updated.count !== 1) throw new Error("OUT_OF_STOCK");
  
          await tx.inventory_reservations.create({
            data: {
              order_id: order.id,
              order_item_id: oi.id,
              product_id: li.productId,
              product_variant_id: null,
              quantity: li.quantity,
              released_at: new Date(),
            },
          });
        }
  
        if (ctx.coupon?.id) {
          await tx.coupon_usages.create({
            data: {
              coupon_id: ctx.coupon.id,
              customer_id: order.customer_id ?? null,
              order_id: order.id,
            },
          });
        }
  
        return order;
      }, PRISMA_TRANSACTION_OPTIONS);
  
      const accessToken = createOrderAccessToken(created.id);
      const productIds = ctx.lineItems.map((li) => li.productId);
  
      after(async () => {
        await runPostOrderFulfillment({
          orderId: created.id,
          productIds,
          checkoutFormEmail: ctx.address.email,
          accountEmail: ctx.accountEmail,
          newAccountPasswordSetup: ctx.newAccountPasswordSetup,
          audit: {
            customerId: ctx.checkoutUserId,
            ipAddress: req.ip ?? null,
            userAgent: req.headers.get("user-agent"),
          },
        });
      });
  
      return NextResponse.json(
        {
          ok: true,
          orderId: created.id,
          orderNumber: created.order_number,
          accessToken,
          checkoutLinkedAs: ctx.checkoutLinkedAs,
          passwordSetupIncluded: Boolean(ctx.newAccountPasswordSetup),
          newAccountCreated: ctx.checkoutLinkedAs === "new_customer",
        },
        { status: 201 }
      );
    } catch (e: any) {
      console.error("[razorpay/verify] order creation failed", {
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
      });
      if (String(e?.message ?? "") === "OUT_OF_STOCK") {
        return NextResponse.json({ error: "Item went out of stock while paying" }, { status: 409 });
      }
      const msg = String(e?.message ?? "");
      if (msg.startsWith("MAX_ORDER_QTY_EXCEEDED:")) {
        const [, productName, maxRaw] = msg.split(":");
        const maxQty = Number(maxRaw);
        return NextResponse.json(
          {
            error: Number.isFinite(maxQty)
              ? `${productName || "This item"} allows max ${maxQty} per order`
              : "One or more items exceed the per-order quantity limit",
          },
          { status: 400 }
        );
      }
      const message = msg || "Could not verify payment";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
    { name: "POST /api/payment/razorpay/verify", timeoutMs: 25_000 }
  );
}
