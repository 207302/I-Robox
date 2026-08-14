-- Per-flash-sale toggle for one-purchase-per-customer enforcement (existing rows stay limited).

ALTER TABLE "flash_sales" ADD COLUMN "limit_one_per_customer" BOOLEAN NOT NULL DEFAULT true;
