/**
 * PostgreSQL connection pool (Neon-compatible via standard pg driver).
 *
 * Uses a global singleton so that Next.js hot-reloads in dev don't
 * create a new pool on every module re-evaluation.
 *
 * In production Vercel + Neon, set DATABASE_URL to the *pooled*
 * connection string from the Neon / Vercel integration dashboard
 * (the one ending in "-pooler.neon.tech") so PgBouncer handles
 * connection limits for you.
 */
import { Pool, types, type QueryResultRow } from 'pg'

// NUMERIC → number (pg returns strings by default; amounts here fit safely in a double)
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v))
// DATE → 'YYYY-MM-DD' string (pg's default Date object shifts by the server's timezone)
types.setTypeParser(types.builtins.DATE, (v) => v)

// Local docker-compose database, used only outside production when DATABASE_URL is unset
const DEV_DATABASE_URL = 'postgresql://cone_user:cone_pass@localhost:5433/cone_ledger'

const connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === 'production' ? undefined : DEV_DATABASE_URL)

if (!connectionString && process.env.NEXT_PHASE !== 'phase-production-build') {
  console.error('DATABASE_URL is not set – database queries will fail.')
}

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

export const pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }))

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

export const query = <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> =>
  pool.query<T>(text, params)
