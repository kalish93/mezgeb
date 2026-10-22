import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { CUSTOMER_BALANCE_SQL } from '@/lib/ledger'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/customers/:id — the customer, balance, every sale (with paid amount) and every payment
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const [cust, salesRes, paymentsRes] = await Promise.all([
      query(`SELECT c.*, ${CUSTOMER_BALANCE_SQL('c.id')} AS balance_due FROM customers c WHERE c.id = $1`, [id]),
      query(`
        SELECT s.id, s.date, s.discount, s.note,
          COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
          COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
                    WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0) AS paid,
          COALESCE(json_agg(json_build_object('productId', si.product_id, 'productName', pr.name_am, 'quantity', si.quantity, 'price', si.price, 'unitCode', si.unit_code, 'unitLabel', si.unit_label, 'unitFactor', si.unit_factor, 'baseQuantity', si.base_quantity) ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL), '[]'::json) AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN products pr ON pr.id = si.product_id
        WHERE s.customer_id = $1
        GROUP BY s.id
        ORDER BY s.date DESC, s.created_at DESC
      `, [id]),
      query(`SELECT * FROM payments WHERE kind = 'customer' AND person_id = $1 ORDER BY date DESC, created_at DESC`, [id]),
    ])
    if (!cust.rows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ ...cust.rows[0], sales: salesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/customers/:id
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const fields = Object.keys(parsed.data).filter((f) => f !== 'id')
    if (!fields.length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const result = await query(
      `UPDATE customers SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => (parsed.data as any)[f]), id]
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE /api/customers/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    // A customer with sales or payments can't be deleted: that history belongs to them
    const used = await query(
      `SELECT EXISTS (SELECT 1 FROM sales WHERE customer_id = $1) OR EXISTS (SELECT 1 FROM payments WHERE kind = 'customer' AND person_id = $1) AS used`,
      [id]
    )
    if (used.rows[0].used) return NextResponse.json({ error: 'IN_USE' }, { status: 409 })
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    return errorResponse(err)
  }
}
