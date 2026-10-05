/**
 * Order access is granted only when both ids are present and equal.
 * A missing session id, a blank customer id, or a stale token that no longer
 * maps to a customer must not count as ownership (and two empty ids must not match).
 */
export function isOrderOwnedByCustomer(
  orderCustomerId: string | null | undefined,
  sessionCustomerId: string | null | undefined
): boolean {
  const orderId = orderCustomerId?.trim() ?? "";
  const sessionId = sessionCustomerId?.trim() ?? "";
  if (!orderId || !sessionId) return false;
  return orderId.toLowerCase() === sessionId.toLowerCase();
}
