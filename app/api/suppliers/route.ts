import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().default(''),
  address: z.string().default(''),
})

// GET /api/suppliers
export async function GET() {
  try {
    const result = await query(`
      SELECT su.*,
        COALESCE(SUM(GREATEST(0,
          (SELECT COALESCE(SUM(pi.quantity * pi.price), 0) FROM purchase_items pi WHERE pi.purchase_id = p.id)
          - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                      JOIN payments py ON py.id = pa.payment_id
                      WHERE pa.transaction_id = p.id AND py.kind = 'supplier'), 0)
        )), 0) AS balance_due
      FROM suppliers su
      LEFT JOIN purchases p ON p.supplier_id = su.id
      GROUP BY su.id
      ORDER BY su.name
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/suppliers
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = SupplierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, name, phone, address } = parsed.data
    const newId = id || `s-${Date.now()}`
    const result = await query(
      `INSERT INTO suppliers (id, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
      [newId, name, phone, address]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
