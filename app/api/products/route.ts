import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

const ProductSchema = z.object({
  id: z.string().min(1),
  name_am: z.string().min(1),
  name_en: z.string().min(1),
  type: z.enum(['raw', 'finished']),
  weight_grams: z.number().int().min(0),
  size: z.string().default(''),
  unit: z.string().default('ኮን'),
  stock: z.number().int().min(0).default(0),
  price: z.number().min(0),
  reorder: z.number().int().min(0).default(0),
})

// GET /api/products
export async function GET() {
  try {
    const result = await query('SELECT * FROM products ORDER BY type, name_am')
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder } = parsed.data
    const result = await query(
      `INSERT INTO products (id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
