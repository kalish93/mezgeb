import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import {
  deleteTransactionPayments, insertSaleLines, movePaymentsToPerson, moveSaleStock, paymentsFor, SaleSchema,
} from '@/lib/ledger'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

type Ctx = { params: Promise<{ id: string }> }

// GET /api/sales/:id — the sale, its lines (with units / stock used) and the payments applied to it
export async function GET(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const result = await client.query(`
      SELECT s.id, s.date, s.customer_id, s.discount, s.note, s.created_at, s.updated_at,
             c.name AS customer_name,
             COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
             COALESCE(s_paid.paid, 0) AS paid,
             COALESCE(json_agg(json_build_object(
               'productId', si.product_id,
               'productName', pr.name_am,
               'quantity', si.quantity,
               'price', si.price,
               'unitCode', si.unit_code, 'unitLabel', si.unit_label,
               'unitFactor', si.unit_factor, 'baseQuantity', si.base_quantity, 'baseUnit', pr.unit
             ) ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL), '[]'::json) AS items
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products pr ON pr.id = si.product_id
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
      status: statusFor(r.total, r.paid),
      payments: await paymentsFor(client, 'customer', id),
    })
  } catch (err) {
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// PUT /api/sales/:id — replace date / customer / lines / discount / note.
// Old stock effect is reversed, new one applied. Payments stay attached (edit them separately).
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = SaleSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { date, customerId, items, discount, note } = parsed.data

    await client.query('BEGIN')
    const old = (await client.query('SELECT customer_id FROM sales WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!old) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }
    await moveSaleStock(client, id, 1)
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id])
    await client.query('UPDATE sales SET date = $1, customer_id = $2, discount = $3, note = $4 WHERE id = $5', [date, customerId, discount, note, id])
    await insertSaleLines(client, id, items)
    await moveSaleStock(client, id, -1)
    if (old.customer_id !== customerId) await movePaymentsToPerson(client, 'customer', id, customerId)
    await client.query('COMMIT')
    return NextResponse.json({ id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// DELETE /api/sales/:id — puts the stock back and removes the payments that were only for this sale
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    await client.query('BEGIN')
    const exists = await client.query('SELECT 1 FROM sales WHERE id = $1 FOR UPDATE', [id])
    if (!exists.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }
    await moveSaleStock(client, id, 1)
    const paymentsDeleted = await deleteTransactionPayments(client, 'customer', id)
    await client.query('DELETE FROM sales WHERE id = $1', [id]) // lines cascade
    await client.query('COMMIT')
    return NextResponse.json({ deleted: id, paymentsDeleted })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
