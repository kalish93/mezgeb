import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { setStock } from '@/lib/stock'

export const runtime = 'nodejs'

// The name comes from the item and the inventory form (type) never changes, so neither is editable here.
// `stock` is a count correction and is logged as an adjustment movement.
const UpdateSchema = z.object({
  unit: z.string().min(1).optional(),
  stock: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  reorder: z.number().min(0).optional(),
  can_buy: z.boolean().optional(),
  can_sell: z.boolean().optional(),
  buy_price: z.number().min(0).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/products/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('SELECT * FROM products WHERE id = $1', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/products/:id
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { stock, ...rest } = parsed.data
    const exists = await client.query('SELECT type FROM products WHERE id = $1', [id])
    if (!exists.rowCount) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (exists.rows[0].type === 'raw') delete rest.unit // raw cone is always kg

    await client.query('BEGIN')
    const fields = Object.keys(rest)
    if (fields.length) {
      const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
      await client.query(`UPDATE products SET ${setClauses} WHERE id = $${fields.length + 1}`, [...fields.map((f) => (rest as any)[f]), id])
    }
    if (stock !== undefined) await setStock(client, id, stock)
    const result = await client.query('SELECT * FROM products WHERE id = $1', [id])
    await client.query('COMMIT')
    return NextResponse.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// DELETE /api/products/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    return errorResponse(err)
  }
}
