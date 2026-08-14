-- Drop shared sale_tag from flash sales; limits are always per flash sale.
-- Re-key existing claims to the flash sale id when available.

UPDATE "flash_sale_claims"
SET "sale_tag" = "flash_sale_id"::text
WHERE "flash_sale_id" IS NOT NULL;

DROP INDEX IF EXISTS "idx_flash_sales_sale_tag";

ALTER TABLE "flash_sales" DROP COLUMN IF EXISTS "sale_tag";
