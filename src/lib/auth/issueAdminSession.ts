import "server-only";
import { signJwt } from "@/lib/auth/jwt";
import { getAuthSecret, setAdminSessionCookie } from "@/lib/auth/session";

export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

export async function issueAdminSession(input: {
  adminId: string;
  email: string;
  roles: string[];
}) {
  const token = signJwt(
    { sub: input.adminId, email: input.email, roles: input.roles },
    getAuthSecret(),
    ADMIN_SESSION_TTL_SECONDS
  );
  await setAdminSessionCookie(token, ADMIN_SESSION_TTL_SECONDS);
}
