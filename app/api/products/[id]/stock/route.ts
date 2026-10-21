import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/products/:id/stock  — adjust stock by a signed delta
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { delta } = (await req.json()) as { delta: number }
    const result = await query(
      `UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2 RETURNING *`,
      [delta, id]
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
