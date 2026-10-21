import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { errorHandler, notFound } from './middleware/errorHandler'
import dashboardRouter from './routes/dashboard'
import productsRouter from './routes/products'
import customersRouter from './routes/customers'
import suppliersRouter from './routes/suppliers'
import salesRouter from './routes/sales'
import purchasesRouter from './routes/purchases'
import paymentsRouter from './routes/payments'
import expensesRouter from './routes/expenses'
import productionRouter from './routes/production'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())

// ─── Health check ─────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRouter)
app.use('/api/products', productsRouter)
app.use('/api/customers', customersRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/sales', salesRouter)
app.use('/api/purchases', purchasesRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/production', productionRouter)

// ─── 404 + Error handlers ─────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Cone Ledger API running at http://localhost:${PORT}`)
  console.log(`📋  Health: http://localhost:${PORT}/health\n`)
})

export default app
