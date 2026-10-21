import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { pool, query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const SaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
})

const SaleSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerId: z.string().min(1),
  items: z.array(SaleItemSchema).min(1),
  discount: z.number().min(0).default(0),
  paid: z.number().min(0).default(0),
  note: z.string().default(''),
})

/** Compute payment status label */
function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

// GET /api/sales
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, status, from, to, limit = '100', offset = '0' } = req.query as Record<string, string>
    const conditions: string[] = []
    const params: any[] = []

    if (customerId) { params.push(customerId); conditions.push(`s.customer_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`s.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`s.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(parseInt(limit), parseInt(offset))

    const result = await query(`
      SELECT s.id, s.date, s.customer_id, s.discount, s.note, s.created_at,
             c.name AS customer_name,
             COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
             COALESCE(s_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', si.product_id,
               'quantity', si.quantity,
               'price', si.price
             ) ORDER BY si.id) AS items
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        WHERE pa.transaction_id = s.id AND p.kind = 'customer'
      ) s_paid ON true
      ${where}
      GROUP BY s.id, c.name, s_paid.paid
      ORDER BY s.date DESC, s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const rows = result.rows.map((r) => ({
      ...r,
      total: parseFloat(r.total),
      paid: parseFloat(r.paid),
      status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
    }))

    // Filter by status if requested (done in JS since it's computed)
    const filtered = status ? rows.filter((r) => r.status === status) : rows
    res.json(filtered)
  } catch (err) {
    next(err)
  }
})

// GET /api/sales/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT s.id, s.date, s.customer_id, s.discount, s.note, s.created_at,
             c.name AS customer_name,
             COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
             COALESCE(s_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', si.product_id,
               'quantity', si.quantity,
               'price', si.price
             ) ORDER BY si.id) AS items
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        WHERE pa.transaction_id = s.id AND p.kind = 'customer'
      ) s_paid ON true
      WHERE s.id = $1
      GROUP BY s.id, c.name, s_paid.paid
    `, [req.params.id])

    if (!result.rows.length) { res.status(404).json({ error: 'Sale not found' }); return }
    const r = result.rows[0]
    res.json({
      ...r,
      total: parseFloat(r.total),
      paid: parseFloat(r.paid),
      status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/sales
router.post('/', validate(SaleSchema), async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id, date, customerId, items, discount, paid, note } = req.body
    const saleId = id || `SAL-${Date.now()}`

    await client.query(
      `INSERT INTO sales (id, date, customer_id, discount, note) VALUES ($1,$2,$3,$4,$5)`,
      [saleId, date, customerId, discount, note]
    )

    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ($1,$2,$3,$4)`,
        [saleId, item.productId, item.quantity, item.price]
      )
      // Reduce stock
      await client.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
        [item.quantity, item.productId]
      )
    }

    // Record initial payment as allocation if paid > 0
    if (paid > 0) {
      const payId = `PAY-${Date.now()}`
      await client.query(
        `INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1,$2,'customer',$3,$4,'')`,
        [payId, date, customerId, paid]
      )
      await client.query(
        `INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1,$2,$3)`,
        [payId, saleId, paid]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ id: saleId })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// DELETE /api/sales/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM sales WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Sale not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
