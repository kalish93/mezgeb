import { NextRequest, NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { allocatePayment, PaymentSchema } from '@/lib/ledger'

export const runtime = 'nodejs'

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
    return errorResponse(err)
  }
}

// POST /api/payments  (transactional)
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = PaymentSchema.safeParse(await req.json())
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
    // No explicit allocations → applied to the person's oldest open invoices (FIFO)
    await allocatePayment(client, paymentId, kind, personId, amount, allocations)
    await client.query('COMMIT')
    return NextResponse.json({ id: paymentId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
