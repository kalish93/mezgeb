import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { FinishedForm, ItemCode, RawForm } from '@/lib/item-schemas'
import { insertStockRow } from '@/lib/stock'

export const runtime = 'nodejs'

const ItemSchema = z.object({
  code: ItemCode.optional(),
  name_am: z.string().trim().min(1),
  name_en: z.string().trim().default(''),
  raw: RawForm.optional(),           // has a RAW_CONE balance (kg)
  finished: FinishedForm.optional(), // has a FINISHED_PRODUCT balance (TUBA)
})

// GET /api/items — product identities
export async function GET() {
  try {
    const result = await query('SELECT * FROM items ORDER BY active DESC, name_am')
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/items — create a product and the inventory forms it has
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = ItemSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { code, name_am, name_en, raw, finished } = parsed.data
    await client.query('BEGIN')
    const item = (await client.query(
      `INSERT INTO items (id, code, name_am, name_en) VALUES ($1, $2, $3, $4) RETURNING *`,
      [`itm-${Date.now()}`, code || null, name_am, name_en]
    )).rows[0]
    if (raw) await insertStockRow(client, { item_id: item.id, type: 'raw', price: 0, ...raw, stock: raw.stock ?? 0 })
    if (finished) await insertStockRow(client, { item_id: item.id, type: 'finished', buy_price: 0, can_sell: true, ...finished, stock: finished.stock ?? 0 })
    await client.query('COMMIT')
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
