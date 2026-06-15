-- Packed weight (grams) and outer box dimensions (cm) per product for ShipMozo / courier selection.
ALTER TABLE "products"
  ADD COLUMN "weight_g" INTEGER,
  ADD COLUMN "length_cm" DECIMAL(6, 2),
  ADD COLUMN "width_cm" DECIMAL(6, 2),
  ADD COLUMN "height_cm" DECIMAL(6, 2);
