import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, readJsonBody } from "@/lib/validation/input";
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

export async function GET() {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const rows = await prisma.diecast_scales.findMany({
        select: { id: true, name: true, ratio: true },
      });
      const sorted = rows.sort(
        (a, b) =>
          parseInt(a.ratio.replace(/^1:/i, ""), 10) - parseInt(b.ratio.replace(/^1:/i, ""), 10)
      );
      return NextResponse.json(sorted.map((r) => ({ id: r.id, name: r.name || r.ratio })));
    } catch (err) {
      console.error("[diecast-scales GET]", err);
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
  
    const existing = await prisma.diecast_scales.findUnique({
      where: { ratio },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, name: existing.name }, { status: 200 });
    }
  
    const row = await prisma.diecast_scales.create({
      data: { ratio, name: ratio },
      select: { id: true, name: true },
    });
    return NextResponse.json(row, { status: 201 });
  
  });}
