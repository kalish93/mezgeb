import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { CUSTOMER_BALANCE_SQL } from '@/lib/ledger'

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
    // balance = total sold − total paid (negative = the customer has credit)
    const result = await query(`
      SELECT c.*, ${CUSTOMER_BALANCE_SQL('c.id')} AS balance_due
      FROM customers c
      ORDER BY c.name
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
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
    return errorResponse(err)
  }
}
