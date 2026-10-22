/**
 * Mezgeb service worker.
 *
 * Caches only the app itself (code, icons, an offline page) — never business data:
 *   /api/*            → always the network (numbers can never be stale)
 *   pages             → network first; offline → /offline.html
 *   /_next/static/*   → cache first (file names contain a content hash, so they never change)
 *   icons / logo      → cache, refreshed in the background
 * Pages always come from the network, so every deploy is picked up on the next load.
 */
const VERSION = 'mezgeb-v1'
const STATIC = `${VERSION}-static`
const PRECACHE = ['/offline.html', '/logo.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/favicon-32.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // saves, edits and deletes always go straight to the server
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // business data: network only, never cached

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)) }
        return res
      }))
    )
    return
  }

  if (url.pathname.startsWith('/icons/') || url.pathname === '/logo.svg') {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fresh = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)) }
          return res
        }).catch(() => hit)
        return hit || fresh
      })
    )
  }
})
