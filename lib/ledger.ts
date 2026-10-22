/**
 * Shared write logic for sales, purchases, production and payments, used by both the
 * create (POST) and the edit / delete ([id]) routes so they can never drift apart.
 *
 * Editing a record = reverse its stock effect, replace it, apply the new effect.
 * Deleting = reverse its stock effect, then remove it. Every stock change is logged
 * in inventory_movements (a reversal has the opposite sign and the same ref_id).
 * All functions expect the caller to have started a transaction.
 */
import { z } from 'zod'
import type { PoolClient } from 'pg'
import { HttpError } from '@/lib/http'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ─── Schemas ─────────────────────────────────────────────────────
export const SaleItemSchema = z.object({
  productId: z.string().min(1),
  // Selling unit: a packaging unit code (MADABERIYA_TIDOSH, PACKET, PIECE) or BASE = the product's own unit (TUBA)
  unitCode: z.string().min(1).default('BASE'),
  quantity: z.number().positive(), // in the selling unit
  price: z.number().min(0),        // per ONE selling unit
})
export const SaleSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  customerId: z.string().min(1),
  items: z.array(SaleItemSchema).min(1),
  discount: z.number().min(0).default(0),
  paid: z.number().min(0).default(0), // creates a payment on POST; ignored on edit (payments are edited separately)
  note: z.string().default(''),
})

export const PurchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(), // in the product's own unit (kg for raw cone)
  price: z.number().min(0),        // per ONE of that unit
})
export const PurchaseSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  supplierId: z.string().min(1),
  items: z.array(PurchaseItemSchema).min(1),
  paid: z.number().min(0).default(0),
  note: z.string().default(''),
})

// Actual output as the user counted it, in a packaging unit or BASE (TUBA); converted to TUBA here
export const ProductionOutputSchema = z.object({
  productId: z.string().min(1),
  unitCode: z.string().min(1).default('BASE'),
  quantity: z.number().positive(),
})
// Yield varies, so nothing is derived: the user records kg consumed, output and (optionally) waste
export const ProductionSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  rawProductId: z.string().min(1),
  rawKg: z.number().positive(),
  outputs: z.array(ProductionOutputSchema).min(1),
  wasteKg: z.number().min(0).default(0),
  note: z.string().default(''),
})

export const PaymentSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  kind: z.enum(['customer', 'supplier']),
  personId: z.string().min(1),
  amount: z.number().min(0.01),
  // Omit (or send []) to auto-allocate to the oldest open invoices
  allocations: z.array(z.object({ transactionId: z.string().min(1), amount: z.number().min(0) })).default([]),
  note: z.string().default(''),
})

type Kind = 'customer' | 'supplier'

// ─── Sales ───────────────────────────────────────────────────────
/** Inserts sale lines. Each keeps its selling unit and the factor used; only FINISHED products can be sold. */
export async function insertSaleLines(client: PoolClient, saleId: string, items: z.infer<typeof SaleItemSchema>[]) {
  for (const item of items) {
    const line = await client.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, price, unit_code, unit_label, unit_factor, base_quantity)
       SELECT $1, p.id, $3::numeric, $4::numeric, $5,
              COALESCE(pu.label_am, p.unit), COALESCE(pu.base_per_unit, 1), $3::numeric * COALESCE(pu.base_per_unit, 1)
       FROM products p
       LEFT JOIN packaging_units pu ON pu.item_id = p.item_id AND pu.unit_code = $5 AND pu.active
       WHERE p.id = $2 AND p.type = 'finished' AND ($5 = 'BASE' OR pu.id IS NOT NULL)
       RETURNING id`,
      [saleId, item.productId, item.quantity, item.price, item.unitCode]
    )
    if (!line.rowCount) throw new HttpError(400, 'INVALID_SALE_ITEM') // unknown product, not finished, or unit not configured
  }
}

/**
 * Applies (sign -1) or reverses (sign +1) a sale's effect on finished stock, using the base quantities
 * stored on its lines. Not checked against what's on hand: purchases / production are sometimes recorded
 * late, so a sale is never blocked — the balance may go negative until they're entered.
 */
export async function moveSaleStock(client: PoolClient, saleId: string, sign: 1 | -1) {
  await client.query(
    `UPDATE products p SET stock = p.stock + $2::numeric * s.q
     FROM (SELECT product_id, SUM(base_quantity) AS q FROM sale_items WHERE sale_id = $1 GROUP BY product_id) s
     WHERE p.id = s.product_id`,
    [saleId, sign]
  )
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id)
     SELECT si.product_id, 'FINISHED_PRODUCT', $2::numeric * SUM(si.base_quantity), p.unit, 'sale', $1
     FROM sale_items si JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = $1
     GROUP BY si.product_id, p.unit`,
    [saleId, sign]
  )
}

// ─── Purchases ───────────────────────────────────────────────────
export async function insertPurchaseLines(client: PoolClient, purchaseId: string, items: z.infer<typeof PurchaseItemSchema>[]) {
  for (const item of items) {
    const line = await client.query(
      `INSERT INTO purchase_items (purchase_id, product_id, quantity, price)
       SELECT $1, p.id, $3, $4 FROM products p WHERE p.id = $2 RETURNING id`,
      [purchaseId, item.productId, item.quantity, item.price]
    )
    if (!line.rowCount) throw new HttpError(400, 'INVALID_PURCHASE_ITEM')
  }
}

/** Applies (+1) or reverses (-1) a purchase on exactly the stock rows bought (raw cone kg, or finished TUBA). */
export async function movePurchaseStock(client: PoolClient, purchaseId: string, sign: 1 | -1) {
  await client.query(
    `UPDATE products p SET stock = p.stock + $2::numeric * s.q
     FROM (SELECT product_id, SUM(quantity) AS q FROM purchase_items WHERE purchase_id = $1 GROUP BY product_id) s
     WHERE p.id = s.product_id`,
    [purchaseId, sign]
  )
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id)
     SELECT pi.product_id, CASE p.type WHEN 'raw' THEN 'RAW_CONE' ELSE 'FINISHED_PRODUCT' END,
            $2::numeric * SUM(pi.quantity), p.unit, 'purchase', $1
     FROM purchase_items pi JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = $1
     GROUP BY pi.product_id, p.type, p.unit`,
    [purchaseId, sign]
  )
}

// ─── Payments tied to a sale / purchase ──────────────────────────
/** Records a payment made together with a sale / purchase (the "paid" field), allocated to it. */
export async function recordInitialPayment(client: PoolClient, kind: Kind, personId: string, transactionId: string, date: string, amount: number) {
  if (!(amount > 0)) return
  const payId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  await client.query(`INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1, $2, $3, $4, $5, '')`, [payId, date, kind, personId, amount])
  await client.query(`INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1, $2, $3)`, [payId, transactionId, amount])
}

/** Payments whose every allocation is to this transaction (i.e. they were made for it). */
const ONLY_FOR = `
  SELECT p.id FROM payments p
  WHERE p.kind = $2
    AND EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.transaction_id = $1)
    AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.transaction_id <> $1)`

/** On delete: removes the payments made only for this sale / purchase; shared payments just lose this allocation. */
export async function deleteTransactionPayments(client: PoolClient, kind: Kind, transactionId: string) {
  const own = await client.query(`DELETE FROM payments WHERE id IN (${ONLY_FOR}) RETURNING id`, [transactionId, kind])
  await client.query(
    `DELETE FROM payment_allocations pa USING payments p
     WHERE pa.payment_id = p.id AND p.kind = $2 AND pa.transaction_id = $1`,
    [transactionId, kind]
  )
  return own.rowCount ?? 0
}

/** On a change of customer / supplier: payments made only for this transaction follow it to the new person. */
export async function movePaymentsToPerson(client: PoolClient, kind: Kind, transactionId: string, personId: string) {
  await client.query(`UPDATE payments SET person_id = $3 WHERE id IN (${ONLY_FOR})`, [transactionId, kind, personId])
  // A payment also covering other invoices of the old person stays theirs; it no longer covers this one
  await client.query(
    `DELETE FROM payment_allocations pa USING payments p
     WHERE pa.payment_id = p.id AND p.kind = $2 AND pa.transaction_id = $1 AND p.person_id <> $3`,
    [transactionId, kind, personId]
  )
}

/** Payments count only for the selected person's invoices (counts payments already recorded for it). */
export async function paymentsFor(client: PoolClient, kind: Kind, transactionId: string) {
  return (await client.query(
    `SELECT p.id, p.date, p.amount AS payment_amount, pa.amount, p.note
     FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
     WHERE pa.transaction_id = $1 AND p.kind = $2
     ORDER BY p.date, p.created_at`,
    [transactionId, kind]
  )).rows
}

// ─── FIFO allocation ─────────────────────────────────────────────
// Unpaid balance per sale / purchase for one person, oldest first
const OPEN_SQL: Record<Kind, string> = {
  customer: `
    SELECT id, owed FROM (
      SELECT s.id, s.date, s.created_at,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
        - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                    JOIN payments p ON p.id = pa.payment_id
                    WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0) AS owed
      FROM sales s WHERE s.customer_id = $1
    ) t WHERE owed > 0 ORDER BY date, created_at`,
  supplier: `
    SELECT id, owed FROM (
      SELECT pu.id, pu.date, pu.created_at,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM purchase_items WHERE purchase_id = pu.id)
        - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                    JOIN payments py ON py.id = pa.payment_id
                    WHERE pa.transaction_id = pu.id AND py.kind = 'supplier'), 0) AS owed
      FROM purchases pu WHERE pu.supplier_id = $1
    ) t WHERE owed > 0 ORDER BY date, created_at`,
}

/** Applies a payment to the person's oldest open invoices (or to explicit allocations). Whole cents, no float error. */
export async function allocatePayment(
  client: PoolClient, paymentId: string, kind: Kind, personId: string, amount: number,
  explicit: { transactionId: string; amount: number }[] = [],
) {
  let allocations = explicit
  if (!allocations.length) {
    const open = await client.query<{ id: string; owed: number }>(OPEN_SQL[kind], [personId])
    let remaining = Math.round(amount * 100)
    allocations = []
    for (const row of open.rows) {
      if (remaining <= 0) break
      const portion = Math.min(remaining, Math.round(Number(row.owed) * 100))
      allocations.push({ transactionId: row.id, amount: portion / 100 })
      remaining -= portion
    }
  }
  for (const a of allocations) {
    await client.query(`INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1, $2, $3)`, [paymentId, a.transactionId, a.amount])
  }
}

// ─── Production ──────────────────────────────────────────────────
/** Consumes raw cone kg (must be in stock), adds finished output in TUBA, logs both. Row in `productions` must exist. */
export async function applyProduction(client: PoolClient, prodId: string, d: z.infer<typeof ProductionSchema>) {
  const raw = await client.query(
    `UPDATE products SET stock = stock - $1::numeric WHERE id = $2 AND type = 'raw' AND stock >= $1::numeric RETURNING unit`,
    [d.rawKg, d.rawProductId]
  )
  if (!raw.rowCount) {
    const exists = await client.query(`SELECT 1 FROM products WHERE id = $1 AND type = 'raw'`, [d.rawProductId])
    throw exists.rowCount ? new HttpError(409, 'INSUFFICIENT_STOCK') : new HttpError(400, 'RAW_MATERIAL_REQUIRED')
  }
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id) VALUES ($1, 'RAW_CONE', -$2::numeric, $3, 'production_out', $4)`,
    [d.rawProductId, d.rawKg, raw.rows[0].unit, prodId]
  )
  for (const out of d.outputs) {
    const line = await client.query(
      `INSERT INTO production_outputs (production_id, product_id, quantity, grams, unit_code, unit_factor, unit_quantity)
       SELECT $1, p.id, $3::numeric * COALESCE(pu.base_per_unit, 1), 0, $4, COALESCE(pu.base_per_unit, 1), $3::numeric
       FROM products p
       LEFT JOIN packaging_units pu ON pu.item_id = p.item_id AND pu.unit_code = $4 AND pu.active
       WHERE p.id = $2 AND p.type = 'finished' AND ($4 = 'BASE' OR pu.id IS NOT NULL)
       RETURNING id`,
      [prodId, out.productId, out.quantity, out.unitCode]
    )
    if (!line.rowCount) throw new HttpError(400, 'INVALID_OUTPUT') // must be a FINISHED product with that unit
  }
  await client.query(
    `UPDATE products p SET stock = p.stock + o.q
     FROM (SELECT product_id, SUM(quantity) AS q FROM production_outputs WHERE production_id = $1 GROUP BY product_id) o
     WHERE p.id = o.product_id`,
    [prodId]
  )
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id)
     SELECT po.product_id, 'FINISHED_PRODUCT', SUM(po.quantity), p.unit, 'production_in', $1
     FROM production_outputs po JOIN products p ON p.id = po.product_id
     WHERE po.production_id = $1 GROUP BY po.product_id, p.unit`,
    [prodId]
  )
}

/** A batch with its outputs (product name, base unit, the unit entered and the factor used). */
export const PRODUCTION_SELECT = `
  SELECT pr.id, pr.date, pr.raw_product_id, pr.raw_quantity, pr.input_grams, pr.waste_grams, pr.note, pr.created_at, pr.updated_at,
         p.name_am AS raw_product_name,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'productId', po.product_id,
             'productName', fp.name_am,
             'baseUnit', fp.unit,
             'quantity', po.quantity,
             'unitCode', po.unit_code,
             'unitFactor', po.unit_factor,
             'unitQuantity', po.unit_quantity
           ) ORDER BY po.id) FROM production_outputs po JOIN products fp ON fp.id = po.product_id WHERE po.production_id = pr.id),
           '[]'::json
         ) AS outputs
  FROM productions pr
  JOIN products p ON p.id = pr.raw_product_id`

/** Undoes a batch exactly as it was recorded: raw kg back, finished output out (may go negative if already sold). */
export async function reverseProduction(client: PoolClient, prodId: string) {
  const batch = (await client.query(
    `SELECT pr.raw_product_id, pr.raw_quantity, p.unit FROM productions pr JOIN products p ON p.id = pr.raw_product_id WHERE pr.id = $1 FOR UPDATE`,
    [prodId]
  )).rows[0]
  if (!batch) return false
  await client.query(`UPDATE products SET stock = stock + $1::numeric WHERE id = $2`, [batch.raw_quantity, batch.raw_product_id])
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id) VALUES ($1, 'RAW_CONE', $2::numeric, $3, 'production_out', $4)`,
    [batch.raw_product_id, batch.raw_quantity, batch.unit, prodId]
  )
  await client.query(
    `UPDATE products p SET stock = p.stock - o.q
     FROM (SELECT product_id, SUM(quantity) AS q FROM production_outputs WHERE production_id = $1 GROUP BY product_id) o
     WHERE p.id = o.product_id`,
    [prodId]
  )
  await client.query(
    `INSERT INTO inventory_movements (product_id, form, delta, unit, reason, ref_id)
     SELECT po.product_id, 'FINISHED_PRODUCT', -SUM(po.quantity), p.unit, 'production_in', $1
     FROM production_outputs po JOIN products p ON p.id = po.product_id
     WHERE po.production_id = $1 GROUP BY po.product_id, p.unit`,
    [prodId]
  )
  await client.query('DELETE FROM production_outputs WHERE production_id = $1', [prodId])
  return true
}

// ─── Balances ────────────────────────────────────────────────────
/**
 * A person's balance = everything sold to / bought from them − everything they paid / we paid.
 * Uses totals rather than per-invoice allocations, so money not tied to one invoice still counts.
 */
export const CUSTOMER_BALANCE_SQL = (c: string) => `(
  COALESCE((SELECT SUM((SELECT COALESCE(SUM(si.quantity * si.price), 0) FROM sale_items si WHERE si.sale_id = s.id) - s.discount)
            FROM sales s WHERE s.customer_id = ${c}), 0)
  - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.kind = 'customer' AND p.person_id = ${c}), 0))`
export const SUPPLIER_BALANCE_SQL = (s: string) => `(
  COALESCE((SELECT SUM(pi.quantity * pi.price) FROM purchases pu JOIN purchase_items pi ON pi.purchase_id = pu.id
            WHERE pu.supplier_id = ${s}), 0)
  - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.kind = 'supplier' AND p.person_id = ${s}), 0))`
