'use client'
/**
 * Detail views. Each loads fresh data from the API (and reloads when `version` changes after a save),
 * links to related records (they open on top; closing returns here), and offers edit / delete.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { CreditCard, Pencil } from 'lucide-react'
import {
  getCustomerDetail, getSupplierDetail, getSaleDetail, getPurchaseDetail, getPaymentDetail, getProductionDetail, getItemDetail,
  deleteSale, deletePurchase, deletePayment, deleteExpense, deleteProduction, deleteItem, deleteCustomer, deleteSupplier,
  type CustomerDetail, type Movement, type SupplierDetail,
} from '@/lib/api'
import { dateBoth, ethiopianMonth, money, previousEthiopianMonth, qty, type EthiopianMonth } from '@/lib/format'
import { equivalents } from '@/lib/packaging'
import { Btn, CallLink, Card, DeleteButton, Empty, InfoRow, LinkRow, Sheet, StatusPill } from './ui'
import { categoryLabel, errorText, fmt, unitLabel, type T } from './i18n'
import { salesIn, type AppData, type Modal } from './pages'
import { anyDate, inRange, type DateRange } from './filters'

type Props = {
  t: T; data: AppData; open: (m: Modal) => void; onClose: () => void; onSaved: (msg: string) => void; version: number
  go?: (page: string) => void // switch page (closes all sheets)
}

const statusFor = (total: number, paid: number): 'paid' | 'partial' | 'unpaid' => (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid')

/** Loads a record; reloads when the id or `version` (bumped after every save) changes. */
function useRecord<R>(load: () => Promise<R>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: R; error?: string }>({})
  useEffect(() => {
    let live = true
    load().then((data) => live && setState({ data }), (e) => live && setState({ error: e?.message ?? 'Error' }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Shared frame: loading / error states, a Close footer and an actions row. */
function DetailSheet({ t, title, onClose, state, actions, children }: {
  t: T; title: string; onClose: () => void; state: { data?: unknown; error?: string }; actions?: ReactNode; children?: ReactNode
}) {
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close} footer={<Btn variant="secondary" full onClick={onClose}>{t.close}</Btn>}>
      {state.error ? <p className="text-sm text-[#a54542]">{errorText(t, state.error)}</p>
        : !state.data ? <p className="text-sm text-[#77867d]">{t.loading}</p>
        : <>{children}{actions && <div className="flex flex-wrap items-start gap-2 border-t pt-4">{actions}</div>}</>}
    </Sheet>
  )
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div><h3 className="mb-1 text-sm font-bold">{title}</h3><Card className="px-4">{children}</Card></div>
)

const reasonLabel = (t: T, m: Movement) => (t as any)[`reason_${m.reason}`] ?? m.reason

// ─── Sale ────────────────────────────────────────────────────────
export function SaleDetailView({ t, data, open, onClose, onSaved, version, id }: Props & { id: string }) {
  const state = useRecord(() => getSaleDetail(id), [id, version])
  const s = state.data
  return (
    <DetailSheet t={t} title={t.saleDetail} onClose={onClose} state={state} actions={s && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'sale', existing: s })}>{t.edit}</Btn>
      <Btn variant="secondary" icon={CreditCard} onClick={() => open({ kind: 'payment', preset: { kind: 'customer', personId: s.customer_id } })}>{t.newPayment}</Btn>
      <DeleteButton t={t} warning={s.payments.length ? t.deleteSaleWarning : undefined} onConfirm={async () => { await deleteSale(id); onSaved(t.deleted) }} />
    </>}>
      {s && <>
        <div>
          <LinkRow onClick={() => open({ kind: 'customerDetail', id: s.customer_id })}><span><small className="block text-[#77867d]">{t.customer}</small><b>{s.customer_name}</b></span></LinkRow>
          <InfoRow label={t.date}>{dateBoth(s.date)}</InfoRow>
          <InfoRow label={t.status}><StatusPill status={statusFor(s.total, s.paid)} t={t} /></InfoRow>
          {s.note && <InfoRow label={t.note}>{s.note}</InfoRow>}
        </div>
        <Section title={t.saleItems}>
          {s.items.map((i, n) => (
            <div key={n} className="flex justify-between gap-3 border-t py-3 text-sm first:border-0">
              <span>
                <b>{i.productName}</b>
                <small className="block text-[#77867d]">
                  {qty(i.quantity)} {i.unitLabel} × {money(i.price)}
                  {i.unitCode !== 'BASE' && ` · ${t.deducts}: ${qty(Number(i.baseQuantity))} ${i.baseUnit}`}
                </small>
              </span>
              <b>{money(i.quantity * i.price)}</b>
            </div>
          ))}
        </Section>
        <div>
          {s.discount > 0 && <InfoRow label={t.discount}>− {money(s.discount)}</InfoRow>}
          <InfoRow label={t.total}>{money(s.total)}</InfoRow>
          <InfoRow label={t.paid}>{money(s.paid)}</InfoRow>
          <InfoRow label={t.remaining}><span className={s.total - s.paid > 0 ? 'text-[#a54542]' : ''}>{money(Math.max(0, s.total - s.paid))}</span></InfoRow>
        </div>
        <Section title={t.paymentsApplied}>
          {s.payments.length ? s.payments.map((p) => (
            <LinkRow key={p.id} onClick={() => open({ kind: 'paymentDetail', id: p.id })}>
              <span>{dateBoth(p.date)}{p.note && <small className="block text-[#77867d]">{p.note}</small>}</span><b>{money(p.amount)}</b>
            </LinkRow>
          )) : <Empty text={t.noPayments} />}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Purchase ────────────────────────────────────────────────────
export function PurchaseDetailView({ t, open, onClose, onSaved, version, id }: Props & { id: string }) {
  const state = useRecord(() => getPurchaseDetail(id), [id, version])
  const p = state.data
  return (
    <DetailSheet t={t} title={t.purchaseDetail} onClose={onClose} state={state} actions={p && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'purchase', existing: p })}>{t.edit}</Btn>
      <Btn variant="secondary" icon={CreditCard} onClick={() => open({ kind: 'payment', preset: { kind: 'supplier', personId: p.supplier_id } })}>{t.newPayment}</Btn>
      <DeleteButton t={t} warning={p.payments.length ? t.deletePurchaseWarning : undefined} onConfirm={async () => { await deletePurchase(id); onSaved(t.deleted) }} />
    </>}>
      {p && <>
        <div>
          <LinkRow onClick={() => open({ kind: 'supplierDetail', id: p.supplier_id })}><span><small className="block text-[#77867d]">{t.supplier}</small><b>{p.supplier_name}</b></span></LinkRow>
          <InfoRow label={t.date}>{dateBoth(p.date)}</InfoRow>
          <InfoRow label={t.status}><StatusPill status={statusFor(p.total, p.paid)} t={t} /></InfoRow>
          {p.note && <InfoRow label={t.note}>{p.note}</InfoRow>}
        </div>
        <Section title={t.purchaseItems}>
          {p.items.map((i, n) => (
            <div key={n} className="flex justify-between gap-3 border-t py-3 text-sm first:border-0">
              <span>
                <b>{i.productName}</b> <small className="text-[#77867d]">{i.form === 'RAW_CONE' ? t.rawForm : t.finishedForm}</small>
                <small className="block text-[#77867d]">{qty(i.quantity)} {i.unit} × {money(i.price)}/{i.unit}</small>
              </span>
              <b>{money(i.quantity * i.price)}</b>
            </div>
          ))}
        </Section>
        <div>
          <InfoRow label={t.total}>{money(p.total)}</InfoRow>
          <InfoRow label={t.paid}>{money(p.paid)}</InfoRow>
          <InfoRow label={t.remaining}><span className={p.total - p.paid > 0 ? 'text-[#a54542]' : ''}>{money(Math.max(0, p.total - p.paid))}</span></InfoRow>
        </div>
        <Section title={t.paymentsApplied}>
          {p.payments.length ? p.payments.map((x) => (
            <LinkRow key={x.id} onClick={() => open({ kind: 'paymentDetail', id: x.id })}>
              <span>{dateBoth(x.date)}{x.note && <small className="block text-[#77867d]">{x.note}</small>}</span><b>{money(x.amount)}</b>
            </LinkRow>
          )) : <Empty text={t.noPayments} />}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Payment ─────────────────────────────────────────────────────
export function PaymentDetailView({ t, open, onClose, onSaved, version, id }: Props & { id: string }) {
  const state = useRecord(() => getPaymentDetail(id), [id, version])
  const p = state.data
  const applied = p ? p.allocations.reduce((s, a) => s + Number(a.amount), 0) : 0
  return (
    <DetailSheet t={t} title={t.paymentDetail} onClose={onClose} state={state} actions={p && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'payment', payment: p })}>{t.edit}</Btn>
      <DeleteButton t={t} onConfirm={async () => { await deletePayment(id); onSaved(t.deleted) }} />
    </>}>
      {p && <>
        <div>
          <LinkRow onClick={() => open({ kind: p.kind === 'customer' ? 'customerDetail' : 'supplierDetail', id: p.person_id })}>
            <span><small className="block text-[#77867d]">{p.kind === 'customer' ? t.received : t.paidOut}</small><b>{p.person_name ?? p.person_id}</b></span>
          </LinkRow>
          <InfoRow label={t.date}>{dateBoth(p.date)}</InfoRow>
          <InfoRow label={t.amount}><span className={p.kind === 'customer' ? 'text-[#287342]' : 'text-[#a54542]'}>{money(p.amount)}</span></InfoRow>
          {p.note && <InfoRow label={t.note}>{p.note}</InfoRow>}
        </div>
        <Section title={t.appliedTo}>
          {p.allocations.map((a) => (
            <LinkRow key={a.transactionId} onClick={() => open({ kind: p.kind === 'customer' ? 'saleDetail' : 'purchaseDetail', id: a.transactionId })}>
              <span>{a.date ? dateBoth(a.date) : a.transactionId}<small className="block text-[#77867d]">{p.kind === 'customer' ? t.sales : t.purchases}</small></span>
              <b>{money(a.amount)}</b>
            </LinkRow>
          ))}
          {p.amount - applied > 0.004 && (
            <div className="flex justify-between border-t py-3 text-sm first:border-0">
              <span>{t.unallocated}<small className="block text-[#77867d]">{t.unallocatedHint}</small></span><b>{money(p.amount - applied)}</b>
            </div>
          )}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Customer / supplier ─────────────────────────────────────────
export function PersonDetailView({ t, open, onClose, onSaved, version, kind, id }: Props & { kind: 'customer' | 'supplier'; id: string }) {
  const isCustomer = kind === 'customer'
  const state = useRecord<CustomerDetail | SupplierDetail>(() => (isCustomer ? getCustomerDetail(id) : getSupplierDetail(id)), [kind, id, version])
  const p = state.data
  const list: { id: string; date: string; total: number; paid: number; note: string }[] = p ? ('sales' in p ? p.sales : p.purchases) : []
  const totalTxn = list.reduce((s, x) => s + Number(x.total), 0)
  const totalPaid = p ? p.payments.reduce((s, x) => s + Number(x.amount), 0) : 0
  const balance = Number(p?.balance_due ?? 0)
  return (
    <DetailSheet t={t} title={p?.name ?? (isCustomer ? t.customer : t.supplier)} onClose={onClose} state={state} actions={p && <>
      <Btn icon={CreditCard} onClick={() => open({ kind: 'payment', preset: { kind, personId: id } })}>{t.newPayment}</Btn>
      <Btn variant="secondary" icon={Pencil} onClick={() => open({ kind, person: p })}>{t.edit}</Btn>
      <DeleteButton t={t} onConfirm={async () => { await (isCustomer ? deleteCustomer(id) : deleteSupplier(id)); onSaved(t.deleted) }} />
    </>}>
      {p && <>
        <div>
          {p.phone && <InfoRow label={t.phone}><span className="flex items-center gap-3">{p.phone}<CallLink phone={p.phone} t={t} /></span></InfoRow>}
          {p.address && <InfoRow label={t.address}>{p.address}</InfoRow>}
          {'note' in p && (p as { note?: string }).note && <InfoRow label={t.note}>{(p as { note?: string }).note}</InfoRow>}
          <InfoRow label={isCustomer ? t.totalSold : t.totalBought}>{money(totalTxn)}</InfoRow>
          <InfoRow label={t.totalPaid}>{money(totalPaid)}</InfoRow>
          <InfoRow label={balance >= 0 ? t.owes : t.credit}>
            <span className={balance > 0 ? 'text-[#a54542]' : 'text-[#287342]'}>{money(Math.abs(balance))}</span>
          </InfoRow>
        </div>
        <Section title={isCustomer ? t.sales : t.purchases}>
          {list.length ? list.map((x) => (
            <LinkRow key={x.id} onClick={() => open({ kind: isCustomer ? 'saleDetail' : 'purchaseDetail', id: x.id })}>
              <span>{dateBoth(x.date)}{x.note && <small className="block text-[#77867d]">{x.note}</small>}</span>
              <span className="flex items-center gap-2"><StatusPill status={statusFor(Number(x.total), Number(x.paid))} t={t} /><b>{money(Number(x.total))}</b></span>
            </LinkRow>
          )) : <Empty text={t.nothingHere} />}
        </Section>
        <Section title={t.payments}>
          {p.payments.length ? p.payments.map((x) => (
            <LinkRow key={x.id} onClick={() => open({ kind: 'paymentDetail', id: x.id })}>
              <span>{dateBoth(x.date)}{x.note && <small className="block text-[#77867d]">{x.note}</small>}</span><b>{money(Number(x.amount))}</b>
            </LinkRow>
          )) : <Empty text={t.noPayments} />}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Product ─────────────────────────────────────────────────────
export function ItemDetailView({ t, open, onClose, onSaved, version, id }: Props & { id: string }) {
  const state = useRecord(() => getItemDetail(id), [id, version])
  const it = state.data
  const refOpen = (m: Movement): Modal | null =>
    !m.ref_id || m.ref_id === 'opening' ? null
      : m.reason === 'sale' ? { kind: 'saleDetail', id: m.ref_id }
      : m.reason === 'purchase' ? { kind: 'purchaseDetail', id: m.ref_id }
      : m.reason.startsWith('production') ? { kind: 'productionDetail', id: m.ref_id } : null
  return (
    <DetailSheet t={t} title={it?.name_am ?? t.product} onClose={onClose} state={state} actions={it && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'item', item: it })}>{t.edit}</Btn>
      <DeleteButton t={t} onConfirm={async () => { await deleteItem(id); onSaved(t.deleted) }} />
    </>}>
      {it && <>
        <div>
          {!it.active && <InfoRow label={t.status}>{t.inactive}</InfoRow>}
          {it.stock.map((s) => {
            const eq = s.type === 'finished' ? equivalents(s.stock, it.packaging.filter((u) => u.active)) : []
            return (
              <InfoRow key={s.id} label={s.type === 'raw' ? t.rawForm : t.finishedForm}>
                <span className={s.stock < 0 ? 'text-[#a54542]' : ''}>{qty(s.stock)} {s.unit}</span>
                {eq.length > 0 && <small className="block font-normal text-[#77867d]">{eq.map((e) => `≈ ${qty(e.amount)} ${unitLabel(t, e)}`).join(' · ')}</small>}
                <small className="block font-normal text-[#77867d]">
                  {s.type === 'raw' ? `${t.canBuy} ${money(s.buy_price)}/${s.unit}` : s.price ? `${money(s.price)}/${s.unit}` : ''}
                </small>
              </InfoRow>
            )
          })}
        </div>
        {it.packaging.length > 0 && (
          <Section title={t.packagingTitle}>
            {it.packaging.map((u) => (
              <div key={u.id} className={`flex justify-between border-t py-2 text-sm first:border-0 ${u.active ? '' : 'opacity-50'}`}>
                <span>1 {unitLabel(t, u)} = {qty(u.base_per_unit)} {it.stock.find((s) => s.type === 'finished')?.unit}</span>
                <span>{u.price != null ? money(u.price) : <span className="text-[#9aa89f]">{t.priceNotSet}</span>}</span>
              </div>
            ))}
          </Section>
        )}
        <Section title={t.movements}>
          {it.movements.length ? it.movements.map((m) => {
            const target = refOpen(m)
            const body = (
              <>
                <span>
                  <b>{reasonLabel(t, m)}</b>{m.person_name && ` · ${m.person_name}`}
                  <small className="block text-[#77867d]">{dateBoth(m.date ?? m.created_at)} · {m.form === 'RAW_CONE' ? t.rawForm : t.finishedForm}</small>
                </span>
                <b className={m.delta < 0 ? 'text-[#a54542]' : 'text-[#287342]'}>{m.delta > 0 ? '+' : ''}{qty(m.delta)} {m.unit}</b>
              </>
            )
            return target
              ? <LinkRow key={m.id} onClick={() => open(target)}>{body}</LinkRow>
              : <div key={m.id} className="flex justify-between gap-3 border-t py-3 text-sm first:border-0">{body}</div>
          }) : <Empty text={t.nothingHere} />}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Production batch ────────────────────────────────────────────
export function ProductionDetailView({ t, data, open, onClose, onSaved, version, id }: Props & { id: string }) {
  const state = useRecord(() => getProductionDetail(id), [id, version])
  const b = state.data
  const label = (productId: string, unitCode: string, fallback?: string) => {
    if (unitCode === 'BASE') return fallback ?? ''
    const itemId = data.products.find((p) => p.id === productId)?.item_id
    const u = data.packaging.find((x) => x.item_id === itemId && x.unit_code === unitCode)
    return u ? unitLabel(t, u) : (t as any)[`unit_${unitCode}`] ?? unitCode
  }
  const rawItem = b && data.products.find((p) => p.id === b.raw_product_id)?.item_id
  return (
    <DetailSheet t={t} title={t.productionDetail} onClose={onClose} state={state} actions={b && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'production', production: b })}>{t.edit}</Btn>
      <DeleteButton t={t} warning={t.deleteProductionWarning} onConfirm={async () => { await deleteProduction(id); onSaved(t.deleted) }} />
    </>}>
      {b && <>
        <div>
          <InfoRow label={t.date}>{dateBoth(b.date)}</InfoRow>
          {rawItem
            ? <LinkRow onClick={() => open({ kind: 'itemDetail', id: rawItem })}><span><small className="block text-[#77867d]">{t.rawCone}</small><b>{b.raw_product_name} · {qty(b.raw_quantity)} ኪ.ግ</b></span></LinkRow>
            : <InfoRow label={t.rawCone}>{b.raw_product_name} · {qty(b.raw_quantity)} ኪ.ግ</InfoRow>}
          {Number(b.waste_grams) > 0 && <InfoRow label={t.waste}>{qty(Number(b.waste_grams) / 1000)} ኪ.ግ</InfoRow>}
          {b.note && <InfoRow label={t.note}>{b.note}</InfoRow>}
        </div>
        <Section title={t.outputs}>
          {b.outputs.map((o, n) => (
            <div key={n} className="flex justify-between gap-3 border-t py-3 text-sm first:border-0">
              <b>{o.productName}</b>
              <span className="text-right">
                {o.unitCode !== 'BASE' && <>{qty(o.unitQuantity)} {label(o.productId, o.unitCode)} = </>}
                <b>{qty(o.quantity)} {o.baseUnit}</b>
              </span>
            </div>
          ))}
        </Section>
      </>}
    </DetailSheet>
  )
}

// ─── Dashboard cards (built from the data already loaded) ────────
export function SummaryView({ t, data, open, onClose, go, which }: Props & { which: 'sales' | 'customerDebt' | 'supplierDebt' | 'stock' }) {
  const month = ethiopianMonth()
  const last = previousEthiopianMonth()
  const monthName = (m: EthiopianMonth) => (t.langCode === 'en' ? m.name_en : m.name_am)
  const title = { sales: fmt(t.monthSales, { m: monthName(month) }), customerDebt: t.customersOwe, supplierDebt: t.youOwe, stock: t.stockValue }[which]
  const seeAll = (page: string, label: string) => go && <Btn variant="secondary" onClick={() => go(page)}>{label}</Btn>
  let body: ReactNode = null, actions: ReactNode = null

  if (which === 'sales') {
    const sum = (r: DateRange) => data.sales.filter((s) => inRange(s.date, r)).reduce((a, s) => a + s.total, 0)
    const thisMonth = data.sales.filter((s) => s.date >= month.from && s.date <= month.to)
    // Per product this month: TUBA that left stock and the money it brought in
    const byProduct = new Map<string, { base: number; amount: number }>()
    for (const s of thisMonth) for (const i of s.items) {
      const row = byProduct.get(i.productId) ?? { base: 0, amount: 0 }
      row.base += Number(i.baseQuantity ?? i.quantity); row.amount += i.quantity * i.price
      byProduct.set(i.productId, row)
    }
    const product = (id: string) => data.products.find((p) => p.id === id)
    body = <>
      <div>
        <InfoRow label={t.today}>{money(sum({ preset: 'today', from: '', to: '' }))}</InfoRow>
        <InfoRow label={`${monthName(month)} (${thisMonth.length})`}>{money(salesIn(data.sales, month))}</InfoRow>
        <InfoRow label={fmt(t.lastMonth, { m: monthName(last) })}>{money(salesIn(data.sales, last))}</InfoRow>
        <InfoRow label={`${t.allTime} (${data.sales.length})`}>{money(sum(anyDate))}</InfoRow>
      </div>
      <Section title={`${t.byProduct} — ${monthName(month)}`}>
        {byProduct.size ? [...byProduct].sort((a, b) => b[1].amount - a[1].amount).map(([id, r]) => {
          const p = product(id)
          const row = <><span><b>{p?.name_am ?? id}</b><small className="block text-[#77867d]">{qty(r.base)} {p?.unit}</small></span><b>{money(r.amount)}</b></>
          return p ? <LinkRow key={id} onClick={() => open({ kind: 'itemDetail', id: p.item_id })}>{row}</LinkRow>
            : <div key={id} className="flex justify-between border-t py-3 text-sm first:border-0">{row}</div>
        }) : <Empty text={t.nothingHere} />}
      </Section>
      <Section title={t.recentSales}>
        {data.sales.length ? data.sales.slice(0, 10).map((s) => (
          <LinkRow key={s.id} onClick={() => open({ kind: 'saleDetail', id: s.id })}>
            <span><b>{s.customer_name}</b><small className="block text-[#77867d]">{dateBoth(s.date)}</small></span>
            <span className="flex items-center gap-2"><StatusPill status={s.status} t={t} /><b>{money(s.total)}</b></span>
          </LinkRow>
        )) : <Empty text={t.nothingHere} />}
      </Section>
    </>
    actions = seeAll('sales', t.allSales)
  }

  if (which === 'customerDebt' || which === 'supplierDebt') {
    const isCustomer = which === 'customerDebt'
    const people = (isCustomer ? data.customers : data.suppliers).map((p) => ({ ...p, balance: Number(p.balance_due ?? 0) }))
    const owing = people.filter((p) => p.balance > 0).sort((a, b) => b.balance - a.balance)
    const credit = people.filter((p) => p.balance < 0).sort((a, b) => a.balance - b.balance)
    const row = (p: (typeof people)[number]) => (
      <LinkRow key={p.id} onClick={() => open({ kind: isCustomer ? 'customerDetail' : 'supplierDetail', id: p.id })}>
        <span><b>{p.name}</b>{p.phone && <small className="block text-[#77867d]">{p.phone}</small>}</span>
        <b className={p.balance > 0 ? 'text-[#a54542]' : 'text-[#287342]'}>{money(Math.abs(p.balance))}</b>
      </LinkRow>
    )
    body = <>
      <div><InfoRow label={`${t.total} (${owing.length})`}>{money(owing.reduce((a, p) => a + p.balance, 0))}</InfoRow></div>
      <Section title={isCustomer ? t.customersWhoOwe : t.suppliersWeOwe}>{owing.length ? owing.map(row) : <Empty text={t.nothingHere} />}</Section>
      {credit.length > 0 && <Section title={t.credit}>{credit.map(row)}</Section>}
    </>
    actions = seeAll(isCustomer ? 'customers' : 'suppliers', isCustomer ? t.customers : t.suppliers)
  }

  if (which === 'stock') {
    // Same rule as the dashboard total: max(stock, 0) × value of one base unit (lib/stock.ts UNIT_VALUE_SQL)
    const rows = data.products.filter((p) => p.item_active).map((p) => ({ p, value: Math.max(p.stock, 0) * Number(p.unit_value ?? 0) }))
    const group = (type: 'raw' | 'finished') => rows.filter((r) => r.p.type === type).sort((a, b) => b.value - a.value).map(({ p, value }) => (
      <LinkRow key={p.id} onClick={() => open({ kind: 'itemDetail', id: p.item_id })}>
        <span>
          <b>{p.name_am}</b>
          <small className="block text-[#77867d]">
            {qty(p.stock)} {p.unit} × {Number(p.unit_value) ? `${money(Number(p.unit_value))}/${p.unit}` : t.priceNotSet}
          </small>
        </span>
        <b>{money(value)}</b>
      </LinkRow>
    ))
    body = <>
      <div><InfoRow label={t.total}>{money(rows.reduce((a, r) => a + r.value, 0))}</InfoRow></div>
      <Section title={t.rawSection}>{group('raw')}</Section>
      <Section title={t.finishedSection}>{group('finished')}</Section>
      <p className="text-xs text-[#77867d]">{t.stockValueNote}</p>
    </>
    actions = seeAll('inventory', t.inventory)
  }

  return <DetailSheet t={t} title={title} onClose={onClose} state={{ data: true }} actions={actions}>{body}</DetailSheet>
}

// ─── Expense (data already loaded with the list) ─────────────────
export function ExpenseDetailView({ t, data, open, onClose, onSaved, id }: Props & { id: string }) {
  const e = data.expenses.find((x) => x.id === id)
  return (
    <DetailSheet t={t} title={t.expenseDetail} onClose={onClose} state={e ? { data: e } : { error: 'Expense not found' }} actions={e && <>
      <Btn icon={Pencil} onClick={() => open({ kind: 'expense', expense: e })}>{t.edit}</Btn>
      <DeleteButton t={t} onConfirm={async () => { await deleteExpense(id); onSaved(t.deleted) }} />
    </>}>
      {e && (
        <div>
          <InfoRow label={t.description}>{e.description}</InfoRow>
          <InfoRow label={t.category}>{categoryLabel(t, e.category)}</InfoRow>
          <InfoRow label={t.date}>{dateBoth(e.date)}</InfoRow>
          <InfoRow label={t.amount}>{money(e.amount)}</InfoRow>
          {e.note && <InfoRow label={t.note}>{e.note}</InfoRow>}
        </div>
      )}
    </DetailSheet>
  )
}
