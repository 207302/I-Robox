/*
  Warnings:

  - You are about to drop the `AdditionalInformation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AttributeValue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Countdown` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomAttribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HeaderSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HeroBanner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HeroSlider` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SeoSetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdditionalInformation" DROP CONSTRAINT "AdditionalInformation_productId_fkey";

-- DropForeignKey
ALTER TABLE "AttributeValue" DROP CONSTRAINT "AttributeValue_customAttributeId_fkey";

-- DropForeignKey
ALTER TABLE "Countdown" DROP CONSTRAINT "Countdown_productId_fkey";

-- DropForeignKey
ALTER TABLE "CustomAttribute" DROP CONSTRAINT "CustomAttribute_productId_fkey";

-- DropForeignKey
ALTER TABLE "HeroBanner" DROP CONSTRAINT "HeroBanner_productId_fkey";

-- DropForeignKey
ALTER TABLE "HeroSlider" DROP CONSTRAINT "HeroSlider_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_productId_fkey";

-- DropForeignKey
ALTER TABLE "product_subtypes" DROP CONSTRAINT "product_subtypes_product_type_id_fkey";

-- DropIndex
DROP INDEX "brands_name_trgm_idx";

-- DropIndex
DROP INDEX "products_description_trgm_idx";

-- DropIndex
DROP INDEX "products_name_trgm_idx";

-- DropIndex
DROP INDEX "products_short_description_trgm_idx";

-- DropTable
DROP TABLE "AdditionalInformation";

-- DropTable
DROP TABLE "AttributeValue";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Countdown";

-- DropTable
DROP TABLE "CustomAttribute";

-- DropTable
DROP TABLE "HeaderSetting";

-- DropTable
DROP TABLE "HeroBanner";

-- DropTable
DROP TABLE "HeroSlider";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "SeoSetting";

-- CreateIndex
CREATE INDEX "idx_products_active_updated_desc" ON "products"("is_active", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_products_active_base_price" ON "products"("is_active", "base_price");

-- RenameForeignKey
ALTER TABLE "product_subtypes" RENAME CONSTRAINT "fk_subtype_category" TO "product_subtypes_category_id_fkey";

-- AddForeignKey
ALTER TABLE "product_subtypes" ADD CONSTRAINT "product_subtypes_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "idx_addresses_user_id" RENAME TO "idx_addresses_customer_id";

-- RenameIndex
ALTER INDEX "idx_audit_user" RENAME TO "idx_audit_customer";

-- RenameIndex
ALTER INDEX "idx_orders_user_id" RENAME TO "idx_orders_customer_id";

-- RenameIndex
ALTER INDEX "idx_returns_user_id" RENAME TO "idx_returns_customer_id";

-- RenameIndex
ALTER INDEX "idx_reviews_user_id" RENAME TO "idx_reviews_customer_id";

-- RenameIndex
ALTER INDEX "wishlists_user_id_key" RENAME TO "wishlists_customer_id_key";
