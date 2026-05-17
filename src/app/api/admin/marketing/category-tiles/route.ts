import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateHomePage } from "@/lib/cache/homePageCache";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.homepage_category_tiles.findMany({
      orderBy: { sort_order: "asc" },
      include: { categories: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json(rows);
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_ct_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const category_id = body.category_id ? String(body.category_id) : "";
    if (!isUuid(category_id)) {
      return NextResponse.json({ error: "category_id required" }, { status: 400 });
    }
  
    const dup = await prisma.homepage_category_tiles.findUnique({
      where: { category_id },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: "This category is already on the homepage grid. Delete the existing tile to replace it." },
        { status: 409 }
      );
    }
  
    let imageUrl = cleanText(body.image_url, 2000);
    const image_public_id = cleanOptionalText(body.image_public_id, 255);
    if (!imageUrl) {
      return NextResponse.json({ error: "image_url or upload required" }, { status: 400 });
    }
  
    const label_override = cleanOptionalText(body.label_override, 120);
    const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : 0;
    const is_active = Boolean(body.is_active);
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
  
    const created = await prisma.homepage_category_tiles.create({
      data: {
        category_id,
        image_url: imageUrl,
        image_public_id: image_public_id ?? null,
        label_override: label_override ?? null,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        is_active,
        active_from: active_from ?? null,
        active_until: active_until ?? null,
      },
      select: { id: true },
    });
  
    revalidateHomePage();
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  
  });}
