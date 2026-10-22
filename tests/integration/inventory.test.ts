import { beforeEach, describe, expect, it } from 'vitest'
import { POST as createPurchase } from '@/app/api/purchases/route'
import { POST as createProduction } from '@/app/api/production/route'
import { POST as createSale } from '@/app/api/sales/route'
import { GET as getSale } from '@/app/api/sales/[id]/route'
import { GET as getCustomers } from '@/app/api/customers/route'
import { GET as getDashboard } from '@/app/api/dashboard/route'
import { POST as createPackaging } from '@/app/api/packaging/route'
import { PUT as updatePackaging } from '@/app/api/packaging/[id]/route'
import { seedProducts } from '../../scripts/seed-products.mjs'
import { addCustomer, addSupplier, ctx, FIN, json, one, pool, RAW, request, resetDb, stockOf } from '../helpers'

const day = '2026-10-21'
let customer: string
let supplier: string

const buyRaw = (code: string, kg: number, pricePerKg = 300, paid = 0) =>
  createPurchase(request('POST', { date: day, supplierId: supplier, items: [{ productId: RAW(code), quantity: kg, price: pricePerKg }], paid }))
const produce = (code: string, rawKg: number, outputs: { unitCode: string; quantity: number }[], wasteKg = 0) =>
  createProduction(request('POST', { date: day, rawProductId: RAW(code), rawKg, wasteKg, outputs: outputs.map((o) => ({ productId: FIN(code), ...o })) }))
const sell = (items: { productId: string; unitCode: string; quantity: number; price: number }[], paid = 0) =>
  createSale(request('POST', { date: day, customerId: customer, items, paid }))
const unitId = async (code: string, unit: string) =>
  (await one(`SELECT pu.id FROM packaging_units pu JOIN items i ON i.id = pu.item_id WHERE i.code = $1 AND pu.unit_code = $2 AND pu.active`, [code, unit])).id
const movements = async (productId: string) =>
  (await pool.query('SELECT form, reason, delta::float AS delta FROM inventory_movements WHERE product_id = $1 ORDER BY id', [productId])).rows

beforeEach(async () => {
  await resetDb()
  customer = await addCustomer()
  supplier = await addSupplier()
})

describe('seeder', () => {
  it('seeds 4 products, each with a RAW_CONE (kg) and a FINISHED_PRODUCT (TUBA) row and 3 conversions', async () => {
    const counts = await one(`SELECT (SELECT count(*) FROM items)::int items,
      (SELECT count(*) FROM products WHERE type = 'raw' AND unit = 'ኪ.ግ')::int raw,
      (SELECT count(*) FROM products WHERE type = 'finished' AND unit = 'ቱባ')::int fin,
      (SELECT count(*) FROM packaging_units)::int units`)
    expect(counts).toEqual({ items: 4, raw: 4, fin: 4, units: 12 })
    const names = await one(`SELECT array_agg(DISTINCT p.name_am ORDER BY p.name_am) AS n FROM products p JOIN items i ON i.id = p.item_id WHERE i.code = 'MENEN'`)
    expect(names.n).toEqual(['መነን']) // same name in both forms
  })

  it('running it again creates no duplicates and keeps prices, stock, conversions and history', async () => {
    await buyRaw('MENEN', 20)
    await pool.query(`UPDATE packaging_units SET base_per_unit = 610, price = 15000 WHERE id = $1`, [await unitId('MENEN', 'MADABERIYA_TIDOSH')])
    await pool.query(`UPDATE products SET buy_price = 999 WHERE id = $1`, [RAW('MENEN')])

    const client = await pool.connect()
    try { await seedProducts(client, () => {}); await seedProducts(client, () => {}) } finally { client.release() }

    const after = await one(`SELECT (SELECT count(*) FROM items)::int items, (SELECT count(*) FROM products)::int rows,
      (SELECT count(*) FROM packaging_units)::int units, (SELECT count(*) FROM purchases)::int purchases`)
    expect(after).toEqual({ items: 4, rows: 8, units: 12, purchases: 1 })
    const m = await one(`SELECT base_per_unit::float f, price::float p FROM packaging_units WHERE id = $1`, [await unitId('MENEN', 'MADABERIYA_TIDOSH')])
    expect(m).toEqual({ f: 610, p: 15000 })
    expect(await stockOf(RAW('MENEN'))).toBe(20)
    expect(Number((await one('SELECT buy_price FROM products WHERE id = $1', [RAW('MENEN')])).buy_price)).toBe(999)
  })

  it('reconciles an existing un-coded product with the same name instead of duplicating it', async () => {
    await pool.query('TRUNCATE inventory_movements, packaging_units, products, items RESTART IDENTITY CASCADE')
    await pool.query(`INSERT INTO items (id, name_am, name_en) VALUES ('itm-old', 'ኮተን', 'Cotton')`)
    await pool.query(`INSERT INTO products (id, item_id, name_am, name_en, type, unit, stock) VALUES ('old-cotton', 'itm-old', 'ኮተን', 'Cotton', 'finished', 'ቱባ', 77)`)
    const client = await pool.connect()
    try { await seedProducts(client, () => {}) } finally { client.release() }

    const cotton = (await pool.query(`SELECT id, code FROM items WHERE name_am = 'ኮተን'`)).rows
    expect(cotton).toEqual([{ id: 'itm-old', code: 'COTTON' }])
    expect(await stockOf('old-cotton')).toBe(77) // existing balance untouched
    expect(Number((await one(`SELECT count(*) FROM products WHERE item_id = 'itm-old' AND type = 'finished'`)).count)).toBe(1)
  })
})

describe('seeder on data from before migration 004', () => {
  const legacy = async (rows: [string, string, 'raw' | 'finished', string, number][]) => {
    await pool.query('TRUNCATE inventory_movements, packaging_units, products, items RESTART IDENTITY CASCADE')
    for (const [id, name, type, unit, stock] of rows) {
      await pool.query(`INSERT INTO items (id, name_am) VALUES ($1, $2)`, [`itm-${id}`, name]) // as migration 004 does
      await pool.query(`INSERT INTO products (id, item_id, name_am, name_en, type, unit, stock) VALUES ($1, $2, $3, '', $4, $5, $6)`, [id, `itm-${id}`, name, type, unit, stock])
    }
    const logs: string[] = []
    const client = await pool.connect()
    try { await seedProducts(client, (m) => logs.push(m)) } finally { client.release() }
    return logs
  }

  it('merges a raw and a finished row with the same name into one product, without a duplicate stock row', async () => {
    await legacy([['old-raw', 'ፒሲ', 'raw', 'ኪ.ግ', 40], ['old-fin', 'ፒሲ', 'finished', 'ቱባ', 800]])
    const rows = (await pool.query(`SELECT p.id, p.type, p.stock::float s FROM products p JOIN items i ON i.id = p.item_id WHERE i.code = 'PC' ORDER BY p.type`)).rows
    expect(rows).toEqual([{ id: 'old-fin', type: 'finished', s: 800 }, { id: 'old-raw', type: 'raw', s: 40 }])
    expect(Number((await one(`SELECT count(*) FROM items WHERE name_am = 'ፒሲ'`)).count)).toBe(1)
    expect(Number((await one(`SELECT count(*) FROM packaging_units pu JOIN items i ON i.id = pu.item_id WHERE i.code = 'PC'`)).count)).toBe(3)
  })

  it('does not guess when two rows of the same kind share a name, nor add TUBA packaging to stock counted in another unit', async () => {
    const logs = await legacy([
      ['a', 'መነን', 'finished', 'ቱባ', 1], ['b', 'መነን', 'finished', 'ቱባ', 2], // ambiguous
      ['c', 'ኮተን', 'finished', 'ኮን', 25],                                    // counted in cones
    ])
    expect(logs.some((l) => l.includes('MENEN') && l.includes('skipped'))).toBe(true)
    expect(Number((await one(`SELECT count(*) FROM items WHERE name_am = 'መነን'`)).count)).toBe(2) // left as they were
    expect(logs.some((l) => l.includes('COTTON') && l.includes('ኮን'))).toBe(true)
    expect(Number((await one(`SELECT count(*) FROM packaging_units pu JOIN items i ON i.id = pu.item_id WHERE i.code = 'COTTON'`)).count)).toBe(0)
    expect(await stockOf('c')).toBe(25)
  })
})

describe('purchasing raw cone', () => {
  it('increases only the raw cone kg', async () => {
    expect((await buyRaw('MENEN', 12.5, 300)).status).toBe(201)
    expect(await stockOf(RAW('MENEN'))).toBe(12.5)
    expect(await stockOf(FIN('MENEN'))).toBe(0)
    expect(await movements(RAW('MENEN'))).toEqual([{ form: 'RAW_CONE', reason: 'purchase', delta: 12.5 }])
    expect(await movements(FIN('MENEN'))).toEqual([])
  })
})

describe('production', () => {
  it('decreases raw cone kg and increases finished TUBA, using the unit the output was counted in', async () => {
    await buyRaw('MENEN', 50)
    const res = await produce('MENEN', 10, [{ unitCode: 'MADABERIYA_TIDOSH', quantity: 2 }, { unitCode: 'PACKET', quantity: 5 }], 0.4)
    expect(res.status).toBe(201)
    expect(await stockOf(RAW('MENEN'))).toBe(40)
    expect(await stockOf(FIN('MENEN'))).toBe(2 * 600 + 5 * 30)
    expect(await movements(FIN('MENEN'))).toEqual([{ form: 'FINISHED_PRODUCT', reason: 'production_in', delta: 1350 }])
    const batch = await one(`SELECT raw_quantity::float kg, waste_grams FROM productions`)
    expect(batch).toEqual({ kg: 10, waste_grams: 400 })
  })

  it('rejects using more raw cone than is in stock, and changes nothing', async () => {
    await buyRaw('PC', 5)
    const res = await json(await produce('PC', 6, [{ unitCode: 'PACKET', quantity: 1 }]))
    expect(res).toEqual({ status: 409, body: { error: 'INSUFFICIENT_STOCK' } })
    expect(await stockOf(RAW('PC'))).toBe(5)
    expect(await stockOf(FIN('PC'))).toBe(0)
    expect(Number((await one('SELECT count(*) FROM productions')).count)).toBe(0)
  })

  it('only consumes RAW_CONE rows and only produces FINISHED_PRODUCT rows', async () => {
    await buyRaw('PC', 5)
    const asRaw = await createProduction(request('POST', { date: day, rawProductId: FIN('PC'), rawKg: 1, outputs: [{ productId: FIN('PC'), quantity: 1 }] }))
    expect((await json(asRaw)).body.error).toBe('RAW_MATERIAL_REQUIRED')
    const intoRaw = await createProduction(request('POST', { date: day, rawProductId: RAW('PC'), rawKg: 1, outputs: [{ productId: RAW('PC'), quantity: 1 }] }))
    expect((await json(intoRaw)).body.error).toBe('INVALID_OUTPUT')
    expect(await stockOf(RAW('PC'))).toBe(5)
  })
})

describe('sales', () => {
  beforeEach(async () => {
    await buyRaw('MENEN', 30)
    await produce('MENEN', 20, [{ unitCode: 'MADABERIYA_TIDOSH', quantity: 2 }]) // 1,200 TUBA
  })

  it('2 Madaberiya of Menen deducts 1,200 TUBA and records unit, factor and total', async () => {
    const res = await json(await sell([{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 2, price: 15000 }]))
    expect(res.status).toBe(201)
    expect(await stockOf(FIN('MENEN'))).toBe(0)
    expect(await stockOf(RAW('MENEN'))).toBe(10) // raw untouched by the sale
    const line = await one(`SELECT unit_code, unit_factor::float f, quantity::float q, price::float p, base_quantity::float b FROM sale_items`)
    expect(line).toEqual({ unit_code: 'MADABERIYA_TIDOSH', f: 600, q: 2, p: 15000, b: 1200 })
    const sale = await json(await getSale(request('GET'), ctx(res.body.id)))
    expect(sale.body.total).toBe(30000)
  })

  it('totals use each line\'s own unit price; a partial payment leaves the right customer balance', async () => {
    const res = await json(await sell([
      { productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 1, price: 15000 }, // 600 TUBA
      { productId: FIN('MENEN'), unitCode: 'PACKET', quantity: 10, price: 800 },             // 300 TUBA
      { productId: FIN('MENEN'), unitCode: 'PIECE', quantity: 5, price: 110 },               // 20 TUBA
    ], 10000))
    expect(res.status).toBe(201)
    expect(await stockOf(FIN('MENEN'))).toBe(1200 - 600 - 300 - 20)
    const sale = await json(await getSale(request('GET'), ctx(res.body.id)))
    expect(sale.body.total).toBe(15000 + 8000 + 550)
    expect(sale.body.paid).toBe(10000)
    expect(sale.body.status).toBe('partial')
    const customers = await json(await getCustomers())
    expect(customers.body.find((c: any) => c.id === customer).balance_due).toBe(23550 - 10000)
  })

  it('never blocks a sale for missing stock: finished stock may go negative (purchase / production recorded later)', async () => {
    const res = await json(await sell([{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 3, price: 15000 }]))
    expect(res.status).toBe(201)
    expect(await stockOf(FIN('MENEN'))).toBe(1200 - 1800)
    expect(await stockOf(RAW('MENEN'))).toBe(10) // raw cone still untouched

    // recording the missing production later brings the balance back
    await produce('MENEN', 5, [{ unitCode: 'MADABERIYA_TIDOSH', quantity: 1 }])
    expect(await stockOf(FIN('MENEN'))).toBe(0)
  })

  it('cannot sell raw cone kilograms or use a unit the product does not have', async () => {
    const raw = await json(await sell([{ productId: RAW('MENEN'), unitCode: 'BASE', quantity: 1, price: 300 }]))
    expect(raw).toEqual({ status: 400, body: { error: 'INVALID_SALE_ITEM' } })
    await pool.query(`UPDATE packaging_units SET active = false WHERE id = $1`, [await unitId('MENEN', 'PIECE')])
    const noUnit = await json(await sell([{ productId: FIN('MENEN'), unitCode: 'PIECE', quantity: 1, price: 110 }]))
    expect(noUnit.body.error).toBe('INVALID_SALE_ITEM')
    expect(await stockOf(RAW('MENEN'))).toBe(10)
  })

  it('changing a conversion later does not change past sales or past stock deductions', async () => {
    const first = await json(await sell([{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 1, price: 15000 }]))
    const id = await unitId('MENEN', 'MADABERIYA_TIDOSH')
    expect((await updatePackaging(request('PUT', { base_per_unit: 500 }), ctx(id))).status).toBe(200)

    const old = await json(await getSale(request('GET'), ctx(first.body.id)))
    expect(old.body.total).toBe(15000)
    expect(old.body.items[0]).toMatchObject({ unitFactor: 600, baseQuantity: 600 })
    expect(await stockOf(FIN('MENEN'))).toBe(600) // not recalculated

    await sell([{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 1, price: 15000 }])
    expect(await stockOf(FIN('MENEN'))).toBe(100) // the new sale uses the new factor (500)
  })

  it('stock value: raw at buying price; finished from the default unit price when no TUBA price; negative stock ignored', async () => {
    await pool.query(`UPDATE products SET buy_price = 300 WHERE id = $1`, [RAW('MENEN')])
    await pool.query(`UPDATE packaging_units SET price = 15000 WHERE id = $1`, [await unitId('MENEN', 'MADABERIYA_TIDOSH')])
    await pool.query(`UPDATE products SET stock = -50 WHERE id = $1`, [FIN('PC')]) // oversold: adds nothing
    const dash = await json(await getDashboard())
    expect(dash.body.stockValue).toBe(10 * 300 + 1200 * (15000 / 600))
  })

  it('stock value falls back to the latest purchase / sale price when no price is set', async () => {
    await buyRaw('MENEN', 5, 320)                 // latest purchase: 320/kg → raw 15 kg
    await sell([{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: 1, price: 18000 }]) // 18000 / 600 = 30 per TUBA
    const dash = await json(await getDashboard())
    expect(dash.body.stockValue).toBe(15 * 320 + 600 * 30)
  })

  it('raw and finished movements stay distinct', async () => {
    await sell([{ productId: FIN('MENEN'), unitCode: 'PACKET', quantity: 2, price: 800 }])
    expect((await movements(RAW('MENEN'))).map((m) => [m.form, m.reason, m.delta])).toEqual([
      ['RAW_CONE', 'purchase', 30], ['RAW_CONE', 'production_out', -20],
    ])
    expect((await movements(FIN('MENEN'))).map((m) => [m.form, m.reason, m.delta])).toEqual([
      ['FINISHED_PRODUCT', 'production_in', 1200], ['FINISHED_PRODUCT', 'sale', -60],
    ])
  })
})

describe('packaging configuration', () => {
  const menenItem = async () => (await one(`SELECT id FROM items WHERE code = 'MENEN'`)).id

  it('rejects zero and negative factors', async () => {
    const item_id = await menenItem()
    await pool.query(`UPDATE packaging_units SET active = false WHERE item_id = $1 AND unit_code = 'PIECE'`, [item_id])
    for (const base_per_unit of [0, -4]) {
      const res = await createPackaging(request('POST', { item_id, unit_code: 'PIECE', base_per_unit, label_am: 'ፍሬ', label_en: 'Piece' }))
      expect(res.status).toBe(400)
    }
    expect((await updatePackaging(request('PUT', { base_per_unit: -1 }), ctx(await unitId('MENEN', 'PACKET')))).status).toBe(400)
  })

  it('does not allow two active rules for the same product and unit', async () => {
    const res = await json(await createPackaging(request('POST', { item_id: await menenItem(), unit_code: 'PACKET', base_per_unit: 25, label_am: 'ፓኬት', label_en: 'Packet' })))
    expect(res).toEqual({ status: 409, body: { error: 'DUPLICATE_UNIT' } })
  })

  it('keeps a single default selling unit per product', async () => {
    await updatePackaging(request('PUT', { is_default: true }), ctx(await unitId('MENEN', 'PACKET')))
    const defaults = (await pool.query(`SELECT unit_code FROM packaging_units pu JOIN items i ON i.id = pu.item_id WHERE i.code = 'MENEN' AND is_default`)).rows
    expect(defaults).toEqual([{ unit_code: 'PACKET' }])
  })
})
