# Mezgeb (መዝገብ): project guide

Ledger app for a family thread-cone business. The main user is an **older person** reading **Amharic**. A single Next.js 16 app (UI + API route handlers) on PostgreSQL, installable as a PWA, behind one shared password. Live at **https://mezgeb-seven.vercel.app** (Vercel + Neon, created through Vercel's Neon integration).

## Business rules (don't change without asking)
- **Product identity vs stock form.** `items` = product (name, optional `code`). `products` = one stock balance per item per form: `type='raw'` = **RAW_CONE in kg** (bought), `type='finished'` = **FINISHED_PRODUCT in ቱባ (TUBA)** (produced, sold). Unique (item_id, type), so raw and finished never mix.
- **Packaging** (`packaging_units`): MADABERIYA_TIDOSH (default selling unit; Madaberiya and Tidosh are treated as **one** unit), PACKET, PIECE, each stored as "ቱባ per unit" with an optional price **per that unit**. Prices are never derived from another unit. Seed values are in `db/seeds/products.json`: Menen 30/packet ×20, PC & Black PC 20 ×20, Cotton 20 ×10, piece = 4 ቱባ.
- **Purchases** are entered in **kg** with a price per kg. **Production**: the kg actually used (must be in stock) plus the output actually counted, in any unit, converted to ቱባ; waste is entered by hand and yield is never assumed. **Sales**: finished products only, in a chosen unit; each line stores unit, factor, price and `base_quantity`, so history never changes.
- **Sales never check stock**: finished stock may go negative (purchases are sometimes recorded late). Production *does* check raw stock.
- **Edit = reverse the old stock effect, then apply the new one.** Deleting a sale or purchase deletes the payments made *only* for it. Every stock change goes to `inventory_movements`.
- **Balances** = total sold/bought − total paid (`CUSTOMER_BALANCE_SQL`/`SUPPLIER_BALANCE_SQL` in `lib/ledger.ts`). Payments without explicit allocations are applied FIFO to the oldest unpaid bills.
- **Dashboard sales card** = the current **Ethiopian** month (`ethiopianMonth()` in `lib/format.ts`) with last month for comparison. Stock value: raw at its buy price (else the latest purchase price), finished at price per ቱባ (else the default unit's price ÷ factor, else the latest sale); negative stock counts as 0 (`UNIT_VALUE_SQL` in `lib/stock.ts`).
- Money: amounts are NUMERIC in Postgres; JS only displays them or rounds to whole cents.

## UI conventions (from the user's feedback)
- Keep the **original compact style**: shadcn-style buttons, `h-11` inputs, green `#21633b`, cards `rounded-[20px]`. **No** big buttons or large text, **no bottom nav bar**. Mobile uses the header menu button, which opens a grid sheet.
- **No technical details in the UI**: no record IDs (SAL-…), product codes, "PostgreSQL", or base-unit jargon.
- Forms only *record*. Products and packaging are created in **Settings**; customers/suppliers on their own pages. **No inline "create new" inside sale/purchase forms.**
- All text lives in `components/ledger/i18n.ts` (Amharic first; `en` must have the same keys, which the type enforces). Dates show Ethiopian + Gregorian (`dateBoth`).
- Any row or card opens a detail view (`components/ledger/details.tsx`). Sheets stack (`stack` in `ledger-app.tsx`); a save pops one sheet and bumps `version` so open details reload.

## Code map
- `app/api/*`: route handlers. **Route files may only export HTTP handlers / `runtime`.** Shared code goes in `lib/` (Next build rejects other exports).
- `lib/ledger.ts`: sale/purchase/production/payment write logic, schemas, balance SQL. `lib/stock.ts`: stock rows, `setStock`, unit value. `lib/packaging.ts`: conversion helpers. `lib/http.ts`: `HttpError` + constraint → error code (translated in UI via `err_*` keys). `lib/auth.ts` + `proxy.ts`: password lock (Next 16 calls middleware "proxy"). `lib/db.ts`: pg pool; NUMERIC parsed to number, DATE kept as a string.
- `components/ledger/`: `forms.tsx`, `pages.tsx`, `details.tsx`, `filters.tsx`, `ui.tsx`, `i18n.ts`. Shell: `components/ledger-app.tsx`.
- `db/migrations/00N_*.sql`: additive and **must stay re-runnable** (IF NOT EXISTS, guarded DO blocks). `db/seeds/products.json` + `scripts/seed-products.mjs`: idempotent seeder (matches by code, then by name; merges raw+finished rows with the same name). `scripts/run-sql.mjs`: runs SQL files or a directory.
- PWA: `app/manifest.ts`, `public/logo.svg` (cross-wound cone + gold thread), `public/icons/*` (rendered from the SVG), `public/sw.js` (never caches `/api`; bump `VERSION` if caching changes), `public/offline.html`.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`. pnpm isn't installed globally here: use `npx -y pnpm@12.3.4 …` (version pinned in `packageManager`). Keep `pnpm-lock.yaml` in sync (Vercel installs with the frozen lockfile).
- `pnpm test`: Vitest, unit + integration. Integration tests call route handlers directly against the **`mezgeb_test`** database (created automatically; refuses names without "test"). Needs the docker Postgres.
- `pnpm db:migrate`, `pnpm db:seed` (safe), `pnpm db:reset` (**deletes all data**, local only).
- Deploy: Vercel runs `pnpm build:deploy` (migrations, then `next build`; fails if `DATABASE_URL` is missing). Env vars: `DATABASE_URL` (pooled Neon), `APP_PASSWORD`. Locally both are in `.env.local` (git-ignored).

## Local environment
- Windows. Postgres in docker: container `cone_ledger_db`, host port **5433** (a native PostgreSQL 18 service occupies 5432). DSN: `postgresql://cone_user:cone_pass@localhost:5433/cone_ledger`.
- The app is usually run as a production build on **port 3100**: `next build`, then `next start -p 3100`. Always stop the old process on 3100 first; stopping the background task can leave the node child alive.
- **The local `cone_ledger` database has the user's real records.** Never create or delete data there for testing; use `mezgeb_test` or read-only browser checks.
- Shell pitfalls: avoid `node -e` / `sed` with backticks, `${}` or `\b` inside bash double quotes (they get mangled). Write a script file or use the Edit tool instead. Browser checks use `puppeteer-core` with Edge at `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` (installed in the session scratchpad, not the repo). Headless Edge's minimum viewport is ~500px; use puppeteer `setViewport` for phone width.
