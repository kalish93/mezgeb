import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'
import { errorResponse, HttpError } from '@/lib/http'
import { UNIT_CODES } from '@/lib/packaging'

export const runtime = 'nodejs'

// One selling unit of an item, expressed in the item's finished base unit (TUBA).
// Changing a factor only affects new transactions: sale lines and production outputs store the factor they used.
const PackagingSchema = z.object({
  item_id: z.string().min(1),
  unit_code: z.enum(UNIT_CODES),
  base_per_unit: z.number().positive(),
  label_am: z.string().trim().min(1),
  label_en: z.string().trim().min(1),
  price: z.number().min(0).nullable().default(null), // per ONE of this unit; null = not set
  is_default: z.boolean().default(false),
})

// GET /api/packaging — all conversion rules (active first)
export async function GET() {
  try {
    const result = await query(`
      SELECT pu.*, i.name_am AS item_name_am, i.code AS item_code,
             (SELECT p.unit FROM products p WHERE p.item_id = pu.item_id AND p.type = 'finished') AS base_unit
      FROM packaging_units pu JOIN items i ON i.id = pu.item_id
      ORDER BY pu.active DESC, i.name_am, pu.base_per_unit DESC
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/packaging
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = PackagingSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    await client.query('BEGIN')
    const finished = await client.query(`SELECT 1 FROM products WHERE item_id = $1 AND type = 'finished'`, [d.item_id])
    if (!finished.rowCount) throw new HttpError(400, 'NOT_A_FINISHED_PRODUCT') // packaging only applies to finished stock
    if (d.is_default) await client.query('UPDATE packaging_units SET is_default = false WHERE item_id = $1', [d.item_id])
    const row = (await client.query(
      `INSERT INTO packaging_units (item_id, unit_code, base_per_unit, label_am, label_en, price, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [d.item_id, d.unit_code, d.base_per_unit, d.label_am, d.label_en, d.price, d.is_default]
    )).rows[0]
    await client.query('COMMIT')
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err) // a second active rule for the same unit → 409 DUPLICATE_UNIT
  } finally {
    client.release()
  }
}
