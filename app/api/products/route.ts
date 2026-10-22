import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { FORM_SQL, insertStockRow, UNIT_VALUE_SQL } from '@/lib/stock'

export const runtime = 'nodejs'

// Adds one inventory form (stock row) to an existing item. Normally done through /api/items.
const ProductSchema = z.object({
  id: z.string().min(1).optional(),
  item_id: z.string().min(1),
  type: z.enum(['raw', 'finished']),
  unit: z.string().min(1).optional(),
  stock: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  buy_price: z.number().min(0).default(0),
  reorder: z.number().min(0).default(0),
  can_buy: z.boolean().optional(),
  can_sell: z.boolean().optional(),
})

// GET /api/products — stock rows with their item's code / name and inventory form
export async function GET() {
  try {
    const result = await query(`
      SELECT p.*, i.code AS item_code, i.active AS item_active, ${FORM_SQL} AS form, ${UNIT_VALUE_SQL('p')} AS unit_value
      FROM products p JOIN items i ON i.id = p.item_id
      ORDER BY p.type, i.name_am
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = ProductSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    await client.query('BEGIN')
    const row = await insertStockRow(client, parsed.data)
    await client.query('COMMIT')
    if (!row) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
