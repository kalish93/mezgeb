import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/customers/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const [cust, salesRes, paymentsRes] = await Promise.all([
      query('SELECT * FROM customers WHERE id = $1', [id]),
      query(`
        SELECT s.id, s.date, s.discount, s.note,
          COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
          json_agg(json_build_object('productId', si.product_id, 'quantity', si.quantity, 'price', si.price)) AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.customer_id = $1
        GROUP BY s.id
        ORDER BY s.date DESC
      `, [id]),
      query(`SELECT * FROM payments WHERE kind = 'customer' AND person_id = $1 ORDER BY date DESC`, [id]),
    ])
    if (!cust.rows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ ...cust.rows[0], sales: salesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/customers/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
