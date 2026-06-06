-- Replace random/hash order numbers with a sequential series: IRX-10001, IRX-10002, …

WITH numbered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + 10000)::bigint AS seq
  FROM "orders"
)
UPDATE "orders" o
SET "order_number" = 'IRX-' || n.seq::text
FROM numbered n
WHERE o.id = n.id;

CREATE SEQUENCE IF NOT EXISTS "orders_order_number_seq";

SELECT setval(
  'orders_order_number_seq',
  GREATEST(
    10000,
    COALESCE(
      (SELECT MAX((regexp_replace("order_number", '^IRX-', ''))::bigint) FROM "orders"),
      10000
    )
  ),
  true
);
