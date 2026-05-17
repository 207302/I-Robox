import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { v2 as cloudinary } from "cloudinary";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateProductById } from "@/lib/cache/productCache";

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    // Optional transformation / version segments (e.g. c_fill/.../v171234/folder/name.webp)
    tail = tail.replace(/^([^/]+\/)*v\d+\//, "");
    if (!tail) return null;
    return tail.replace(/\.[^.\/]+$/, "");
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const images = await prisma.product_images.findMany({
      where: { product_id: id },
      orderBy: { sort_order: "asc" },
      select: { id: true, url: true, alt_text: true, sort_order: true },
    });
    return NextResponse.json(images);
  
  });}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  
    let productVariantId: string | null = null;
    const rawVariantId = body.product_variant_id;
    if (rawVariantId != null && rawVariantId !== "") {
      if (typeof rawVariantId !== "string" || !isUuid(rawVariantId)) {
        return NextResponse.json({ error: "Invalid product_variant_id" }, { status: 400 });
      }
      const variant = await prisma.product_variants.findFirst({
        where: { id: rawVariantId, product_id: id },
        select: { id: true },
      });
      if (!variant) {
        return NextResponse.json({ error: "Variant not found for this product" }, { status: 400 });
      }
      productVariantId = rawVariantId;
    }
  
    const maxOrder = await prisma.product_images.aggregate({
      _max: { sort_order: true },
      where: { product_id: id, product_variant_id: productVariantId },
    });
  
    const image = await prisma.product_images.create({
      data: {
        product_id: id,
        product_variant_id: productVariantId,
        url: cleanText(body.url, 2000),
        alt_text: body.alt_text ? cleanText(body.alt_text, 255) : null,
        sort_order: (maxOrder._max.sort_order ?? -1) + 1,
      },
      select: { id: true, url: true, alt_text: true, sort_order: true, product_variant_id: true },
    });
    await revalidateProductById(id);
    return NextResponse.json(image, { status: 201 });
  
  });}

/** PATCH — update sort_order in bulk after drag-reorder.
 *  Body: { order: string[] }  — array of image IDs in their new order (0-indexed).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: productId } = await ctx.params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    if (!Array.isArray(body.order)) {
      return NextResponse.json({ error: "order array required" }, { status: 400 });
    }
    const order: string[] = body.order.filter((id) => typeof id === "string" && isUuid(id));
  
    await Promise.all(
      order.map((imgId, i) =>
        prisma.product_images.updateMany({
          where: { id: imgId, product_id: productId },
          data: { sort_order: i },
        })
      )
    );
    await revalidateProductById(productId);
    return NextResponse.json({ ok: true });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: productId } = await ctx.params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const imageId = cleanText(searchParams.get("imageId") ?? "", 128);
    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }
  
    const row = await prisma.product_images.findFirst({
      where: { id: imageId, product_id: productId },
      select: { url: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Image not found for this product" }, { status: 404 });
    }
  
    const deleted = await prisma.product_images.deleteMany({ where: { id: imageId, product_id: productId } });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Image could not be deleted" }, { status: 409 });
    }
  
    const pid = row?.url ? cloudinaryPublicIdFromUrl(row.url) : null;
    if (pid) {
      cloudinary.uploader.destroy(pid, { resource_type: "image" }).catch(() => {});
    }
    await revalidateProductById(productId);
    return NextResponse.json({ ok: true });
  
  });}
