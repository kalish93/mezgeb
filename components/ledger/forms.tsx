'use client'
import { useState } from 'react'
import { Factory, Package, Plus, Settings as SettingsIcon, X } from 'lucide-react'
import {
  createSale, createPurchase, createPayment, createExpense, createItem, updateItem,
  createPackaging, updatePackaging, deletePackaging,
  createCustomer, updateCustomer, createSupplier, updateSupplier, createProduction,
  updateSale, updatePurchase, updatePayment, updateExpense, updateProduction,
  type Product, type Customer, type Supplier, type Item, type PackagingUnit,
  type SaleDetail, type PurchaseDetail, type Payment, type Expense, type Production,
} from '@/lib/api'
import { money, localDay, dateBoth, qty } from '@/lib/format'
import { BASE, UNIT_CODES, isValidFactor, lineTotal, toBase, type UnitCode } from '@/lib/packaging'
import { Btn, ChoiceCard, DateInput, DeleteButton, Empty, Errors, Field, Group, MoneyInput, Select, Sheet, SheetFooter, Stepper, TextInput } from './ui'
import { expenseCategories, categoryLabel, errorText, fmt, unitLabel, type T } from './i18n'

export type Data = { products: Product[]; customers: Customer[]; suppliers: Supplier[]; items: Item[]; packaging: PackagingUnit[] }
type Base = { t: T; onClose: () => void; onSaved: (msg: string) => void }

const num = (v: string) => Number(v) || 0
const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
const KG = 'ኪ.ግ'
const TUBA = 'ቱባ'
const panel = 'rounded-2xl border border-[#dfe9e1] bg-[#f7faf7] p-4'

/** Shared save wrapper: validation errors first, then API errors (translated) shown in the form. */
function useSave(t: T) {
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const run = async (errs: string[], action: () => Promise<void>) => {
    setErrors(errs)
    if (errs.length || busy) return
    setBusy(true)
    try { await action() } catch (e: any) { setErrors([errorText(t, e?.message ?? 'Error')]) } finally { setBusy(false) }
  }
  return { errors, busy, run }
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label} hint={value ? dateBoth(value) : undefined}><DateInput value={value} onChange={onChange} /></Field>
}

/** Selling units of a finished stock row: its active packaging units (largest first) plus the base unit. */
export function unitsFor(p: Product | undefined, packaging: PackagingUnit[], t: T) {
  if (!p) return []
  const packs = packaging
    .filter((u) => u.item_id === p.item_id && u.active)
    .sort((a, b) => b.base_per_unit - a.base_per_unit)
    .map((u) => ({ code: u.unit_code as string, label: unitLabel(t, u), factor: u.base_per_unit, price: u.price, isDefault: u.is_default }))
  return [...packs, { code: BASE, label: p.unit, factor: 1, price: p.price || null, isDefault: false }]
}
const defaultUnit = (units: ReturnType<typeof unitsFor>) => units.find((u) => u.isDefault) ?? units[0]
/** A unit's own configured price; empty when not set — never derived from another unit's price. */
const priceText = (price: number | null | undefined) => (price ? String(price) : '')

// ─── Sale / Purchase ─────────────────────────────────────────────
type Line = { key: number; productId: string; unitCode: string; quantity: string; price: string }

export type GoTo = (page: 'settings' | 'customers' | 'suppliers') => void

/** `existing` = edit that sale / purchase (its payments are edited separately, so "paid" is hidden). */
export function TradeForm({ kind, t, data, onClose, onSaved, goTo, existing }: Base & {
  kind: 'sale' | 'purchase'; data: Data; goTo: GoTo; existing?: SaleDetail | PurchaseDetail
}) {
  const isSale = kind === 'sale'
  // Sales: finished products only (stock in TUBA). Purchases: anything bought — raw cone in kg, or finished bought directly.
  // When editing, a product used on the record stays selectable even if it was deactivated since.
  const used = new Set(existing?.items.map((i) => i.productId) ?? [])
  const products = data.products.filter((p) => (p.item_active || used.has(p.id)) && (isSale ? p.type === 'finished' && p.can_sell : p.can_buy || used.has(p.id)))
  const people: (Customer | Supplier)[] = isSale ? data.customers : data.suppliers
  const units = (id: string) => (isSale ? unitsFor(products.find((p) => p.id === id), data.packaging, t) : [])

  const newLine = (productId = products[0]?.id ?? ''): Line => {
    const p = products.find((x) => x.id === productId)
    if (!isSale) return { key: Date.now() + Math.random(), productId, unitCode: BASE, quantity: '1', price: priceText(p?.buy_price) }
    const u = defaultUnit(units(productId))
    return { key: Date.now() + Math.random(), productId, unitCode: u?.code ?? BASE, quantity: '1', price: priceText(u?.price) }
  }

  const [day, setDay] = useState(existing?.date ?? localDay())
  const [personId, setPersonId] = useState(existing ? ('customer_id' in existing ? existing.customer_id : existing.supplier_id) : people[0]?.id ?? '')
  const [lines, setLines] = useState<Line[]>(() => existing
    ? existing.items.map((i) => ({
        key: Math.random(), productId: i.productId, unitCode: (i as SaleDetail['items'][number]).unitCode ?? BASE,
        quantity: String(i.quantity), price: String(i.price),
      }))
    : [newLine()])
  const [discount, setDiscount] = useState(existing && 'discount' in existing && existing.discount ? String(existing.discount) : '')
  const [paid, setPaid] = useState('')
  const [note, setNote] = useState(existing?.note ?? '')
  const { errors, busy, run } = useSave(t)

  const title = existing ? (isSale ? t.editSale : t.editPurchase) : isSale ? t.newSale : t.newPurchase
  // Products and people are set up elsewhere; the form only records. Point to what's missing.
  if (!products.length || !people.length) {
    return (
      <Sheet title={title} onClose={onClose} closeLabel={t.close} footer={<Btn variant="secondary" full onClick={onClose}>{t.cancel}</Btn>}>
        {!products.length && (
          <Empty text={isSale ? t.noSellable : t.noBuyable} action={<Btn icon={SettingsIcon} onClick={() => goTo('settings')}>{t.goSettings}</Btn>} />
        )}
        {!people.length && (
          <Empty
            text={isSale ? t.noCustomers : t.noSuppliers}
            action={<Btn icon={Plus} onClick={() => goTo(isSale ? 'customers' : 'suppliers')}>{isSale ? t.addCustomer : t.addSupplier}</Btn>}
          />
        )}
      </Sheet>
    )
  }

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const factorOf = (l: Line) => units(l.productId).find((u) => u.code === l.unitCode)?.factor ?? 1
  const filled = lines.filter((l) => l.productId && num(l.quantity) > 0)
  const items = filled.map((l) => ({ productId: l.productId, unitCode: l.unitCode, quantity: round3(num(l.quantity)), price: Math.max(0, num(l.price)) }))
  const subtotal = round2(items.reduce((s, i) => s + lineTotal(i.quantity, i.price), 0))
  const total = Math.max(0, round2(subtotal - (isSale ? num(discount) : 0)))
  const paidN = num(paid)

  // Stock needed per product in base units. Selling more than is on hand is allowed (a purchase or
  // production may not be recorded yet); the line just shows a warning.
  const needed = new Map<string, number>()
  if (isSale) for (const l of filled) needed.set(l.productId, (needed.get(l.productId) ?? 0) + toBase(num(l.quantity), factorOf(l)))
  // When editing, this sale's own deduction is given back before comparing
  const ownBase = new Map<string, number>()
  if (isSale && existing) for (const i of existing.items as SaleDetail['items']) ownBase.set(i.productId, (ownBase.get(i.productId) ?? 0) + Number(i.baseQuantity ?? 0))
  const availableOf = (id: string) => (products.find((p) => p.id === id)?.stock ?? 0) + (ownBase.get(id) ?? 0)
  const short = [...needed].filter(([id, n]) => n > availableOf(id))

  const save = () => {
    const errs: string[] = []
    if (!personId) errs.push(t.errPerson)
    if (!items.length) errs.push(t.errItems)
    if (isSale && filled.some((l) => l.price.trim() === '')) errs.push(t.errPrice)
    if (!existing && paidN > total + 0.001) errs.push(t.errOverpaid)
    run(errs, async () => {
      const purchaseItems = items.map(({ unitCode: _, ...i }) => i)
      if (isSale) {
        const body = { date: day, customerId: personId, items, discount: num(discount), paid: paidN, note }
        if (existing) await updateSale(existing.id, body)
        else await createSale(body)
      } else {
        const body = { date: day, supplierId: personId, items: purchaseItems, paid: paidN, note }
        if (existing) await updatePurchase(existing.id, body)
        else await createPurchase(body)
      }
      onSaved(isSale ? t.saleSaved : t.purchaseSaved)
    })
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <DateField label={isSale ? t.saleDate : t.purchaseDate} value={day} onChange={setDay} />
      <Field label={isSale ? t.customer : t.supplier}>
        <Select value={personId} onChange={setPersonId} options={people.map((p) => [p.id, p.name])} />
      </Field>

      <div className={panel}>
        <div className="mb-3 flex items-center justify-between">
          <b>{isSale ? t.saleItems : t.purchaseItems}</b>
          <Btn variant="secondary" size="sm" icon={Plus} onClick={() => setLines([...lines, newLine()])}>{t.addItem}</Btn>
        </div>
        <div className="flex flex-col gap-4">
          {lines.map((l, index) => {
            const p = products.find((x) => x.id === l.productId)
            const lineUnits = units(l.productId)
            const unit = isSale ? lineUnits.find((u) => u.code === l.unitCode) : undefined
            const unitText = isSale ? unit?.label ?? '' : p?.unit ?? ''
            const base = isSale && num(l.quantity) > 0 ? toBase(num(l.quantity), unit?.factor ?? 1) : 0
            const isShort = short.some(([id]) => id === l.productId)
            return (
              <div key={l.key} className="flex flex-col gap-1 [&_input]:mt-0 [&_select]:mt-0">
                <div className={`grid gap-2 ${isSale ? 'sm:grid-cols-[1fr_150px_auto]' : 'sm:grid-cols-[1fr_auto]'}`}>
                  <Select
                    ariaLabel={`${t.product} ${index + 1}`}
                    value={l.productId}
                    onChange={(id) => update(l.key, { ...newLine(id), key: l.key })}
                    options={products.map((x) => [x.id, `${x.name_am}${x.type === 'raw' ? ` · ${t.rawForm}` : ''}`])}
                  />
                  {isSale && (
                    <Select
                      ariaLabel={t.sellUnit}
                      value={l.unitCode}
                      // switching unit loads THAT unit's own price (blank if none) — prices are never scaled between units
                      onChange={(code) => update(l.key, { unitCode: code, price: priceText(lineUnits.find((u) => u.code === code)?.price) })}
                      options={lineUnits.map((u) => [u.code, u.label])}
                    />
                  )}
                  <Btn variant="ghost" ariaLabel={t.remove} icon={X} onClick={() => lines.length > 1 && setLines(lines.filter((x) => x.key !== l.key))}>{''}</Btn>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stepper label={t.quantity} min={0} decimal unit={unitText} value={l.quantity} onChange={(q) => update(l.key, { quantity: q })} />
                  <Stepper label={t.unitPrice} min={0} decimal unit={unitText ? `ብር/${unitText}` : 'ብር'} value={l.price} onChange={(v) => update(l.key, { price: v })} />
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 text-xs text-[#77867d]">
                  <span className={isShort ? 'font-semibold text-[#a54542]' : ''}>
                    {isSale && unit && unit.code !== BASE && <>{t.deducts}: <b>{qty(base)} {p?.unit}</b> · </>}
                    {t.available}: {qty(isSale ? availableOf(l.productId) : p?.stock ?? 0)} {p?.unit}
                    {isShort && <> · {t.goesNegative}</>}
                  </span>
                  <span>{money(lineTotal(round3(num(l.quantity)), num(l.price)))}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-right text-sm text-[#617168]">{t.total}: <b className="text-[#17221e]">{money(subtotal)}</b></div>
      </div>

      {isSale && <Field label={t.discount}><MoneyInput value={discount} onChange={setDiscount} /></Field>}
      {existing ? (
        // Payments already recorded stay as they are; add or change them from the payments list / detail
        <div className="rounded-xl bg-[#f6f9f6] p-4 text-sm">
          {t.total}: <b>{money(total)}</b> · {t.paid}: <b>{money(existing.paid)}</b> · {t.remaining}: <b>{money(Math.max(0, total - existing.paid))}</b>
          <p className="mt-1 text-xs text-[#77867d]">{t.paymentsSeparate}</p>
        </div>
      ) : (
        <>
          <Field label={t.amountPaid}><MoneyInput value={paid} onChange={setPaid} /></Field>
          <button type="button" onClick={() => setPaid(String(total))} className="-mt-2 w-fit text-xs font-semibold text-[#21633b]">{t.paidInFull}</button>
          <div className="rounded-xl bg-[#f6f9f6] p-4 text-sm">{t.total}: <b>{money(total)}</b> · {t.remaining}: <b>{money(Math.max(0, total - paidN))}</b></div>
        </>
      )}
      <Field label={t.note}><TextInput value={note} onChange={setNote} /></Field>
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}

// ─── Payment ─────────────────────────────────────────────────────
/** `payment` = edit it; `preset` = open for a given person (from their detail page). */
export function PaymentForm({ t, data, onClose, onSaved, payment, preset }: Base & {
  data: Data; payment?: Omit<Payment, 'allocations'>; preset?: { kind: 'customer' | 'supplier'; personId: string }
}) {
  const pickDefault = (list: (Customer | Supplier)[]) => (list.find((p) => Number(p.balance_due ?? 0) > 0) ?? list[0])?.id ?? ''
  const [kind, setKind] = useState<'customer' | 'supplier'>(payment?.kind ?? preset?.kind ?? 'customer')
  const [personId, setPersonId] = useState(payment?.person_id ?? preset?.personId ?? pickDefault(data.customers))
  const [day, setDay] = useState(payment?.date ?? localDay())
  const [amount, setAmount] = useState(payment ? String(payment.amount) : '')
  const [note, setNote] = useState(payment?.note ?? '')
  const { errors, busy, run } = useSave(t)

  const people: (Customer | Supplier)[] = kind === 'customer' ? data.customers : data.suppliers
  const balance = Number(people.find((p) => p.id === personId)?.balance_due ?? 0)
  const switchKind = (k: 'customer' | 'supplier') => { setKind(k); setPersonId(pickDefault(k === 'customer' ? data.customers : data.suppliers)) }

  const save = () => {
    const errs: string[] = []
    if (!personId) errs.push(t.errPerson)
    if (!(num(amount) > 0)) errs.push(t.errAmount)
    run(errs, async () => {
      const body = { date: day, kind, personId, amount: num(amount), note }
      if (payment) await updatePayment(payment.id, body) // re-applied to the oldest unpaid bills
      else await createPayment(body)
      onSaved(t.paymentSaved)
    })
  }

  // When editing, the person's balance already includes this payment — show what it would be without it
  const shownBalance = payment && payment.kind === kind && payment.person_id === personId ? balance + payment.amount : balance

  return (
    <Sheet title={payment ? t.editPayment : t.newPayment} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <DateField label={t.paymentDate} value={day} onChange={setDay} />
      <Field label={t.paymentKind}>
        <Select value={kind} onChange={(k) => switchKind(k as 'customer' | 'supplier')} options={[['customer', t.received], ['supplier', t.paidOut]]} />
      </Field>
      {people.length ? (
        <Field label={kind === 'customer' ? t.customer : t.supplier} hint={`${t.balance}: ${money(shownBalance)}`}>
          <Select value={personId} onChange={setPersonId} options={people.map((p) => [p.id, p.name])} />
        </Field>
      ) : (
        <p className="text-sm text-[#77867d]">{kind === 'customer' ? t.noCustomers : t.noSuppliers}</p>
      )}
      <Field label={t.amount} hint={t.paymentNote}><MoneyInput value={amount} onChange={setAmount} /></Field>
      {shownBalance > 0 && <button type="button" onClick={() => setAmount(String(shownBalance))} className="-mt-2 w-fit text-xs font-semibold text-[#21633b]">{t.payFullBalance}: {money(shownBalance)}</button>}
      <Field label={t.note}><TextInput value={note} onChange={setNote} /></Field>
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}

// ─── Expense ─────────────────────────────────────────────────────
export function ExpenseForm({ t, onClose, onSaved, expense }: Base & { expense?: Expense }) {
  const [day, setDay] = useState(expense?.date ?? localDay())
  const [category, setCategory] = useState<string>(expense?.category ?? 'other')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const { errors, busy, run } = useSave(t)

  const save = () => {
    const errs: string[] = []
    if (!description.trim()) errs.push(t.errDescription)
    if (!(num(amount) > 0)) errs.push(t.errAmount)
    run(errs, async () => {
      const body = { date: day, category, description: description.trim(), amount: num(amount), note }
      if (expense) await updateExpense(expense.id, body)
      else await createExpense(body)
      onSaved(t.expenseSaved)
    })
  }

  return (
    <Sheet title={expense ? t.editExpense : t.newExpense} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField label={t.date} value={day} onChange={setDay} />
        <Field label={t.category}><Select value={category} onChange={setCategory} options={expenseCategories.map((c) => [c, categoryLabel(t, c)])} /></Field>
        <Field label={t.description}><TextInput value={description} onChange={setDescription} /></Field>
        <Field label={t.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
      </div>
      <Field label={t.note}><TextInput value={note} onChange={setNote} /></Field>
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}

// ─── Product: identity + raw cone / finished forms ──────────────
export function ItemForm({ t, item, data, onClose, onSaved }: Base & { item?: Item; data: Data }) {
  const rawRow = item && data.products.find((p) => p.item_id === item.id && p.type === 'raw')
  const finRow = item && data.products.find((p) => p.item_id === item.id && p.type === 'finished')
  const [nameAm, setNameAm] = useState(item?.name_am ?? '')
  const [nameEn, setNameEn] = useState(item?.name_en ?? '')
  const [active, setActive] = useState(item?.active ?? true)
  const [hasRaw, setHasRaw] = useState(!!rawRow || !item)
  const [hasFin, setHasFin] = useState(!!finRow || !item)
  const [rawPrice, setRawPrice] = useState(rawRow ? String(rawRow.buy_price) : '')
  const [rawStock, setRawStock] = useState(String(rawRow?.stock ?? 0))
  const [rawReorder, setRawReorder] = useState(String(rawRow?.reorder ?? 0))
  const finUnit = finRow?.unit ?? TUBA // finished stock is counted in ቱባ (packaging units are defined in it)
  const [finPrice, setFinPrice] = useState(finRow?.price ? String(finRow.price) : '')
  const [finStock, setFinStock] = useState(String(finRow?.stock ?? 0))
  const [finReorder, setFinReorder] = useState(String(finRow?.reorder ?? 0))
  const [finBuy, setFinBuy] = useState(finRow?.can_buy ?? false)
  const { errors, busy, run } = useSave(t)

  const save = () => {
    const errs: string[] = []
    if (!nameAm.trim()) errs.push(t.errName)
    if (!hasRaw && !hasFin) errs.push(t.errNoForm)
    run(errs, async () => {
      // stock is sent only when it changed, so an untouched balance is never overwritten by a stale value
      const raw = hasRaw ? {
        buy_price: num(rawPrice), reorder: round3(num(rawReorder)),
        ...(!rawRow || num(rawStock) !== rawRow.stock ? { stock: round3(num(rawStock)) } : {}),
      } : undefined
      const finished = hasFin ? {
        unit: finUnit, price: num(finPrice), reorder: round3(num(finReorder)), can_buy: finBuy,
        ...(!finRow || num(finStock) !== finRow.stock ? { stock: round3(num(finStock)) } : {}),
      } : undefined
      // the product code is not edited here (used only by the product seeder), so it's never sent
      const body = { name_am: nameAm.trim(), name_en: nameEn.trim(), raw, finished }
      if (item) await updateItem(item.id, { ...body, active })
      else await createItem(body)
      onSaved(t.productSaved)
    })
  }

  return (
    <Sheet title={item ? t.editItem : t.addProductItem} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.productName}><TextInput value={nameAm} onChange={setNameAm} placeholder="ለምሳሌ፦ መነን" /></Field>
        <Field label={t.productNameEn}><TextInput value={nameEn} onChange={setNameEn} placeholder="Menen" /></Field>
        {item && <Group label={t.status}><ChoiceCard selected={active} onClick={() => setActive(!active)} title={active ? t.active : t.inactive} /></Group>}
      </div>

      {/* An existing form can't be switched off: its stock and history belong to it */}
      <ChoiceCard selected={hasRaw} onClick={() => !rawRow && setHasRaw(!hasRaw)} title={t.rawForm} hint={t.rawFormHint} icon={Factory} />
      {hasRaw && (
        <div className={`grid gap-3 sm:grid-cols-3 ${panel}`}>
          <Field label={fmt(t.pricePerBase, { u: KG })}><MoneyInput value={rawPrice} onChange={setRawPrice} /></Field>
          <Field label={t.stockNow}><Stepper label={`${t.rawForm} ${t.stockNow}`} decimal unit={KG} value={rawStock} onChange={setRawStock} /></Field>
          <Field label={t.reorder}><Stepper label={`${t.rawForm} ${t.reorder}`} decimal unit={KG} value={rawReorder} onChange={setRawReorder} /></Field>
        </div>
      )}

      <ChoiceCard selected={hasFin} onClick={() => !finRow && setHasFin(!hasFin)} title={t.finishedForm} hint={t.finishedFormHint} icon={Package} />
      {hasFin && (
        <div className={`flex flex-col gap-3 ${panel}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={fmt(t.pricePerBase, { u: finUnit || TUBA })}><MoneyInput value={finPrice} onChange={setFinPrice} /></Field>
            <Field label={t.stockNow}><Stepper label={`${t.finishedForm} ${t.stockNow}`} decimal unit={finUnit} value={finStock} onChange={setFinStock} /></Field>
            <Field label={t.reorder}><Stepper label={`${t.finishedForm} ${t.reorder}`} decimal unit={finUnit} value={finReorder} onChange={setFinReorder} /></Field>
          </div>
          <ChoiceCard selected={finBuy} onClick={() => setFinBuy(!finBuy)} title={t.alsoBuyFinished} />
        </div>
      )}
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}

// ─── Packaging unit (add / edit) ─────────────────────────────────
export function PackagingForm({ t, unit, data, itemId, onClose, onSaved }: Base & { unit?: PackagingUnit; data: Data; itemId?: string }) {
  const finishedItems = data.items.filter((i) => data.products.some((p) => p.item_id === i.id && p.type === 'finished'))
  const [item, setItem] = useState(unit?.item_id ?? itemId ?? finishedItems[0]?.id ?? '')
  const taken = (code: string) => data.packaging.some((u) => u.item_id === item && u.unit_code === code && u.active && u.id !== unit?.id)
  const [code, setCode] = useState<UnitCode>(unit?.unit_code ?? UNIT_CODES.find((c) => !taken(c)) ?? 'MADABERIYA_TIDOSH')
  const [labelAm, setLabelAm] = useState(unit?.label_am ?? dictLabel(code, 'am'))
  const [labelEn, setLabelEn] = useState(unit?.label_en ?? dictLabel(code, 'en'))
  const [factor, setFactor] = useState(unit ? String(unit.base_per_unit) : '')
  const [price, setPrice] = useState(unit?.price != null ? String(unit.price) : '')
  const [isDefault, setIsDefault] = useState(unit?.is_default ?? false)
  const [active, setActive] = useState(unit?.active ?? true)
  const { errors, busy, run } = useSave(t)

  if (!finishedItems.length) {
    return (
      <Sheet title={t.addPackaging} onClose={onClose} closeLabel={t.close} footer={<Btn variant="secondary" full onClick={onClose}>{t.cancel}</Btn>}>
        <Empty text={t.noFinishedItems} />
      </Sheet>
    )
  }

  const baseUnit = data.products.find((p) => p.item_id === item && p.type === 'finished')?.unit ?? TUBA
  const pickCode = (c: UnitCode) => {
    setCode(c)
    if (!unit) { setLabelAm(dictLabel(c, 'am')); setLabelEn(dictLabel(c, 'en')) }
  }

  const save = () => {
    const f = Number(factor)
    const errs: string[] = []
    if (!item) errs.push(t.noFinishedItems)
    if (!isValidFactor(f)) errs.push(t.errFactor)
    if (!labelAm.trim()) errs.push(t.errName)
    if (!unit && taken(code)) errs.push(t.err_DUPLICATE_UNIT)
    run(errs, async () => {
      const common = {
        base_per_unit: f, label_am: labelAm.trim(), label_en: labelEn.trim() || labelAm.trim(),
        price: price.trim() === '' ? null : num(price), is_default: isDefault,
      }
      if (unit) await updatePackaging(unit.id, { ...common, active })
      else await createPackaging({ item_id: item, unit_code: code, ...common })
      onSaved(t.saved)
    })
  }

  const label = labelAm || (t as any)[`unit_${code}`]
  return (
    <Sheet title={unit ? t.editPackaging : t.addPackaging} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.product}>
          {unit
            ? <TextInput value={unit.item_name_am} onChange={() => {}} />
            : <Select value={item} onChange={setItem} options={finishedItems.map((i) => [i.id, i.name_am])} />}
        </Field>
        <Field label={t.unitType}>
          {unit
            ? <TextInput value={(t as any)[`unit_${unit.unit_code}`]} onChange={() => {}} />
            : <Select value={code} onChange={(c) => pickCode(c as UnitCode)} options={UNIT_CODES.map((c) => [c, `${(t as any)[`unit_${c}`]}${taken(c) ? ' ✓' : ''}`])} />}
        </Field>
        <Field label={t.labelAm}><TextInput value={labelAm} onChange={setLabelAm} /></Field>
        <Field label={t.labelEn}><TextInput value={labelEn} onChange={setLabelEn} /></Field>
        <Field label={fmt(t.basePerUnit, { u: label, b: baseUnit })}>
          <Stepper label={t.basePerUnit} min={0} decimal unit={baseUnit} value={factor} onChange={setFactor} />
        </Field>
        <Field label={fmt(t.pricePerUnit, { u: label })} hint={t.priceNotSet}><MoneyInput value={price} onChange={setPrice} /></Field>
      </div>
      <ChoiceCard selected={isDefault} onClick={() => setIsDefault(!isDefault)} title={t.defaultUnit} />
      {unit && <ChoiceCard selected={active} onClick={() => setActive(!active)} title={active ? t.active : t.inactive} />}
      <p className="text-xs text-[#77867d]">{t.packagingHint}</p>
      <Errors t={t} errors={errors} />
      {/* Safe for history: past sales and production keep the factor they used */}
      {unit && <DeleteButton t={t} onConfirm={async () => { await deletePackaging(unit.id); onSaved(t.deleted) }} />}
    </Sheet>
  )
}
const DICT_LABELS: Record<UnitCode, { am: string; en: string }> = {
  MADABERIYA_TIDOSH: { am: 'ማዳበሪያ / ትዶሽ', en: 'Madaberiya / Tidosh' },
  PACKET: { am: 'ፓኬት', en: 'Packet' },
  PIECE: { am: 'ፍሬ', en: 'Piece' },
}
const dictLabel = (c: UnitCode, l: 'am' | 'en') => DICT_LABELS[c][l]

// ─── Customer / Supplier (add / edit) ────────────────────────────
export function PersonForm({ t, kind, person, onClose, onSaved }: Base & { kind: 'customer' | 'supplier'; person?: Customer | Supplier }) {
  const [name, setName] = useState(person?.name ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [address, setAddress] = useState(person?.address ?? '')
  const [note, setNote] = useState((person as Customer | undefined)?.note ?? '')
  const { errors, busy, run } = useSave(t)

  const save = () => run(name.trim() ? [] : [t.errName], async () => {
    const base = { name: name.trim(), phone: phone.trim(), address: address.trim() }
    if (kind === 'customer') {
      if (person) await updateCustomer(person.id, { ...base, note })
      else await createCustomer({ ...base, note })
    } else {
      if (person) await updateSupplier(person.id, base)
      else await createSupplier(base)
    }
    onSaved(t.personSaved)
  })

  const title = kind === 'customer' ? (person ? t.editCustomer : t.addCustomer) : (person ? t.editSupplier : t.addSupplier)
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.name}><TextInput value={name} onChange={setName} placeholder={kind === 'customer' ? 'ለምሳሌ፦ ሚካኤል ልብስ ቤት' : 'ለምሳሌ፦ አዲስ ክር አቅራቢ'} /></Field>
        <Field label={t.phone}><TextInput type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="+251 911 234 567" /></Field>
        <Field label={t.address}><TextInput value={address} onChange={setAddress} /></Field>
        {kind === 'customer' && <Field label={t.note}><TextInput value={note} onChange={setNote} /></Field>}
      </div>
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}

// ─── Production: raw cone kg → finished product TUBA ─────────────
type Output = { key: number; productId: string; unitCode: string; quantity: string }

/** `production` = edit that batch (it is undone and recorded again with the new values). */
export function ProductionForm({ t, data, onClose, onSaved, goProducts, production }: Base & { data: Data; goProducts: () => void; production?: Production }) {
  const usedIds = new Set([production?.raw_product_id, ...(production?.outputs.map((o) => o.productId) ?? [])])
  const raws = data.products.filter((p) => p.type === 'raw' && (p.item_active || usedIds.has(p.id)))
  const fins = data.products.filter((p) => p.type === 'finished' && (p.item_active || usedIds.has(p.id)))
  const units = (id: string) => unitsFor(fins.find((p) => p.id === id), data.packaging, t)
  // Default the output to the same product as the raw cone (same name, other form) when there is one
  const finFor = (rawId: string) => fins.find((f) => f.item_id === raws.find((r) => r.id === rawId)?.item_id) ?? fins[0]
  const newOutput = (productId: string): Output => ({ key: Date.now() + Math.random(), productId, unitCode: defaultUnit(units(productId))?.code ?? BASE, quantity: '' })

  const [day, setDay] = useState(production?.date ?? localDay())
  const [rawId, setRawId] = useState(production?.raw_product_id ?? raws[0]?.id ?? '')
  const [rawKg, setRawKg] = useState(production ? String(production.raw_quantity) : '')
  const [wasteKg, setWasteKg] = useState(production?.waste_grams ? String(Number(production.waste_grams) / 1000) : '')
  const [note, setNote] = useState(production?.note ?? '')
  const [outs, setOuts] = useState<Output[]>(() => production
    ? production.outputs.map((o) => ({ key: Math.random(), productId: o.productId, unitCode: o.unitCode, quantity: String(o.unitQuantity ?? o.quantity) }))
    : raws.length && fins.length ? [newOutput(finFor(raws[0].id)!.id)] : [])
  const { errors, busy, run } = useSave(t)

  if (!raws.length || !fins.length) {
    return (
      <Sheet title={t.newProduction} onClose={onClose} closeLabel={t.close} footer={<Btn variant="secondary" full onClick={onClose}>{t.cancel}</Btn>}>
        <Empty text={!raws.length ? t.noRaw : t.noFinished} action={<Btn icon={SettingsIcon} onClick={goProducts}>{t.goSettings}</Btn>} />
      </Sheet>
    )
  }

  const raw = raws.find((p) => p.id === rawId)
  const usedKg = round3(num(rawKg))
  const update = (key: number, patch: Partial<Output>) => setOuts((os) => os.map((o) => (o.key === key ? { ...o, ...patch } : o)))
  const outputs = outs.filter((o) => o.productId && num(o.quantity) > 0)
    .map((o) => ({ productId: o.productId, unitCode: o.unitCode, quantity: round3(num(o.quantity)) }))

  // When editing, the batch's own kg are given back before the check
  const rawAvailable = (raw?.stock ?? 0) + (production && production.raw_product_id === rawId ? Number(production.raw_quantity) : 0)

  const save = () => {
    const errs: string[] = []
    if (!rawId) errs.push(t.errRaw)
    if (!(usedKg > 0)) errs.push(t.errRawKg)
    if (raw && usedKg > rawAvailable) errs.push(t.errNotEnough)
    if (!outputs.length) errs.push(t.errOutputs)
    run(errs, async () => {
      const body = { date: day, rawProductId: rawId, rawKg: usedKg, outputs, wasteKg: round3(num(wasteKg)), note }
      if (production) await updateProduction(production.id, body)
      else await createProduction(body)
      onSaved(t.productionSaved)
    })
  }

  return (
    <Sheet title={production ? t.editProduction : t.newProduction} onClose={onClose} closeLabel={t.close} footer={<SheetFooter t={t} onCancel={onClose} onSave={save} busy={busy} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField label={t.date} value={day} onChange={setDay} />
        <Field label={t.rawCone}>
          <Select value={rawId} onChange={(id) => { setRawId(id); setOuts([newOutput(finFor(id)!.id)]) }} options={raws.map((p) => [p.id, p.name_am])} />
        </Field>
        <Field label={t.rawKgUsed} hint={raw ? `${t.available}: ${qty(rawAvailable)} ${KG}` : undefined}>
          <Stepper label={t.rawKgUsed} decimal unit={KG} value={rawKg} onChange={setRawKg} />
        </Field>
        <Field label={t.wasteKg}><Stepper label={t.wasteKg} decimal unit={KG} value={wasteKg} onChange={setWasteKg} /></Field>
      </div>
      <div className={panel}>
        <div className="mb-3 flex items-center justify-between">
          <b>{t.outputs}</b>
          <Btn variant="secondary" size="sm" icon={Plus} onClick={() => setOuts([...outs, newOutput(fins[0].id)])}>{t.addOutput}</Btn>
        </div>
        <div className="flex flex-col gap-3">
          {outs.map((o) => {
            const p = fins.find((x) => x.id === o.productId)
            const u = units(o.productId)
            const unit = u.find((x) => x.code === o.unitCode)
            return (
              <div key={o.key} className="flex flex-col gap-1 [&_input]:mt-0 [&_select]:mt-0">
                <div className="grid gap-2 sm:grid-cols-[1fr_150px_120px_auto]">
                  <Select ariaLabel={t.product} value={o.productId} onChange={(id) => update(o.key, { ...newOutput(id), key: o.key })} options={fins.map((x) => [x.id, x.name_am])} />
                  <Select ariaLabel={t.sellUnit} value={o.unitCode} onChange={(c) => update(o.key, { unitCode: c })} options={u.map((x) => [x.code, x.label])} />
                  <Stepper label={`${t.producedAs} ${p?.name_am ?? ''}`} decimal unit={unit?.label} value={o.quantity} onChange={(q) => update(o.key, { quantity: q })} />
                  <Btn variant="ghost" ariaLabel={t.remove} icon={X} onClick={() => outs.length > 1 && setOuts(outs.filter((x) => x.key !== o.key))}>{''}</Btn>
                </div>
                {num(o.quantity) > 0 && unit && unit.code !== BASE && (
                  <span className="text-xs text-[#77867d]">= {qty(toBase(num(o.quantity), unit.factor))} {p?.unit}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <Field label={t.note}><TextInput value={note} onChange={setNote} /></Field>
      <Errors t={t} errors={errors} />
    </Sheet>
  )
}
