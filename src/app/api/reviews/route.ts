import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const url = new URL(req.url);
    const productId = (url.searchParams.get("productId") ?? "").trim();
    if (!productId || !isUuid(productId)) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
  
    const reviews = await prisma.reviews.findMany({
      where: { product_id: productId, is_approved: true },
      orderBy: { created_at: "desc" },
      select: { id: true, rating: true, title: true, comment: true, created_at: true, is_verified_purchase: true },
    });
  
    return NextResponse.json({ items: reviews }, { status: 200 });
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`reviews_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const productId = cleanText(body.productId, 64);
    const rating = Number(body.rating ?? 0);
    const title = cleanOptionalText(body.title, 255);
    const comment = cleanText(body.comment, 2000);
  
    if (
      !productId ||
      !isUuid(productId) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !comment.trim() ||
      hasSuspiciousInput(comment) ||
      (title ? hasSuspiciousInput(title) : false)
    ) {
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    }
  
    // Strict enforcement: one review per purchased order item.
    const unreviewedPurchasedItem = await prisma.order_items.findFirst({
      where: {
        product_id: productId,
        orders: {
          customer_id: session.sub,
          payment_status: "SUCCEEDED",
        },
        reviews: {
          none: {
            customer_id: session.sub,
          },
        },
      },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });
    if (!unreviewedPurchasedItem) {
      return NextResponse.json(
        { error: "You can only review purchased items once per purchase" },
        { status: 400 }
      );
    }
  
    const created = await prisma.reviews.create({
      data: {
        product_id: productId,
        customer_id: session.sub,
        order_item_id: unreviewedPurchasedItem.id,
        rating,
        title,
        comment,
        is_verified_purchase: true,
        is_approved: false, // moderation required
      },
      select: { id: true },
    });
  
    await writeAuditLog({
      customerId: session.sub,
      entityType: "REVIEW",
      entityId: created.id,
      action: "REVIEW_SUBMITTED",
      newValues: { productId, rating, verified: true, orderItemId: unreviewedPurchasedItem.id },
      ipAddress: req.ip ?? null,
      userAgent: req.headers.get("user-agent"),
    });
  
    return NextResponse.json({ ok: true }, { status: 201 });
  
  });}

