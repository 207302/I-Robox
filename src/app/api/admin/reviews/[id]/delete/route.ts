import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { validateUuid } from "@/lib/validation/rules";
import { revalidateProductReviewsByReviewId } from "@/lib/cache/productCache";
import { redirectUrl } from "@/lib/siteUrl";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_reviews_delete:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    const idResult = validateUuid(id, "review id");
    if (!idResult.ok) return NextResponse.json({ error: idResult.error }, { status: 400 });
    await prisma.reviews.delete({ where: { id: idResult.value } });
    await revalidateProductReviewsByReviewId(idResult.value);
    return NextResponse.redirect(redirectUrl(req, "/admin/reviews"));
  
  });}
