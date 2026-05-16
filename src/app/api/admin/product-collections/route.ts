import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

function isAllowed(roles: string[]) {
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT")
  );
}

export async function GET() {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const rows = await prisma.product_collections.findMany({
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, is_active: true, sort_order: true },
      });
      return NextResponse.json(rows);
    } catch (err) {
      console.error("[product-collections GET]", err);
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
    const name = cleanText(parsed.body.name, 120);
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (hasSuspiciousInput(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!baseSlug) return NextResponse.json({ error: "Invalid slug from name" }, { status: 400 });
    const existing = await prisma.product_collections.findFirst({ where: { slug: baseSlug } });
    const finalSlug = existing ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug;
    const sort_order = Number(parsed.body.sort_order);
    const row = await prisma.product_collections.create({
      data: {
        name,
        slug: finalSlug,
        is_active: parsed.body.is_active === undefined ? true : Boolean(parsed.body.is_active),
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      },
      select: { id: true, name: true, slug: true, is_active: true, sort_order: true },
    });
    return NextResponse.json(row, { status: 201 });
  
  });}
