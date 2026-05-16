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
      const categories = await prisma.categories.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, parent_id: true },
      });
      return NextResponse.json(categories);
    } catch (err) {
      console.error("[categories GET]", err);
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
  
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
    // Handle slug collisions by appending a short random suffix
    const existing = await prisma.categories.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;
  
    const category = await prisma.categories.create({
      data: { name, slug: finalSlug },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json(category, { status: 201 });
  
  });}
