import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { insertSaleLines, moveSaleStock, recordInitialPayment, SaleSchema } from '@/lib/ledger'

export const runtime = 'nodejs'

function statusFor(total: number, paid: number) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

// GET /api/sales
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '') || 100, 1), 1000)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '') || 0, 0)

    const conditions: string[] = []
    const params: any[] = []

    if (customerId) { params.push(customerId); conditions.push(`s.customer_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`s.date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`s.date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT s.id, s.date, s.customer_id, s.discount, s.note, s.created_at,
               c.name AS customer_name,
               COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total,
               COALESCE(s_paid.paid, 0) AS paid,
               COALESCE(json_agg(json_build_object(
                 'productId', si.product_id,
                 'quantity', si.quantity,
                 'price', si.price,
               'unitCode', si.unit_code, 'unitLabel', si.unit_label,
               'unitFactor', si.unit_factor, 'baseQuantity', si.base_quantity
               ) ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL), '[]'::json) AS items
        FROM sales s
        JOIN customers c ON c.id = s.customer_id
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pa.amount), 0) AS paid
          FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id
          WHERE pa.transaction_id = s.id AND p.kind = 'customer'
        ) s_paid ON true
        ${where}
        GROUP BY s.id, c.name, s_paid.paid
        ORDER BY s.date DESC, s.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params)

      const rows = result.rows.map((r) => ({
        ...r,
        total: parseFloat(r.total),
        paid: parseFloat(r.paid),
        status: statusFor(parseFloat(r.total), parseFloat(r.paid)),
      }))
      const filtered = status ? rows.filter((r) => r.status === status) : rows
      return NextResponse.json(filtered)
    } finally {
      client.release()
    }
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/sales  (transactional)
export async function POST(req: NextRequest) {
  const client = await pool.connect()
  try {
    const parsed = SaleSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, date, customerId, items, discount, paid, note } = parsed.data
    const saleId = id || `SAL-${Date.now()}`

    await client.query('BEGIN')
    await client.query(
      `INSERT INTO sales (id, date, customer_id, discount, note) VALUES ($1,$2,$3,$4,$5)`,
      [saleId, date, customerId, discount, note]
    )
    await insertSaleLines(client, saleId, items)
    await moveSaleStock(client, saleId, -1)
    await recordInitialPayment(client, 'customer', customerId, saleId, date, paid)
    await client.query('COMMIT')
    return NextResponse.json({ id: saleId }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
