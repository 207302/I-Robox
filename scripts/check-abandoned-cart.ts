import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ABANDONED_CART_IDLE_MINUTES,
  resolveAbandonedCartIdleMinutes,
} from "../src/lib/marketing/abandonedCart";

const SITE_MARKETING_SETTINGS_ID = "00000000-0000-4000-8000-000000000001";

async function resolveSettings(prisma: PrismaClient) {
  const minutesRaw = Number(process.env.ABANDONED_CART_MINUTES ?? "");
  if (Number.isFinite(minutesRaw) && minutesRaw > 0) {
    return { enabled: true, idleMs: minutesRaw * 60 * 1000, source: "env_minutes" as const };
  }
  try {
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
        source: "db" as const,
      };
    }
  } catch {
    // Migration not applied — fall through to default.
  }
  const minutes = DEFAULT_ABANDONED_CART_IDLE_MINUTES;
  return { enabled: true, idleMs: minutes * 60 * 1000, source: "default" as const };
}

async function main() {
  const prisma = new PrismaClient();
  const settings = await resolveSettings(prisma);
  const cutoff = new Date(Date.now() - settings.idleMs);

  let eligible: Array<{
    id: string;
    updated_at: Date;
    customers: { email: string | null } | null;
    _count: { cart_items: number };
  }> = [];
  try {
    eligible = await prisma.carts.findMany({
      where: {
        status: "ACTIVE",
        customer_id: { not: null },
        abandoned_reminder_sent_at: null,
        updated_at: { lt: cutoff },
        cart_items: { some: {} },
      },
      select: {
        id: true,
        updated_at: true,
        customers: { select: { email: true } },
        _count: { select: { cart_items: true } },
      },
      take: 20,
    });
  } catch (e) {
    console.error("eligible query failed:", e);
  }

  const allActive = await prisma.carts.count({
    where: { status: "ACTIVE", customer_id: { not: null } },
  });

  let dbSettings: unknown = null;
  try {
    dbSettings = await prisma.site_marketing_settings.findFirst({
      select: {
        abandoned_cart_reminders_enabled: true,
        abandoned_cart_idle_minutes: true,
      },
    });
  } catch (e) {
    dbSettings = { error: String(e) };
  }

  const settingsCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'site_marketing_settings' AND column_name LIKE 'abandoned%'
    ORDER BY column_name`;
  const cartCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'carts' AND column_name LIKE 'abandoned%'
    ORDER BY column_name`;

  console.log(
    JSON.stringify(
      {
        settings,
        dbSettings,
        settingsCols: settingsCols.map((r) => r.column_name),
        cartCols: cartCols.map((r) => r.column_name),
        cutoff: cutoff.toISOString(),
        activeLoggedInCarts: allActive,
        eligibleNow: eligible.length,
        eligible,
        emailConfigured: Boolean(
          process.env.EMAIL_SERVER_HOST &&
            process.env.EMAIL_SERVER_PORT &&
            process.env.EMAIL_SERVER_USER &&
            process.env.EMAIL_SERVER_PASSWORD &&
            process.env.EMAIL_FROM
        ),
        cronSecretSet: Boolean(process.env.CRON_SECRET),
        abandonedCartMinutesEnv: process.env.ABANDONED_CART_MINUTES ?? null,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
