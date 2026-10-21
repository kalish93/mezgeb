import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const ProductSchema = z.object({
  id: z.string().min(1),
  name_am: z.string().min(1),
  name_en: z.string().min(1),
  type: z.enum(['raw', 'finished']),
  weight_grams: z.number().int().min(0),
  size: z.string().default(''),
  unit: z.string().default('ኮን'),
  stock: z.number().int().min(0).default(0),
  price: z.number().min(0),
  reorder: z.number().int().min(0).default(0),
})

const UpdateSchema = ProductSchema.partial().omit({ id: true })

// GET /api/products
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY type, name_am')
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT * FROM products WHERE id = $1', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/products
router.post('/', validate(ProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder } = req.body
    const result = await query(
      `INSERT INTO products (id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT /api/products/:id
router.put('/:id', validate(UpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body)
    if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return }
    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const values = [...fields.map((f) => req.body[f]), req.params.id]
    const result = await query(
      `UPDATE products SET ${setClauses} WHERE id = $${fields.length + 1} RETURNING *`,
      values
    )
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PATCH /api/products/:id/stock  – adjust stock level
router.patch('/:id/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { delta } = req.body as { delta: number }
    const result = await query(
      `UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2 RETURNING *`,
      [delta, req.params.id]
    )
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE /api/products/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return }
    res.json({ deleted: result.rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
