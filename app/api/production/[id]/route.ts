import { NextRequest, NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { applyProduction, PRODUCTION_SELECT, ProductionSchema, reverseProduction } from '@/lib/ledger'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/production/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query(`${PRODUCTION_SELECT} WHERE pr.id = $1`, [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Production run not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/production/:id — undo the batch as recorded, then record it again with the new values
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = ProductionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    await client.query('BEGIN')
    if (!(await reverseProduction(client, id))) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Production run not found' }, { status: 404 })
    }
    await client.query(
      `UPDATE productions SET date = $2, raw_product_id = $3, raw_quantity = $4::numeric,
              input_grams = ROUND($4::numeric * 1000), waste_grams = ROUND($5::numeric * 1000), note = $6
       WHERE id = $1`,
      [id, d.date, d.rawProductId, d.rawKg, d.wasteKg, d.note]
    )
    await applyProduction(client, id, d)
    await client.query('COMMIT')
    return NextResponse.json({ id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// DELETE /api/production/:id — raw kg goes back, finished output comes out
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    await client.query('BEGIN')
    if (!(await reverseProduction(client, id))) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Production run not found' }, { status: 404 })
    }
    await client.query('DELETE FROM productions WHERE id = $1', [id])
    await client.query('COMMIT')
    return NextResponse.json({ deleted: id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
