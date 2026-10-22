import { NextRequest, NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { applyProduction, PRODUCTION_SELECT, ProductionSchema } from '@/lib/ledger'

export const runtime = 'nodejs'

// GET /api/production
export async function GET() {
  try {
    const result = await query(`${PRODUCTION_SELECT} ORDER BY pr.date DESC, pr.created_at DESC`)
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/production — raw kg out, finished TUBA in, batch record: all in one transaction
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = ProductionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const prodId = d.id || `PRD-${Date.now()}`

    await client.query('BEGIN')
    await client.query(
      `INSERT INTO productions (id, date, raw_product_id, raw_quantity, input_grams, waste_grams, note)
       VALUES ($1, $2, $3, $4::numeric, ROUND($4::numeric * 1000), ROUND($5::numeric * 1000), $6)`,
      [prodId, d.date, d.rawProductId, d.rawKg, d.wasteKg, d.note]
    )
    await applyProduction(client, prodId, d)
    await client.query('COMMIT')
    return NextResponse.json({ id: prodId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
