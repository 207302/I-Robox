ALTER TABLE "site_marketing_settings"
  ADD COLUMN "abandoned_cart_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "abandoned_cart_idle_hours" INTEGER NOT NULL DEFAULT 48;
