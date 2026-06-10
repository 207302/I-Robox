DROP TABLE IF EXISTS "free_shipping_excluded_categories";

CREATE TABLE "free_shipping_excluded_brands" (
    "brand_id" UUID NOT NULL,

    CONSTRAINT "free_shipping_excluded_brands_pkey" PRIMARY KEY ("brand_id")
);

ALTER TABLE "free_shipping_excluded_brands" ADD CONSTRAINT "free_shipping_excluded_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
