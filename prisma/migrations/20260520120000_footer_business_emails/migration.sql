-- Footer Business block (wholesale + retail partnership emails)
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "footer_business_title" VARCHAR(120);
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "footer_business_wholesale_label" VARCHAR(120);
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "footer_business_wholesale_email" VARCHAR(200);
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "footer_business_retail_label" VARCHAR(120);
ALTER TABLE "site_marketing_settings" ADD COLUMN IF NOT EXISTS "footer_business_retail_email" VARCHAR(200);
