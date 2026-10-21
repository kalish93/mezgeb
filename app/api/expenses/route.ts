import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const ExpenseSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().default('other'),
  description: z.string().min(1),
  amount: z.number().min(0),
  note: z.string().default(''),
})

// GET /api/expenses
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const conditions: string[] = []
    const params: any[] = []

    if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`date >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`date <= $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(
      `SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC`,
      params
    )
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, date, category, description, amount, note } = parsed.data
    const newId = id || `EXP-${Date.now()}`
    const result = await query(
      `INSERT INTO expenses (id, date, category, description, amount, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId, date, category, description, amount, note]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
