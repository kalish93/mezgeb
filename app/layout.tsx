import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegister } from '@/components/sw-register'
import './globals.css'

export const metadata: Metadata = {
  title: 'መዝገብ | Mezgeb',
  description: 'የኢትዮጵያ ክር ኮን ንግድ ዲጂታል መዝገብ',
  applicationName: 'መዝገብ',
  // the manifest itself comes from app/manifest.ts
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  // Installed on an iPhone / iPad: open full-screen with this name
  appleWebApp: { capable: true, title: 'መዝገብ', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  // The app has its own Amharic / English switch, so stop Chrome/Edge offering to translate every page
  other: { google: 'notranslate' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#21633b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="am" dir="ltr" translate="no">
      <body className="antialiased">
        {children}
        <ServiceWorkerRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
