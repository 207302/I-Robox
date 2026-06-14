import { NextRequest, NextResponse } from "next/server";
import { applyShipmozoWebhookUpdate } from "@/lib/shipping/shipmozoTracking";
import { runApiRoute } from "@/lib/api/runApiRoute";

function verifyShipmozoSecret(req: NextRequest): boolean {
  const expected = (process.env.SHIPMOZO_WEBHOOK_SECRET ?? "").trim();
  if (!expected) {
    console.error("[shipmozo-webhook] SHIPMOZO_WEBHOOK_SECRET is not configured");
    return false;
  }
  const provided = (req.headers.get("x-shipmozo-secret") ?? "").trim();
  return provided.length > 0 && provided === expected;
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      if (!verifyShipmozoSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch (err) {
        console.error("[shipmozo-webhook] invalid JSON body", err);
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const payload = {
        awb: typeof body.awb === "string" ? body.awb : undefined,
        order_id: typeof body.order_id === "string" ? body.order_id : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        timestamp: typeof body.timestamp === "string" ? body.timestamp : undefined,
        carrier: typeof body.carrier === "string" ? body.carrier : undefined,
        location: typeof body.location === "string" ? body.location : undefined,
      };

      if (!payload.status) {
        return NextResponse.json({ error: "Missing status" }, { status: 400 });
      }
      if (!payload.awb && !payload.order_id) {
        return NextResponse.json({ error: "Missing awb or order_id" }, { status: 400 });
      }

      const result = await applyShipmozoWebhookUpdate(payload);
      if (!result.ok) {
        console.error("[shipmozo-webhook] update failed", {
          payload,
          error: result.error,
        });
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      console.error("[shipmozo-webhook] unhandled error", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
