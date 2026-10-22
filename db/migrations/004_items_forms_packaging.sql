-- ============================================================
-- Product identity vs. inventory form, packaging conversions,
-- sale-unit history and an inventory movement log.
--
--   items              product identity (stable code, one name)
--   products           one stock balance of an item in one form:
--                        type 'raw'      = RAW_CONE          (base unit kg)
--                        type 'finished' = FINISHED_PRODUCT  (base unit TUBA)
--   packaging_units    per-item selling units expressed in the base unit (TUBA)
--   inventory_movements every stock change, with its reason
--
-- Additive only: no data is dropped. Safe to re-run.
-- ============================================================

-- ─────────────────────────── Items ───────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE CHECK (code ~ '^[A-Z0-9_]+$'),
  name_am     TEXT NOT NULL,
  name_en     TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every existing stock row gets its own item (same name). Rows are NOT merged by name:
-- whether two existing rows are the same product is a business decision (see README).
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES items(id) ON DELETE RESTRICT;
INSERT INTO items (id, name_am, name_en)
  SELECT 'itm-' || p.id, p.name_am, p.name_en FROM products p WHERE p.item_id IS NULL
  ON CONFLICT (id) DO NOTHING;
UPDATE products SET item_id = 'itm-' || id WHERE item_id IS NULL;
ALTER TABLE products ALTER COLUMN item_id SET NOT NULL;

-- One balance per item per form, so raw kg and finished TUBA can never be mixed
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_item_form ON products(item_id, type);

-- Stock may not go below zero; sales / production that would oversell are rejected.
-- NOT VALID: existing rows are not re-checked (they were clamped at 0 before anyway).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonneg') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0) NOT VALID;
  END IF;
END$$;

-- ─────────────────────── Packaging units ─────────────────────────
-- base_per_unit = how many base units (TUBA) one selling unit holds.
-- price = selling price for ONE of this unit (NULL = not set; never derived from another unit).
CREATE TABLE IF NOT EXISTS packaging_units (
  id             SERIAL PRIMARY KEY,
  item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_code      TEXT NOT NULL CHECK (unit_code IN ('MADABERIYA_TIDOSH', 'PACKET', 'PIECE')),
  base_per_unit  NUMERIC(14, 4) NOT NULL CHECK (base_per_unit > 0),
  label_am       TEXT NOT NULL,
  label_en       TEXT NOT NULL,
  price          NUMERIC(12, 2) CHECK (price >= 0),
  is_default     BOOLEAN NOT NULL DEFAULT false,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_packaging_units_updated_at BEFORE UPDATE ON packaging_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- At most one ACTIVE rule per item and unit (inactive old rules stay for reference)
CREATE UNIQUE INDEX IF NOT EXISTS uq_packaging_active ON packaging_units(item_id, unit_code) WHERE active;

-- ─────────────────────── Sale-line history ───────────────────────
-- quantity / price keep their meaning: amount and price in the SELLING unit (totals = quantity × price).
-- The conversion actually used is frozen on the line.
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_code     TEXT NOT NULL DEFAULT 'BASE';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_label    TEXT NOT NULL DEFAULT '';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_factor   NUMERIC(14, 4) NOT NULL DEFAULT 1;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS base_quantity NUMERIC(14, 3);
UPDATE sale_items SET base_quantity = quantity WHERE base_quantity IS NULL; -- older lines were sold in the base unit
ALTER TABLE sale_items ALTER COLUMN base_quantity SET NOT NULL;

-- ─────────────────────── Production output ───────────────────────
-- quantity = base units added (TUBA); the unit the user entered is kept alongside.
-- Yield is whatever the user records: nothing is derived from a weight per piece anymore.
ALTER TABLE production_outputs ALTER COLUMN quantity TYPE NUMERIC(14, 3);
ALTER TABLE production_outputs ALTER COLUMN grams SET DEFAULT 0;
ALTER TABLE production_outputs ADD COLUMN IF NOT EXISTS unit_code     TEXT NOT NULL DEFAULT 'BASE';
ALTER TABLE production_outputs ADD COLUMN IF NOT EXISTS unit_factor   NUMERIC(14, 4) NOT NULL DEFAULT 1;
ALTER TABLE production_outputs ADD COLUMN IF NOT EXISTS unit_quantity NUMERIC(14, 3);
UPDATE production_outputs SET unit_quantity = quantity WHERE unit_quantity IS NULL;

-- ─────────────────────── Movement log ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id          SERIAL PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  form        TEXT NOT NULL CHECK (form IN ('RAW_CONE', 'FINISHED_PRODUCT')),
  delta       NUMERIC(14, 3) NOT NULL,
  unit        TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('purchase', 'sale', 'production_in', 'production_out', 'adjustment')),
  ref_id      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);
