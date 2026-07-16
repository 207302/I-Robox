CREATE TABLE "cod_allowed_brands" (
    "brand_id" UUID NOT NULL,

    CONSTRAINT "cod_allowed_brands_pkey" PRIMARY KEY ("brand_id")
);

CREATE TABLE "cod_allowed_categories" (
    "category_id" UUID NOT NULL,

    CONSTRAINT "cod_allowed_categories_pkey" PRIMARY KEY ("category_id")
);

ALTER TABLE "cod_allowed_brands"
ADD CONSTRAINT "cod_allowed_brands_brand_id_fkey"
FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "cod_allowed_categories"
ADD CONSTRAINT "cod_allowed_categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
