-- Enforce flash-sale purchase limits per shipping phone as well as per customer account,
-- so the same buyer cannot bypass the limit by checking out with another email.
-- One order may now hold one claim per limited sale it touches.

ALTER TABLE "flash_sale_claims" ADD COLUMN "phone" VARCHAR(20);

UPDATE "flash_sale_claims" c
SET "phone" = RIGHT(REGEXP_REPLACE(a."phone", '\D', '', 'g'), 10)
FROM "orders" o
JOIN "addresses" a ON a."id" = o."shipping_address_id"
WHERE o."id" = c."order_id"
  AND LENGTH(REGEXP_REPLACE(a."phone", '\D', '', 'g')) >= 10;

CREATE INDEX "idx_flash_sale_claims_sale_tag_phone"
  ON "flash_sale_claims"("sale_tag", "phone");

DROP INDEX IF EXISTS "flash_sale_claims_order_id_key";

CREATE UNIQUE INDEX "flash_sale_claims_order_id_sale_tag_key"
  ON "flash_sale_claims"("order_id", "sale_tag");
