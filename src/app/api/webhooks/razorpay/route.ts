import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { handleRazorpayRefundWebhook } from "@/lib/payments/razorpayRefundWebhook";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await req.text();

  if (!signature || !verifyRazorpayWebhookSignature({ rawBody, signature })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleRazorpayRefundWebhook(rawBody);
  } catch (err) {
    console.error("[razorpay-refund-webhook] unhandled error", err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
