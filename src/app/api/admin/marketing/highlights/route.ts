import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateHomePage } from "@/lib/cache/homePageCache";

const HIGHLIGHT_KINDS = ["FEATURED", "TRENDING", "CATEGORY", "PRODUCT", "BRAND", "CUSTOM"] as const;
type HighlightKind = (typeof HIGHLIGHT_KINDS)[number];

function parseKind(s: string): HighlightKind | null {
  return (HIGHLIGHT_KINDS as readonly string[]).includes(s) ? (s as HighlightKind) : null;
}

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.homepage_highlights.findMany({
      orderBy: { sort_order: "asc" },
      include: {
        categories: { select: { id: true, name: true, slug: true } },
        products: { select: { id: true, name: true, slug: true } },
        brands: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json(rows);
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_hi_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const kind = parseKind(cleanText(body.kind, 40));
    if (!kind) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  
    const category_id = body.category_id ? String(body.category_id) : null;
    const product_id = body.product_id ? String(body.product_id) : null;
    const brand_id = body.brand_id ? String(body.brand_id) : null;
    if (category_id && !isUuid(category_id)) {
      return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
    }
    if (product_id && !isUuid(product_id)) {
      return NextResponse.json({ error: "Invalid product_id" }, { status: 400 });
    }
    if (brand_id && !isUuid(brand_id)) {
      return NextResponse.json({ error: "Invalid brand_id" }, { status: 400 });
    }
    if (kind === "CATEGORY" && !category_id) {
      return NextResponse.json({ error: "category_id required for CATEGORY" }, { status: 400 });
    }
    if (kind === "PRODUCT" && !product_id) {
      return NextResponse.json({ error: "product_id required for PRODUCT" }, { status: 400 });
    }
    if (kind === "BRAND" && !brand_id) {
      return NextResponse.json({ error: "brand_id required for BRAND" }, { status: 400 });
    }
    // Link target is independent of `kind`: any highlight can carry any
    // combination of category/product/brand IDs. The homepage resolves the
    // link in priority order (link_url > product > brand > category).
  
    const title = cleanText(body.title, 255);
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    const subtitle = cleanOptionalText(body.subtitle, 500);
    const image_url = cleanOptionalText(body.image_url, 2000);
    const image_public_id = cleanOptionalText(body.image_public_id, 255);
    const link_url = cleanOptionalText(body.link_url, 2000);
    const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : 0;
    const is_active = Boolean(body.is_active);
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
  
    const created = await prisma.homepage_highlights.create({
      data: {
        kind,
        category_id,
        product_id,
        brand_id,
        title,
        subtitle: subtitle ?? null,
        image_url: image_url ?? null,
        image_public_id: image_public_id ?? null,
        link_url: link_url ?? null,
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
