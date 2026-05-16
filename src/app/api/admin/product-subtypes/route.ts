import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

function isAllowed(roles: string[]) {
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT")
  );
}

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const typeId = req.nextUrl.searchParams.get("type_id");
    if (!typeId || !isUuid(typeId)) {
      return NextResponse.json({ error: "type_id query required" }, { status: 400 });
    }
    try {
      const rows = await prisma.product_subtypes.findMany({
        where: { product_type_id: typeId },
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        select: {
          id: true,
          product_type_id: true,
          name: true,
          slug: true,
          is_active: true,
          sort_order: true,
        },
      });
      return NextResponse.json(rows);
    } catch (err) {
      console.error("[product-subtypes GET]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  
  });}

export async function POST(req: NextRequest) {
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
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const product_type_id = typeof body.product_type_id === "string" ? body.product_type_id : "";
    if (!isUuid(product_type_id)) return NextResponse.json({ error: "product_type_id required" }, { status: 400 });
    const name = cleanText(body.name, 120);
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (hasSuspiciousInput(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  
    const pt = await prisma.product_types.findUnique({ where: { id: product_type_id } });
    if (!pt) return NextResponse.json({ error: "Product type not found" }, { status: 400 });
  
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!baseSlug) return NextResponse.json({ error: "Invalid slug from name" }, { status: 400 });
    const existing = await prisma.product_subtypes.findFirst({ where: { slug: baseSlug } });
    const finalSlug = existing ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug;
    const sort_order = Number(body.sort_order);
  
    const row = await prisma.product_subtypes.create({
      data: {
        product_type_id,
        name,
        slug: finalSlug,
        is_active: body.is_active === undefined ? true : Boolean(body.is_active),
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      },
      select: {
        id: true,
        product_type_id: true,
        name: true,
        slug: true,
        is_active: true,
        sort_order: true,
      },
    });
    return NextResponse.json(row, { status: 201 });
  
  });}
