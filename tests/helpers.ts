import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { seedProducts } from '../scripts/seed-products.mjs'

export { pool }

/** Wipes the test database and seeds the four products (reset.sql + seeder, as an operator would). */
export async function resetDb() {
  const client = await pool.connect()
  try {
    await client.query(readFileSync(path.resolve(__dirname, '../db/reset.sql'), 'utf8'))
    await seedProducts(client, () => {})
  } finally {
    client.release()
  }
}

export const request = (method: string, body?: unknown) =>
  new NextRequest('http://test.local/api', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })

export const ctx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) })

export async function json(res: Response) {
  return { status: res.status, body: await res.json() }
}

export const one = async <T = any>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0] as T
export const stockOf = async (id: string) => Number((await one('SELECT stock FROM products WHERE id = $1', [id])).stock)

/** Seeded stock-row ids: raw-menen / fin-menen, raw-pc / fin-pc, … */
export const RAW = (code: string) => `raw-${code.toLowerCase()}`
export const FIN = (code: string) => `fin-${code.toLowerCase()}`

export async function addCustomer(id = 'c-test') {
  await pool.query(`INSERT INTO customers (id, name) VALUES ($1, 'Test customer')`, [id])
  return id
}
export async function addSupplier(id = 's-test') {
  await pool.query(`INSERT INTO suppliers (id, name) VALUES ($1, 'Test supplier')`, [id])
  return id
}
