import { AUTH_COOKIE_NAME } from "@/lib/auth/cookieNames";

/** True when the customer session cookie is present (does not validate JWT). */
export function hasCustomerAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  const prefix = `${AUTH_COOKIE_NAME}=`;
  return document.cookie.split(";").some((part) => {
    const trimmed = part.trim();
    return trimmed.startsWith(prefix) && trimmed.length > prefix.length;
  });
}
