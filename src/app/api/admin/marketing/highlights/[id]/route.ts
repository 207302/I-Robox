import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

const HIGHLIGHT_KINDS = ["FEATURED", "TRENDING", "CATEGORY", "PRODUCT", "BRAND", "CUSTOM"] as const;
type HighlightKind = (typeof HIGHLIGHT_KINDS)[number];

function parseKind(s: string): HighlightKind | null {
  return (HIGHLIGHT_KINDS as readonly string[]).includes(s) ? (s as HighlightKind) : null;
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = "/image/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    tail = tail.replace(/^v\d+\//, "");
    tail = tail.replace(/\.[a-zA-Z0-9]+$/, "");
    return tail || null;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_hi_patch:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const data: Record<string, unknown> = {};
  
    if (body.kind !== undefined) {
      const kind = parseKind(cleanText(body.kind, 40));
      if (!kind) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
      data.kind = kind;
    }
  
    if (body.category_id !== undefined) {
      const cid = body.category_id ? String(body.category_id) : null;
      if (cid && !isUuid(cid)) return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
      data.category_id = cid;
    }
    if (body.product_id !== undefined) {
      const pid = body.product_id ? String(body.product_id) : null;
      if (pid && !isUuid(pid)) return NextResponse.json({ error: "Invalid product_id" }, { status: 400 });
      data.product_id = pid;
    }
    if (body.brand_id !== undefined) {
      const bid = body.brand_id ? String(body.brand_id) : null;
      if (bid && !isUuid(bid)) return NextResponse.json({ error: "Invalid brand_id" }, { status: 400 });
      data.brand_id = bid;
    }
  
    if (body.title !== undefined) {
      const title = cleanText(body.title, 255);
      if (!title) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      data.title = title;
    }
    if (body.subtitle !== undefined) data.subtitle = cleanOptionalText(body.subtitle, 500) ?? null;
    if (body.image_url !== undefined) data.image_url = cleanOptionalText(body.image_url, 2000) ?? null;
    if (body.image_public_id !== undefined) data.image_public_id = cleanOptionalText(body.image_public_id, 255) ?? null;
    if (body.link_url !== undefined) data.link_url = cleanOptionalText(body.link_url, 2000) ?? null;
    if (body.sort_order !== undefined) {
      const n = Number(body.sort_order);
      if (Number.isFinite(n)) data.sort_order = n;
    }
    if (typeof body.is_active === "boolean") data.is_active = body.is_active;
    if (body.active_from !== undefined) {
      const d = parseOptionalDate(body.active_from);
      if (d === undefined && body.active_from !== null && body.active_from !== "") {
        return NextResponse.json({ error: "Invalid active_from" }, { status: 400 });
      }
      data.active_from = d ?? null;
    }
    if (body.active_until !== undefined) {
      const d = parseOptionalDate(body.active_until);
      if (d === undefined && body.active_until !== null && body.active_until !== "") {
        return NextResponse.json({ error: "Invalid active_until" }, { status: 400 });
      }
      data.active_until = d ?? null;
    }
  
    await prisma.homepage_highlights.update({ where: { id }, data });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_hi_del:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const row = await prisma.homepage_highlights.findUnique({
      where: { id },
      select: { image_url: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    await prisma.homepage_highlights.delete({ where: { id } });
    const derivedPublicId = cloudinaryPublicIdFromUrl(row.image_url);
    if (derivedPublicId?.startsWith("irobox/homepage-highlights/")) {
      await cloudinary.uploader.destroy(derivedPublicId).catch(() => null);
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
