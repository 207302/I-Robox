import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanOptionalText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { categoryId } = await ctx.params;
    if (!isUuid(categoryId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
        category_pages: { select: { hero_image: true } },
      },
    });
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      heroImage: category.category_pages?.hero_image ?? null,
    });
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { categoryId } = await ctx.params;
    if (!isUuid(categoryId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const heroImage =
      parsed.body.heroImage === null
        ? null
        : cleanOptionalText(String(parsed.body.heroImage ?? ""), 500);

    const row = await prisma.category_pages.upsert({
      where: { category_id: categoryId },
      create: { category_id: categoryId, hero_image: heroImage },
      update: { hero_image: heroImage },
      select: { hero_image: true },
    });

    return NextResponse.json({ ok: true, heroImage: row.hero_image });
  });
}
