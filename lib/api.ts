/**
 * Typed API client for Cone Ledger backend (Next.js built-in API routes).
 * Uses a relative /api base so it works on any deployment without config.
 * Override with NEXT_PUBLIC_API_URL if you ever need an absolute URL.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Types (mirrors mock-data.ts) ────────────────────────────────
export type Product = {
  id: string; name_am: string; name_en: string; type: 'raw' | 'finished'
  weight_grams: number; size: string; unit: string; stock: number; price: number; reorder: number
}

export type Customer = {
  id: string; name: string; phone: string; address: string; note: string
  balance_due?: number
}

export type Supplier = {
  id: string; name: string; phone: string; address: string
  balance_due?: number
}

export type SaleItem = { productId: string; quantity: number; price: number }
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

export type ProductionOutput = { productId: string; quantity: number; grams: number }
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
export const createProduct = (data: Omit<Product, 'id'> & { id?: string }) =>
  apiFetch<Product>('/products', { method: 'POST', body: JSON.stringify(data) })
export const updateProduct = (id: string, data: Partial<Product>) =>
  apiFetch<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProduct = (id: string) =>
  apiFetch<{ deleted: string }>(`/products/${id}`, { method: 'DELETE' })

// ─── Customers ───────────────────────────────────────────────────
export const getCustomers = () => apiFetch<Customer[]>('/customers')
export const getCustomer = (id: string) => apiFetch<Customer>(`/customers/${id}`)
export const createCustomer = (data: Omit<Customer, 'id' | 'balance_due'> & { id?: string }) =>
  apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) })
export const updateCustomer = (id: string, data: Partial<Customer>) =>
  apiFetch<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCustomer = (id: string) =>
  apiFetch<{ deleted: string }>(`/customers/${id}`, { method: 'DELETE' })

// ─── Suppliers ───────────────────────────────────────────────────
export const getSuppliers = () => apiFetch<Supplier[]>('/suppliers')
export const getSupplier = (id: string) => apiFetch<Supplier>(`/suppliers/${id}`)
export const createSupplier = (data: Omit<Supplier, 'id' | 'balance_due'> & { id?: string }) =>
  apiFetch<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) })
export const updateSupplier = (id: string, data: Partial<Supplier>) =>
  apiFetch<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSupplier = (id: string) =>
  apiFetch<{ deleted: string }>(`/suppliers/${id}`, { method: 'DELETE' })

// ─── Sales ───────────────────────────────────────────────────────
export const getSales = (params?: { customerId?: string; status?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString()
  return apiFetch<Sale[]>(`/sales${qs ? `?${qs}` : ''}`)
}
export const getSale = (id: string) => apiFetch<Sale>(`/sales/${id}`)
export const createSale = (data: {
  date: string; customerId: string; items: SaleItem[]
  discount?: number; paid?: number; note?: string
}) => apiFetch<{ id: string }>('/sales', { method: 'POST', body: JSON.stringify(data) })

// ─── Purchases ───────────────────────────────────────────────────
export const getPurchases = (params?: { supplierId?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString()
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
  date: string; rawProductId: string; rawQuantity: number
  inputGrams: number; outputs: ProductionOutput[]; wasteGrams?: number; note?: string
}) => apiFetch<{ id: string }>('/production', { method: 'POST', body: JSON.stringify(data) })
