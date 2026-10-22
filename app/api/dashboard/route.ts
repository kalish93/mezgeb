import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { errorResponse } from '@/lib/http'
import { CUSTOMER_BALANCE_SQL, SUPPLIER_BALANCE_SQL } from '@/lib/ledger'
import { UNIT_VALUE_SQL } from '@/lib/stock'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const [salesResult, customerDebtResult, supplierDebtResult, stockResult, recentSalesResult, unpaidResult] =
      await Promise.all([
        // Total sales value
        // (discount is per sale, so it must not be summed once per item row)
        query<{ total: string }>(`
          SELECT COALESCE(SUM(
            (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
          ), 0) AS total
          FROM sales s
        `),

        // Customer debt = sum of each customer's balance that is owed (credit of one doesn't cancel another's debt)
        query<{ debt: string }>(`
          SELECT COALESCE(SUM(GREATEST(0, ${CUSTOMER_BALANCE_SQL('c.id')})), 0) AS debt FROM customers c
        `),

        // Supplier debt = the same per supplier
        query<{ debt: string }>(`
          SELECT COALESCE(SUM(GREATEST(0, ${SUPPLIER_BALANCE_SQL('su.id')})), 0) AS debt FROM suppliers su
        `),

        // Stock value
        query<{ value: string }>(`
          SELECT COALESCE(SUM(GREATEST(p.stock, 0) * ${UNIT_VALUE_SQL('p')}), 0) AS value FROM products p
        `),

        // Recent sales (last 7)
        query(`
          SELECT s.id, s.date, s.customer_id, c.name AS customer_name,
                 COALESCE(SUM(si.quantity * si.price), 0) - s.discount AS total
          FROM sales s
          JOIN customers c ON c.id = s.customer_id
          LEFT JOIN sale_items si ON si.sale_id = s.id
          GROUP BY s.id, c.name
          ORDER BY s.date DESC, s.created_at DESC
          LIMIT 7
        `),

        // Unpaid invoices (top 5 by owed amount)
        query(`
          SELECT * FROM (
            SELECT s.id, c.name AS customer_name,
              GREATEST(0,
                (SELECT COALESCE(SUM(quantity * price), 0) FROM sale_items WHERE sale_id = s.id) - s.discount
                - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
                            JOIN payments p ON p.id = pa.payment_id
                            WHERE pa.transaction_id = s.id AND p.kind = 'customer'), 0)
              ) AS owed
            FROM sales s
            JOIN customers c ON c.id = s.customer_id
          ) t
          WHERE owed > 0
          ORDER BY owed DESC
          LIMIT 5
        `),
      ])

    return NextResponse.json({
      totalSales: parseFloat(salesResult.rows[0]?.total ?? '0'),
      customerDebt: parseFloat(customerDebtResult.rows[0]?.debt ?? '0'),
      supplierDebt: parseFloat(supplierDebtResult.rows[0]?.debt ?? '0'),
      stockValue: parseFloat(stockResult.rows[0]?.value ?? '0'),
      recentSales: recentSalesResult.rows,
      unpaidInvoices: unpaidResult.rows,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
