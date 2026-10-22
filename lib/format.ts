/** Display helpers shared by the UI (money in ETB, Gregorian + Ethiopian dates). */

export const money = (value: number) =>
  `${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ብር`

/** Quantity / stock: whole numbers stay whole, kg shows up to 3 decimals (12.5). */
export const qty = (value: number) => (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })

const parse = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`)

export const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parse(value))

export const ethiopianDate = (value: string) =>
  new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', { day: 'numeric', month: 'long', year: 'numeric' }).format(parse(value))

export const dateBoth = (value: string) => `${ethiopianDate(value)} · ${date(value)}`

/** 'YYYY-MM-DD' in the device's local timezone (toISOString() would give the UTC day). */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ─── Ethiopian months ────────────────────────────────────────────
const ethParts = new Intl.DateTimeFormat('en-u-ca-ethiopic', { day: 'numeric', month: 'numeric', year: 'numeric' })
const ethDayMonth = (d: Date) => {
  const p = Object.fromEntries(ethParts.formatToParts(d).map((x) => [x.type, x.value]))
  return { day: Number(p.day), month: Number(p.month) }
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export type EthiopianMonth = { from: string; to: string; name_am: string; name_en: string }

/**
 * The Ethiopian calendar month containing `d`, as Gregorian 'YYYY-MM-DD' bounds (inclusive).
 * E.g. 22 Oct 2026 = 12 ጥቅምት 2019 → ጥቅምት = 11 Oct … 9 Nov 2026. Handles the 5/6-day ጳጉሜን.
 */
export function ethiopianMonth(d = new Date()): EthiopianMonth {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) // avoid DST edge cases
  const start = addDays(noon, 1 - ethDayMonth(noon).day)
  const month = ethDayMonth(start).month
  let end = start
  while (ethDayMonth(addDays(end, 1)).month === month) end = addDays(end, 1)
  return {
    from: localDay(start),
    to: localDay(end),
    name_am: new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', { month: 'long' }).format(start),
    name_en: new Intl.DateTimeFormat('en-u-ca-ethiopic', { month: 'long' }).format(start),
  }
}

/** The Ethiopian month before the one containing `d`. */
export const previousEthiopianMonth = (d = new Date()) => {
  const current = ethiopianMonth(d)
  return ethiopianMonth(addDays(new Date(`${current.from}T12:00:00`), -1))
}

export const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDay(d)
}
