-- ============================================================
-- Sales may take finished stock below zero: purchases / production are
-- sometimes recorded late, and a sale must never be blocked for that.
-- A negative balance shows something wasn't recorded yet.
-- Production still refuses to use more raw cone than is in stock (checked in the API).
-- Safe to re-run.
-- ============================================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_nonneg;
