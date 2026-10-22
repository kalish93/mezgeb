import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { SUPPLIER_BALANCE_SQL } from '@/lib/ledger'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/suppliers/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    // the supplier, balance, every purchase (with paid amount) and every payment we made them
    const [sup, purchasesRes, paymentsRes] = await Promise.all([
      query(`SELECT su.*, ${SUPPLIER_BALANCE_SQL('su.id')} AS balance_due FROM suppliers su WHERE su.id = $1`, [id]),
      query(`
        SELECT p.id, p.date, p.note,
          COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
          COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments py ON py.id = pa.payment_id
                    WHERE pa.transaction_id = p.id AND py.kind = 'supplier'), 0) AS paid,
          COALESCE(json_agg(json_build_object('productId', pi.product_id, 'productName', pr.name_am, 'unit', pr.unit, 'quantity', pi.quantity, 'price', pi.price) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
        FROM purchases p
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        LEFT JOIN products pr ON pr.id = pi.product_id
        WHERE p.supplier_id = $1
        GROUP BY p.id
        ORDER BY p.date DESC, p.created_at DESC
      `, [id]),
      query(`SELECT * FROM payments WHERE kind = 'supplier' AND person_id = $1 ORDER BY date DESC, created_at DESC`, [id]),
    ])
    if (!sup.rows.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json({ ...sup.rows[0], purchases: purchasesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/suppliers/:id
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const fields = Object.keys(parsed.data).filter((f) => f !== 'id')
    if (!fields.length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const result = await query(
      `UPDATE suppliers SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => (parsed.data as any)[f]), id]
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE /api/suppliers/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    // A supplier with purchases or payments can't be deleted: that history belongs to them
    const used = await query(
      `SELECT EXISTS (SELECT 1 FROM purchases WHERE supplier_id = $1) OR EXISTS (SELECT 1 FROM payments WHERE kind = 'supplier' AND person_id = $1) AS used`,
      [id]
    )
    if (used.rows[0].used) return NextResponse.json({ error: 'IN_USE' }, { status: 409 })
    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    return errorResponse(err)
  }
}
