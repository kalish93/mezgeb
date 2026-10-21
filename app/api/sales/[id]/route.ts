import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

type Ctx = { params: Promise<{ id: string }> }

// GET /api/sales/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query(`
      SELECT s.id, s.date, s.customer_id, s.discount, s.note, s.created_at,
             c.name AS customer_name,
             COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
             COALESCE(s_paid.paid, 0) AS paid,
             json_agg(json_build_object(
               'productId', si.product_id,
               'quantity', si.quantity,
               'price', si.price
             ) ORDER BY si.id) AS items
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        WHERE pa.transaction_id = s.id AND p.kind = 'customer'
      ) s_paid ON true
      WHERE s.id = $1
      GROUP BY s.id, c.name, s_paid.paid
    `, [id])

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
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

// DELETE /api/sales/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM sales WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
