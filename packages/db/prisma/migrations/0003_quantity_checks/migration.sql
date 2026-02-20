ALTER TABLE "Product"
  ADD CONSTRAINT "Product_minPurchaseQty_positive" CHECK ("minPurchaseQty" > 0),
  ADD CONSTRAINT "Product_quantityStep_positive" CHECK ("quantityStep" > 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_quantity_positive" CHECK ("quantity" > 0);
