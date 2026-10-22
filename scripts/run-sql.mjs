/**
 * Runs .sql files (or every .sql file in a directory, in name order) against DATABASE_URL.
 *   node scripts/run-sql.mjs db/migrations
 *   node scripts/run-sql.mjs db/seed.sql
 * Loads .env.local / .env when present (same files Next.js reads).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) process.loadEnvFile(f)
}

const files = process.argv.slice(2).flatMap((p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => f.endsWith('.sql')).sort().map((f) => join(p, f))
    : [p]
)
if (!files.length) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql | dir> [...]')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (add it to .env.local or the environment).')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  for (const file of files) {
    await client.query(readFileSync(file, 'utf8'))
    console.log(`✅ ${file}`)
  }
} catch (err) {
  console.error('❌', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
