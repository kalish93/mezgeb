import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import {
  deleteTransactionPayments, insertPurchaseLines, movePaymentsToPerson, movePurchaseStock, paymentsFor, PurchaseSchema,
} from '@/lib/ledger'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

type Ctx = { params: Promise<{ id: string }> }

// GET /api/purchases/:id — the purchase, its lines and the payments applied to it
export async function GET(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const result = await client.query(`
      SELECT p.id, p.date, p.supplier_id, p.note, p.created_at, p.updated_at,
             su.name AS supplier_name,
             COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
             COALESCE(p_paid.paid, 0) AS paid,
             COALESCE(json_agg(json_build_object(
               'productId', pi.product_id,
               'productName', pr.name_am,
               'form', CASE pr.type WHEN 'raw' THEN 'RAW_CONE' ELSE 'FINISHED_PRODUCT' END,
               'quantity', pi.quantity,
               'price', pi.price,
               'unit', pr.unit
             ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
      FROM purchases p
      JOIN suppliers su ON su.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN products pr ON pr.id = pi.product_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pa.amount), 0) AS paid
        FROM payment_allocations pa
        JOIN payments py ON py.id = pa.payment_id
        WHERE pa.transaction_id = p.id AND py.kind = 'supplier'
      ) p_paid ON true
      WHERE p.id = $1
      GROUP BY p.id, su.name, p_paid.paid
    `, [id])

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }
    const r = result.rows[0]
    return NextResponse.json({
      ...r,
      status: statusFor(r.total, r.paid),
      payments: await paymentsFor(client, 'supplier', id),
    })
  } catch (err) {
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// PUT /api/purchases/:id — replace date / supplier / lines / note; stock reversed then re-applied
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = PurchaseSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { date, supplierId, items, note } = parsed.data

    await client.query('BEGIN')
    const old = (await client.query('SELECT supplier_id FROM purchases WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!old) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }
    await movePurchaseStock(client, id, -1)
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id])
    await client.query('UPDATE purchases SET date = $1, supplier_id = $2, note = $3 WHERE id = $4', [date, supplierId, note, id])
    await insertPurchaseLines(client, id, items)
    await movePurchaseStock(client, id, 1)
    if (old.supplier_id !== supplierId) await movePaymentsToPerson(client, 'supplier', id, supplierId)
    await client.query('COMMIT')
    return NextResponse.json({ id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// DELETE /api/purchases/:id — takes the bought stock back out and removes the payments made only for it
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    await client.query('BEGIN')
    const exists = await client.query('SELECT 1 FROM purchases WHERE id = $1 FOR UPDATE', [id])
    if (!exists.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }
    await movePurchaseStock(client, id, -1)
    const paymentsDeleted = await deleteTransactionPayments(client, 'supplier', id)
    await client.query('DELETE FROM purchases WHERE id = $1', [id]) // lines cascade
    await client.query('COMMIT')
    return NextResponse.json({ deleted: id, paymentsDeleted })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
