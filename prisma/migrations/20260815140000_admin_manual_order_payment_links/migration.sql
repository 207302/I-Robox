-- Admin manual orders: Razorpay payment links + creating admin id.

ALTER TABLE "orders"
  ADD COLUMN "razorpay_payment_link_id" VARCHAR(120),
  ADD COLUMN "razorpay_payment_link_url" VARCHAR(500),
  ADD COLUMN "razorpay_payment_link_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "created_by_admin_id" UUID;

CREATE INDEX "idx_orders_razorpay_payment_link_id" ON "orders"("razorpay_payment_link_id");
CREATE INDEX "idx_orders_payment_link_expires_at" ON "orders"("razorpay_payment_link_expires_at");
CREATE INDEX "idx_orders_created_by_admin_id" ON "orders"("created_by_admin_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
