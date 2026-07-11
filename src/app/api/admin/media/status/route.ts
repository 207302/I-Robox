import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { runApiRoute } from "@/lib/api/runApiRoute";
import {
  getCloudinaryCloudName,
  getMissingCloudinaryEnvKeys,
  isCloudinaryAdminConfigured,
  pingCloudinaryAdmin,
} from "@/lib/cloudinary/adminImageUpload";

/** Quick diagnostics for the bulk upload panel (no secrets returned). */
export async function GET() {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    const roles = session?.roles ?? [];
    const canUpload = roles.some((r) => ["SUPER_ADMIN", "MANAGER", "STAFF"].includes(r));
    const configured = isCloudinaryAdminConfigured();
    const ping = configured ? await pingCloudinaryAdmin() : { ok: false as const, error: "not_configured" };

    return NextResponse.json({
      authenticated: Boolean(session),
      canUpload,
      cloudinaryConfigured: configured,
      cloudinaryPingOk: ping.ok,
      cloudinaryError: ping.ok ? null : ping.error ?? "ping_failed",
      missingCloudinaryKeys: getMissingCloudinaryEnvKeys(),
      cloudName: getCloudinaryCloudName() || null,
    });
  });
}
