import { prisma } from "@/lib/prisma";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";

export const DEFAULT_ABANDONED_CART_IDLE_HOURS = 48;
export const MIN_ABANDONED_CART_IDLE_HOURS = 1;
export const MAX_ABANDONED_CART_IDLE_HOURS = 168;

export function resolveAbandonedCartIdleHours(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_ABANDONED_CART_IDLE_HOURS;
  }
  return Math.min(
    MAX_ABANDONED_CART_IDLE_HOURS,
    Math.max(MIN_ABANDONED_CART_IDLE_HOURS, Math.round(value))
  );
}

export type AbandonedCartSettings = {
  enabled: boolean;
  idleMs: number;
  idleHours: number;
  source: "env_minutes" | "db" | "env_hours" | "default";
};

/** Cron + admin: env ABANDONED_CART_MINUTES overrides DB for dev/staging. */
export async function getAbandonedCartSettings(): Promise<AbandonedCartSettings> {
  const minutesRaw = Number(process.env.ABANDONED_CART_MINUTES ?? "");
  if (Number.isFinite(minutesRaw) && minutesRaw > 0) {
    return {
      enabled: true,
      idleMs: minutesRaw * 60 * 1000,
      idleHours: minutesRaw / 60,
      source: "env_minutes",
    };
  }

  const row = await prisma.site_marketing_settings.findUnique({
    where: { id: SITE_MARKETING_SETTINGS_ID },
    select: {
      abandoned_cart_reminders_enabled: true,
      abandoned_cart_idle_hours: true,
    },
  });

  if (row) {
    const hours = resolveAbandonedCartIdleHours(row.abandoned_cart_idle_hours);
    return {
      enabled: row.abandoned_cart_reminders_enabled,
      idleMs: hours * 60 * 60 * 1000,
      idleHours: hours,
      source: "db",
    };
  }

  const envHours = Number(process.env.ABANDONED_CART_HOURS ?? "");
  const hours = Number.isFinite(envHours) && envHours > 0
    ? resolveAbandonedCartIdleHours(envHours)
    : DEFAULT_ABANDONED_CART_IDLE_HOURS;

  return {
    enabled: true,
    idleMs: hours * 60 * 60 * 1000,
    idleHours: hours,
    source: Number.isFinite(envHours) && envHours > 0 ? "env_hours" : "default",
  };
}
