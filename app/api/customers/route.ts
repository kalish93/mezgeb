import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const CustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().default(''),
  address: z.string().default(''),
  note: z.string().default(''),
})

// GET /api/customers
export async function GET() {
  try {
    const result = await query(`
      SELECT c.*,
        COALESCE(SUM(GREATEST(0,
          (SELECT COALESCE(SUM(si.quantity * si.price), 0) FROM sale_items si WHERE si.sale_id = s.id) - s.discount
          - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                      JOIN payments p ON p.id = pa.payment_id
                      WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
        )), 0) AS balance_due
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/customers
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, name, phone, address, note } = parsed.data
    const newId = id || `c-${Date.now()}`
    const result = await query(
      `INSERT INTO customers (id, name, phone, address, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [newId, name, phone, address, note]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
