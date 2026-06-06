import { getAdminSession } from "@/lib/auth/session";

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return { ok: false as const, session: null };
  const roles = session.roles ?? [];
  const isAdmin = roles.some((r) =>
    ["SUPER_ADMIN", "MANAGER", "STAFF", "SUPPORT"].includes(r)
  );
  if (!isAdmin) return { ok: false as const, session };
  return { ok: true as const, session };
}

export async function requireAdminWrite() {
  const res = await requireAdmin();
  if (!res.ok) return res;
  const roles = res.session.roles ?? [];
  const canWrite = roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
  return { ok: canWrite as boolean, session: res.session };
}

export async function requireSuperAdmin() {
  const res = await requireAdmin();
  if (!res.ok) return res;
  const roles = res.session.roles ?? [];
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  return { ok: isSuperAdmin as boolean, session: res.session };
}

