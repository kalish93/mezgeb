import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { pool, query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const AllocationSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().min(0),
})

const PaymentSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['customer', 'supplier']),
  personId: z.string().min(1),
  amount: z.number().min(0.01),
  allocations: z.array(AllocationSchema).default([]),
  note: z.string().default(''),
})

// GET /api/payments
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kind, personId, from, to } = req.query as Record<string, string>
    const conditions: string[] = []
    const params: any[] = []

    if (kind) { params.push(kind); conditions.push(`p.kind = $${params.length}`) }
    if (personId) { params.push(personId); conditions.push(`p.person_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`p.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(`
      SELECT p.*,
        COALESCE(
          (SELECT json_agg(json_build_object('transactionId', pa.transaction_id, 'amount', pa.amount))
           FROM payment_allocations pa WHERE pa.payment_id = p.id),
          '[]'::json
        ) AS allocations
      FROM payments p
      ${where}
      ORDER BY p.date DESC, p.created_at DESC
    `, params)

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/payments/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT p.*,
        COALESCE(
          (SELECT json_agg(json_build_object('transactionId', pa.transaction_id, 'amount', pa.amount))
           FROM payment_allocations pa WHERE pa.payment_id = p.id),
          '[]'::json
        ) AS allocations
      FROM payments p
      WHERE p.id = $1
    `, [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Payment not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/payments
router.post('/', validate(PaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id, date, kind, personId, amount, allocations, note } = req.body
    const paymentId = id || `PAY-${Date.now()}`

    await client.query(
      `INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [paymentId, date, kind, personId, amount, note]
    )

    for (const alloc of allocations) {
      await client.query(
        `INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1,$2,$3)`,
        [paymentId, alloc.transactionId, alloc.amount]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ id: paymentId })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// DELETE /api/payments/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Payment not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
