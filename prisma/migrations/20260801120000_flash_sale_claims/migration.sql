-- Flash sale one-purchase claims: optional shared sale_tag + per-customer claim rows.

ALTER TABLE "flash_sales" ADD COLUMN "sale_tag" VARCHAR(80);

CREATE INDEX "idx_flash_sales_sale_tag" ON "flash_sales"("sale_tag");

CREATE TABLE "flash_sale_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "sale_tag" VARCHAR(80) NOT NULL,
    "flash_sale_id" UUID,
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flash_sale_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flash_sale_claims_order_id_key" ON "flash_sale_claims"("order_id");
CREATE UNIQUE INDEX "flash_sale_claims_customer_sale_tag_key" ON "flash_sale_claims"("customer_id", "sale_tag");
CREATE INDEX "idx_flash_sale_claims_customer_id" ON "flash_sale_claims"("customer_id");
CREATE INDEX "idx_flash_sale_claims_sale_tag" ON "flash_sale_claims"("sale_tag");

ALTER TABLE "flash_sale_claims" ADD CONSTRAINT "flash_sale_claims_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "flash_sale_claims" ADD CONSTRAINT "flash_sale_claims_flash_sale_id_fkey"
  FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "flash_sale_claims" ADD CONSTRAINT "flash_sale_claims_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
