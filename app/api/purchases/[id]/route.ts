import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

type Ctx = { params: Promise<{ id: string }> }

// GET /api/purchases/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query(`
      SELECT p.id, p.date, p.supplier_id, p.note, p.created_at,
             su.name AS supplier_name,
             COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
             COALESCE(p_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', pi.product_id,
               'quantity', pi.quantity,
               'price', pi.price
             ) ORDER BY pi.id) AS items
      FROM purchases p
      JOIN suppliers su ON su.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments py ON py.id = pa.payment_id
        WHERE pa.transaction_id = p.id AND py.kind = 'supplier'
      ) p_paid ON true
      WHERE p.id = $1
      GROUP BY p.id, su.name, p_paid.paid
    `, [id])

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }
    const r = result.rows[0]
    return NextResponse.json({
      ...r,
      total: parseFloat(r.total),
      paid: parseFloat(r.paid),
      status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchases/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM purchases WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
