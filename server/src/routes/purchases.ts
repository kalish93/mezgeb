import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { pool, query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const PurchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
})

const PurchaseSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.string().min(1),
  items: z.array(PurchaseItemSchema).min(1),
  paid: z.number().min(0).default(0),
  note: z.string().default(''),
})

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

// GET /api/purchases
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, from, to, limit = '100', offset = '0' } = req.query as Record<string, string>
    const conditions: string[] = []
    const params: any[] = []

    if (supplierId) { params.push(supplierId); conditions.push(`p.supplier_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`p.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(parseInt(limit), parseInt(offset))

    const result = await query(`
      SELECT p.id, p.date, p.supplier_id, p.note, p.created_at,
             su.name AS supplier_name,
             COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
             COALESCE(p_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', pi.product_id,
               'quantity', pi.quantity,
               'price', pi.price
             ) ORDER BY pi.id) AS items
      FROM purchases p
      JOIN suppliers su ON su.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments py ON py.id = pa.payment_id
        WHERE pa.transaction_id = p.id AND py.kind = 'supplier'
      ) p_paid ON true
      ${where}
      GROUP BY p.id, su.name, p_paid.paid
      ORDER BY p.date DESC, p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const rows = result.rows.map((r) => ({
      ...r,
      total: parseFloat(r.total),
      paid: parseFloat(r.paid),
      status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
    }))
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/purchases/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT p.id, p.date, p.supplier_id, p.note, p.created_at,
             su.name AS supplier_name,
             COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
             COALESCE(p_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', pi.product_id,
               'quantity', pi.quantity,
               'price', pi.price
             ) ORDER BY pi.id) AS items
      FROM purchases p
      JOIN suppliers su ON su.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments py ON py.id = pa.payment_id
        WHERE pa.transaction_id = p.id AND py.kind = 'supplier'
      ) p_paid ON true
      WHERE p.id = $1
      GROUP BY p.id, su.name, p_paid.paid
    `, [req.params.id])

    if (!result.rows.length) { res.status(404).json({ error: 'Purchase not found' }); return }
    const r = result.rows[0]
    res.json({ ...r, total: parseFloat(r.total), paid: parseFloat(r.paid), status: statusFor(parseFloat(r.total), parseFloat(r.paid)) })
  } catch (err) {
    next(err)
  }
})

// POST /api/purchases
router.post('/', validate(PurchaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id, date, supplierId, items, paid, note } = req.body
    const purchaseId = id || `PUR-${Date.now()}`

    await client.query(
      `INSERT INTO purchases (id, date, supplier_id, note) VALUES ($1,$2,$3,$4)`,
      [purchaseId, date, supplierId, note]
    )

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, price) VALUES ($1,$2,$3,$4)`,
        [purchaseId, item.productId, item.quantity, item.price]
      )
      // Increase stock
      await client.query(
        `UPDATE products SET stock = stock + $1 WHERE id = $2`,
        [item.quantity, item.productId]
      )
    }

    if (paid > 0) {
      const payId = `PAY-${Date.now()}`
      await client.query(
        `INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1,$2,'supplier',$3,$4,'')`,
        [payId, date, supplierId, paid]
      )
      await client.query(
        `INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1,$2,$3)`,
        [payId, purchaseId, paid]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ id: purchaseId })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// DELETE /api/purchases/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM purchases WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Purchase not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
