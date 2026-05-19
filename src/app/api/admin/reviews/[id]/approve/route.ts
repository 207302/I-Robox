import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateProductReviewsByReviewId } from "@/lib/cache/productCache";
import { redirectUrl } from "@/lib/siteUrl";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(_req);
      await rateLimitStrict(`admin_reviews_approve:${_req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    await prisma.reviews.update({ where: { id }, data: { is_approved: true } });
    await revalidateProductReviewsByReviewId(id);
    return NextResponse.redirect(redirectUrl(_req, "/admin/reviews"));
  
  });}

