import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VBetreut · ERP',
  description: 'Internes ERP für 24h-Betreuungsagentur',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
