CREATE TABLE "coupon_products" (
    "coupon_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("coupon_id","product_id")
);

CREATE INDEX "idx_coupon_products_product_id" ON "coupon_products"("product_id");

ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
