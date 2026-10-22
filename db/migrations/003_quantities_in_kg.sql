-- ============================================================
-- Purchases are made by weight: quantities and stock can be
-- fractional (e.g. 12.5 kg), and raw material is stocked in kg.
-- Safe to re-run.
-- ============================================================

ALTER TABLE products       ALTER COLUMN stock        TYPE NUMERIC(12, 3);
ALTER TABLE products       ALTER COLUMN reorder      TYPE NUMERIC(12, 3);
ALTER TABLE sale_items     ALTER COLUMN quantity     TYPE NUMERIC(12, 3);
ALTER TABLE purchase_items ALTER COLUMN quantity     TYPE NUMERIC(12, 3);
ALTER TABLE productions    ALTER COLUMN raw_quantity TYPE NUMERIC(12, 3);

-- Raw products that were counted as cones of a fixed weight become kg-based:
-- stock / purchases / production use are converted from cones to kg, and prices to price-per-kg.
-- Only rows not yet in kg are touched, so re-running changes nothing.
DO $$
DECLARE p RECORD; kg NUMERIC;
BEGIN
  FOR p IN SELECT id, weight_grams FROM products WHERE type = 'raw' AND unit <> 'ኪ.ግ' AND weight_grams > 0 LOOP
    kg := p.weight_grams / 1000.0;
    UPDATE products
       SET stock = stock * kg, reorder = reorder * kg,
           buy_price = ROUND(buy_price / kg, 2), price = ROUND(price / kg, 2),
           unit = 'ኪ.ግ', weight_grams = 0, size = ''
     WHERE id = p.id;
    UPDATE purchase_items SET quantity = quantity * kg, price = ROUND(price / kg, 2) WHERE product_id = p.id;
    UPDATE sale_items     SET quantity = quantity * kg, price = ROUND(price / kg, 2) WHERE product_id = p.id;
    UPDATE productions    SET raw_quantity = raw_quantity * kg WHERE raw_product_id = p.id;
  END LOOP;
END$$;
