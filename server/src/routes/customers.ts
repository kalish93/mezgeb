import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const CustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().default(''),
  address: z.string().default(''),
  note: z.string().default(''),
})

// GET /api/customers
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT c.*,
        COALESCE(SUM(GREATEST(0,
          (SELECT COALESCE(SUM(si.quantity * si.price), 0) FROM sale_items si WHERE si.sale_id = s.id) - s.discount
          - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                      JOIN payments p ON p.id = pa.payment_id
                      WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
        )), 0) AS balance_due
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/customers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [cust, salesRes, paymentsRes] = await Promise.all([
      query('SELECT * FROM customers WHERE id = $1', [req.params.id]),
      query(`
        SELECT s.id, s.date, s.discount, s.note,
          COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
          json_agg(json_build_object('productId', si.product_id, 'quantity', si.quantity, 'price', si.price)) AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.customer_id = $1
        GROUP BY s.id
        ORDER BY s.date DESC
      `, [req.params.id]),
      query(`
        SELECT * FROM payments WHERE kind = 'customer' AND person_id = $1 ORDER BY date DESC
      `, [req.params.id]),
    ])
    if (!cust.rows.length) { res.status(404).json({ error: 'Customer not found' }); return }
    res.json({ ...cust.rows[0], sales: salesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    next(err)
  }
})

// POST /api/customers
router.post('/', validate(CustomerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, phone, address, note } = req.body
    const newId = id || `c-${Date.now()}`
    const result = await query(
      `INSERT INTO customers (id, name, phone, address, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [newId, name, phone, address, note]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT /api/customers/:id
router.put('/:id', validate(CustomerSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body).filter((f) => f !== 'id')
    if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return }
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const result = await query(
      `UPDATE customers SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => req.body[f]), req.params.id]
    )
    if (!result.rows.length) { res.status(404).json({ error: 'Customer not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE /api/customers/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Customer not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
