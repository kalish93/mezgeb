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
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

export const pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }))

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

export const query = <T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> =>
  pool.query(text, params)
