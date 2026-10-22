-- ============================================================
-- Products can be bought, sold, or both (independent of raw/finished,
-- which only matters for production). Adds a separate buying price.
-- Safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'can_buy'
  ) THEN
    ALTER TABLE products
      ADD COLUMN can_buy   BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN can_sell  BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN buy_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

    -- Existing rows keep their old behaviour: raw cones were bought, finished cones were sold
    UPDATE products SET can_buy = (type = 'raw'), can_sell = (type = 'finished');
    UPDATE products SET buy_price = price WHERE type = 'raw';
  END IF;
END$$;
