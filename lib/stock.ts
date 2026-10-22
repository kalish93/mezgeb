/**
 * Stock-row helpers shared by the products and items routes.
 * A "product" row is one stock balance of an item in one inventory form:
 *   type 'raw'      → RAW_CONE, counted in kg
 *   type 'finished' → FINISHED_PRODUCT, counted in TUBA (or the item's own base unit)
 */
import type { PoolClient } from 'pg'

export const FORM_SQL = `CASE p.type WHEN 'raw' THEN 'RAW_CONE' ELSE 'FINISHED_PRODUCT' END`

/**
 * Value of ONE base unit of a stock row, used for "stock value". First price found wins:
 *   raw cone → buying price per kg set on the product → price paid in the latest purchase
 *   finished → price per TUBA → the default (else largest) priced packaging unit's price ÷ its TUBA
 *              → the latest sale line's price ÷ the factor it used (what it actually sold for)
 */
export const UNIT_VALUE_SQL = (p: string) => `(CASE WHEN ${p}.type = 'raw' THEN COALESCE(
  NULLIF(${p}.buy_price, 0),
  (SELECT pi.price FROM purchase_items pi JOIN purchases pc ON pc.id = pi.purchase_id
    WHERE pi.product_id = ${p}.id ORDER BY pc.date DESC, pc.created_at DESC, pi.id DESC LIMIT 1),
  0) ELSE COALESCE(
  NULLIF(${p}.price, 0),
  (SELECT pu.price / pu.base_per_unit FROM packaging_units pu
    WHERE pu.item_id = ${p}.item_id AND pu.active AND pu.price IS NOT NULL
    ORDER BY pu.is_default DESC, pu.base_per_unit DESC LIMIT 1),
  (SELECT si.price / si.unit_factor FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${p}.id ORDER BY s.date DESC, s.created_at DESC, si.id DESC LIMIT 1),
  0) END)`
export const RAW_UNIT = 'ኪ.ግ'
export const FINISHED_UNIT = 'ቱባ'

export type StockRowInput = {
  id?: string
  item_id: string
  type: 'raw' | 'finished'
  unit?: string
  stock: number
  price: number
  buy_price: number
  reorder: number
  can_buy?: boolean
  can_sell?: boolean
}

const formOf = (type: 'raw' | 'finished') => (type === 'raw' ? 'RAW_CONE' : 'FINISHED_PRODUCT')

/** Inserts one form of an item (name copied from the item) plus an opening-stock movement. Caller owns the transaction. */
export async function insertStockRow(client: PoolClient, d: StockRowInput) {
  const isRaw = d.type === 'raw'
  const result = await client.query(
    `INSERT INTO products (id, item_id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder, can_buy, can_sell, buy_price)
     SELECT $1, i.id, i.name_am, i.name_en, $2, 0, '', $3, $4, $5, $6, $7, $8, $9 FROM items i WHERE i.id = $10
     RETURNING *`,
    [
      d.id || `${isRaw ? 'raw' : 'fin'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      d.type, isRaw ? RAW_UNIT : d.unit || FINISHED_UNIT, d.stock, isRaw ? 0 : d.price, d.reorder,
      d.can_buy ?? isRaw, d.can_sell ?? !isRaw, d.buy_price, d.item_id,
    ]
  )
  const row = result.rows[0]
  if (row && d.stock > 0) {
    await client.query(
      `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id) VALUES ($1, $2, $3, $4, 'adjustment', 'opening')`,
      [row.id, formOf(d.type), d.stock, row.unit]
    )
  }
  return row
}

/** Sets a stock row's balance to `stock` (a count correction) and logs the difference. Caller owns the transaction. */
export async function setStock(client: PoolClient, productId: string, stock: number) {
  const before = await client.query(`SELECT stock, type, unit FROM products WHERE id = $1 FOR UPDATE`, [productId])
  if (!before.rowCount) return null
  const r = await client.query(
    `UPDATE products SET stock = $1::numeric WHERE id = $2 RETURNING stock - $3::numeric AS delta`,
    [stock, productId, before.rows[0].stock]
  )
  const delta = Number(r.rows[0].delta)
  if (delta !== 0) {
    await client.query(
      `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id) VALUES ($1, $2, $3::numeric, $4, 'adjustment', NULL)`,
      [productId, formOf(before.rows[0].type), r.rows[0].delta, before.rows[0].unit]
    )
  }
  return delta
}
