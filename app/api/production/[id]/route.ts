import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/production/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
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
    `, [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Production run not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
