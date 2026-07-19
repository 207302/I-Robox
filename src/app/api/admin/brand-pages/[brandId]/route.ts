import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanOptionalText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ brandId: string }> }
) {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { brandId } = await ctx.params;
    if (!isUuid(brandId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        brand_pages: { select: { hero_image: true } },
      },
    });
    if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      brandId: brand.id,
      name: brand.name,
      slug: brand.slug,
      heroImage: brand.brand_pages?.hero_image ?? null,
      description: brand.description,
    });
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ brandId: string }> }
) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { brandId } = await ctx.params;
    if (!isUuid(brandId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
      select: { id: true, slug: true },
    });
    if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    // Partial update: only touch the fields present in the body, so saving
    // the description can never wipe the banner and vice versa.
    const hasHeroImage = "heroImage" in parsed.body;
    const hasDescription = "description" in parsed.body;
    if (!hasHeroImage && !hasDescription) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    let heroImage: string | null = null;
    if (hasHeroImage) {
      heroImage =
        parsed.body.heroImage === null
          ? null
          : cleanOptionalText(String(parsed.body.heroImage ?? ""), 500);
      await prisma.brand_pages.upsert({
        where: { brand_id: brandId },
        create: { brand_id: brandId, hero_image: heroImage },
        update: { hero_image: heroImage },
        select: { hero_image: true },
      });
    }

    let description: string | null = null;
    if (hasDescription) {
      description =
        parsed.body.description === null
          ? null
          : cleanOptionalText(String(parsed.body.description ?? ""), 2000);
      await prisma.brands.update({
        where: { id: brandId },
        data: { description },
      });
    }

    const fresh = await prisma.brands.findUnique({
      where: { id: brandId },
      select: {
        description: true,
        brand_pages: { select: { hero_image: true } },
      },
    });

    // Brand pages are ISR-cached (revalidate = 300); refresh so the new
    // banner/description is visible immediately instead of within 5 minutes.
    revalidatePath(`/brand/${brand.slug}`);

    return NextResponse.json({
      ok: true,
      heroImage: fresh?.brand_pages?.hero_image ?? null,
      description: fresh?.description ?? null,
    });
  });
}
