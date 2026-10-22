import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { insertPurchaseLines, movePurchaseStock, PurchaseSchema, recordInitialPayment } from '@/lib/ledger'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

// GET /api/purchases
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '') || 100, 1), 1000)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '') || 0, 0)

    const conditions: string[] = []
    const params: any[] = []

    if (supplierId) { params.push(supplierId); conditions.push(`p.supplier_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`p.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT p.id, p.date, p.supplier_id, p.note, p.created_at,
               su.name AS supplier_name,
               COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
               COALESCE(p_paid.paid, 0) AS paid,
               COALESCE(json_agg(json_build_object(
                 'productId', pi.product_id,
                 'quantity', pi.quantity,
                 'price', pi.price
               ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
        FROM purchases p
        JOIN suppliers su ON su.id = p.supplier_id
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pa.amount), 0) AS paid
          FROM payment_allocations pa
          JOIN payments py ON py.id = pa.payment_id
          WHERE pa.transaction_id = p.id AND py.kind = 'supplier'
        ) p_paid ON true
        ${where}
        GROUP BY p.id, su.name, p_paid.paid
        ORDER BY p.date DESC, p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params)

      const rows = result.rows.map((r) => ({
        ...r,
        total: parseFloat(r.total),
        paid: parseFloat(r.paid),
        status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
      }))
      return NextResponse.json(rows)
    } finally {
      client.release()
    }
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/purchases  (transactional)
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const body = await req.json()
    const parsed = PurchaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, date, supplierId, items, paid, note } = parsed.data
    const purchaseId = id || `PUR-${Date.now()}`

    await client.query('BEGIN')

    await client.query(
      `INSERT INTO purchases (id, date, supplier_id, note) VALUES ($1,$2,$3,$4)`,
      [purchaseId, date, supplierId, note]
    )

    // Adds to exactly the stock rows bought: raw cone kg for RAW_CONE, TUBA for a directly bought FINISHED product
    await insertPurchaseLines(client, purchaseId, items)
    await movePurchaseStock(client, purchaseId, 1)
    await recordInitialPayment(client, 'supplier', supplierId, purchaseId, date, paid)

    await client.query('COMMIT')
    return NextResponse.json({ id: purchaseId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
