import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/clientSession";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { getSession } from "@/lib/auth/session";

/** Storefront user for client hydration — matches GET /api/auth/me. */
export async function resolveSessionUser(
  existingSession?: Awaited<ReturnType<typeof getSession>>
): Promise<SessionUser | null> {
  const session = existingSession ?? (await getSession());
  if (!session?.sub) return null;

  const user = await prisma.customers.findUnique({
    where: { id: session.sub },
    select: { name: true, email: true, phone: true },
  });

  const email =
    user?.email && !isSyntheticPhoneSignupEmail(user.email) ? user.email : null;

  return {
    id: session.sub,
    email,
    phone: user?.phone ?? null,
    name: user?.name ?? null,
    roles: session.roles,
  };
}
