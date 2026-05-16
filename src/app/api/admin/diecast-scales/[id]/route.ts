import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { normalizeDiecastScale } from "@/lib/products/diecastScales";
import { runApiRoute } from "@/lib/api/runApiRoute";

function isAllowed(roles: string[]) {
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT")
  );
}

type Ctx = { params: Promise<{ id: string }> };

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
    const rawName = cleanText(parsed.body.name, 80);
    if (!rawName) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (hasSuspiciousInput(rawName)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  
    const ratio = normalizeDiecastScale(rawName);
    if (!ratio) {
      return NextResponse.json(
        { error: "Invalid scale — use a denominator (e.g. 87) or ratio (1:87)" },
        { status: 400 }
      );
    }
  
    const clash = await prisma.diecast_scales.findFirst({
      where: { ratio, NOT: { id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "That scale already exists" }, { status: 400 });
    }
  
    const row = await prisma.diecast_scales.update({
      where: { id },
      data: { ratio, name: ratio },
      select: { id: true, name: true },
    });
    return NextResponse.json(row);
  
  });}

export async function DELETE(req: NextRequest, ctx: Ctx) {
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
  
    try {
      await prisma.diecast_scales.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      if (e?.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete this scale because products are linked to it." },
          { status: 409 }
        );
      }
      console.error("[diecast-scales DELETE]", e);
      return NextResponse.json({ error: "Could not delete scale" }, { status: 409 });
    }
  
  });}
