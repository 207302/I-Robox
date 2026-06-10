import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ABANDONED_CART_IDLE_MINUTES,
  resolveAbandonedCartIdleMinutes,
} from "@/lib/marketing/abandonedCart";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";

export type AbandonedCartSettings = {
  enabled: boolean;
  idleMs: number;
  idleHours: number;
  source: "env_minutes" | "db" | "env_hours" | "default";
};

/** Cron: env ABANDONED_CART_MINUTES overrides DB for dev/staging. */
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
      abandoned_cart_idle_minutes: true,
    },
  });

  if (row) {
    const minutes = resolveAbandonedCartIdleMinutes(row.abandoned_cart_idle_minutes);
    return {
      enabled: row.abandoned_cart_reminders_enabled,
      idleMs: minutes * 60 * 1000,
      idleHours: minutes / 60,
      source: "db",
    };
  }

  const envHours = Number(process.env.ABANDONED_CART_HOURS ?? "");
  const minutes =
    Number.isFinite(envHours) && envHours > 0
      ? resolveAbandonedCartIdleMinutes(envHours * 60)
      : DEFAULT_ABANDONED_CART_IDLE_MINUTES;

  return {
    enabled: true,
    idleMs: minutes * 60 * 1000,
    idleHours: minutes / 60,
    source: Number.isFinite(envHours) && envHours > 0 ? "env_hours" : "default",
  };
}
