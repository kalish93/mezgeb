import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'

export const runtime = 'nodejs'

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
export async function GET() {
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
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/production  (transactional)
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const body = await req.json()
    const parsed = ProductionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, date, rawProductId, rawQuantity, inputGrams, outputs, wasteGrams, note } = parsed.data
    const prodId = id || `PRD-${Date.now()}`

    await client.query('BEGIN')

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
    return NextResponse.json({ id: prodId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
}
