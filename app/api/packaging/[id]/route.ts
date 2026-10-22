import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'

export const runtime = 'nodejs'

// The unit itself is fixed once created; deactivate it and add a new one to change it.
const UpdateSchema = z.object({
  base_per_unit: z.number().positive().optional(),
  label_am: z.string().trim().min(1).optional(),
  label_en: z.string().trim().min(1).optional(),
  price: z.number().min(0).nullable().optional(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/packaging/:id — safe for history: sale lines and production outputs keep the factor they used
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await pool.query('DELETE FROM packaging_units WHERE id = $1 RETURNING id', [id])
    if (!result.rowCount) return NextResponse.json({ error: 'Packaging unit not found' }, { status: 404 })
    return NextResponse.json({ deleted: Number(id) })
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/packaging/:id — new factor applies to future transactions only (history stores the factor used)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const fields = Object.keys(d) as (keyof typeof d)[]
    if (!fields.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    await client.query('BEGIN')
    if (d.is_default) {
      await client.query(
        'UPDATE packaging_units SET is_default = false WHERE item_id = (SELECT item_id FROM packaging_units WHERE id = $1)',
        [id]
      )
    }
    const result = await client.query(
      `UPDATE packaging_units SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => d[f]), id]
    )
    if (!result.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Packaging unit not found' }, { status: 404 })
    }
    await client.query('COMMIT')
    return NextResponse.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err) // re-activating a duplicate → 409 DUPLICATE_UNIT
  } finally {
    client.release()
  }
}
