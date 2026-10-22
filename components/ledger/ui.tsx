'use client'
/** Shared building blocks in the original Mezgeb style. */
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Phone, Trash2, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorText, type T } from './i18n'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export const primaryCls = 'bg-[#21633b] shadow-[0_6px_14px_rgba(33,99,59,0.18)] transition-all hover:bg-[#174d2c] active:scale-[0.98]'

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'default' | 'sm'
  icon?: LucideIcon
  disabled?: boolean
  full?: boolean
  className?: string
  ariaLabel?: string
}
export function Btn({ children, onClick, variant = 'primary', size = 'default', icon: I, disabled, full, className, ariaLabel }: BtnProps) {
  return (
    <Button
      type="button"
      size={size}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      variant={variant === 'secondary' || variant === 'danger' ? 'outline' : variant === 'ghost' ? 'ghost' : 'default'}
      className={cx(variant === 'primary' && primaryCls, variant === 'danger' && 'text-[#a54542]', full && 'w-full', className)}
    >
      {I && <I data-icon="inline-start" />}
      {children}
    </Button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-hidden rounded-[20px] border border-[#dfe9e1] bg-white shadow-[0_8px_24px_rgba(28,67,43,0.045)]', className)}>{children}</div>
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[25px] font-bold tracking-[-0.03em] sm:text-3xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#77867d] sm:text-sm">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-[#77867d]">{hint}</span>}
    </label>
  )
}

/** Like Field, but for a section holding several controls (a <label> must wrap only one). */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </div>
  )
}

const inputCls = 'mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal'

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: 'numeric' | 'decimal' | 'tel' | 'text'; ariaLabel?: string }) {
  return (
    <input
      type={props.type ?? 'text'}
      inputMode={props.inputMode}
      aria-label={props.ariaLabel}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={inputCls}
    />
  )
}

export function MoneyInput({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return <TextInput type="number" inputMode="decimal" value={value} onChange={onChange} placeholder="0" ariaLabel={ariaLabel} />
}

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
}

export function Select({ value, onChange, options, ariaLabel }: { value: string; onChange: (v: string) => void; options: [string, string][]; ariaLabel?: string }) {
  return (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

/** Quantity / stock input. `unit` is shown inside the box (e.g. ኪ.ግ); `decimal` allows 12.5. */
export function Stepper({ value, onChange, min = 0, label, unit, decimal }: {
  value: string; onChange: (v: string) => void; min?: number; label: string; unit?: string; decimal?: boolean
}) {
  return (
    <div className="relative">
      <input
        aria-label={label}
        type="number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        step={decimal ? 'any' : 1}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputCls, unit && 'pr-12')}
      />
      {unit && <span className="pointer-events-none absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs text-[#77867d]">{unit}</span>}
    </div>
  )
}

/** Row of small toggle pills — used by filters and small choices. */
export function Chips<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: [V, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx(
            'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
            value === v ? 'border-[#b9d9c1] bg-[#e5f2e8] text-[#21633b]' : 'border-[#e5ebe6] bg-white text-[#52645a] hover:border-[#b9d9c1]',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** Selectable card (radio / checkbox). */
export function ChoiceCard({ selected, onClick, title, hint, icon: I }: { selected: boolean; onClick: () => void; title: string; hint?: string; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition',
        selected ? 'border-[#b9d9c1] bg-[#e5f2e8]' : 'border-[#e5ebe6] bg-white hover:border-[#b9d9c1]',
      )}
    >
      <span className={cx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]', selected ? 'border-[#21633b] bg-[#21633b] text-white' : 'border-[#9aa89f]')}>
        {selected && '✓'}
      </span>
      {I && <I className="size-4 shrink-0 text-[#21633b]" aria-hidden />}
      <span>
        <b className="block">{title}</b>
        {hint && <span className="block text-xs text-[#77867d]">{hint}</span>}
      </span>
    </button>
  )
}

/** The original bottom-sheet / centered modal. */
export function Sheet({ title, onClose, children, footer, closeLabel }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; closeLabel: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-5 flex justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label={closeLabel} onClick={onClose}><X /></button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-6 flex gap-2">{footer}</div>
      </div>
    </div>
  )
}

export function SheetFooter({ t, onCancel, onSave, busy }: { t: T; onCancel: () => void; onSave: () => void; busy: boolean }) {
  return (
    <>
      <Btn variant="secondary" onClick={onCancel} className="flex-1">{t.cancel}</Btn>
      <Btn onClick={onSave} disabled={busy} className="flex-1">{busy ? t.saving : t.save}</Btn>
    </>
  )
}

export function Errors({ t, errors }: { t: T; errors: string[] }) {
  if (!errors.length) return null
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-[#fce9e8] p-3 text-sm text-[#a54542]">
      <b>{t.fixErrors}</b>
      <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  )
}

export function StatusPill({ status, t }: { status: 'paid' | 'partial' | 'unpaid'; t: T }) {
  return (
    <span className={cx(
      'w-fit rounded-full px-2 py-1 text-xs',
      status === 'paid' && 'bg-[#e5f2e8] text-[#287342]',
      status === 'partial' && 'bg-[#fff4dc] text-[#a66a00]',
      status === 'unpaid' && 'bg-[#fce9e8] text-[#a54542]',
    )}>
      {t[status]}
    </span>
  )
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 p-5">
      <p className="text-sm text-[#77867d]">{text}</p>
      {action}
    </div>
  )
}

/** Summary card; with `onClick` the whole card is a button that opens its details. */
export function Stat({ label, value, icon: I, tone = 'green', onClick, sub }: {
  label: string; value: string; icon: LucideIcon; tone?: 'green' | 'amber' | 'red' | 'blue'; onClick?: () => void
  sub?: string // small second line, e.g. last month for comparison
}) {
  const tones = { green: 'bg-[#e5f2e8] text-[#21633b]', amber: 'bg-[#fff4dc] text-[#a66a00]', red: 'bg-[#fce9e8] text-[#a54542]', blue: 'bg-[#e4f0f8] text-[#216182]' }
  const body = (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className={cx('flex size-10 items-center justify-center rounded-[14px]', tones[tone])}><I className="size-5" /></div>
        {onClick && <ChevronRight className="size-4 text-[#9aa89f]" aria-hidden />}
      </div>
      <div className="mt-4 text-lg font-bold">{value}</div>
      <div className="text-sm text-[#77867d]">{label}</div>
      {sub && <div className="mt-1 text-xs text-[#9aa89f]">{sub}</div>}
    </div>
  )
  return (
    <Card className={onClick ? 'transition hover:border-[#b9d9c1] hover:shadow-md' : undefined}>
      {onClick ? <button type="button" onClick={onClick} className="block w-full text-left">{body}</button> : body}
    </Card>
  )
}

export function CallLink({ phone, t }: { phone: string; t: T }) {
  if (!phone) return null
  return (
    <a href={`tel:${phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#21633b]">
      <Phone className="size-3.5" />{t.call}
    </a>
  )
}

/** Delete with an inline "are you sure?" step; shows the API's refusal (e.g. still in use) instead of closing. */
export function DeleteButton({ t, onConfirm, warning, label }: { t: T; onConfirm: () => Promise<void>; warning?: string; label?: string }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    setBusy(true); setError('')
    try { await onConfirm() } catch (e: any) { setError(errorText(t, e?.message ?? 'Error')); setAsking(false) } finally { setBusy(false) }
  }
  if (!asking) {
    return (
      <div className="flex flex-col gap-2">
        <Btn variant="danger" icon={Trash2} onClick={() => setAsking(true)}>{label ?? t.delete}</Btn>
        {error && <p role="alert" className="text-xs text-[#a54542]">{error}</p>}
      </div>
    )
  }
  return (
    <div role="alertdialog" className="flex w-full flex-col gap-2 rounded-xl border border-red-200 bg-[#fce9e8] p-3 text-sm text-[#a54542]">
      <b>{t.confirmDelete}</b>
      {warning && <span>{warning}</span>}
      <div className="flex gap-2">
        <Btn variant="secondary" size="sm" onClick={() => setAsking(false)}>{t.cancel}</Btn>
        <Btn variant="danger" size="sm" icon={Trash2} onClick={confirm} disabled={busy}>{t.yesDelete}</Btn>
      </div>
    </div>
  )
}

/** Label / value row used in detail views. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-[#77867d]">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

/** Clickable list row inside a detail view (opens another detail). */
export function LinkRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 border-t py-3 text-left text-sm first:border-0 hover:bg-[#f6f9f6]">
      {children}
      <ChevronRight className="size-4 shrink-0 text-[#9aa89f]" aria-hidden />
    </button>
  )
}

/** Summary line under a filtered list. */
export function ResultBar({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-[#52645a]">{children}</div>
}
