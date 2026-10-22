'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen, CreditCard, Factory, FileBarChart, Home, Menu, Package, Settings as SettingsIcon,
  ShoppingCart, Truck, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import {
  getDashboard, getProducts, getCustomers, getSuppliers, getSales, getPurchases,
  getPayments, getExpenses, getProductions, getItems, getPackaging,
} from '@/lib/api'
import { dateBoth, localDay } from '@/lib/format'
import { dictionaries, type Lang } from './ledger/i18n'
import {
  Dashboard, TradeList, PaymentList, PeopleList, Inventory, ProductionList, ExpenseList, Reports, Settings,
  type AppData, type Modal,
} from './ledger/pages'
import { TradeForm, PaymentForm, ExpenseForm, ItemForm, PackagingForm, PersonForm, ProductionForm } from './ledger/forms'
import {
  SaleDetailView, PurchaseDetailView, PaymentDetailView, ProductionDetailView, ExpenseDetailView, ItemDetailView, PersonDetailView, SummaryView,
} from './ledger/details'

type Page = 'dashboard' | 'sales' | 'purchases' | 'payments' | 'customers' | 'suppliers' | 'inventory' | 'production' | 'expenses' | 'reports' | 'settings'
const nav: [Page, LucideIcon][] = [
  ['dashboard', Home], ['sales', ShoppingCart], ['purchases', Truck], ['payments', CreditCard], ['customers', Users],
  ['suppliers', BookOpen], ['inventory', Package], ['production', Factory], ['expenses', Wallet], ['reports', FileBarChart], ['settings', SettingsIcon],
]

// Remembered per device; storage may be unavailable (private mode), so never let it throw
const loadLang = (): Lang => { try { return localStorage.getItem('ledger.lang') === 'en' ? 'en' : 'am' } catch { return 'am' } }
const storeLang = (l: Lang) => { try { localStorage.setItem('ledger.lang', l) } catch {} }

const empty: AppData = { dash: null, products: [], customers: [], suppliers: [], sales: [], purchases: [], payments: [], expenses: [], productions: [], items: [], packaging: [] }

export default function LedgerApp() {
  const [lang, setLangState] = useState<Lang>('am')
  const t = dictionaries[lang]
  const [page, setPage] = useState<Page>('dashboard')
  // Open sheets, top last: a detail can open another detail or a form; closing returns to the one below
  const [stack, setStack] = useState<Modal[]>([])
  const modal = stack[stack.length - 1] ?? null
  // Bumped after every save so open detail views reload their data
  const [version, setVersion] = useState(0)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  useEffect(() => { setLangState(loadLang()) }, [])
  const setLang = (l: Lang) => { setLangState(l); storeLang(l) }

  const reload = useCallback(async () => {
    try {
      setApiError('')
      const [dash, products, customers, suppliers, sales, purchases, payments, expenses, productions, items, packaging] = await Promise.all([
        getDashboard(), getProducts(), getCustomers(), getSuppliers(), getSales(), getPurchases(), getPayments(), getExpenses(), getProductions(), getItems(), getPackaging(),
      ])
      setData({ dash, products, customers, suppliers, sales, purchases, payments, expenses, productions, items, packaging })
    } catch (e: any) {
      setApiError(e?.message || 'API error')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { reload() }, [reload])

  const open = useCallback((m: Modal) => setStack((s) => [...s, m]), [])
  const go = (p: Page) => { setPage(p); setStack([]); setMobileMenu(false) }
  const closeModal = useCallback(() => setStack((s) => s.slice(0, -1)), [])
  const saved = (msg: string) => {
    closeModal() // back to the detail the form was opened from (if any), which then reloads
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
    setVersion((v) => v + 1)
    reload()
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f4f7f4]"><div className="text-center"><div className="mb-4 text-4xl">🧵</div><p className="text-[#5e7568]">{t.loading}</p></div></div>
  }
  if (apiError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f4]">
        <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <b className="block text-red-700">{t.cantConnect}</b>
          {/* "Failed to fetch" etc. means no connection: say that plainly */}
          <p className="mt-2 text-sm text-[#77867d]">{/fetch|network/i.test(apiError) ? t.noConnection : apiError}</p>
          <button onClick={() => { setLoading(true); reload() }} className="mt-4 rounded-xl bg-[#21633b] px-5 py-2 text-sm text-white">{t.tryAgain}</button>
        </div>
      </div>
    )
  }

  const pageEl = (() => {
    switch (page) {
      case 'dashboard': return <Dashboard t={t} data={data} open={open} />
      case 'sales': return <TradeList key="sale" t={t} kind="sale" data={data} open={open} />
      case 'purchases': return <TradeList key="purchase" t={t} kind="purchase" data={data} open={open} />
      case 'payments': return <PaymentList t={t} data={data} open={open} />
      case 'customers': return <PeopleList key="customer" t={t} kind="customer" data={data} open={open} />
      case 'suppliers': return <PeopleList key="supplier" t={t} kind="supplier" data={data} open={open} />
      case 'inventory': return <Inventory t={t} data={data} open={open} goSettings={() => go('settings')} />
      case 'production': return <ProductionList t={t} data={data} open={open} />
      case 'expenses': return <ExpenseList t={t} data={data} open={open} />
      case 'reports': return <Reports t={t} data={data} open={open} />
      case 'settings': return <Settings t={t} lang={lang} setLang={setLang} data={data} open={open} />
    }
  })()

  const modalEl = (() => {
    if (!modal) return null
    const base = { t, onClose: closeModal, onSaved: saved }
    const detail = { ...base, data, open, version, go: (p: string) => go(p as Page) }
    switch (modal.kind) {
      case 'sale':
      case 'purchase': return <TradeForm {...base} kind={modal.kind} data={data} goTo={go} existing={modal.existing} />
      case 'payment': return <PaymentForm {...base} data={data} payment={modal.payment} preset={modal.preset} />
      case 'expense': return <ExpenseForm {...base} expense={modal.expense} />
      case 'production': return <ProductionForm {...base} data={data} goProducts={() => go('settings')} production={modal.production} />
      case 'saleDetail': return <SaleDetailView key={modal.id} {...detail} id={modal.id} />
      case 'purchaseDetail': return <PurchaseDetailView key={modal.id} {...detail} id={modal.id} />
      case 'paymentDetail': return <PaymentDetailView key={modal.id} {...detail} id={modal.id} />
      case 'productionDetail': return <ProductionDetailView key={modal.id} {...detail} id={modal.id} />
      case 'expenseDetail': return <ExpenseDetailView key={modal.id} {...detail} id={modal.id} />
      case 'itemDetail': return <ItemDetailView key={modal.id} {...detail} id={modal.id} />
      case 'customerDetail': return <PersonDetailView key={modal.id} {...detail} kind="customer" id={modal.id} />
      case 'supplierDetail': return <PersonDetailView key={modal.id} {...detail} kind="supplier" id={modal.id} />
      case 'summary': return <SummaryView key={modal.which} {...detail} which={modal.which} />
      case 'item': return <ItemForm {...base} item={modal.item} data={data} />
      case 'packaging': return <PackagingForm {...base} unit={modal.unit} itemId={modal.itemId} data={data} />
      case 'customer':
      case 'supplier': return <PersonForm {...base} kind={modal.kind} person={modal.person} />
    }
  })()

  return (
    <div className="min-h-screen bg-[#f4f7f4] text-[#17221e] selection:bg-[#cfe8d5] selection:text-[#17472a]" style={{ fontFamily: 'Noto Sans Ethiopic, sans-serif' }}>
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-[#dfe9e1] bg-white/95 p-5 shadow-[8px_0_30px_rgba(28,67,43,0.04)] lg:flex print:hidden">
        <Brand t={t} />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map(([id, I]) => (
            <button key={id} onClick={() => go(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${page === id ? 'bg-[#e5f2e8] font-bold text-[#21633b]' : 'text-[#718078]'}`}>
              <I className="size-[18px]" />{t[id]}
            </button>
          ))}
        </nav>
      </aside>

      <main className="pb-8 lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dfe9e1] bg-[#f4f7f4]/90 px-4 shadow-[0_1px_12px_rgba(28,67,43,0.04)] backdrop-blur-xl lg:h-20 lg:px-10 print:hidden">
          <div className="flex items-center gap-3 lg:hidden"><Brand t={t} compact /></div>
          <span className="hidden text-sm text-[#708178] lg:block">{dateBoth(localDay())}</span>
          {/* Language is chosen in Settings */}
          <button aria-label={t.more} onClick={() => setMobileMenu(true)} className="rounded-xl border border-[#dfe9e1] bg-white p-2 text-[#21633b] lg:hidden"><Menu className="size-5" /></button>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-9">{pageEl}</div>
      </main>

      {mobileMenu && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-x-3 bottom-3 rounded-3xl border border-[#dfe9e1] bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <b className="text-base">{t.more}</b>
              <button aria-label={t.close} onClick={() => setMobileMenu(false)} className="rounded-xl p-2 text-[#718078]"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nav.map(([id, I]) => (
                <button key={id} onClick={() => go(id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold ${page === id ? 'border-[#b9d9c1] bg-[#e5f2e8] text-[#21633b]' : 'border-[#e5ebe6] text-[#52645a]'}`}>
                  <I className="size-4" />{t[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalEl}

      {toast && <div role="status" className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[#173c2b] px-5 py-3 text-sm text-white">{toast}</div>}
    </div>
  )
}

function Brand({ t, compact = false }: { t: { appName: string }; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo, no optimisation needed */}
      <img src="/logo.svg" alt={t.appName} width={40} height={40} className="size-10 shrink-0 rounded-[11px] shadow-[0_6px_14px_rgba(33,99,59,0.22)]" />
      {!compact && <div><b className="text-[15px] tracking-tight">መዝገብ</b><div className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#829189]">MEZGEB</div></div>}
    </div>
  )
}
