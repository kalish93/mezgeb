/**
 * Seed script – populates the DB with the same data as lib/mock-data.ts.
 * Run: npm run seed  (from the server/ directory)
 */
import { pool } from '../src/db'
import dotenv from 'dotenv'

dotenv.config()

async function seed() {
  const client = await pool.connect()
  console.log('🌱 Seeding database...\n')

  try {
    await client.query('BEGIN')

    // ─── Clear existing data ───────────────────────────────────────
    await client.query(`
      TRUNCATE production_outputs, productions, payment_allocations, payments,
               sale_items, sales, purchase_items, purchases,
               expenses, customers, suppliers, products
      RESTART IDENTITY CASCADE
    `)

    // ─── Products ──────────────────────────────────────────────────
    const products = [
      { id: 'raw-20', name_am: 'ትልቅ ጥሬ ኮን 20ኪ.ግ', name_en: 'Raw Cone 20kg', type: 'raw', weight_grams: 20000, size: '20 kg', unit: 'ኮን', stock: 18, price: 4200, reorder: 8 },
      { id: 'raw-10', name_am: 'ትልቅ ጥሬ ኮን 10ኪ.ግ', name_en: 'Raw Cone 10kg', type: 'raw', weight_grams: 10000, size: '10 kg', unit: 'ኮን', stock: 11, price: 2200, reorder: 6 },
      { id: 'fin-500', name_am: 'ክር ኮን 500ግ', name_en: 'Thread Cone 500g', type: 'finished', weight_grams: 500, size: '500 g', unit: 'ኮን', stock: 96, price: 185, reorder: 40 },
      { id: 'fin-250', name_am: 'ክር ኮን 250ግ', name_en: 'Thread Cone 250g', type: 'finished', weight_grams: 250, size: '250 g', unit: 'ኮን', stock: 138, price: 98, reorder: 50 },
      { id: 'fin-100', name_am: 'ክር ኮን 100ግ', name_en: 'Thread Cone 100g', type: 'finished', weight_grams: 100, size: '100 g', unit: 'ኮን', stock: 224, price: 45, reorder: 80 },
    ]
    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, p.name_am, p.name_en, p.type, p.weight_grams, p.size, p.unit, p.stock, p.price, p.reorder]
      )
    }
    console.log(`  ✅ Products (${products.length})`)

    // ─── Customers ─────────────────────────────────────────────────
    const customers = [
      { id: 'c1', name: 'ሰላም ጨርቃ ጨርቅ', phone: '+251 911 234 567', address: 'መርካቶ ፣ አዲስ አበባ', note: '' },
      { id: 'c2', name: 'ዮሴፍ አልባሳት', phone: '0912 345 678', address: 'ፒያሳ ፣ አዲስ አበባ', note: '' },
      { id: 'c3', name: 'ማህበረ ስፌት', phone: '+251 922 456 789', address: 'ቦሌ ፣ አዲስ አበባ', note: '' },
    ]
    for (const c of customers) {
      await client.query(
        `INSERT INTO customers (id, name, phone, address, note) VALUES ($1,$2,$3,$4,$5)`,
        [c.id, c.name, c.phone, c.address, c.note]
      )
    }
    console.log(`  ✅ Customers (${customers.length})`)

    // ─── Suppliers ─────────────────────────────────────────────────
    const suppliers = [
      { id: 's1', name: 'አበበ ክር አቅራቢ', phone: '+251 911 888 222', address: 'መርካቶ ፣ አዲስ አበባ' },
      { id: 's2', name: 'ኢትዮ ቴክስ አስመጪ', phone: '0911 700 500', address: 'ቃሊቲ ፣ አዲስ አበባ' },
    ]
    for (const s of suppliers) {
      await client.query(
        `INSERT INTO suppliers (id, name, phone, address) VALUES ($1,$2,$3,$4)`,
        [s.id, s.name, s.phone, s.address]
      )
    }
    console.log(`  ✅ Suppliers (${suppliers.length})`)

    // ─── Sales ─────────────────────────────────────────────────────
    const sales = [
      { id: 'SAL-1042', date: '2026-10-20', customerId: 'c1', discount: 100, note: 'የጥቅምት ትዕዛዝ',
        items: [{ productId: 'fin-500', quantity: 30, price: 185 }, { productId: 'fin-250', quantity: 20, price: 98 }] },
      { id: 'SAL-1041', date: '2026-10-18', customerId: 'c2', discount: 0, note: '',
        items: [{ productId: 'fin-100', quantity: 60, price: 45 }] },
      { id: 'SAL-1040', date: '2026-10-16', customerId: 'c3', discount: 0, note: 'ቀሪ ክፍያ በኋላ',
        items: [{ productId: 'fin-500', quantity: 20, price: 185 }] },
    ]
    for (const s of sales) {
      await client.query(
        `INSERT INTO sales (id, date, customer_id, discount, note) VALUES ($1,$2,$3,$4,$5)`,
        [s.id, s.date, s.customerId, s.discount, s.note]
      )
      for (const item of s.items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ($1,$2,$3,$4)`,
          [s.id, item.productId, item.quantity, item.price]
        )
      }
    }
    console.log(`  ✅ Sales (${sales.length})`)

    // ─── Purchases ─────────────────────────────────────────────────
    const purchases = [
      { id: 'PUR-208', date: '2026-10-15', supplierId: 's1', note: 'የጥሬ እቃ ግዢ',
        items: [{ productId: 'raw-20', quantity: 10, price: 4200 }] },
      { id: 'PUR-207', date: '2026-10-10', supplierId: 's2', note: '',
        items: [{ productId: 'raw-10', quantity: 8, price: 2200 }] },
    ]
    for (const p of purchases) {
      await client.query(
        `INSERT INTO purchases (id, date, supplier_id, note) VALUES ($1,$2,$3,$4)`,
        [p.id, p.date, p.supplierId, p.note]
      )
      for (const item of p.items) {
        await client.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, price) VALUES ($1,$2,$3,$4)`,
          [p.id, item.productId, item.quantity, item.price]
        )
      }
    }
    console.log(`  ✅ Purchases (${purchases.length})`)

    // ─── Payments ──────────────────────────────────────────────────
    const payments = [
      { id: 'PAY-301', date: '2026-10-19', kind: 'customer', personId: 'c1', amount: 1500, note: 'በባንክ',
        allocations: [{ transactionId: 'SAL-1042', amount: 1500 }] },
      { id: 'PAY-302', date: '2026-10-17', kind: 'supplier', personId: 's1', amount: 5000, note: 'በእጅ',
        allocations: [{ transactionId: 'PUR-208', amount: 5000 }] },
      // initial payments embedded in sales
      { id: 'PAY-INIT-1042', date: '2026-10-20', kind: 'customer', personId: 'c1', amount: 3000, note: 'initial',
        allocations: [{ transactionId: 'SAL-1042', amount: 3000 }] },
      { id: 'PAY-INIT-1041', date: '2026-10-18', kind: 'customer', personId: 'c2', amount: 2700, note: 'initial',
        allocations: [{ transactionId: 'SAL-1041', amount: 2700 }] },
      { id: 'PAY-INIT-1040', date: '2026-10-16', kind: 'customer', personId: 'c3', amount: 1000, note: 'initial',
        allocations: [{ transactionId: 'SAL-1040', amount: 1000 }] },
      { id: 'PAY-INIT-208', date: '2026-10-15', kind: 'supplier', personId: 's1', amount: 30000, note: 'initial',
        allocations: [{ transactionId: 'PUR-208', amount: 30000 }] },
      { id: 'PAY-INIT-207', date: '2026-10-10', kind: 'supplier', personId: 's2', amount: 17600, note: 'initial',
        allocations: [{ transactionId: 'PUR-207', amount: 17600 }] },
    ]
    for (const p of payments) {
      await client.query(
        `INSERT INTO payments (id, date, kind, person_id, amount, note) VALUES ($1,$2,$3,$4,$5,$6)`,
        [p.id, p.date, p.kind, p.personId, p.amount, p.note]
      )
      for (const a of p.allocations) {
        await client.query(
          `INSERT INTO payment_allocations (payment_id, transaction_id, amount) VALUES ($1,$2,$3)`,
          [p.id, a.transactionId, a.amount]
        )
      }
    }
    console.log(`  ✅ Payments (${payments.length})`)

    // ─── Expenses ──────────────────────────────────────────────────
    const expenses = [
      { id: 'EXP-81', date: '2026-10-20', category: 'transport', description: 'የጭነት መጓጓዣ', amount: 850, note: '' },
      { id: 'EXP-80', date: '2026-10-14', category: 'utility', description: 'የመብራት ክፍያ', amount: 1200, note: '' },
      { id: 'EXP-79', date: '2026-10-05', category: 'other', description: 'የማሸጊያ እቃ', amount: 540, note: '' },
    ]
    for (const e of expenses) {
      await client.query(
        `INSERT INTO expenses (id, date, category, description, amount, note) VALUES ($1,$2,$3,$4,$5,$6)`,
        [e.id, e.date, e.category, e.description, e.amount, e.note]
      )
    }
    console.log(`  ✅ Expenses (${expenses.length})`)

    // ─── Production ────────────────────────────────────────────────
    await client.query(
      `INSERT INTO productions (id, date, raw_product_id, raw_quantity, input_grams, waste_grams, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['PRD-44', '2026-10-18', 'raw-20', 1, 20000, 1000, 'መደበኛ ምርት']
    )
    const prodOutputs = [
      { productId: 'fin-500', quantity: 32, grams: 16000 },
      { productId: 'fin-250', quantity: 12, grams: 3000 },
    ]
    for (const o of prodOutputs) {
      await client.query(
        `INSERT INTO production_outputs (production_id, product_id, quantity, grams) VALUES ($1,$2,$3,$4)`,
        ['PRD-44', o.productId, o.quantity, o.grams]
      )
    }
    console.log('  ✅ Productions (1)')

    await client.query('COMMIT')
    console.log('\n✨ Seed complete!\n')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
