import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  note: z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/expenses/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('SELECT * FROM expenses WHERE id = $1', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// PUT /api/expenses/:id
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
      `UPDATE expenses SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => (parsed.data as any)[f]), id]
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE /api/expenses/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.rows[0].id })
  } catch (err) {
    return errorResponse(err)
  }
}
