# Mezgeb — መዝገብ

Business ledger for a thread-cone business: sales, purchases, payments, production, expenses and stock, in Amharic and English. A single Next.js app (UI + API routes) on PostgreSQL, installable as an app (PWA), locked with one shared password.

## Deploying to Vercel

1. **Database.** Create a PostgreSQL database, e.g. Neon through Vercel → Storage, and copy its **pooled** connection string (it ends in `?sslmode=require`).
2. **Environment variables** (Vercel → Project → Settings → Environment Variables, for *Production*):
   - `DATABASE_URL`: the connection string above.
   - `APP_PASSWORD`: the password used to open the app. Without it the app stays locked.
3. **Deploy** (push to the connected Git repository, or `vercel --prod`). Every deploy applies the database migrations first (`pnpm build:deploy`). They are additive and safe to re-run, and the build stops if `DATABASE_URL` is missing.
4. **First time only:** add the four products and their packaging by running this from a computer with the production `DATABASE_URL`:
   ```bash
   DATABASE_URL="postgres://…" pnpm db:seed
   ```
   It only inserts what's missing and never changes existing data.
5. Open the site, sign in, and enter the prices and opening stock in **Settings**.

Preview deployments also run migrations against their own `DATABASE_URL`. Give them a separate database, or leave `DATABASE_URL` unset for Preview.

**Install it as an app:** Android/Chrome: ⋮ → "Install app". iPhone/Safari: Share → "Add to Home Screen". Computer (Chrome/Edge): the install icon in the address bar.

## Local development

```bash
docker compose up -d postgres   # Postgres on localhost:5433
cp .env.example .env.local      # DATABASE_URL for that database; APP_PASSWORD optional locally
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev                        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Applies every file in `db/migrations/` (additive, safe to re-run) |
| `pnpm db:seed` | Adds the four products and their packaging if missing (`db/seeds/products.json`) |
| `pnpm db:reset` | **Deletes all data**, keeping the tables. Local development only |
| `pnpm test` | Unit + integration tests, run against a separate `mezgeb_test` database on the docker-compose server |

## How it works

**Products and stock.** A product (`items`) has one name and up to two stock balances (`products`): **raw cone** counted in **kg** (bought) and **finished product** counted in **ቱባ** (produced, sold). Raw and finished stock never mix.

**Packaging** (`packaging_units`). Each product's selling units are stored as ቱባ per unit: ማዳበሪያ/ትዶሽ (the default selling unit), ፓኬት and ፍሬ. A unit can have its own price. Packet / piece / Madaberiya amounts shown for stock are calculated, not stored.

| Product | ቱባ / packet | Packets / Madaberiya | ቱባ / piece | ቱባ / Madaberiya |
|---|---:|---:|---:|---:|
| መነን | 30 | 20 | 4 | 600 |
| ፒሲ | 20 | 20 | 4 | 400 |
| ጥቁር ፒሲ | 20 | 20 | 4 | 400 |
| ኮተን | 20 | 10 | 4 | 200 |

**Flows** (each one runs as a single database transaction):
- **Purchase:** raw cone in kg at a price per kg, added to raw stock.
- **Production:** raw kg used (must be in stock) becomes the counted output in any unit, converted to ቱባ. Waste is optional.
- **Sale:** finished products in a chosen unit. Each line stores the unit, factor, price and ቱባ deducted, so later changes never alter old sales. Sales are never blocked by stock: stock may go negative until a late purchase or production is recorded.
- **Edit / delete:** the old stock effect is reversed and the new one applied. Deleting a sale or purchase also deletes the payments made only for it. Every stock change is kept in `inventory_movements`.
- **Balances:** a person's balance is total sold/bought minus total paid. A new payment is applied to the oldest unpaid bills.

**Code map.** `app/api/*` route handlers · `lib/ledger.ts` (sale / purchase / production / payment logic) · `lib/stock.ts` · `lib/packaging.ts` · `lib/auth.ts` + `proxy.ts` (password lock) · `components/ledger/*` (UI) · `db/migrations/*` · `scripts/` (migrate, seed).

**PWA.** `app/manifest.ts`, `public/logo.svg` (PNG icons in `public/icons/`), `public/sw.js`. The service worker caches only app files and the offline page, never `/api` data.

## Existing data from before the product/packaging migration (004)

Older stock rows each became their own product. `pnpm db:seed` merges a raw and a finished row with the same name for the four products. Rows it cannot classify safely (two of the same kind, or finished stock not counted in ቱባ) are skipped with a warning; fix those by hand, then run the seeder again.
