-- ============================================================
-- Cone Ledger – Initial Schema
-- Auto-loaded by Docker via /docker-entrypoint-initdb.d
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────── Products ────────────────────────────
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  name_am       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('raw', 'finished')),
  weight_grams  INTEGER NOT NULL DEFAULT 0,
  size          TEXT NOT NULL DEFAULT '',
  unit          TEXT NOT NULL DEFAULT 'ኮን',
  stock         INTEGER NOT NULL DEFAULT 0,
  price         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder       INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── Customers ───────────────────────────
CREATE TABLE customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── Suppliers ───────────────────────────
CREATE TABLE suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────── Sales ──────────────────────────────
CREATE TABLE sales (
  id           TEXT PRIMARY KEY,
  date         DATE NOT NULL,
  customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  discount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sale_items (
  id          SERIAL PRIMARY KEY,
  sale_id     TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL,
  price       NUMERIC(12, 2) NOT NULL
);

-- ─────────────────────────── Purchases ───────────────────────────
CREATE TABLE purchases (
  id           TEXT PRIMARY KEY,
  date         DATE NOT NULL,
  supplier_id  TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
  id           SERIAL PRIMARY KEY,
  purchase_id  TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL,
  price        NUMERIC(12, 2) NOT NULL
);

-- ─────────────────────────── Payments ────────────────────────────
CREATE TABLE payments (
  id          TEXT PRIMARY KEY,
  date        DATE NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('customer', 'supplier')),
  person_id   TEXT NOT NULL,   -- customer id or supplier id
  amount      NUMERIC(12, 2) NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_allocations (
  id              SERIAL PRIMARY KEY,
  payment_id      TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  transaction_id  TEXT NOT NULL,   -- sale id or purchase id
  amount          NUMERIC(12, 2) NOT NULL
);

-- ─────────────────────────── Expenses ────────────────────────────
CREATE TABLE expenses (
  id          TEXT PRIMARY KEY,
  date        DATE NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── Productions ─────────────────────────
CREATE TABLE productions (
  id              TEXT PRIMARY KEY,
  date            DATE NOT NULL,
  raw_product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  raw_quantity    INTEGER NOT NULL DEFAULT 1,
  input_grams     INTEGER NOT NULL DEFAULT 0,
  waste_grams     INTEGER NOT NULL DEFAULT 0,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE production_outputs (
  id             SERIAL PRIMARY KEY,
  production_id  TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL,
  grams          INTEGER NOT NULL
);

-- ─────────────────── Utility: updated_at triggers ────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products','customers','suppliers','sales','purchases',
    'payments','expenses','productions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', tbl, tbl
    );
  END LOOP;
END$$;

-- ─────────────────── Indexes for common lookups ───────────────────
CREATE INDEX idx_sales_customer     ON sales(customer_id);
CREATE INDEX idx_sales_date         ON sales(date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_date     ON purchases(date);
CREATE INDEX idx_payments_person    ON payments(person_id);
CREATE INDEX idx_payments_date      ON payments(date);
CREATE INDEX idx_expenses_date      ON expenses(date);
CREATE INDEX idx_productions_date   ON productions(date);
