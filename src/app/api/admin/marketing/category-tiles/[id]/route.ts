import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromStoredOrUrl(
  publicId: string | null | undefined,
  url: string | null | undefined
): string | null {
  if (publicId?.trim()) return publicId.trim();
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
      await rateLimitStrict(`admin_marketing_ct_patch:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
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
  
    const image_url =
      body.image_url !== undefined ? cleanText(body.image_url, 2000) : undefined;
    const image_public_id =
      body.image_public_id !== undefined
        ? cleanOptionalText(body.image_public_id, 255)
        : undefined;
    const label_override =
      body.label_override !== undefined
        ? cleanOptionalText(body.label_override, 120)
        : undefined;
    const sort_order =
      body.sort_order !== undefined ? Number(body.sort_order) : undefined;
    const is_active =
      typeof body.is_active === "boolean" ? body.is_active : undefined;
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
  
    if (image_url !== undefined && !image_url) {
      return NextResponse.json({ error: "image_url cannot be empty" }, { status: 400 });
    }
  
    await prisma.homepage_category_tiles.update({
      where: { id },
      data: {
        ...(image_url !== undefined ? { image_url } : {}),
        ...(image_public_id !== undefined ? { image_public_id: image_public_id ?? null } : {}),
        ...(label_override !== undefined ? { label_override: label_override ?? null } : {}),
        ...(sort_order !== undefined && Number.isFinite(sort_order) ? { sort_order } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(body.active_from !== undefined ? { active_from: active_from ?? null } : {}),
        ...(body.active_until !== undefined ? { active_until: active_until ?? null } : {}),
      },
    });
  
    return NextResponse.json({ ok: true });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_ct_del:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const row = await prisma.homepage_category_tiles.findUnique({
      where: { id },
      select: { image_url: true, image_public_id: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    await prisma.homepage_category_tiles.delete({ where: { id } });
  
    const derived = cloudinaryPublicIdFromStoredOrUrl(row.image_public_id, row.image_url);
    if (derived?.startsWith("irobox/homepage-category-tiles/")) {
      await cloudinary.uploader.destroy(derived).catch(() => null);
    }
  
    return NextResponse.json({ ok: true });
  
  });}
