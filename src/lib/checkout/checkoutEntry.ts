/** Where a signed-out shopper should land after they sign in from checkout. */
export const CHECKOUT_LOGIN_NEXT = "/cart";

/** Safe internal path (no open redirects). Mirrors the OAuth `next` check. */
function safeInternalPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.length > 512 || /[\r\n\0]/.test(trimmed)) return "/";
  return trimmed;
}

/**
 * Signed-in shoppers go to checkout. Guests and expired sessions go to sign-in
 * and come back to the cart (the cart itself is kept in local storage).
 */
export function checkoutEntryHref(userId: string | null | undefined): string {
  const id = userId?.trim() ?? "";
  if (!id) return `/login?next=${encodeURIComponent(CHECKOUT_LOGIN_NEXT)}`;
  return "/checkout";
}

/** Path to open after a successful sign-in. Rejects open redirects and login loops. */
export function postLoginPath(raw: string | null | undefined): string {
  const next = safeInternalPath(raw);
  if (next.startsWith("/login")) return "/";
  return next;
}
