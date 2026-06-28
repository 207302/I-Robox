import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { readJsonBody } from "@/lib/validation/input";
import { buildCheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { sealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { getRazorpayClient, razorpayPublicConfig } from "@/lib/payments/razorpay";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { StockValidationError } from "@/lib/inventory/cartStock";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`rzp_order:${req.ip ?? "unknown"}`, 2);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  
    try {
      const session = await getSession();
      const ctx = await buildCheckoutContext({
        body: parsed.body as Record<string, unknown>,
        session,
      });
      const razorpay = getRazorpayClient();
      const publicCfg = razorpayPublicConfig();
      const amountPaise = Math.round(ctx.total * 100);
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `chk_${Date.now()}`,
        payment_capture: true,
        notes: {
          customer_email: ctx.address.email.slice(0, 255),
          customer_phone: ctx.address.phone.slice(0, 255),
        },
      });
  
      return NextResponse.json(
        {
          ok: true,
          keyId: publicCfg.keyId,
          razorpayOrderId: razorpayOrder.id,
          checkoutSeal: sealCheckoutContext(razorpayOrder.id, ctx),
          amount: amountPaise,
          currency: "INR",
          pricing: {
            subtotal: ctx.subtotal,
            discount: ctx.discount,
            shipping: ctx.shipping,
            total: ctx.total,
          },
        },
        { status: 201 }
      );
    } catch (e: any) {
      const message = String(e?.message ?? "Could not initiate payment");
      if (message === "RAZORPAY_NOT_CONFIGURED") {
        return NextResponse.json({ error: "Razorpay is not configured" }, { status: 500 });
      }
      if (message === "CART_EMPTY") {
        return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
      }
      if (message === "ADDRESS_INCOMPLETE") {
        return NextResponse.json({ error: "Address is incomplete" }, { status: 400 });
      }
      if (message === "EMAIL_PROVIDER_INVALID") {
        return NextResponse.json(
          { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
          { status: 400 }
        );
      }
      if (message === "INVALID_INPUT" || message === "INVALID_ITEMS" || message === "INVALID_QUANTITY") {
        return NextResponse.json({ error: "Invalid checkout data" }, { status: 400 });
      }
      if (message.startsWith("MAX_ORDER_QTY_EXCEEDED:")) {
        const [, productName, maxRaw] = message.split(":");
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
      if (message === "OUT_OF_STOCK" || e instanceof StockValidationError) {
        return NextResponse.json(
          {
            error:
              e instanceof StockValidationError
                ? e.message
                : "One or more items are out of stock. Please refresh cart and try again.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: message || "Could not initiate payment" }, { status: 400 });
    }
  },
    { name: "POST /api/payment/razorpay/order", timeoutMs: 25_000 }
  );
}
