CREATE TABLE "email_change_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "new_email" CITEXT NOT NULL,
    "old_email" CITEXT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_email_change_otps_customer_id" ON "email_change_otps"("customer_id");
CREATE INDEX "idx_email_change_otps_expires_at" ON "email_change_otps"("expires_at");

ALTER TABLE "email_change_otps" ADD CONSTRAINT "email_change_otps_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
