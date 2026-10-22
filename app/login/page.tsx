'use client'
import { useState } from 'react'

// Shown until the app password is entered on this device (see lib/auth.ts and proxy.ts).
export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null)
    if (res?.ok) { window.location.href = '/'; return }
    const code = res ? (await res.json().catch(() => ({}))).error : 'OFFLINE'
    setError(
      code === 'NO_PASSWORD_SET' ? 'የይለፍ ቃል በሰርቨሩ ላይ አልተዘጋጀም። · No password is set on the server (APP_PASSWORD).'
        : code === 'OFFLINE' ? 'ኢንተርኔት የለም። · No connection.'
        : 'የይለፍ ቃሉ ትክክል አይደለም። · Wrong password.',
    )
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7f4] p-4 text-[#17221e]" style={{ fontFamily: 'Noto Sans Ethiopic, sans-serif' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-[24px] border border-[#dfe9e1] bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,67,43,0.045)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
        <img src="/logo.svg" alt="" width={72} height={72} className="mx-auto size-[72px]" />
        <h1 className="mt-4 text-2xl font-bold">መዝገብ</h1>
        <p className="mt-1 text-sm text-[#77867d]">ለመግባት የይለፍ ቃሉን ያስገቡ</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="የይለፍ ቃል · Password"
          placeholder="የይለፍ ቃል"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-6 h-12 w-full rounded-xl border px-4 text-center text-lg"
        />
        {error && <p role="alert" className="mt-3 text-sm text-[#a54542]">{error}</p>}
        <button type="submit" disabled={busy || !password} className="mt-5 h-12 w-full rounded-xl bg-[#21633b] text-base font-semibold text-white disabled:opacity-60">
          {busy ? '…' : 'ግባ · Sign in'}
        </button>
      </form>
    </div>
  )
}
