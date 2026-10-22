import { beforeEach, describe, expect, it } from 'vitest'
import { POST as createPurchase } from '@/app/api/purchases/route'
import { GET as getPurchase, PUT as updatePurchase, DELETE as deletePurchase } from '@/app/api/purchases/[id]/route'
import { POST as createProduction } from '@/app/api/production/route'
import { PUT as updateProduction, DELETE as deleteProduction } from '@/app/api/production/[id]/route'
import { POST as createSale } from '@/app/api/sales/route'
import { GET as getSale, PUT as updateSale, DELETE as deleteSale } from '@/app/api/sales/[id]/route'
import { POST as createPayment } from '@/app/api/payments/route'
import { PUT as updatePayment, DELETE as deletePayment } from '@/app/api/payments/[id]/route'
import { GET as getCustomer, DELETE as deleteCustomer } from '@/app/api/customers/[id]/route'
import { GET as getSupplier, DELETE as deleteSupplier } from '@/app/api/suppliers/[id]/route'
import { GET as getItem, DELETE as deleteItem } from '@/app/api/items/[id]/route'
import { POST as createItem } from '@/app/api/items/route'
import { DELETE as deletePackaging } from '@/app/api/packaging/[id]/route'
import { addCustomer, addSupplier, ctx, FIN, json, one, pool, RAW, request, resetDb, stockOf } from '../helpers'

const day = '2026-10-21'
let customer: string
let supplier: string

const sale = (qty: number, paid = 0, customerId = customer) => ({
  date: day, customerId, paid, items: [{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: qty, price: 15000 }],
})
const purchase = (kg: number, paid = 0) => ({ date: day, supplierId: supplier, paid, items: [{ productId: RAW('MENEN'), quantity: kg, price: 300 }] })
const batch = (kg: number, madaberiya: number) => ({
  date: day, rawProductId: RAW('MENEN'), rawKg: kg, outputs: [{ productId: FIN('MENEN'), unitCode: 'MADABERIYA_TIDOSH', quantity: madaberiya }],
})
const created = async (res: Response) => (await res.json()).id as string
const balanceOf = async (id: string) => Number((await json(await getCustomer(request('GET'), ctx(id)))).body.balance_due)
const count = async (sql: string) => Number((await one(sql)).count)

beforeEach(async () => {
  await resetDb()
  customer = await addCustomer()
  supplier = await addSupplier()
  await createPurchase(request('POST', purchase(50)))
  await createProduction(request('POST', batch(20, 3))) // 1,800 TUBA
})

describe('editing and deleting sales', () => {
  it('edit: reverses the old stock deduction and applies the new one; payments stay attached', async () => {
    const id = await created(await createSale(request('POST', sale(2, 10000))))
    expect(await stockOf(FIN('MENEN'))).toBe(1800 - 1200)

    const res = await updateSale(request('PUT', sale(1)), ctx(id))
    expect(res.status).toBe(200)
    expect(await stockOf(FIN('MENEN'))).toBe(1800 - 600)
    const s = (await json(await getSale(request('GET'), ctx(id)))).body
    expect(s.total).toBe(15000)
    expect(s.paid).toBe(10000)
    expect(s.payments).toHaveLength(1)
    expect(await balanceOf(customer)).toBe(5000)
  })

  it('edit: moving a sale to another customer moves the payments made for it', async () => {
    const other = await addCustomer('c-other')
    const id = await created(await createSale(request('POST', sale(1, 4000))))
    await updateSale(request('PUT', sale(1, 0, other)), ctx(id))
    expect(await balanceOf(customer)).toBe(0)
    expect(await balanceOf(other)).toBe(15000 - 4000)
  })

  it('delete: puts the stock back and removes the payment made only for that sale', async () => {
    const id = await created(await createSale(request('POST', sale(2, 10000))))
    const res = await json(await deleteSale(request('DELETE'), ctx(id)))
    expect(res).toEqual({ status: 200, body: { deleted: id, paymentsDeleted: 1 } })
    expect(await stockOf(FIN('MENEN'))).toBe(1800)
    expect(await count('SELECT count(*) FROM payments')).toBe(0)
    expect(await balanceOf(customer)).toBe(0)
    // the movement log keeps both sides
    const moves = (await pool.query(`SELECT delta::float d FROM inventory_movements WHERE reason = 'sale' ORDER BY id`)).rows
    expect(moves).toEqual([{ d: -1200 }, { d: 1200 }])
  })

  it('delete: a payment that also covered another sale is kept (only this sale\'s part is removed)', async () => {
    const a = await created(await createSale(request('POST', sale(1))))
    await created(await createSale(request('POST', sale(1))))
    await createPayment(request('POST', { date: day, kind: 'customer', personId: customer, amount: 20000 })) // 15000 to a, 5000 to b
    await deleteSale(request('DELETE'), ctx(a))
    expect(await count('SELECT count(*) FROM payments')).toBe(1)
    expect(await balanceOf(customer)).toBe(15000 - 20000) // credit of 5,000
  })
})

describe('editing and deleting purchases', () => {
  it('edit changes raw stock by the difference; delete takes it out and removes its own payment', async () => {
    const id = await created(await createPurchase(request('POST', purchase(10, 3000))))
    expect(await stockOf(RAW('MENEN'))).toBe(30 + 10)
    await updatePurchase(request('PUT', purchase(12.5)), ctx(id))
    expect(await stockOf(RAW('MENEN'))).toBe(42.5)
    const p = (await json(await getPurchase(request('GET'), ctx(id)))).body
    expect(p.total).toBe(3750)
    expect(p.paid).toBe(3000)

    expect((await json(await deletePurchase(request('DELETE'), ctx(id)))).body.paymentsDeleted).toBe(1)
    expect(await stockOf(RAW('MENEN'))).toBe(30)
    const sup = (await json(await getSupplier(request('GET'), ctx(supplier)))).body
    expect(sup.balance_due).toBe(50 * 300) // only the first purchase remains, unpaid
  })
})

describe('editing and deleting production', () => {
  it('edit undoes the batch and records it again; delete restores raw kg and removes the output', async () => {
    const id = await created(await createProduction(request('POST', batch(5, 1))))
    expect([await stockOf(RAW('MENEN')), await stockOf(FIN('MENEN'))]).toEqual([25, 2400])

    expect((await updateProduction(request('PUT', batch(8, 2)), ctx(id))).status).toBe(200)
    expect([await stockOf(RAW('MENEN')), await stockOf(FIN('MENEN'))]).toEqual([22, 3000])

    expect((await deleteProduction(request('DELETE'), ctx(id))).status).toBe(200)
    expect([await stockOf(RAW('MENEN')), await stockOf(FIN('MENEN'))]).toEqual([30, 1800])
    expect(await count(`SELECT count(*) FROM productions WHERE id = '${id}'`)).toBe(0)
  })

  it('an edit that needs more raw cone than there is fails and leaves the batch unchanged', async () => {
    const id = await created(await createProduction(request('POST', batch(5, 1))))
    const res = await json(await updateProduction(request('PUT', batch(500, 1)), ctx(id)))
    expect(res).toEqual({ status: 409, body: { error: 'INSUFFICIENT_STOCK' } })
    expect([await stockOf(RAW('MENEN')), await stockOf(FIN('MENEN'))]).toEqual([25, 2400])
  })
})

describe('editing and deleting payments', () => {
  it('edit re-applies the new amount; delete removes it', async () => {
    const s = await created(await createSale(request('POST', sale(1))))
    const pay = await created(await createPayment(request('POST', { date: day, kind: 'customer', personId: customer, amount: 5000 })))
    await updatePayment(request('PUT', { date: day, kind: 'customer', personId: customer, amount: 15000 }), ctx(pay))
    expect((await json(await getSale(request('GET'), ctx(s)))).body.status).toBe('paid')
    expect(await balanceOf(customer)).toBe(0)

    await deletePayment(request('DELETE'), ctx(pay))
    expect((await json(await getSale(request('GET'), ctx(s)))).body.status).toBe('unpaid')
    expect(await balanceOf(customer)).toBe(15000)
  })
})

describe('deleting people and products', () => {
  it('refuses to delete a customer or supplier with history, allows it without', async () => {
    await createSale(request('POST', sale(1)))
    expect((await json(await deleteCustomer(request('DELETE'), ctx(customer)))).body.error).toBe('IN_USE')
    expect((await json(await deleteSupplier(request('DELETE'), ctx(supplier)))).body.error).toBe('IN_USE')
    const fresh = await addCustomer('c-fresh')
    expect((await deleteCustomer(request('DELETE'), ctx(fresh))).status).toBe(200)
  })

  it('refuses to delete a product with transactions; deletes an unused one', async () => {
    const menen = (await one(`SELECT id FROM items WHERE code = 'MENEN'`)).id
    expect((await json(await deleteItem(request('DELETE'), ctx(menen)))).body.error).toBe('IN_USE')

    const fresh = await created(await createItem(request('POST', { name_am: 'አዲስ', finished: { stock: 10 } })))
    expect((await deleteItem(request('DELETE'), ctx(fresh))).status).toBe(200)
    expect(await count(`SELECT count(*) FROM products WHERE item_id = '${fresh}'`)).toBe(0)
  })

  it('product detail lists the stock rows, packaging and movement history', async () => {
    await createSale(request('POST', sale(1)))
    const menen = (await one(`SELECT id FROM items WHERE code = 'MENEN'`)).id
    const d = (await json(await getItem(request('GET'), ctx(menen)))).body
    expect(d.stock.map((s: any) => s.form)).toEqual(['RAW_CONE', 'FINISHED_PRODUCT'])
    expect(d.packaging).toHaveLength(3)
    expect(d.movements.map((m: any) => m.reason)).toEqual(['sale', 'production_in', 'production_out', 'purchase'])
    expect(d.movements[0].person_name).toBe('Test customer')
  })

  it('deleting a packaging unit leaves past sales intact', async () => {
    const id = await created(await createSale(request('POST', sale(1))))
    const unit = (await one(`SELECT pu.id FROM packaging_units pu JOIN items i ON i.id = pu.item_id WHERE i.code = 'MENEN' AND pu.unit_code = 'MADABERIYA_TIDOSH'`)).id
    expect((await deletePackaging(request('DELETE'), ctx(unit))).status).toBe(200)
    const s = (await json(await getSale(request('GET'), ctx(id)))).body
    expect(s.items[0]).toMatchObject({ unitFactor: 600, baseQuantity: 600 })
    expect(s.total).toBe(15000)
  })
})
