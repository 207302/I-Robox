-- Human-readable order reference (e.g. IRX-A7K2M9). Internal UUID remains primary key.

ALTER TABLE "orders" ADD COLUMN "order_number" VARCHAR(16);

UPDATE "orders" o
SET "order_number" = (
  SELECT 'IRX-' || string_agg(ch, '')
  FROM (
    SELECT substr(
      '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
      (get_byte(decode(md5(o.id::text), 'hex'), gs.i) % 32) + 1,
      1
    ) AS ch
    FROM generate_series(0, 5) AS gs(i)
  ) s
)
WHERE "order_number" IS NULL;

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;
