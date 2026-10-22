/**
 * Creates the test database if needed and applies every migration to it, exactly as
 * `pnpm db:migrate` does. Each test file then resets data through tests/helpers.ts.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { TEST_DATABASE_URL } from '../vitest.config'

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL)
  const dbName = url.pathname.slice(1)
  if (!/^[a-z0-9_]*test[a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to run tests against "${dbName}": the test database name must contain "test".`)
  }

  // Connect to the server's default database to create the test one
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() })
  await admin.connect()
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (!exists.rowCount) await admin.query(`CREATE DATABASE ${dbName}`)
  await admin.end()

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  const dir = path.resolve(__dirname, '../db/migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(path.join(dir, file), 'utf8'))
  }
  await client.end()
}
