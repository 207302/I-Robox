-- Replace boolean one-per-customer with a numeric purchase_limit (0 = unlimited).
-- Existing limited sales become 1. Claims store quantity and may repeat per customer+tag.

ALTER TABLE "flash_sales" ADD COLUMN "purchase_limit" INTEGER NOT NULL DEFAULT 0;

UPDATE "flash_sales" SET "purchase_limit" = 1 WHERE "limit_one_per_customer" = true;
UPDATE "flash_sales" SET "purchase_limit" = 0 WHERE "limit_one_per_customer" = false;

ALTER TABLE "flash_sales" DROP COLUMN "limit_one_per_customer";

ALTER TABLE "flash_sale_claims" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "flash_sale_claims_customer_sale_tag_key";

CREATE INDEX "idx_flash_sale_claims_customer_sale_tag"
  ON "flash_sale_claims"("customer_id", "sale_tag");
