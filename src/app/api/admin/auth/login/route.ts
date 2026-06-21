import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { getAuthSecret, setAdminSessionCookie } from "@/lib/auth/session";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody } from "@/lib/validation/input";
import { validateEmailAddress, validatePassword } from "@/lib/validation/rules";
import { runApiRoute } from "@/lib/api/runApiRoute";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "MANAGER", "STAFF", "SUPPORT"]);
const SESSION_TTL = 60 * 60 * 8; // 8-hour session for admin

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      await rateLimitStrict(`admin_login:${req.ip ?? "unknown"}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const emailResult = validateEmailAddress(body.email, { commonProviderOnly: false });
    if (!emailResult.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const email = emailResult.value;
    const password = passwordResult.value;
  
    const admin = await prisma.admin_users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        is_active: true,
        admin_user_roles: { select: { roles: { select: { name: true } } } },
      },
    });
  
    const dummyHash = "$2b$12$invalidhashfortimingprotection000000000000000000000000";
    const hashToCheck = admin?.password_hash ?? dummyHash;
    const passwordOk = await bcrypt.compare(password, hashToCheck);
  
    if (!admin || !admin.is_active || !passwordOk) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
  
    const roles = admin.admin_user_roles.map((ur) => ur.roles.name as string);
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));
  
    if (!hasAdminRole) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
  
    const token = signJwt({ sub: admin.id, email: admin.email, roles }, getAuthSecret(), SESSION_TTL);
  
    await setAdminSessionCookie(token, SESSION_TTL);
    return NextResponse.json({ ok: true });
  
  });}
