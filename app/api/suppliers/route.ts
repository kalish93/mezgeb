import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { SUPPLIER_BALANCE_SQL } from '@/lib/ledger'

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
    // balance = total bought − total paid (negative = we paid in advance)
    const result = await query(`
      SELECT su.*, ${SUPPLIER_BALANCE_SQL('su.id')} AS balance_due
      FROM suppliers su
      ORDER BY su.name
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    return errorResponse(err)
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
    return errorResponse(err)
  }
}
