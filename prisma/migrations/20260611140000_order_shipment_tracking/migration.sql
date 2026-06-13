ALTER TABLE "orders" ADD COLUMN "awb_number" VARCHAR(255);
ALTER TABLE "orders" ADD COLUMN "carrier" VARCHAR(120);
ALTER TABLE "orders" ADD COLUMN "shipment_status" VARCHAR(40) NOT NULL DEFAULT 'ORDER_PLACED';
ALTER TABLE "orders" ADD COLUMN "shipment_updated_at" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN "shipment_location" VARCHAR(255);

CREATE INDEX "idx_orders_awb_number" ON "orders"("awb_number");
CREATE INDEX "idx_orders_shipment_status" ON "orders"("shipment_status");
