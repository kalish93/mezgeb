import { NextRequest, NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { allocatePayment, PaymentSchema } from '@/lib/ledger'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/payments/:id — with the person's name and what each allocation paid for
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query(`
      SELECT p.*,
        COALESCE(c.name, s.name) AS person_name,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'transactionId', pa.transaction_id, 'amount', pa.amount,
             'date', COALESCE(sa.date, pu.date)
           ) ORDER BY COALESCE(sa.date, pu.date))
           FROM payment_allocations pa
           LEFT JOIN sales sa ON sa.id = pa.transaction_id AND p.kind = 'customer'
           LEFT JOIN purchases pu ON pu.id = pa.transaction_id AND p.kind = 'supplier'
           WHERE pa.payment_id = p.id),
          '[]'::json
        ) AS allocations
      FROM payments p
      LEFT JOIN customers c ON p.kind = 'customer' AND c.id = p.person_id
      LEFT JOIN suppliers s ON p.kind = 'supplier' AND s.id = p.person_id
      WHERE p.id = $1
    `, [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/payments/:id — change date / person / amount / note; the payment is re-applied to the oldest open invoices
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = PaymentSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { date, kind, personId, amount, allocations, note } = parsed.data
    await client.query('BEGIN')
    const updated = await client.query(
      'UPDATE payments SET date = $1, kind = $2, person_id = $3, amount = $4, note = $5 WHERE id = $6',
      [date, kind, personId, amount, note, id]
    )
    if (!updated.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    await client.query('DELETE FROM payment_allocations WHERE payment_id = $1', [id])
    await allocatePayment(client, id, kind, personId, amount, allocations)
    await client.query('COMMIT')
    return NextResponse.json({ id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// DELETE /api/payments/:id (allocations cascade)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    return errorResponse(err)
  }
}
