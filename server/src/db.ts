import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://cone_user:cone_pass@localhost:5432/cone_ledger'

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

export const query = <T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> =>
  pool.query(text, params)
