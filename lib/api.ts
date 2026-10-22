/** Typed client for the app's own API routes (app/api/*), served from the same origin. */

const BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login' // signed out (or password changed): back to the login page
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error
    // Error codes / messages are strings; zod validation errors are objects — flatten those to text
    const fieldErrors = err && typeof err === 'object' ? Object.values({ ...err.fieldErrors }).flat().concat(err.formErrors ?? []) : []
    throw new Error(typeof err === 'string' ? err : fieldErrors.join(', ') || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Types (rows as returned by app/api/*) ───────────────────────
/** Product identity: one name and code, shared by its raw and finished stock. */
export type Item = { id: string; code: string | null; name_am: string; name_en: string; active: boolean }

/** One stock balance of an item: type 'raw' = RAW_CONE (kg), 'finished' = FINISHED_PRODUCT (TUBA). */
export type Product = {
  id: string; item_id: string; item_code: string | null; item_active: boolean
  form: 'RAW_CONE' | 'FINISHED_PRODUCT'
  name_am: string; name_en: string; type: 'raw' | 'finished'
  weight_grams: number; size: string; unit: string; stock: number
  price: number      // per ONE base unit (finished); packaging units carry their own prices
  buy_price: number  // per ONE base unit (kg for raw cone)
  reorder: number; can_buy: boolean; can_sell: boolean
  unit_value: number // value of one base unit for "stock value" (see lib/stock.ts UNIT_VALUE_SQL)
}

/** A selling unit of an item, in base units (TUBA). price is per ONE of this unit, null = not set. */
export type PackagingUnit = {
  id: number; item_id: string; item_name_am: string; item_code: string | null; base_unit: string | null
  unit_code: 'MADABERIYA_TIDOSH' | 'PACKET' | 'PIECE'; base_per_unit: number
  label_am: string; label_en: string; price: number | null; is_default: boolean; active: boolean
  updated_at: string
}

export type Customer = {
  id: string; name: string; phone: string; address: string; note: string
  balance_due?: number
}

export type Supplier = {
  id: string; name: string; phone: string; address: string
  balance_due?: number
}

/** quantity and price are in the selling unit; baseQuantity is what left stock. */
export type SaleItem = {
  productId: string; quantity: number; price: number
  unitCode?: string; unitLabel?: string; unitFactor?: number; baseQuantity?: number
}
export type Sale = {
  id: string; date: string; customer_id: string; customer_name: string
  discount: number; total: number; paid: number; note: string
  status: 'paid' | 'partial' | 'unpaid'; items: SaleItem[]
}

export type PurchaseItem = { productId: string; quantity: number; price: number }
export type Purchase = {
  id: string; date: string; supplier_id: string; supplier_name: string
  total: number; paid: number; note: string
  status: 'paid' | 'partial' | 'unpaid'; items: PurchaseItem[]
}

export type PaymentAllocation = { transactionId: string; amount: number }
export type Payment = {
  id: string; date: string; kind: 'customer' | 'supplier'
  person_id: string; amount: number; note: string; allocations: PaymentAllocation[]
}

export type Expense = {
  id: string; date: string; category: string; description: string; amount: number; note: string
}

/** quantity = base units added (TUBA); unitQuantity is what was entered, in unitCode. */
export type ProductionOutput = {
  productId: string; productName?: string; baseUnit?: string
  quantity: number; unitCode: string; unitFactor: number; unitQuantity: number
}
export type Production = {
  id: string; date: string; raw_product_id: string; raw_product_name: string
  raw_quantity: number; input_grams: number; waste_grams: number; note: string
  outputs: ProductionOutput[]
}

export type DashboardData = {
  totalSales: number; customerDebt: number; supplierDebt: number; stockValue: number
  recentSales: { id: string; date: string; customer_name: string; total: number }[]
  unpaidInvoices: { id: string; customer_name: string; owed: number }[]
}

// ─── Dashboard ───────────────────────────────────────────────────
export const getDashboard = () => apiFetch<DashboardData>('/dashboard')

// ─── Products ────────────────────────────────────────────────────
export const getProducts = () => apiFetch<Product[]>('/products')

// ─── Items (product identity + its inventory forms) ──────────────
export type RawFormInput = { buy_price: number; stock?: number; reorder: number }
export type FinishedFormInput = { unit: string; price: number; stock?: number; reorder: number; can_buy: boolean }
export type ItemInput = { code?: string | null; name_am: string; name_en: string; active?: boolean; raw?: RawFormInput; finished?: FinishedFormInput }
export const getItems = () => apiFetch<Item[]>('/items')
export const createItem = (data: ItemInput) => apiFetch<Item>('/items', { method: 'POST', body: JSON.stringify(data) })
export const updateItem = (id: string, data: Partial<ItemInput>) =>
  apiFetch<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ─── Packaging conversions ───────────────────────────────────────
export type PackagingInput = Pick<PackagingUnit, 'item_id' | 'unit_code' | 'base_per_unit' | 'label_am' | 'label_en' | 'price' | 'is_default'>
export const getPackaging = () => apiFetch<PackagingUnit[]>('/packaging')
export const createPackaging = (data: PackagingInput) =>
  apiFetch<PackagingUnit>('/packaging', { method: 'POST', body: JSON.stringify(data) })
export const updatePackaging = (id: number, data: Partial<Omit<PackagingInput, 'item_id' | 'unit_code'> & { active: boolean }>) =>
  apiFetch<PackagingUnit>(`/packaging/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ─── Customers ───────────────────────────────────────────────────
export const getCustomers = () => apiFetch<Customer[]>('/customers')
export const createCustomer = (data: Omit<Customer, 'id' | 'balance_due'> & { id?: string }) =>
  apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) })
export const updateCustomer = (id: string, data: Partial<Customer>) =>
  apiFetch<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCustomer = (id: string) =>
  apiFetch<{ deleted: string }>(`/customers/${id}`, { method: 'DELETE' })

// ─── Suppliers ───────────────────────────────────────────────────
export const getSuppliers = () => apiFetch<Supplier[]>('/suppliers')
export const createSupplier = (data: Omit<Supplier, 'id' | 'balance_due'> & { id?: string }) =>
  apiFetch<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) })
export const updateSupplier = (id: string, data: Partial<Supplier>) =>
  apiFetch<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSupplier = (id: string) =>
  apiFetch<{ deleted: string }>(`/suppliers/${id}`, { method: 'DELETE' })

// ─── Sales ───────────────────────────────────────────────────────
export const getSales = (params?: { customerId?: string; status?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams({ limit: '1000', ...(params ?? {}) }).toString()
  return apiFetch<Sale[]>(`/sales${qs ? `?${qs}` : ''}`)
}
export const createSale = (data: {
  date: string; customerId: string; items: SaleItem[]
  discount?: number; paid?: number; note?: string
}) => apiFetch<{ id: string }>('/sales', { method: 'POST', body: JSON.stringify(data) })

// ─── Purchases ───────────────────────────────────────────────────
export const getPurchases = (params?: { supplierId?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams({ limit: '1000', ...(params ?? {}) }).toString()
  return apiFetch<Purchase[]>(`/purchases${qs ? `?${qs}` : ''}`)
}
export const createPurchase = (data: {
  date: string; supplierId: string; items: PurchaseItem[]
  paid?: number; note?: string
}) => apiFetch<{ id: string }>('/purchases', { method: 'POST', body: JSON.stringify(data) })

// ─── Payments ────────────────────────────────────────────────────
export const getPayments = (params?: { kind?: 'customer' | 'supplier'; personId?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString()
  return apiFetch<Payment[]>(`/payments${qs ? `?${qs}` : ''}`)
}
export const createPayment = (data: {
  date: string; kind: 'customer' | 'supplier'; personId: string
  amount: number; allocations?: PaymentAllocation[]; note?: string
}) => apiFetch<{ id: string }>('/payments', { method: 'POST', body: JSON.stringify(data) })

// ─── Expenses ────────────────────────────────────────────────────
export const getExpenses = () => apiFetch<Expense[]>('/expenses')
export const createExpense = (data: Omit<Expense, 'id'> & { id?: string }) =>
  apiFetch<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) })

// ─── Production ──────────────────────────────────────────────────
export const getProductions = () => apiFetch<Production[]>('/production')
export const createProduction = (data: {
  date: string; rawProductId: string; rawKg: number
  outputs: { productId: string; unitCode: string; quantity: number }[]; wasteKg?: number; note?: string
}) => apiFetch<{ id: string }>('/production', { method: 'POST', body: JSON.stringify(data) })

// ─── Detail views, editing and deleting ──────────────────────────
/** A payment applied to one sale / purchase: `amount` is the part that went to it. */
export type AppliedPayment = { id: string; date: string; amount: number; payment_amount: number; note: string }
export type SaleDetail = Omit<Sale, 'items'> & {
  items: (SaleItem & { productName: string; baseUnit: string })[]
  payments: AppliedPayment[]
}
export type PurchaseDetail = Omit<Purchase, 'items'> & {
  items: (PurchaseItem & { productName: string; unit: string; form: Product['form'] })[]
  payments: AppliedPayment[]
}
export type PaymentDetail = Omit<Payment, 'allocations'> & {
  person_name: string | null
  allocations: (PaymentAllocation & { date: string | null })[]
}
type PersonTxn = { id: string; date: string; note: string; total: number; paid: number }
export type CustomerDetail = Customer & {
  sales: (PersonTxn & { discount: number; items: (SaleItem & { productName: string })[] })[]
  payments: Payment[]
}
export type SupplierDetail = Supplier & {
  purchases: (PersonTxn & { items: (PurchaseItem & { productName: string; unit: string })[] })[]
  payments: Payment[]
}
export type Movement = {
  id: number; product_id: string; form: Product['form']; delta: number; unit: string
  reason: 'purchase' | 'sale' | 'production_in' | 'production_out' | 'adjustment'
  ref_id: string | null; created_at: string; date: string | null; person_name: string | null
}
export type ItemDetail = Item & { stock: Product[]; packaging: PackagingUnit[]; movements: Movement[] }

type SaleInput = Parameters<typeof createSale>[0]
type PurchaseInput = Parameters<typeof createPurchase>[0]
type PaymentInput = Parameters<typeof createPayment>[0]
type ProductionInput = Parameters<typeof createProduction>[0]
const put = (path: string, data: unknown) => apiFetch<{ id: string }>(path, { method: 'PUT', body: JSON.stringify(data) })
const del = <T = { deleted: string }>(path: string) => apiFetch<T>(path, { method: 'DELETE' })

export const getCustomerDetail = (id: string) => apiFetch<CustomerDetail>(`/customers/${id}`)
export const getSupplierDetail = (id: string) => apiFetch<SupplierDetail>(`/suppliers/${id}`)

export const getSaleDetail = (id: string) => apiFetch<SaleDetail>(`/sales/${id}`)
export const updateSale = (id: string, data: SaleInput) => put(`/sales/${id}`, data)
export const deleteSale = (id: string) => del<{ deleted: string; paymentsDeleted: number }>(`/sales/${id}`)

export const getPurchaseDetail = (id: string) => apiFetch<PurchaseDetail>(`/purchases/${id}`)
export const updatePurchase = (id: string, data: PurchaseInput) => put(`/purchases/${id}`, data)
export const deletePurchase = (id: string) => del<{ deleted: string; paymentsDeleted: number }>(`/purchases/${id}`)

export const getPaymentDetail = (id: string) => apiFetch<PaymentDetail>(`/payments/${id}`)
export const updatePayment = (id: string, data: PaymentInput) => put(`/payments/${id}`, data)
export const deletePayment = (id: string) => del(`/payments/${id}`)

export const updateExpense = (id: string, data: Omit<Expense, 'id'>) => put(`/expenses/${id}`, data)
export const deleteExpense = (id: string) => del(`/expenses/${id}`)

export const getProductionDetail = (id: string) => apiFetch<Production>(`/production/${id}`)
export const updateProduction = (id: string, data: ProductionInput) => put(`/production/${id}`, data)
export const deleteProduction = (id: string) => del(`/production/${id}`)

export const getItemDetail = (id: string) => apiFetch<ItemDetail>(`/items/${id}`)
export const deleteItem = (id: string) => del(`/items/${id}`)
export const deletePackaging = (id: number) => del<{ deleted: number }>(`/packaging/${id}`)

// ─── Session ─────────────────────────────────────────────────────
export const signOut = async () => {
  await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
  window.location.href = '/login'
}
