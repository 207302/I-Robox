-- Site-wide accent color (buttons, links, cart badge, progress bars, etc.)
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "accent_color" VARCHAR(20);
