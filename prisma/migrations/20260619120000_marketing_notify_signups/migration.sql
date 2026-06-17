CREATE TABLE "marketing_notify_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_notify_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_notify_signups_email_key" ON "marketing_notify_signups"("email");
CREATE INDEX "idx_marketing_notify_signups_created" ON "marketing_notify_signups"("created_at" DESC);
