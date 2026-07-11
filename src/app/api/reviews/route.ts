import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import {
  validateReviewComment,
  validateStarRating,
  validateUuid,
} from "@/lib/validation/rules";
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
  
    const productIdResult = validateUuid(body.productId, "product");
    const ratingResult = validateStarRating(body.rating);
    const title = cleanOptionalText(body.title, 255);
    const commentResult = validateReviewComment(body.comment);

    if (
      !productIdResult.ok ||
      !ratingResult.ok ||
      !commentResult.ok ||
      (title ? hasSuspiciousInput(title) : false)
    ) {
      const error =
        productIdResult.ok === false
          ? productIdResult.error
          : ratingResult.ok === false
            ? ratingResult.error
            : commentResult.ok === false
              ? commentResult.error
              : "Invalid review";
      return NextResponse.json({ error }, { status: 400 });
    }

    const productId = productIdResult.value;
    const rating = ratingResult.value;
    const comment = commentResult.value;

    const existingReview = await prisma.reviews.findFirst({
      where: { product_id: productId, customer_id: session.sub },
      select: { id: true },
    });
    if (existingReview) {
      return NextResponse.json(
        { error: "You have already submitted a review for this product" },
        { status: 400 }
      );
    }

    const unreviewedPurchasedItem = await prisma.order_items.findFirst({
      where: {
        product_id: productId,
        orders: {
          customer_id: session.sub,
          payment_status: "SUCCEEDED",
        },
        reviews: { none: {} },
      },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });

    const isVerifiedPurchase = Boolean(unreviewedPurchasedItem);

    const created = await prisma.reviews.create({
      data: {
        product_id: productId,
        customer_id: session.sub,
        order_item_id: unreviewedPurchasedItem?.id ?? null,
        rating,
        title,
        comment,
        is_verified_purchase: isVerifiedPurchase,
        is_approved: false, // moderation required
      },
      select: { id: true },
    });

    await writeAuditLog({
      customerId: session.sub,
      entityType: "REVIEW",
      entityId: created.id,
      action: "REVIEW_SUBMITTED",
      newValues: {
        productId,
        rating,
        verified: isVerifiedPurchase,
        orderItemId: unreviewedPurchasedItem?.id ?? null,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.headers.get("user-agent"),
    });
  
    return NextResponse.json({ ok: true }, { status: 201 });
  
  });}

