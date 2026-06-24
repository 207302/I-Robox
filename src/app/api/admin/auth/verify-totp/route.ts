import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStoredAdminTotpCode } from "@/lib/auth/adminTotp";
import { verifyAdminTotpChallenge } from "@/lib/auth/adminTotpChallenge";
import { issueAdminSession } from "@/lib/auth/issueAdminSession";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanText, readJsonBody } from "@/lib/validation/input";
import { validateOtpCode } from "@/lib/validation/rules";
import { runApiRoute } from "@/lib/api/runApiRoute";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "MANAGER", "STAFF", "SUPPORT"]);

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      await rateLimitStrict(`admin_totp_verify:${req.ip ?? "unknown"}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;

    const challenge = cleanText(body.challenge, 2048);
    const otpResult = validateOtpCode(body.code ?? body.otp);
    if (!challenge) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 400 });
    }
    if (!otpResult.ok) {
      return NextResponse.json({ error: otpResult.error }, { status: 400 });
    }

    const payload = verifyAdminTotpChallenge(challenge);
    if (!payload) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 400 });
    }

    const admin = await prisma.admin_users.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        is_active: true,
        totp_enabled: true,
        totp_secret: true,
        admin_user_roles: { select: { roles: { select: { name: true } } } },
      },
    });

    if (!admin || !admin.is_active || !admin.totp_enabled || !admin.totp_secret) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const roles = admin.admin_user_roles.map((ur) => ur.roles.name as string);
    if (!roles.some((r) => ADMIN_ROLES.has(r))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const totpOk = await verifyStoredAdminTotpCode(admin.totp_secret, otpResult.value);
    if (!totpOk) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    await issueAdminSession({ adminId: admin.id, email: admin.email, roles });
    return NextResponse.json({ ok: true });
  });
}
