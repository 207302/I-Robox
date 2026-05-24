-- Listing / homepage filter indexes
CREATE INDEX IF NOT EXISTS "idx_products_created_at" ON "products"("created_at");
CREATE INDEX IF NOT EXISTS "idx_products_updated_at" ON "products"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_products_category_brand" ON "products"("category_id", "brand_id");
CREATE INDEX IF NOT EXISTS "idx_products_category_active" ON "products"("category_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_products_brand_active" ON "products"("brand_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_flash_sale_is_active" ON "flash_sale_products"("is_active");
CREATE INDEX IF NOT EXISTS "idx_flash_sale_active_until" ON "flash_sale_products"("active_until");
CREATE INDEX IF NOT EXISTS "idx_flash_sale_active_product" ON "flash_sale_products"("is_active", "product_id");

CREATE INDEX IF NOT EXISTS "idx_homepage_hero_slides_is_active" ON "homepage_hero_slides"("is_active");
CREATE INDEX IF NOT EXISTS "idx_homepage_hero_slides_sort_order" ON "homepage_hero_slides"("sort_order");

CREATE INDEX IF NOT EXISTS "idx_homepage_highlights_is_active" ON "homepage_highlights"("is_active");
CREATE INDEX IF NOT EXISTS "idx_homepage_highlights_sort_order" ON "homepage_highlights"("sort_order");

CREATE INDEX IF NOT EXISTS "idx_homepage_brand_rail_is_active" ON "homepage_brand_rail"("is_active");
CREATE INDEX IF NOT EXISTS "idx_homepage_brand_rail_sort_order" ON "homepage_brand_rail"("sort_order");
CREATE INDEX IF NOT EXISTS "idx_homepage_brand_rail_active_sort" ON "homepage_brand_rail"("is_active", "sort_order");

CREATE INDEX IF NOT EXISTS "idx_homepage_category_tiles_is_active" ON "homepage_category_tiles"("is_active");
CREATE INDEX IF NOT EXISTS "idx_homepage_category_tiles_sort_order" ON "homepage_category_tiles"("sort_order");

-- Typo-tolerant / ILIKE search (pg_trgm) — complements existing products_name_trgm_idx
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_short_description_trgm_idx
  ON products USING gin (short_description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brands_name_trgm_idx
  ON brands USING gin (name gin_trgm_ops);
