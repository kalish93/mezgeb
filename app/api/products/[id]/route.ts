import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name_am: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  type: z.enum(['raw', 'finished']).optional(),
  weight_grams: z.number().int().min(0).optional(),
  size: z.string().optional(),
  unit: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  reorder: z.number().int().min(0).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/products/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('SELECT * FROM products WHERE id = $1', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/products/:id
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const fields = Object.keys(parsed.data)
    if (!fields.length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const values = [...fields.map((f) => (parsed.data as any)[f]), id]
    const result = await query(
      `UPDATE products SET ${setClauses} WHERE id = $${fields.length + 1} RETURNING *`,
      values
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/products/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
