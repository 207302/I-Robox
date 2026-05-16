import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaDB";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";

function isAllowed(roles: string[]) {
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT")
  );
}

type Ctx = { params: Promise<{ id: string }> };

function slugFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function PUT(req: NextRequest, ctx: Ctx) {
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
  const name = cleanText(parsed.body.name, 120);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (hasSuspiciousInput(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const baseSlug = slugFromName(name);
  if (!baseSlug) return NextResponse.json({ error: "Invalid slug from name" }, { status: 400 });
  const clash = await prisma.categories.findFirst({ where: { slug: baseSlug, NOT: { id } } });
  const finalSlug = clash ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug;

  const row = await prisma.categories.update({
    where: { id },
    data: { name, slug: finalSlug },
    select: { id: true, name: true, slug: true },
  });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
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
    await prisma.categories.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this category because products/types or child categories are linked to it.",
        },
        { status: 409 }
      );
    }
    console.error("[categories DELETE]", e);
    return NextResponse.json({ error: "Could not delete category" }, { status: 409 });
  }
}
