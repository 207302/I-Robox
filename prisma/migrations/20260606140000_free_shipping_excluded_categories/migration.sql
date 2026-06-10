CREATE TABLE "free_shipping_excluded_categories" (
    "category_id" UUID NOT NULL,

    CONSTRAINT "free_shipping_excluded_categories_pkey" PRIMARY KEY ("category_id")
);

ALTER TABLE "free_shipping_excluded_categories" ADD CONSTRAINT "free_shipping_excluded_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
