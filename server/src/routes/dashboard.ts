import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../db'

const router = Router()

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Total sales value
    const salesResult = await query<{ total: string }>(`
      SELECT COALESCE(SUM(si.quantity * si.price) - SUM(s.discount), 0) AS total
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
    `)

    // Customer debt = sum of (sale_total - paid_for_that_sale)
    const customerDebtResult = await query<{ debt: string }>(`
      SELECT COALESCE(SUM(GREATEST(0,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
        - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                    JOIN payments p ON p.id = pa.payment_id
                    WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
      )), 0) AS debt
      FROM sales s
    `)

    // Supplier debt = sum of (purchase_total - paid_for_that_purchase)
    const supplierDebtResult = await query<{ debt: string }>(`
      SELECT COALESCE(SUM(GREATEST(0,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM purchase_items WHERE purchase_id = p.id)
        - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                    JOIN payments py ON py.id = pa.payment_id
                    WHERE pa.transaction_id = p.id AND py.kind = 'supplier'), 0)
      )), 0) AS debt
      FROM purchases p
    `)

    // Stock value = sum of (stock * price) for all products
    const stockResult = await query<{ value: string }>(`
      SELECT COALESCE(SUM(stock * price), 0) AS value FROM products
    `)

    // Recent sales (last 7)
    const recentSalesResult = await query(`
      SELECT s.id, s.date, s.customer_id, c.name AS customer_name,
             COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      GROUP BY s.id, c.name
      ORDER BY s.date DESC, s.created_at DESC
      LIMIT 7
    `)

    // Unpaid invoices (customer, top 5 by debt)
    const unpaidResult = await query(`
      SELECT s.id, c.name AS customer_name,
        GREATEST(0,
          (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
          - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                      JOIN payments p ON p.id = pa.payment_id
                      WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
        ) AS owed
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      HAVING GREATEST(0,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
        - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                    JOIN payments p ON p.id = pa.payment_id
                    WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
      ) > 0
      ORDER BY owed DESC
      LIMIT 5
    `)

    res.json({
      totalSales: parseFloat(salesResult.rows[0]?.total ?? '0'),
      customerDebt: parseFloat(customerDebtResult.rows[0]?.debt ?? '0'),
      supplierDebt: parseFloat(supplierDebtResult.rows[0]?.debt ?? '0'),
      stockValue: parseFloat(stockResult.rows[0]?.value ?? '0'),
      recentSales: recentSalesResult.rows,
      unpaidInvoices: unpaidResult.rows,
    })
  } catch (err) {
    next(err)
  }
})

export default router
