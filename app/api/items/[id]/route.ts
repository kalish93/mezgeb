import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pool, query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { FinishedForm, ItemCode, RawForm } from '@/lib/item-schemas'
import { FORM_SQL, insertStockRow, setStock } from '@/lib/stock'

export const runtime = 'nodejs'

// Missing forms are added; existing forms are updated (a form is never removed — deactivate the item instead)
const UpdateSchema = z.object({
  code: ItemCode.nullable().optional(),
  name_am: z.string().trim().min(1).optional(),
  name_en: z.string().trim().optional(),
  active: z.boolean().optional(),
  raw: RawForm.optional(),
  finished: FinishedForm.optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/items/:id — product with its stock rows, packaging and full movement history
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const item = (await query('SELECT * FROM items WHERE id = $1', [id])).rows[0]
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    const [stock, packaging, movements] = await Promise.all([
      query(`SELECT p.*, ${FORM_SQL} AS form FROM products p WHERE p.item_id = $1 ORDER BY p.type DESC`, [id]),
      query('SELECT * FROM packaging_units WHERE item_id = $1 ORDER BY active DESC, base_per_unit DESC', [id]),
      // who / what each movement was: the sale's customer, the purchase's supplier, the batch
      query(`
        SELECT m.id, m.product_id, m.form, m.delta, m.unit, m.reason, m.ref_id, m.created_at,
               COALESCE(sa.date, pu.date, pr.date) AS date,
               COALESCE(c.name, s.name) AS person_name
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        LEFT JOIN sales sa ON m.reason = 'sale' AND sa.id = m.ref_id
        LEFT JOIN customers c ON c.id = sa.customer_id
        LEFT JOIN purchases pu ON m.reason = 'purchase' AND pu.id = m.ref_id
        LEFT JOIN suppliers s ON s.id = pu.supplier_id
        LEFT JOIN productions pr ON m.reason IN ('production_in', 'production_out') AND pr.id = m.ref_id
        WHERE p.item_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 300
      `, [id]),
    ])
    return NextResponse.json({ ...item, stock: stock.rows, packaging: packaging.rows, movements: movements.rows })
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE /api/items/:id — only a product never used in a sale, purchase or production; otherwise deactivate it
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const used = await client.query(
      `SELECT EXISTS (SELECT 1 FROM sale_items si JOIN products p ON p.id = si.product_id WHERE p.item_id = $1)
           OR EXISTS (SELECT 1 FROM purchase_items pi JOIN products p ON p.id = pi.product_id WHERE p.item_id = $1)
           OR EXISTS (SELECT 1 FROM productions pr JOIN products p ON p.id = pr.raw_product_id WHERE p.item_id = $1)
           OR EXISTS (SELECT 1 FROM production_outputs po JOIN products p ON p.id = po.product_id WHERE p.item_id = $1) AS used`,
      [id]
    )
    if (used.rows[0].used) return NextResponse.json({ error: 'IN_USE' }, { status: 409 })
    await client.query('BEGIN')
    await client.query('DELETE FROM packaging_units WHERE item_id = $1', [id])
    await client.query('DELETE FROM products WHERE item_id = $1', [id]) // movements cascade (only opening counts)
    const result = await client.query('DELETE FROM items WHERE id = $1 RETURNING id', [id])
    await client.query('COMMIT')
    if (!result.rowCount) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json({ deleted: id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}

// PUT /api/items/:id
export async function PUT(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    const { id } = await params
    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { raw, finished, ...identity } = parsed.data
    await client.query('BEGIN')

    const fields = Object.keys(identity) as (keyof typeof identity)[]
    if (fields.length) {
      await client.query(
        `UPDATE items SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1}`,
        [...fields.map((f) => (f === 'code' ? identity.code || null : identity[f])), id]
      )
    }
    const item = (await client.query('SELECT * FROM items WHERE id = $1', [id])).rows[0]
    if (!item) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    // The name is the same in every inventory form
    await client.query('UPDATE products SET name_am = $1, name_en = $2 WHERE item_id = $3', [item.name_am, item.name_en, id])

    for (const [type, form] of [['raw', raw], ['finished', finished]] as const) {
      if (!form) continue
      const row = (await client.query('SELECT id FROM products WHERE item_id = $1 AND type = $2', [id, type])).rows[0]
      if (!row) {
        await insertStockRow(client, { item_id: id, type, price: 0, buy_price: 0, can_sell: type === 'finished', ...form, stock: form.stock ?? 0 })
        continue
      }
      if (type === 'raw') {
        const f = form as z.infer<typeof RawForm>
        await client.query('UPDATE products SET buy_price = $1, reorder = $2 WHERE id = $3', [f.buy_price, f.reorder, row.id])
      } else {
        const f = form as z.infer<typeof FinishedForm>
        await client.query(
          'UPDATE products SET unit = $1, price = $2, reorder = $3, can_buy = $4 WHERE id = $5',
          [f.unit, f.price, f.reorder, f.can_buy, row.id]
        )
      }
      if (form.stock !== undefined) await setStock(client, row.id, form.stock)
    }

    await client.query('COMMIT')
    return NextResponse.json(item)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return errorResponse(err)
  } finally {
    client.release()
  }
}
