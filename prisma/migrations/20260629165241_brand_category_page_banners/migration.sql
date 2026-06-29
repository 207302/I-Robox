-- CreateTable
CREATE TABLE "brand_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID NOT NULL,
    "hero_image" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "hero_image" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_pages_brand_id_key" ON "brand_pages"("brand_id");

-- CreateIndex
CREATE INDEX "idx_brand_pages_brand_id" ON "brand_pages"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_pages_category_id_key" ON "category_pages"("category_id");

-- CreateIndex
CREATE INDEX "idx_category_pages_category_id" ON "category_pages"("category_id");

-- AddForeignKey
ALTER TABLE "brand_pages" ADD CONSTRAINT "brand_pages_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "category_pages" ADD CONSTRAINT "category_pages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
