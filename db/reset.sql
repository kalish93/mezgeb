-- ============================================================
-- Mezgeb – delete ALL data (keeps the tables). Never run this in production.
-- Run: pnpm db:reset   (then `pnpm db:seed` to add the four products back)
-- ============================================================

TRUNCATE inventory_movements, production_outputs, productions, payment_allocations, payments,
         sale_items, sales, purchase_items, purchases,
         expenses, customers, suppliers, packaging_units, products, items
RESTART IDENTITY CASCADE;
