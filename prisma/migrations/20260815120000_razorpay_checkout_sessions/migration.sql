-- Persist checkout snapshots so payment.captured can create the order if the browser
-- never calls /verify after capture (common with UPI app-switch / guest checkout).

CREATE TABLE "razorpay_checkout_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razorpay_order_id" VARCHAR(120) NOT NULL,
    "customer_id" UUID,
    "checkout_email" CITEXT NOT NULL,
    "context" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "razorpay_checkout_sessions_razorpay_order_id_key" ON "razorpay_checkout_sessions"("razorpay_order_id");
CREATE INDEX "idx_razorpay_checkout_sessions_customer_id" ON "razorpay_checkout_sessions"("customer_id");
CREATE INDEX "idx_razorpay_checkout_sessions_order_id" ON "razorpay_checkout_sessions"("order_id");
CREATE INDEX "idx_razorpay_checkout_sessions_expires_at" ON "razorpay_checkout_sessions"("expires_at");

ALTER TABLE "razorpay_checkout_sessions"
  ADD CONSTRAINT "razorpay_checkout_sessions_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "razorpay_checkout_sessions"
  ADD CONSTRAINT "razorpay_checkout_sessions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

DROP INDEX IF EXISTS "idx_orders_razorpay_checkout_order_id";

-- Keep the newest/paid row when the same Razorpay order id was stored twice.
UPDATE "orders" AS o
SET "razorpay_checkout_order_id" = NULL
WHERE o."id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "razorpay_checkout_order_id"
        ORDER BY
          CASE WHEN "payment_status" = 'SUCCEEDED' THEN 0 ELSE 1 END,
          "created_at" DESC
      ) AS rn
    FROM "orders"
    WHERE "razorpay_checkout_order_id" IS NOT NULL
  ) d
  WHERE rn > 1
);

CREATE UNIQUE INDEX "orders_razorpay_checkout_order_id_key" ON "orders"("razorpay_checkout_order_id");

CREATE INDEX "idx_orders_external_payment_id" ON "orders"("external_payment_id");
