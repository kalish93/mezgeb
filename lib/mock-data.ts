export type Language = 'am' | 'en'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type Product = { id: string; nameAm: string; nameEn: string; type: 'raw' | 'finished'; weightGrams: number; size: string; unit: string; stock: number; price: number; reorder: number }
export type Customer = { id: string; name: string; phone: string; address: string; note?: string }
export type Supplier = { id: string; name: string; phone: string; address: string }
export type Sale = { id: string; date: string; customerId: string; items: { productId: string; quantity: number; price: number }[]; discount: number; paid: number; note: string }
export type Purchase = { id: string; date: string; supplierId: string; items: { productId: string; quantity: number; price: number }[]; paid: number; note: string }
export type Payment = { id: string; date: string; kind: 'customer' | 'supplier'; personId: string; amount: number; allocations: { transactionId: string; amount: number }[]; note: string }
export type Expense = { id: string; date: string; category: string; description: string; amount: number; note?: string }
export type Production = { id: string; date: string; rawProductId: string; rawQuantity: number; inputGrams: number; outputs: { productId: string; quantity: number; grams: number }[]; wasteGrams: number; note: string }

export const products: Product[] = [
  { id: 'raw-20', nameAm: 'ትልቅ ጥሬ ኮን 20ኪ.ግ', nameEn: 'Raw Cone 20kg', type: 'raw', weightGrams: 20000, size: '20 kg', unit: 'ኮን', stock: 18, price: 4200, reorder: 8 },
  { id: 'raw-10', nameAm: 'ትልቅ ጥሬ ኮን 10ኪ.ግ', nameEn: 'Raw Cone 10kg', type: 'raw', weightGrams: 10000, size: '10 kg', unit: 'ኮን', stock: 11, price: 2200, reorder: 6 },
  { id: 'fin-500', nameAm: 'ክር ኮን 500ግ', nameEn: 'Thread Cone 500g', type: 'finished', weightGrams: 500, size: '500 g', unit: 'ኮን', stock: 96, price: 185, reorder: 40 },
  { id: 'fin-250', nameAm: 'ክር ኮን 250ግ', nameEn: 'Thread Cone 250g', type: 'finished', weightGrams: 250, size: '250 g', unit: 'ኮን', stock: 138, price: 98, reorder: 50 },
  { id: 'fin-100', nameAm: 'ክር ኮን 100ግ', nameEn: 'Thread Cone 100g', type: 'finished', weightGrams: 100, size: '100 g', unit: 'ኮን', stock: 224, price: 45, reorder: 80 },
]
export const customers: Customer[] = [
  { id: 'c1', name: 'ሰላም ጨርቃ ጨርቅ', phone: '+251 911 234 567', address: 'መርካቶ ፣ አዲስ አበባ' },
  { id: 'c2', name: 'ዮሴፍ አልባሳት', phone: '0912 345 678', address: 'ፒያሳ ፣ አዲስ አበባ' },
  { id: 'c3', name: 'ማህበረ ስፌት', phone: '+251 922 456 789', address: 'ቦሌ ፣ አዲስ አበባ' },
]
export const suppliers: Supplier[] = [
  { id: 's1', name: 'አበበ ክር አቅራቢ', phone: '+251 911 888 222', address: 'መርካቶ ፣ አዲስ አበባ' },
  { id: 's2', name: 'ኢትዮ ቴክስ አስመጪ', phone: '0911 700 500', address: 'ቃሊቲ ፣ አዲስ አበባ' },
]
export const sales: Sale[] = [
  { id: 'SAL-1042', date: '2026-10-20', customerId: 'c1', items: [{ productId: 'fin-500', quantity: 30, price: 185 }, { productId: 'fin-250', quantity: 20, price: 98 }], discount: 100, paid: 3000, note: 'የጥቅምት ትዕዛዝ' },
  { id: 'SAL-1041', date: '2026-10-18', customerId: 'c2', items: [{ productId: 'fin-100', quantity: 60, price: 45 }], discount: 0, paid: 2700, note: '' },
  { id: 'SAL-1040', date: '2026-10-16', customerId: 'c3', items: [{ productId: 'fin-500', quantity: 20, price: 185 }], discount: 0, paid: 1000, note: 'ቀሪ ክፍያ በኋላ' },
]
export const purchases: Purchase[] = [
  { id: 'PUR-208', date: '2026-10-15', supplierId: 's1', items: [{ productId: 'raw-20', quantity: 10, price: 4200 }], paid: 30000, note: 'የጥሬ እቃ ግዢ' },
  { id: 'PUR-207', date: '2026-10-10', supplierId: 's2', items: [{ productId: 'raw-10', quantity: 8, price: 2200 }], paid: 17600, note: '' },
]
export const payments: Payment[] = [
  { id: 'PAY-301', date: '2026-10-19', kind: 'customer', personId: 'c1', amount: 1500, allocations: [{ transactionId: 'SAL-1042', amount: 1500 }], note: 'በባንክ' },
  { id: 'PAY-302', date: '2026-10-17', kind: 'supplier', personId: 's1', amount: 5000, allocations: [{ transactionId: 'PUR-208', amount: 5000 }], note: 'በእጅ' },
]
export const expenses: Expense[] = [
  { id: 'EXP-81', date: '2026-10-20', category: 'transport', description: 'የጭነት መጓጓዣ', amount: 850 },
  { id: 'EXP-80', date: '2026-10-14', category: 'utility', description: 'የመብራት ክፍያ', amount: 1200 },
  { id: 'EXP-79', date: '2026-10-05', category: 'other', description: 'የማሸጊያ እቃ', amount: 540 },
]
export const productions: Production[] = [{ id: 'PRD-44', date: '2026-10-18', rawProductId: 'raw-20', rawQuantity: 1, inputGrams: 20000, outputs: [{ productId: 'fin-500', quantity: 32, grams: 16000 }, { productId: 'fin-250', quantity: 12, grams: 3000 }], wasteGrams: 1000, note: 'መደበኛ ምርት' }]
export const money = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ብር`
export const date = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
export const ethiopianDate = (value: string) => new Intl.DateTimeFormat('en-u-ca-ethiopic', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
export const dateBoth = (value: string) => `${date(value)} · ${ethiopianDate(value)}`
export const product = (id: string) => products.find((item) => item.id === id)!
export const customer = (id: string) => customers.find((item) => item.id === id)!
export const supplier = (id: string) => suppliers.find((item) => item.id === id)!
export const saleTotal = (sale: Sale) => sale.items.reduce((sum, item) => sum + item.quantity * item.price, 0) - sale.discount
export const purchaseTotal = (purchase: Purchase) => purchase.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
export const salePaid = (id: string) => sales.find((sale) => sale.id === id)!.paid + payments.filter((p) => p.kind === 'customer').flatMap((p) => p.allocations).filter((a) => a.transactionId === id).reduce((sum, a) => sum + a.amount, 0)
export const purchasePaid = (id: string) => purchases.find((purchase) => purchase.id === id)!.paid + payments.filter((p) => p.kind === 'supplier').flatMap((p) => p.allocations).filter((a) => a.transactionId === id).reduce((sum, a) => sum + a.amount, 0)
export const statusFor = (total: number, paid: number): PaymentStatus => paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
