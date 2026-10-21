import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().default(''),
  address: z.string().default(''),
})

// GET /api/suppliers
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT su.*,
        COALESCE(SUM(GREATEST(0,
          (SELECT COALESCE(SUM(pi.quantity * pi.price), 0) FROM purchase_items pi WHERE pi.purchase_id = p.id)
          - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                      JOIN payments py ON py.id = pa.payment_id
                      WHERE pa.transaction_id = p.id AND py.kind = 'supplier'), 0)
        )), 0) AS balance_due
      FROM suppliers su
      LEFT JOIN purchases p ON p.supplier_id = su.id
      GROUP BY su.id
      ORDER BY su.name
    `)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/suppliers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [sup, purchasesRes, paymentsRes] = await Promise.all([
      query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]),
      query(`
        SELECT p.id, p.date, p.note,
          COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
          json_agg(json_build_object('productId', pi.product_id, 'quantity', pi.quantity, 'price', pi.price)) AS items
        FROM purchases p
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE p.supplier_id = $1
        GROUP BY p.id
        ORDER BY p.date DESC
      `, [req.params.id]),
      query(
        `SELECT * FROM payments WHERE kind = 'supplier' AND person_id = $1 ORDER BY date DESC`,
        [req.params.id]
      ),
    ])
    if (!sup.rows.length) { res.status(404).json({ error: 'Supplier not found' }); return }
    res.json({ ...sup.rows[0], purchases: purchasesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    next(err)
  }
})

// POST /api/suppliers
router.post('/', validate(SupplierSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, phone, address } = req.body
    const newId = id || `s-${Date.now()}`
    const result = await query(
      `INSERT INTO suppliers (id, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
      [newId, name, phone, address]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT /api/suppliers/:id
router.put('/:id', validate(SupplierSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body).filter((f) => f !== 'id')
    if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return }
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const result = await query(
      `UPDATE suppliers SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => req.body[f]), req.params.id]
    )
    if (!result.rows.length) { res.status(404).json({ error: 'Supplier not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE /api/suppliers/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Supplier not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
