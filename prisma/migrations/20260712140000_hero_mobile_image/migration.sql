-- Separate mobile hero banner images (optional; falls back to desktop image_url).
ALTER TABLE "homepage_hero_slides"
ADD COLUMN IF NOT EXISTS "mobile_image_url" TEXT;

ALTER TABLE "homepage_hero_slides"
ADD COLUMN IF NOT EXISTS "mobile_image_public_id" VARCHAR(255);
