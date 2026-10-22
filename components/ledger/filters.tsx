'use client'
import { useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { daysAgo, ethiopianMonth, localDay } from '@/lib/format'
import { Btn, Card, Chips, DateInput } from './ui'
import type { T } from './i18n'

export type DatePreset = 'all' | 'today' | 'month' | '7' | '30' | 'custom' // month = current Ethiopian month
export type DateRange = { preset: DatePreset; from: string; to: string }
export const anyDate: DateRange = { preset: 'all', from: '', to: '' }

/** Resolves a preset to concrete [from, to] bounds ('' = open-ended). */
export function bounds(r: DateRange): [string, string] {
  switch (r.preset) {
    case 'today': return [localDay(), localDay()]
    case 'month': { const m = ethiopianMonth(); return [m.from, m.to] }
    case '7': return [daysAgo(6), localDay()]
    case '30': return [daysAgo(29), localDay()]
    case 'custom': return [r.from, r.to]
    default: return ['', '']
  }
}

export const inRange = (date: string, r: DateRange) => {
  const [from, to] = bounds(r)
  const d = date.slice(0, 10)
  return (!from || d >= from) && (!to || d <= to)
}

export function DateFilter({ t, value, onChange }: { t: T; value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <FilterRow label={t.date}>
      <Chips
        value={value.preset}
        onChange={(preset) => onChange({ ...value, preset, ...(preset === 'custom' && !value.from ? { from: daysAgo(29), to: localDay() } : {}) })}
        options={[['all', t.anyDate], ['today', t.today], ['month', t.thisMonth], ['7', t.last7], ['30', t.last30], ['custom', t.pickDates]]}
      />
      {value.preset === 'custom' && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[#77867d]">{t.from}<DateInput value={value.from} onChange={(from) => onChange({ ...value, from })} /></label>
          <label className="block text-xs font-semibold text-[#77867d]">{t.to}<DateInput value={value.to} onChange={(to) => onChange({ ...value, to })} /></label>
        </div>
      )}
    </FilterRow>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#8b978f]" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border bg-white pl-10 pr-3 text-sm"
      />
    </div>
  )
}

export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-[#77867d]">{label}</div>
      {children}
    </div>
  )
}

/**
 * Search box plus a "Filter" button; the filters themselves open in a card below.
 * `active` = how many filters are not at their default.
 */
export function FilterPanel({ t, search, active = 0, onClear, children }: {
  t: T; search?: ReactNode; active?: number; onClear?: () => void; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {search}
        <Btn variant="secondary" icon={SlidersHorizontal} onClick={() => setOpen(!open)} className={active ? 'border-[#b9d9c1] bg-[#e5f2e8] text-[#21633b]' : ''}>
          {t.filters}{active > 0 && ` (${active})`}
        </Btn>
        {active > 0 && onClear && <Btn variant="ghost" icon={X} onClick={onClear}>{t.clearFilters}</Btn>}
      </div>
      {open && <Card className="mt-3 flex flex-col gap-4 p-4">{children}</Card>}
    </div>
  )
}

/** Case-insensitive "contains" across several text fields. */
export const matches = (q: string, ...fields: (string | undefined | null)[]) => {
  const needle = q.trim().toLowerCase()
  return !needle || fields.some((f) => f?.toLowerCase().includes(needle))
}
