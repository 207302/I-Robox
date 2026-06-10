ALTER TABLE "site_marketing_settings"
  ADD COLUMN "abandoned_cart_idle_minutes" INTEGER NOT NULL DEFAULT 2880;

UPDATE "site_marketing_settings"
SET "abandoned_cart_idle_minutes" = "abandoned_cart_idle_hours" * 60;

ALTER TABLE "site_marketing_settings"
  DROP COLUMN "abandoned_cart_idle_hours";
