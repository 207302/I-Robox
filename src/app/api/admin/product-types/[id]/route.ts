import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateShopTaxonomy } from "@/lib/cache/revalidate";

function isAllowed(roles: string[]) {
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT")
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await prisma.product_types.findUnique({
      where: { id },
      select: { id: true, category_id: true, name: true, slug: true, is_active: true, sort_order: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  
  });}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body as Record<string, unknown>;
  
    const data: {
      name?: string;
      slug?: string;
      is_active?: boolean;
      sort_order?: number;
      category_id?: string;
    } = {};
  
    if (body.name !== undefined) {
      const name = cleanText(String(body.name), 120);
      if (!name || hasSuspiciousInput(name)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.slug !== undefined) {
      const slug = cleanText(String(body.slug), 160);
      if (!slug || hasSuspiciousInput(slug)) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      const clash = await prisma.product_types.findFirst({ where: { slug, NOT: { id } } });
      if (clash) {
        return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
      }
      data.slug = slug;
    }
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);
    if (body.sort_order !== undefined) {
      const n = Number(body.sort_order);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 });
      data.sort_order = n;
    }
    if (body.category_id !== undefined) {
      const cid = body.category_id === null || body.category_id === "" ? null : String(body.category_id);
      if (cid) {
        if (!isUuid(cid)) return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
        const c = await prisma.categories.findUnique({ where: { id: cid } });
        if (!c) return NextResponse.json({ error: "Category not found" }, { status: 400 });
        data.category_id = cid;
      }
    }
  
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }
  
    const row = await prisma.product_types.update({
      where: { id },
      data,
      select: { id: true, category_id: true, name: true, slug: true, is_active: true, sort_order: true },
    });
    revalidateShopTaxonomy();
    return NextResponse.json(row);
  
  });}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    try {
      await prisma.product_types.delete({ where: { id } });
      revalidateShopTaxonomy();
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[product-types DELETE]", e);
      return NextResponse.json({ error: "Could not delete (in use?)" }, { status: 409 });
    }
  
  });}
