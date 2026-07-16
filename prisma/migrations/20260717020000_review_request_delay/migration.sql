-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "review_request_email_sent_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "site_marketing_settings"
  ADD COLUMN IF NOT EXISTS "review_request_emails_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "review_request_delay_hours" INTEGER NOT NULL DEFAULT 24;

-- Backfill sent flag from legacy shipments.metadata.reviewRequestEmailSentAt when present.
UPDATE "orders" o
SET "review_request_email_sent_at" = COALESCE(
  NULLIF(s.metadata->>'reviewRequestEmailSentAt', '')::timestamptz,
  NOW()
)
FROM "shipments" s
WHERE s.order_id = o.id
  AND o.review_request_email_sent_at IS NULL
  AND s.metadata ? 'reviewRequestEmailSentAt'
  AND COALESCE(s.metadata->>'reviewRequestEmailSentAt', '') <> '';

CREATE INDEX IF NOT EXISTS "idx_orders_review_request_email_sent_at"
  ON "orders" ("review_request_email_sent_at");
