CREATE TABLE "coupon_brands" (
    "coupon_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,

    CONSTRAINT "coupon_brands_pkey" PRIMARY KEY ("coupon_id","brand_id")
);

CREATE INDEX "idx_coupon_brands_brand_id" ON "coupon_brands"("brand_id");

ALTER TABLE "coupon_brands" ADD CONSTRAINT "coupon_brands_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "coupon_brands" ADD CONSTRAINT "coupon_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
