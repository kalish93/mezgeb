/**
 * Idempotent product seeder: the four products, their RAW_CONE (kg) and FINISHED_PRODUCT (TUBA)
 * stock rows, and their packaging conversions — from db/seeds/products.json.
 *
 *   pnpm db:seed            (uses DATABASE_URL / .env.local)
 *
 * Only inserts what is missing. It never deletes rows, never changes stock, prices, history
 * or conversions that already exist, and matches existing products by code, then by name.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const seedFile = new URL('../db/seeds/products.json', import.meta.url)
export const seedData = () => JSON.parse(readFileSync(seedFile, 'utf8'))

/** Base units per selling unit for one product row of the seed table. */
export function conversionsFor(p) {
  const perPacket = p.tubaPerPacket
  const perMadaberiya = p.tubaPerPacket * p.packetsPerMadaberiya
  const perPiece = p.tubaPerPiece
  for (const [name, v] of [['tubaPerPacket', perPacket], ['packetsPerMadaberiya', p.packetsPerMadaberiya], ['tubaPerPiece', perPiece]]) {
    if (!(Number.isFinite(v) && v > 0)) throw new Error(`${p.code}: ${name} must be > 0`)
  }
  return { MADABERIYA_TIDOSH: perMadaberiya, PACKET: perPacket, PIECE: perPiece }
}

/**
 * Finds the existing product for a seed row without creating duplicates.
 * Migration 004 gave every older stock row its own item, so a raw "መነን" and a finished "መነን"
 * arrive as two un-coded items. Different forms with the same name are one product → merge them.
 * Two rows of the SAME form with the same name are ambiguous → return null (caller skips + warns).
 */
async function reconcileByName(client, p, log) {
  const candidates = (await client.query(
    `SELECT i.id, array_remove(array_agg(pr.type), NULL) AS forms
       FROM items i LEFT JOIN products pr ON pr.item_id = i.id
      WHERE i.code IS NULL AND i.name_am = $1
      GROUP BY i.id, i.created_at ORDER BY i.created_at, i.id`,
    [p.name_am],
  )).rows
  if (!candidates.length) return undefined
  const forms = candidates.flatMap((c) => c.forms)
  if (new Set(forms).size !== forms.length) {
    log(`  ⚠ ${p.code}: several existing "${p.name_am}" rows of the same kind — skipped, reconcile manually (see README)`)
    return null
  }
  const [primary, ...others] = candidates
  for (const o of others) {
    await client.query('UPDATE products SET item_id = $1 WHERE item_id = $2', [primary.id, o.id])
    await client.query('UPDATE packaging_units SET item_id = $1 WHERE item_id = $2', [primary.id, o.id])
    await client.query('DELETE FROM items WHERE id = $1', [o.id]) // now empty: its stock rows moved to primary
  }
  await client.query('UPDATE items SET code = $1 WHERE id = $2', [p.code, primary.id])
  log(`  ↺ ${p.code}: matched existing "${p.name_am}" by name${others.length ? ` (merged ${candidates.length} rows into one product)` : ''}`)
  return { id: primary.id }
}

export async function seedProducts(client, log = console.log) {
  const { units, products } = seedData()
  await client.query('BEGIN')
  try {
    for (const p of products) {
      // 1. find the item: by code, else un-coded item(s) with the same name (reconcile, don't duplicate)
      let item = (await client.query('SELECT id FROM items WHERE code = $1', [p.code])).rows[0]
      if (!item) {
        const matched = await reconcileByName(client, p, log)
        if (matched === null) continue
        item = matched
      }
      if (!item) {
        item = (await client.query(
          `INSERT INTO items (id, code, name_am, name_en) VALUES ($1, $2, $3, $4) RETURNING id`,
          [`itm-${p.code.toLowerCase()}`, p.code, p.name_am, p.name_en],
        )).rows[0]
        log(`  + ${p.code}: created`)
      }

      // 2. stock rows: raw cone in kg (bought), finished product in TUBA (sold). Zero stock, no price.
      const forms = [
        { type: 'raw', unit: 'ኪ.ግ', can_buy: true, can_sell: false, prefix: 'raw' },
        { type: 'finished', unit: 'ቱባ', can_buy: false, can_sell: true, prefix: 'fin' },
      ]
      for (const f of forms) {
        const r = await client.query(
          `INSERT INTO products (id, item_id, name_am, name_en, type, weight_grams, size, unit, stock, price, reorder, can_buy, can_sell, buy_price)
           SELECT $1, $2, $3, $4, $5, 0, '', $6, 0, 0, 0, $7, $8, 0
           WHERE NOT EXISTS (SELECT 1 FROM products WHERE item_id = $2 AND type = $5)`,
          [`${f.prefix}-${p.code.toLowerCase()}`, item.id, p.name_am, p.name_en, f.type, f.unit, f.can_buy, f.can_sell],
        )
        if (r.rowCount) log(`  + ${p.code}: ${f.type === 'raw' ? 'RAW_CONE (kg)' : 'FINISHED_PRODUCT (TUBA)'} stock row`)
      }

      // 3. packaging (in TUBA): only if the finished stock really is counted in TUBA.
      //    An older row counted in another unit (e.g. ኮን) would be converted wrongly — leave it for manual reconciliation.
      const fin = (await client.query(`SELECT unit FROM products WHERE item_id = $1 AND type = 'finished'`, [item.id])).rows[0]
      if (fin && fin.unit !== 'ቱባ') {
        log(`  ⚠ ${p.code}: finished stock is counted in "${fin.unit}", not ቱባ — packaging not added; reconcile manually (see README)`)
        continue
      }
      // add a unit only if the item has no active rule for it yet (edits are kept)
      for (const [code, factor] of Object.entries(conversionsFor(p))) {
        const r = await client.query(
          `INSERT INTO packaging_units (item_id, unit_code, base_per_unit, label_am, label_en, is_default)
           SELECT $1, $2, $3, $4, $5, $6
           WHERE NOT EXISTS (SELECT 1 FROM packaging_units WHERE item_id = $1 AND unit_code = $2 AND active)`,
          [item.id, code, factor, units[code].label_am, units[code].label_en, code === 'MADABERIYA_TIDOSH'],
        )
        if (r.rowCount) log(`  + ${p.code}: 1 ${units[code].label_en} = ${factor} TUBA`)
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  }
}

// Run directly: node scripts/seed-products.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f)
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (add it to .env.local or the environment).')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    console.log('Seeding products…')
    await seedProducts(client)
    console.log('✅ products seeded')
  } catch (err) {
    console.error('❌', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}
