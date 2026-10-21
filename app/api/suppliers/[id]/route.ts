import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

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
    const [sup, purchasesRes, paymentsRes] = await Promise.all([
      query('SELECT * FROM suppliers WHERE id = $1', [id]),
      query(`
        SELECT p.id, p.date, p.note,
          COALESCE(SUM(pi.quantity * pi.price), 0) AS total,
          json_agg(json_build_object('productId', pi.product_id, 'quantity', pi.quantity, 'price', pi.price)) AS items
        FROM purchases p
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE p.supplier_id = $1
        GROUP BY p.id
        ORDER BY p.date DESC
      `, [id]),
      query(`SELECT * FROM payments WHERE kind = 'supplier' AND person_id = $1 ORDER BY date DESC`, [id]),
    ])
    if (!sup.rows.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json({ ...sup.rows[0], purchases: purchasesRes.rows, payments: paymentsRes.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/suppliers/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
