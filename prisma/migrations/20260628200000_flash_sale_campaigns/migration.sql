-- Flash sales: campaigns with product/category/brand scope + fixed or percentage discount.

ALTER TABLE "flash_sale_products" RENAME TO "flash_sale_products_legacy";
ALTER TABLE "flash_sale_products_legacy"
  RENAME CONSTRAINT "flash_sale_products_pkey" TO "flash_sale_products_legacy_pkey";
ALTER TABLE "flash_sale_products_legacy"
  RENAME CONSTRAINT "flash_sale_products_product_id_fkey" TO "flash_sale_products_legacy_product_id_fkey";
ALTER INDEX "flash_sale_products_product_id_key" RENAME TO "flash_sale_products_legacy_product_id_key";

CREATE TABLE "flash_sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120),
    "discount_type" VARCHAR(20) NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "active_from" TIMESTAMPTZ(6),
    "active_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_flash_sales_is_active" ON "flash_sales"("is_active");
CREATE INDEX "idx_flash_sales_active_until" ON "flash_sales"("active_until");

CREATE TABLE "flash_sale_products" (
    "flash_sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "flash_sale_products_pkey" PRIMARY KEY ("flash_sale_id","product_id")
);

CREATE INDEX "idx_flash_sale_products_product_id" ON "flash_sale_products"("product_id");

CREATE TABLE "flash_sale_categories" (
    "flash_sale_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "flash_sale_categories_pkey" PRIMARY KEY ("flash_sale_id","category_id")
);

CREATE INDEX "idx_flash_sale_categories_category_id" ON "flash_sale_categories"("category_id");

CREATE TABLE "flash_sale_brands" (
    "flash_sale_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,

    CONSTRAINT "flash_sale_brands_pkey" PRIMARY KEY ("flash_sale_id","brand_id")
);

CREATE INDEX "idx_flash_sale_brands_brand_id" ON "flash_sale_brands"("brand_id");

ALTER TABLE "flash_sale_products" ADD CONSTRAINT "flash_sale_products_flash_sale_id_fkey"
  FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "flash_sale_products" ADD CONSTRAINT "flash_sale_products_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "flash_sale_categories" ADD CONSTRAINT "flash_sale_categories_flash_sale_id_fkey"
  FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "flash_sale_categories" ADD CONSTRAINT "flash_sale_categories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "flash_sale_brands" ADD CONSTRAINT "flash_sale_brands_flash_sale_id_fkey"
  FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "flash_sale_brands" ADD CONSTRAINT "flash_sale_brands_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Migrate legacy per-product fixed prices into individual campaigns.
INSERT INTO "flash_sales" (
    "id",
    "name",
    "discount_type",
    "discount_value",
    "is_active",
    "active_from",
    "active_until",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    NULL,
    'FIXED',
    "sale_price",
    "is_active",
    "active_from",
    "active_until",
    "created_at",
    "updated_at"
FROM "flash_sale_products_legacy";

INSERT INTO "flash_sale_products" ("flash_sale_id", "product_id")
SELECT "id", "product_id" FROM "flash_sale_products_legacy";

DROP TABLE "flash_sale_products_legacy";
