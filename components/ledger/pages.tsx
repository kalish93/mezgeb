'use client'
import { useMemo, useState } from 'react'
import { CircleDollarSign, CreditCard, Factory, LogOut, Package, Pencil, Plus, Settings as SettingsIcon, ShoppingCart, Truck, Users, Wallet } from 'lucide-react'
import { signOut, type Customer, type DashboardData, type Expense, type Item, type PackagingUnit, type Payment, type Product, type Production, type Purchase, type PurchaseDetail, type Sale, type SaleDetail, type Supplier } from '@/lib/api'
import { dateBoth, ethiopianMonth, money, previousEthiopianMonth, qty, type EthiopianMonth } from '@/lib/format'
import { equivalents, fromBase } from '@/lib/packaging'
import { Btn, CallLink, Card, Chips, Empty, PageHead, ResultBar, Select, Stat, StatusPill } from './ui'
import { anyDate, DateFilter, FilterPanel, FilterRow, inRange, matches, SearchBox, type DateRange } from './filters'
import { categoryLabel, expenseCategories, fmt, unitLabel, type Lang, type T } from './i18n'

export type Modal =
  // forms (an existing record = edit it)
  | { kind: 'sale' | 'purchase'; existing?: SaleDetail | PurchaseDetail }
  | { kind: 'payment'; payment?: Omit<Payment, 'allocations'>; preset?: { kind: 'customer' | 'supplier'; personId: string } }
  | { kind: 'expense'; expense?: Expense }
  | { kind: 'production'; production?: Production }
  // detail views
  | { kind: 'saleDetail' | 'purchaseDetail' | 'paymentDetail' | 'productionDetail' | 'expenseDetail' | 'itemDetail' | 'customerDetail' | 'supplierDetail'; id: string }
  | { kind: 'summary'; which: 'sales' | 'customerDebt' | 'supplierDebt' | 'stock' } // dashboard cards
  | { kind: 'item'; item?: Item }
  | { kind: 'packaging'; unit?: PackagingUnit; itemId?: string }
  | { kind: 'customer' | 'supplier'; person?: Customer | Supplier }

export type AppData = {
  dash: DashboardData | null; products: Product[]; customers: Customer[]; suppliers: Supplier[]
  sales: Sale[]; purchases: Purchase[]; payments: Payment[]; expenses: Expense[]; productions: Production[]
  items: Item[]; packaging: PackagingUnit[]
}

const activeUnits = (data: AppData, itemId: string) => data.packaging.filter((u) => u.item_id === itemId && u.active)

type Open = (m: Modal) => void
const sum = <X,>(xs: X[], f: (x: X) => number) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0)
const isLow = (p: Product) => p.reorder > 0 && p.stock <= p.reorder
const rowCls = 'border-t p-4 text-sm'
const clickable = 'cursor-pointer hover:bg-[#f6f9f6] focus-visible:bg-[#eef6f0] focus-visible:outline-none'

// ─── Dashboard ───────────────────────────────────────────────────
/** Sales total for an Ethiopian month (bounds are inclusive 'YYYY-MM-DD'). */
export const salesIn = (sales: Sale[], m: { from: string; to: string }) =>
  sales.filter((s) => s.date >= m.from && s.date <= m.to).reduce((a, s) => a + s.total, 0)

export function Dashboard({ t, data, open }: { t: T; data: AppData; open: Open }) {
  // This Ethiopian month's sales (an all-time total keeps growing and says little); last month for comparison
  const month = ethiopianMonth()
  const last = previousEthiopianMonth()
  const monthName = (m: EthiopianMonth) => (t.langCode === 'en' ? m.name_en : m.name_am)
  return (
    <>
      <PageHead title={t.hello} sub={t.helloSub} action={<Btn icon={Plus} onClick={() => open({ kind: 'sale' })}>{t.newSale}</Btn>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={fmt(t.monthSales, { m: monthName(month) })}
          value={money(salesIn(data.sales, month))}
          sub={`${fmt(t.lastMonth, { m: monthName(last) })}: ${money(salesIn(data.sales, last))}`}
          icon={CircleDollarSign}
          onClick={() => open({ kind: 'summary', which: 'sales' })}
        />
        <Stat label={t.customersOwe} value={money(data.dash?.customerDebt ?? 0)} icon={Users} tone="amber" onClick={() => open({ kind: 'summary', which: 'customerDebt' })} />
        <Stat label={t.youOwe} value={money(data.dash?.supplierDebt ?? 0)} icon={Truck} tone="red" onClick={() => open({ kind: 'summary', which: 'supplierDebt' })} />
        <Stat label={t.stockValue} value={money(data.dash?.stockValue ?? 0)} icon={Package} tone="blue" onClick={() => open({ kind: 'summary', which: 'stock' })} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-5">
            <h2 className="font-bold">{t.recentSales}</h2>
            <div className="mt-4 divide-y">
              {data.dash?.recentSales.length ? data.dash.recentSales.slice(0, 5).map((s) => (
                <button type="button" key={s.id} onClick={() => open({ kind: 'saleDetail', id: s.id })} className={`flex w-full justify-between py-3 text-left text-sm ${clickable}`}>
                  <span><b>{s.customer_name}</b><br /><small className="text-[#77867d]">{dateBoth(s.date)}</small></span>
                  <b>{money(s.total)}</b>
                </button>
              )) : <p className="text-sm text-[#77867d]">{t.nothingHere}</p>}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <h2 className="mb-4 font-bold">{t.unpaidInvoices}</h2>
            {data.dash?.unpaidInvoices.length ? data.dash.unpaidInvoices.map((u) => (
              <button type="button" key={u.id} onClick={() => open({ kind: 'saleDetail', id: u.id })} className={`flex w-full items-center justify-between border-b py-3 text-left last:border-0 ${clickable}`}>
                <span className="text-sm font-semibold">{u.customer_name}</span><b>{money(u.owed)}</b>
              </button>
            )) : <p className="text-sm text-[#77867d]">{t.nothingHere}</p>}
          </div>
        </Card>
      </div>
    </>
  )
}

// ─── Sales / Purchases ───────────────────────────────────────────
export function TradeList({ t, kind, data, open }: { t: T; kind: 'sale' | 'purchase'; data: AppData; open: Open }) {
  const isSale = kind === 'sale'
  const rows: (Sale | Purchase)[] = isSale ? data.sales : data.purchases
  const people: (Customer | Supplier)[] = isSale ? data.customers : data.suppliers
  const [range, setRange] = useState<DateRange>(anyDate)
  const [personId, setPersonId] = useState('')
  const [status, setStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')
  const [productId, setProductId] = useState('')
  const [q, setQ] = useState('')
  const nameOf = (r: Sale | Purchase) => ('customer_name' in r ? r.customer_name : r.supplier_name)
  const products = data.products.filter((p) => (isSale ? p.can_sell : p.can_buy))
  // "መነን 1 ማዳበሪያ / ትዶሽ · ፒሲ 2 ፓኬት" — what was sold / bought, in the unit it was recorded in
  const itemsOf = (r: Sale | Purchase) => r.items.map((i) => {
    const p = data.products.find((x) => x.id === i.productId)
    const unit = 'unitLabel' in i && i.unitLabel ? i.unitLabel : p?.unit ?? ''
    return `${p?.name_am ?? ''} ${qty(i.quantity)} ${unit}`.trim()
  }).join(' · ')

  const shown = rows.filter((r) =>
    inRange(r.date, range) &&
    (!personId || ('customer_id' in r ? r.customer_id : r.supplier_id) === personId) &&
    (status === 'all' || r.status === status) &&
    (!productId || r.items.some((i) => i.productId === productId)) &&
    matches(q, nameOf(r), r.note, itemsOf(r)),
  )

  return (
    <>
      <PageHead title={isSale ? t.sales : t.purchases} sub={isSale ? t.salesSub : t.purchasesSub} action={<Btn icon={Plus} onClick={() => open({ kind })}>{isSale ? t.newSale : t.newPurchase}</Btn>} />
      <FilterPanel
        t={t}
        search={<SearchBox value={q} onChange={setQ} placeholder={t.search} />}
        active={[range.preset !== 'all', status !== 'all', !!personId, !!productId].filter(Boolean).length}
        onClear={() => { setRange(anyDate); setStatus('all'); setPersonId(''); setProductId('') }}
      >
        <DateFilter t={t} value={range} onChange={setRange} />
        <FilterRow label={t.status}>
          <Chips value={status} onChange={setStatus} options={[['all', t.all], ['unpaid', t.unpaid], ['partial', t.partial], ['paid', t.paid]]} />
        </FilterRow>
        <div className="grid gap-3 sm:grid-cols-2 [&_select]:mt-0">
          <FilterRow label={isSale ? t.customer : t.supplier}>
            <Select value={personId} onChange={setPersonId} options={[['', t.all], ...people.map((p): [string, string] => [p.id, p.name])]} />
          </FilterRow>
          <FilterRow label={t.product}>
            <Select value={productId} onChange={setProductId} options={[['', t.all], ...products.map((p): [string, string] => [p.id, p.name_am])]} />
          </FilterRow>
        </div>
      </FilterPanel>
      <ResultBar>
        <span>{shown.length} {t.found}</span>
        <span>{t.total}: <b>{money(sum(shown, (r) => r.total))}</b></span>
        <span>{t.remaining}: <b>{money(sum(shown, (r) => Math.max(0, r.total - r.paid)))}</b></span>
      </ResultBar>
      <Card>
        <div className="hidden grid-cols-6 gap-2 bg-[#f6f9f6] p-4 text-xs text-[#77867d] md:grid">
          <span>{t.date}</span><span>{isSale ? t.customer : t.supplier}</span><span>{t.itemsCol}</span><span>{t.total}</span><span>{t.paid}</span><span>{t.status}</span>
        </div>
        {shown.length ? shown.map((r) => (
          <button type="button" key={r.id} onClick={() => open({ kind: isSale ? 'saleDetail' : 'purchaseDetail', id: r.id })} className={`grid w-full grid-cols-2 gap-2 text-left md:grid-cols-6 ${rowCls} ${clickable}`}>
            <span>{dateBoth(r.date)}</span><b>{nameOf(r)}</b><span className="truncate text-[#52645a]">{itemsOf(r)}</span><b>{money(r.total)}</b><span>{money(r.paid)}</span><StatusPill status={r.status} t={t} />
          </button>
        )) : <Empty text={t.nothingHere} />}
      </Card>
    </>
  )
}

// ─── Payments ────────────────────────────────────────────────────
export function PaymentList({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const [range, setRange] = useState<DateRange>(anyDate)
  const [kind, setKind] = useState<'all' | 'customer' | 'supplier'>('all')
  const [personId, setPersonId] = useState('')
  const people: (Customer | Supplier)[] = kind === 'supplier' ? data.suppliers : kind === 'customer' ? data.customers : [...data.customers, ...data.suppliers]
  const nameOf = (p: Payment) => (p.kind === 'customer' ? data.customers : data.suppliers).find((x) => x.id === p.person_id)?.name ?? p.person_id

  const shown = data.payments.filter((p) => inRange(p.date, range) && (kind === 'all' || p.kind === kind) && (!personId || p.person_id === personId))

  return (
    <>
      <PageHead title={t.payments} sub={t.paymentsSub} action={<Btn icon={Plus} onClick={() => open({ kind: 'payment' })}>{t.newPayment}</Btn>} />
      <FilterPanel
        t={t}
        active={[range.preset !== 'all', kind !== 'all', !!personId].filter(Boolean).length}
        onClear={() => { setRange(anyDate); setKind('all'); setPersonId('') }}
      >
        <DateFilter t={t} value={range} onChange={setRange} />
        <FilterRow label={t.type}>
          <Chips value={kind} onChange={(k) => { setKind(k); setPersonId('') }} options={[['all', t.all], ['customer', t.received], ['supplier', t.paidOut]]} />
        </FilterRow>
        <FilterRow label={t.person}>
          <div className="max-w-sm [&_select]:mt-0"><Select value={personId} onChange={setPersonId} options={[['', t.all], ...people.map((p): [string, string] => [p.id, p.name])]} /></div>
        </FilterRow>
      </FilterPanel>
      <ResultBar>
        <span>{shown.length} {t.found}</span>
        <span>{t.moneyIn}: <b className="text-[#287342]">{money(sum(shown.filter((p) => p.kind === 'customer'), (p) => p.amount))}</b></span>
        <span>{t.moneyOut}: <b className="text-[#a54542]">{money(sum(shown.filter((p) => p.kind === 'supplier'), (p) => p.amount))}</b></span>
      </ResultBar>
      <Card>
        {shown.length ? shown.map((p) => (
          <button type="button" key={p.id} onClick={() => open({ kind: 'paymentDetail', id: p.id })} className={`grid w-full grid-cols-2 gap-2 text-left first:border-0 md:grid-cols-4 ${rowCls} ${clickable}`}>
            <span>{dateBoth(p.date)}</span>
            <span><b>{nameOf(p)}</b><small className="block text-[#77867d]">{p.kind === 'customer' ? t.received : t.paidOut}</small></span>
            <b className={p.kind === 'customer' ? 'text-[#287342]' : 'text-[#a54542]'}>{money(p.amount)}</b>
            <small className="truncate text-[#77867d]">{p.note}</small>
          </button>
        )) : <Empty text={t.nothingHere} />}
      </Card>
    </>
  )
}

// ─── Customers / Suppliers ───────────────────────────────────────
export function PeopleList({ t, kind, data, open }: { t: T; kind: 'customer' | 'supplier'; data: AppData; open: Open }) {
  const list: (Customer | Supplier)[] = kind === 'customer' ? data.customers : data.suppliers
  const [q, setQ] = useState('')
  const [owing, setOwing] = useState<'all' | 'owing'>('all')
  const shown = list.filter((p) => matches(q, p.name, p.phone, p.address) && (owing === 'all' || Number(p.balance_due ?? 0) > 0))
  return (
    <>
      <PageHead title={kind === 'customer' ? t.customers : t.suppliers} sub={t.peopleSub} action={<Btn icon={Plus} onClick={() => open({ kind })}>{kind === 'customer' ? t.addCustomer : t.addSupplier}</Btn>} />
      <FilterPanel t={t} search={<SearchBox value={q} onChange={setQ} placeholder={t.search} />} active={owing === 'owing' ? 1 : 0} onClear={() => setOwing('all')}>
        <Chips value={owing} onChange={setOwing} options={[['all', t.all], ['owing', t.owesMoney]]} />
      </FilterPanel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => {
          const balance = Number(p.balance_due ?? 0)
          return (
            <Card key={p.id}>
              {/* the whole card opens the detail (their purchases / sales and payments); edit and call stay separate */}
              <div role="button" tabIndex={0} onClick={() => open({ kind: kind === 'customer' ? 'customerDetail' : 'supplierDetail', id: p.id })}
                onKeyDown={(e) => e.key === 'Enter' && open({ kind: kind === 'customer' ? 'customerDetail' : 'supplierDetail', id: p.id })}
                className={`p-5 ${clickable}`}>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#e5f2e8] font-bold text-[#21633b]">{p.name.slice(0, 1)}</div>
                  <div className="min-w-0 flex-1"><b>{p.name}</b><p className="text-xs text-[#77867d]">{p.phone}</p></div>
                  <span onClick={(e) => e.stopPropagation()}><Btn variant="ghost" size="sm" icon={Pencil} ariaLabel={t.edit} onClick={() => open({ kind, person: p })}>{''}</Btn></span>
                </div>
                <div className="mt-5 flex items-end justify-between border-t pt-4">
                  <div>
                    <small className="text-[#77867d]">{balance >= 0 ? t.owes : t.credit}</small>
                    <div className={`text-lg font-bold ${balance > 0 ? 'text-[#a54542]' : ''}`}>{money(Math.abs(balance))}</div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}><CallLink phone={p.phone} t={t} /></span>
                </div>
              </div>
            </Card>
          )
        })}
        {!shown.length && <Card className="md:col-span-2 xl:col-span-3"><Empty text={t.nothingHere} /></Card>}
      </div>
    </>
  )
}

// ─── Inventory ───────────────────────────────────────────────────
type ProductFilter = 'all' | 'low'
/**
 * Raw cone (kg) and finished products (TUBA) are separate balances of the same named product.
 * Packet / piece / Madaberiya figures are derived from the TUBA balance, never stored.
 */
export function Inventory({ t, data, open, goSettings }: { t: T; data: AppData; open: Open; goSettings: () => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('all')
  const shown = data.products.filter((p) => p.item_active && (filter === 'all' || isLow(p)) && matches(q, p.name_am, p.name_en))
  return (
    <>
      <PageHead title={t.inventory} sub={t.inventorySub} action={<Btn variant="secondary" icon={SettingsIcon} onClick={goSettings}>{t.manageProducts}</Btn>} />
      <FilterPanel t={t} search={<SearchBox value={q} onChange={setQ} placeholder={t.search} />} active={filter !== 'all' ? 1 : 0} onClear={() => setFilter('all')}>
        <FilterRow label={t.type}>
          <Chips value={filter} onChange={setFilter} options={[['all', t.all], ['low', t.lowBadge]]} />
        </FilterRow>
      </FilterPanel>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['raw', 'finished'] as const).map((k) => {
          const group = shown.filter((p) => p.type === k)
          return (
            <Card key={k}>
              <div className="bg-[#f6f9f6] p-5">
                <h2 className="font-bold">{k === 'raw' ? t.rawSection : t.finishedSection}</h2>
                {k === 'finished' && <p className="mt-1 text-xs text-[#77867d]">{t.derivedNote}</p>}
              </div>
              {group.length ? group.map((p) => {
                const eq = k === 'finished' ? equivalents(p.stock, activeUnits(data, p.item_id)) : []
                return (
                  <button type="button" key={p.id} onClick={() => open({ kind: 'itemDetail', id: p.item_id })} className={`flex w-full items-start justify-between gap-3 border-t p-4 text-left ${clickable}`}>
                    <span className="min-w-0">
                      <b>{p.name_am}</b>
                      <small className="block text-[#77867d]">
                        {k === 'raw'
                          ? `${t.canBuy} ${money(p.buy_price)}/${p.unit}`
                          : eq.map((e) => `≈ ${qty(e.amount)} ${unitLabel(t, e)}`).join(' · ')}
                      </small>
                    </span>
                    <b className={`shrink-0 ${isLow(p) || p.stock < 0 ? 'text-[#a54542]' : ''}`}>{qty(p.stock)} {p.unit}</b>
                  </button>
                )
              }) : <Empty text={t.nothingHere} />}
            </Card>
          )
        })}
      </div>
    </>
  )
}

// ─── Production ──────────────────────────────────────────────────
export function ProductionList({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const [range, setRange] = useState<DateRange>(anyDate)
  const shown = data.productions.filter((p) => inRange(p.date, range))
  const productOf = (id: string) => data.products.find((p) => p.id === id)
  // Shows the output as it was entered (e.g. 2 ማዳበሪያ = 1,200 ቱባ), using the factor stored with the batch
  const outputText = (o: Production['outputs'][number]) => {
    const p = productOf(o.productId)
    const u = o.unitCode !== 'BASE' && p ? activeUnits(data, p.item_id).find((x) => x.unit_code === o.unitCode) : undefined
    const entered = u ? `${qty(o.unitQuantity)} ${unitLabel(t, u)} = ` : ''
    return `${p?.name_am ?? o.productId}: ${entered}${qty(o.quantity)} ${p?.unit ?? ''}`
  }
  return (
    <>
      <PageHead title={t.production} sub={t.productionSub} action={<Btn icon={Factory} onClick={() => open({ kind: 'production' })}>{t.newProduction}</Btn>} />
      <FilterPanel t={t} active={range.preset !== 'all' ? 1 : 0} onClear={() => setRange(anyDate)}>
        <DateFilter t={t} value={range} onChange={setRange} />
      </FilterPanel>
      <Card>
        {shown.length ? shown.map((p) => (
          <button type="button" key={p.id} onClick={() => open({ kind: 'productionDetail', id: p.id })} className={`block w-full text-left first:border-0 ${rowCls} ${clickable}`}>
            <div className="flex justify-between gap-2"><b>{p.raw_product_name} · {qty(p.raw_quantity)} ኪ.ግ</b><span>{dateBoth(p.date)}</span></div>
            <small className="text-[#77867d]">
              {p.outputs.map(outputText).join(' · ')}
              {Number(p.waste_grams) > 0 && ` · ${t.waste} ${qty(Number(p.waste_grams) / 1000)} ኪ.ግ`}
              {p.note && ` · ${p.note}`}
            </small>
          </button>
        )) : <Empty text={t.nothingHere} />}
      </Card>
    </>
  )
}

// ─── Expenses ────────────────────────────────────────────────────
export function ExpenseList({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const [range, setRange] = useState<DateRange>(anyDate)
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const shown = data.expenses.filter((e) => inRange(e.date, range) && (category === 'all' || e.category === category) && matches(q, e.description, e.note))
  return (
    <>
      <PageHead title={t.expenses} sub={t.expensesSub} action={<Btn icon={Plus} onClick={() => open({ kind: 'expense' })}>{t.newExpense}</Btn>} />
      <FilterPanel
        t={t}
        search={<SearchBox value={q} onChange={setQ} placeholder={t.search} />}
        active={[range.preset !== 'all', category !== 'all'].filter(Boolean).length}
        onClear={() => { setRange(anyDate); setCategory('all') }}
      >
        <DateFilter t={t} value={range} onChange={setRange} />
        <FilterRow label={t.category}>
          <Chips value={category} onChange={setCategory} options={[['all', t.all], ...expenseCategories.map((c): [string, string] => [c, categoryLabel(t, c)])]} />
        </FilterRow>
      </FilterPanel>
      <ResultBar><span>{shown.length} {t.found}</span><span>{t.total}: <b>{money(sum(shown, (e) => e.amount))}</b></span></ResultBar>
      <Card>
        <div className="p-5">
          {shown.length ? shown.map((e) => (
            <button type="button" key={e.id} onClick={() => open({ kind: 'expenseDetail', id: e.id })} className={`flex w-full justify-between border-t py-4 text-left text-sm first:border-0 ${clickable}`}>
              <span><b>{e.description}</b><small className="block text-[#77867d]">{categoryLabel(t, e.category)} · {dateBoth(e.date)}</small></span>
              <b>{money(e.amount)}</b>
            </button>
          )) : <p className="text-sm text-[#77867d]">{t.nothingHere}</p>}
        </div>
      </Card>
    </>
  )
}

// ─── Reports ─────────────────────────────────────────────────────
export function Reports({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const [range, setRange] = useState<DateRange>({ preset: 'month', from: '', to: '' })
  const r = useMemo(() => {
    const within = <X extends { date: string }>(xs: X[]) => xs.filter((x) => inRange(x.date, range))
    const payments = within(data.payments)
    return {
      sales: sum(within(data.sales), (x) => x.total),
      purchases: sum(within(data.purchases), (x) => x.total),
      expenses: sum(within(data.expenses), (x) => x.amount),
      moneyIn: sum(payments.filter((p) => p.kind === 'customer'), (p) => p.amount),
      moneyOut: sum(payments.filter((p) => p.kind === 'supplier'), (p) => p.amount),
    }
  }, [data, range])
  return (
    <>
      <PageHead title={t.reports} sub={t.reportsSub} action={<Btn variant="secondary" onClick={() => window.print()}>{t.print}</Btn>} />
      <div className="mb-4"><DateFilter t={t} value={range} onChange={setRange} /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t.salesTotal} value={money(r.sales)} icon={ShoppingCart} />
        <Stat label={t.purchasesTotal} value={money(r.purchases)} icon={Truck} tone="blue" />
        <Stat label={t.expensesTotal} value={money(r.expenses)} icon={Wallet} tone="red" />
        <Stat label={t.received} value={money(r.moneyIn)} icon={CreditCard} />
        <Stat label={t.paidOut} value={money(r.moneyOut)} icon={CreditCard} tone="amber" />
      </div>
      <h2 className="mb-3 mt-6 font-bold">{t.rightNow}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t.customersOwe} value={money(data.dash?.customerDebt ?? 0)} icon={Users} tone="amber" onClick={() => open({ kind: 'summary', which: 'customerDebt' })} />
        <Stat label={t.youOwe} value={money(data.dash?.supplierDebt ?? 0)} icon={Truck} tone="red" onClick={() => open({ kind: 'summary', which: 'supplierDebt' })} />
        <Stat label={t.stockValue} value={money(data.dash?.stockValue ?? 0)} icon={Package} tone="blue" onClick={() => open({ kind: 'summary', which: 'stock' })} />
      </div>
    </>
  )
}

// ─── Settings ────────────────────────────────────────────────────
/** Products: one row per product identity, with its raw-cone and finished balances. */
function ProductsSection({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const forms = (itemId: string) => data.products.filter((p) => p.item_id === itemId)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 bg-[#f6f9f6] p-5">
        <div><h2 className="font-bold">{t.productsTitle}</h2><p className="text-xs text-[#77867d]">{t.productsHint}</p></div>
        <Btn size="sm" icon={Plus} onClick={() => open({ kind: 'item' })}>{t.addProductItem}</Btn>
      </div>
      {data.items.length ? data.items.map((i) => (
        <div key={i.id} className={`flex items-center justify-between gap-3 border-t p-4 text-sm ${i.active ? '' : 'opacity-60'}`}>
          <button type="button" onClick={() => open({ kind: 'itemDetail', id: i.id })} className={`min-w-0 flex-1 text-left ${clickable}`}>
            <b>{i.name_am}</b>
            {!i.active && <small className="ml-2 rounded-full bg-[#f1f1f1] px-2 py-0.5">{t.inactive}</small>}
            <small className="block text-[#77867d]">
              {forms(i.id).map((p) => `${p.type === 'raw' ? t.rawForm : t.finishedForm}: ${qty(p.stock)} ${p.unit}`).join(' · ')}
            </small>
          </button>
          <Btn variant="ghost" size="sm" icon={Pencil} ariaLabel={t.edit} onClick={() => open({ kind: 'item', item: i })}>{''}</Btn>
        </div>
      )) : <Empty text={t.nothingHere} />}
    </Card>
  )
}

/** Packaging conversions, grouped by product: factor in the base unit, price per unit, default flag. */
function PackagingSection({ t, data, open }: { t: T; data: AppData; open: Open }) {
  const byItem = data.items
    .map((i) => ({ item: i, base: data.products.find((p) => p.item_id === i.id && p.type === 'finished')?.unit, units: data.packaging.filter((u) => u.item_id === i.id) }))
    .filter((g) => g.base)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 bg-[#f6f9f6] p-5">
        <div><h2 className="font-bold">{t.packagingTitle}</h2><p className="text-xs text-[#77867d]">{t.packagingHint}</p></div>
        <Btn size="sm" icon={Plus} onClick={() => open({ kind: 'packaging' })}>{t.addPackaging}</Btn>
      </div>
      {byItem.length ? byItem.map(({ item, base, units }) => {
        const active = units.filter((u) => u.active).sort((a, b) => b.base_per_unit - a.base_per_unit)
        const [top, ...rest] = active
        return (
          <div key={item.id} className="border-t p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <b>{item.name_am}</b>
              <Btn variant="ghost" size="sm" icon={Plus} ariaLabel={t.addPackaging} onClick={() => open({ kind: 'packaging', itemId: item.id })}>{''}</Btn>
            </div>
            {/* e.g. 1 ማዳበሪያ = 20 ፓኬት = 150 ፍሬ = 600 ቱባ — derived from the factors */}
            {top && rest.length > 0 && (
              <p className="mb-2 text-xs text-[#77867d]">
                1 {unitLabel(t, top)} = {rest.map((u) => `${qty(fromBase(top.base_per_unit, u.base_per_unit))} ${unitLabel(t, u)}`).join(' = ')} = {qty(top.base_per_unit)} {base}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[#77867d]">
                  <tr><th className="py-1 font-normal">{t.unitType}</th><th className="font-normal">{base}</th><th className="font-normal">{t.unitPrice}</th><th /></tr>
                </thead>
                <tbody>
                  {units.length ? units.map((u) => (
                    <tr key={u.id} className={`border-t ${u.active ? '' : 'opacity-50'}`}>
                      <td className="py-2">
                        {unitLabel(t, u)}
                        {u.is_default && <small className="ml-1 rounded-full bg-[#e5f2e8] px-2 py-0.5 text-[#21633b]">{t.defaultUnit}</small>}
                        {!u.active && <small className="ml-1">{t.inactive}</small>}
                      </td>
                      <td>{qty(u.base_per_unit)}</td>
                      <td>{u.price != null ? money(u.price) : <span className="text-[#9aa89f]">{t.priceNotSet}</span>}</td>
                      <td className="text-right">
                        <Btn variant="ghost" size="sm" icon={Pencil} ariaLabel={t.edit} onClick={() => open({ kind: 'packaging', unit: u })}>{''}</Btn>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} className="py-2 text-[#77867d]">{t.nothingHere}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }) : <Empty text={t.noFinishedItems} />}
    </Card>
  )
}

export function Settings({ t, lang, setLang, data, open }: { t: T; lang: Lang; setLang: (l: Lang) => void; data: AppData; open: Open }) {
  return (
    <>
      <PageHead title={t.settings} sub={t.settingsSub} />
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <ProductsSection t={t} data={data} open={open} />
        <PackagingSection t={t} data={data} open={open} />
      </div>
      <Card>
        <div className="p-5 text-sm"><b className="mb-2 block">{t.language}</b><Chips value={lang} onChange={setLang} options={[['am', 'አማርኛ'], ['en', 'English']]} /></div>
        <div className="flex items-center justify-between gap-3 border-t p-5 text-sm">
          <span className="text-[#77867d]">{t.signOutHint}</span>
          <Btn variant="secondary" icon={LogOut} onClick={signOut}>{t.signOut}</Btn>
        </div>
      </Card>
    </>
  )
}
