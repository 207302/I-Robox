-- AlterTable
ALTER TABLE "orders" ADD COLUMN "razorpay_checkout_order_id" VARCHAR(120),
ADD COLUMN "payment_retry_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "payment_retry_exhausted_notified_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "idx_orders_razorpay_checkout_order_id" ON "orders"("razorpay_checkout_order_id");
