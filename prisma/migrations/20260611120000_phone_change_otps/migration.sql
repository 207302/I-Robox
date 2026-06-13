CREATE TABLE "phone_change_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "new_phone" VARCHAR(10) NOT NULL,
    "email" CITEXT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_change_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_phone_change_otps_customer_id" ON "phone_change_otps"("customer_id");
CREATE INDEX "idx_phone_change_otps_expires_at" ON "phone_change_otps"("expires_at");

ALTER TABLE "phone_change_otps" ADD CONSTRAINT "phone_change_otps_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
