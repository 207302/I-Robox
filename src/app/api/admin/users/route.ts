import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { cleanText, hasSuspiciousInput, isUuid, normalizeEmail, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const ADMIN_ROLES = ["SUPER_ADMIN", "MANAGER", "STAFF", "SUPPORT"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

function isSuperAdmin(roles: string[]) {
  return roles.includes("SUPER_ADMIN");
}

export async function GET() {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isSuperAdmin(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    const admins = await prisma.admin_users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        is_active: true,
        created_at: true,
        admin_user_roles: { select: { roles: { select: { name: true } } } },
      },
      orderBy: { created_at: "asc" },
    });
  
    return NextResponse.json(
      admins.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        is_active: u.is_active,
        roles: u.admin_user_roles.map((ur) => ur.roles.name),
        created_at: u.created_at,
      }))
    );
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
  
    const session = await getAdminSession();
    if (!session || !isSuperAdmin(session.roles)) {
      return NextResponse.json({ error: "Only SUPER_ADMIN can create admin users" }, { status: 403 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const email = normalizeEmail(body.email);
    const password = typeof body?.password === "string" ? body.password : "";
    const rawRole = (body as { role?: unknown }).role;
    const role: AdminRole = ADMIN_ROLES.includes(rawRole as AdminRole)
      ? (rawRole as AdminRole)
      : "STAFF";
    const name = body?.name ? cleanText(body.name, 150) : null;
  
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (hasSuspiciousInput(email) || (name ? hasSuspiciousInput(name) : false)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
  
    const existing = await prisma.admin_users.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
  
    const roleRow = await prisma.roles.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
      select: { id: true },
    });
  
    const password_hash = await bcrypt.hash(password, 12);
  
    const admin = await prisma.admin_users.create({
      data: {
        email,
        password_hash,
        name,
        is_active: true,
        admin_user_roles: {
          create: { role_id: roleRow.id },
        },
      },
      select: { id: true, email: true },
    });
  
    return NextResponse.json({ ok: true, id: admin.id, email: admin.email }, { status: 201 });
  
  });}

export async function DELETE(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
  
    const session = await getAdminSession();
    if (!session || !isSuperAdmin(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    if (!userId || !isUuid(userId)) return NextResponse.json({ error: "id required" }, { status: 400 });
  
    if (userId === session.sub) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }
  
    await prisma.admin_users.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  
  });}
