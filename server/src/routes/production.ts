import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { pool, query } from '../db'
import { validate } from '../middleware/validate'

const router = Router()

const OutputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  grams: z.number().int().min(1),
})

const ProductionSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rawProductId: z.string().min(1),
  rawQuantity: z.number().int().min(1),
  inputGrams: z.number().int().min(1),
  outputs: z.array(OutputSchema).min(1),
  wasteGrams: z.number().int().min(0).default(0),
  note: z.string().default(''),
})

// GET /api/production
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT pr.id, pr.date, pr.raw_product_id, pr.raw_quantity, pr.input_grams, pr.waste_grams, pr.note, pr.created_at,
             p.name_am AS raw_product_name,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'productId', po.product_id,
                 'quantity', po.quantity,
                 'grams', po.grams
               )) FROM production_outputs po WHERE po.production_id = pr.id),
               '[]'::json
             ) AS outputs
      FROM productions pr
      JOIN products p ON p.id = pr.raw_product_id
      ORDER BY pr.date DESC, pr.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/production/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT pr.*, p.name_am AS raw_product_name,
        COALESCE(
          (SELECT json_agg(json_build_object('productId', po.product_id, 'quantity', po.quantity, 'grams', po.grams))
           FROM production_outputs po WHERE po.production_id = pr.id),
          '[]'::json
        ) AS outputs
      FROM productions pr
      JOIN products p ON p.id = pr.raw_product_id
      WHERE pr.id = $1
    `, [req.params.id])
    if (!result.rows.length) { res.status(404).json({ error: 'Production run not found' }); return }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/production
router.post('/', validate(ProductionSchema), async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id, date, rawProductId, rawQuantity, inputGrams, outputs, wasteGrams, note } = req.body
    const prodId = id || `PRD-${Date.now()}`

    await client.query(
      `INSERT INTO productions (id, date, raw_product_id, raw_quantity, input_grams, waste_grams, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [prodId, date, rawProductId, rawQuantity, inputGrams, wasteGrams, note]
    )

    // Consume raw stock
    await client.query(
      `UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
      [rawQuantity, rawProductId]
    )

    for (const out of outputs) {
      await client.query(
        `INSERT INTO production_outputs (production_id, product_id, quantity, grams) VALUES ($1,$2,$3,$4)`,
        [prodId, out.productId, out.quantity, out.grams]
      )
      // Add finished stock
      await client.query(
        `UPDATE products SET stock = stock + $1 WHERE id = $2`,
        [out.quantity, out.productId]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ id: prodId })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
