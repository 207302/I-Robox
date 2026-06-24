import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { requireAdmin } from "@/lib/admin/rbac";
import { prisma } from "@/lib/prisma";
import { verifyStoredAdminTotpCode } from "@/lib/auth/adminTotp";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody } from "@/lib/validation/input";
import { validateOtpCode, validatePassword } from "@/lib/validation/rules";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function POST(req: NextRequest) {
  return runAdminApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_2fa_disable:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;

    const passwordResult = validatePassword(body.password);
    const otpResult = validateOtpCode(body.code);
    if (!passwordResult.ok) {
      return NextResponse.json({ error: passwordResult.error }, { status: 400 });
    }
    if (!otpResult.ok) {
      return NextResponse.json({ error: otpResult.error }, { status: 400 });
    }

    const admin = await prisma.admin_users.findUnique({
      where: { id: auth.session.sub },
      select: {
        password_hash: true,
        totp_enabled: true,
        totp_secret: true,
      },
    });
    if (!admin?.totp_enabled || !admin.totp_secret) {
      return NextResponse.json({ error: "Two-factor authentication is not enabled." }, { status: 400 });
    }

    const passwordOk = await bcrypt.compare(passwordResult.value, admin.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const totpOk = await verifyStoredAdminTotpCode(admin.totp_secret, otpResult.value);
    if (!totpOk) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    await prisma.admin_users.update({
      where: { id: auth.session.sub },
      data: {
        totp_secret: null,
        totp_enabled: false,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ ok: true, enabled: false });
  }, { name: "POST /api/admin/auth/2fa/disable" });
}
