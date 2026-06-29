/** Client-side session user shape from GET /api/auth/me */
export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  roles: string[];
};

export type MeApiResponse = {
  user: SessionUser | null;
};

export const AUTH_CHANGED_EVENT = "irobox-auth-changed";

/** Set before `AUTH_CHANGED_EVENT` so the post-login welcome popup can open once. */
export const LOGIN_WELCOME_PENDING_KEY = "irobox-pending-login-welcome";

export function markPendingLoginWelcome() {
  try {
    sessionStorage.setItem(LOGIN_WELCOME_PENDING_KEY, "1");
  } catch {
    /* private browsing / SSR */
  }
}

export function takePendingLoginWelcome(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_WELCOME_PENDING_KEY) === "1") {
      sessionStorage.removeItem(LOGIN_WELCOME_PENDING_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Greeting label for header / UI (matches previous MainHeader logic). */
export function displayNameFromUser(user: SessionUser | null | undefined): string | null {
  if (!user) return null;
  const rawName = user.name?.trim();
  const fromEmail = user.email?.split("@")[0]?.trim();
  const fromPhone = user.phone?.trim();
  return rawName || fromEmail || fromPhone || null;
}
