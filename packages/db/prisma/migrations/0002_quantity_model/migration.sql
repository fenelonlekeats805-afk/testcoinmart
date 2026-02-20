-- Add quantity model for per-order purchases.
ALTER TABLE "Product"
  ADD COLUMN "minPurchaseQty" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "quantityStep" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Order"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
