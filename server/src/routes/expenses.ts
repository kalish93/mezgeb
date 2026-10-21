import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const ExpenseSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().default('other'),
  description: z.string().min(1),
  amount: z.number().min(0),
  note: z.string().default(''),
})

// GET /api/expenses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, from, to } = req.query as Record<string, string>
    const conditions: string[] = []
    const params: any[] = []

    if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(`SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC`, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/expenses/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Expense not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/expenses
router.post('/', validate(ExpenseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date, category, description, amount, note } = req.body
    const newId = id || `EXP-${Date.now()}`
    const result = await query(
      `INSERT INTO expenses (id, date, category, description, amount, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId, date, category, description, amount, note]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT /api/expenses/:id
router.put('/:id', validate(ExpenseSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body).filter((f) => f !== 'id')
    if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return }
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const result = await query(
      `UPDATE expenses SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => req.body[f]), req.params.id]
    )
    if (!result.rows.length) { res.status(404).json({ error: 'Expense not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE /api/expenses/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Expense not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
