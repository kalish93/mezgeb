import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'

export const runtime = 'nodejs'

const AllocationSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().min(0),
})

const PaymentSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['customer', 'supplier']),
  personId: z.string().min(1),
  amount: z.number().min(0.01),
  allocations: z.array(AllocationSchema).default([]),
  note: z.string().default(''),
})

// GET /api/payments
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind')
    const personId = searchParams.get('personId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const conditions: string[] = []
    const params: any[] = []

    if (kind) { params.push(kind); conditions.push(`p.kind = $${params.length}`) }
    if (personId) { params.push(personId); conditions.push(`p.person_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`p.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(`
      SELECT p.*,
        COALESCE(
          (SELECT json_agg(json_build_object('transactionId', pa.transaction_id, 'amount', pa.amount))
           FROM payment_allocations pa WHERE pa.payment_id = p.id),
          '[]'::json
        ) AS allocations
      FROM payments p
      ${where}
      ORDER BY p.date DESC, p.created_at DESC
    `, params)

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/payments  (transactional)
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const body = await req.json()
    const parsed = PaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, date, kind, personId, amount, allocations, note } = parsed.data
    const paymentId = id || `PAY-${Date.now()}`

    await client.query('BEGIN')

    await client.query(
      `INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [paymentId, date, kind, personId, amount, note]
    )

    for (const alloc of allocations) {
      await client.query(
        `INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1,$2,$3)`,
        [paymentId, alloc.transactionId, alloc.amount]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ id: paymentId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
}
