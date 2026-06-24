import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { prisma } from "@/lib/prisma";
import { encryptTotpSecretForStorage, verifyAdminTotpCode } from "@/lib/auth/adminTotp";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanText, readJsonBody } from "@/lib/validation/input";
import { validateOtpCode } from "@/lib/validation/rules";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function POST(req: NextRequest) {
  return runAdminApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_2fa_enable:${req.ip ?? "unknown"}`, 1);
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

    const secret = cleanText(body.secret, 128);
    const otpResult = validateOtpCode(body.code);
    if (!secret) {
      return NextResponse.json({ error: "Setup expired. Start again." }, { status: 400 });
    }
    if (!otpResult.ok) {
      return NextResponse.json({ error: otpResult.error }, { status: 400 });
    }

    const valid = await verifyAdminTotpCode(secret, otpResult.value);
    if (!valid) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    await prisma.admin_users.update({
      where: { id: auth.session.sub },
      data: {
        totp_secret: encryptTotpSecretForStorage(secret),
        totp_enabled: true,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ ok: true, enabled: true });
  }, { name: "POST /api/admin/auth/2fa/enable" });
}
