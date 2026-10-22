import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { setStock } from '@/lib/stock'

export const runtime = 'nodejs'

// delta is in the row's own base unit (kg for raw cone, TUBA for finished)
const StockSchema = z.object({ delta: z.number() })

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/products/:id/stock  — adjust stock by a signed delta (clamped at 0), logged as an adjustment
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = StockSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT GREATEST(0, stock + $1::numeric) AS next FROM products WHERE id = $2 FOR UPDATE`,
      [parsed.data.delta, id]
    )
    if (!current.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    await setStock(client, id, current.rows[0].next)
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
