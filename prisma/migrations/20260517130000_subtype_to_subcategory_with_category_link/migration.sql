-- Taxonomy: link product_subtypes directly to categories; orphan product type on products.

-- 1. Add category_id (nullable until backfilled)
ALTER TABLE "product_subtypes" ADD COLUMN IF NOT EXISTS "category_id" UUID;

-- 2. Backfill category_id from product_types
UPDATE "product_subtypes" ps
SET "category_id" = pt."category_id"
FROM "product_types" pt
WHERE ps."product_type_id" = pt."id"
  AND ps."category_id" IS NULL;

-- 3. Require category_id on subtypes
ALTER TABLE "product_subtypes" ALTER COLUMN "category_id" SET NOT NULL;

-- 4. FK to categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subtype_category'
  ) THEN
    ALTER TABLE "product_subtypes"
      ADD CONSTRAINT "fk_subtype_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_product_subtypes_category_id" ON "product_subtypes"("category_id");

-- 5. Orphan product type references on products (column kept for rollback)
UPDATE "products" SET "type_id" = NULL WHERE "type_id" IS NOT NULL;

-- 6. product_type_id on subtypes optional (table/column retained)
ALTER TABLE "product_subtypes" ALTER COLUMN "product_type_id" DROP NOT NULL;
