import type { MetadataRoute } from 'next'

// Web app manifest (served at /manifest.webmanifest and linked automatically by Next.js):
// lets Mezgeb be installed to the home screen / desktop and open full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'መዝገብ — Mezgeb',
    short_name: 'መዝገብ',
    description: 'የክር ኮን ንግድ መዝገብ — ሽያጭ፣ ግዢ፣ ክፍያ እና እቃ ክምችት',
    lang: 'am',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f4f7f4',
    theme_color: '#21633b',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
