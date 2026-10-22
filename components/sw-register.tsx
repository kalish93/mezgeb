'use client'
import { useEffect } from 'react'

/**
 * Registers the service worker (public/sw.js) in production only. In development it would
 * serve stale code during hot reload, so any earlier registration is removed instead.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service worker registration failed:', err))
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
    }
  }, [])
  return null
}
