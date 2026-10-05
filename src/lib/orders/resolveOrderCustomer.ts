import "server-only";

import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/validation/input";

/**
 * Customer id to use for order ownership. The JWT `sub` is ignored when it is
 * missing, not a customer id, or no longer an active customer (stale session).
 */
export async function resolveLiveCustomerId(
  session: { sub?: string | null } | null
): Promise<string | null> {
  const sub = session?.sub?.trim() ?? "";
  if (!sub || !isUuid(sub)) return null;

  const customer = await prisma.customers.findUnique({
    where: { id: sub },
    select: { id: true, is_active: true },
  });
  if (!customer?.is_active) return null;
  return customer.id;
}
