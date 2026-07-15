import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SidebarLayout from '@/app/components/Layout/SidebarLayout'
import IdleTimer from '@/app/components/IdleTimer'
import { TK } from '@/lib/theme'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: '2026 투자학교', template: '%s · 2026 투자학교' },
  description: '투자학교 포트폴리오 관리 · 피터 린치 6대 분류 · 수익률 분석',
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
}

export const viewport: Viewport = { themeColor: '#080B11' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0a', color: TK.slate100 }}>
        <SidebarLayout>
          {children}
        </SidebarLayout>
        <IdleTimer />
      </body>
    </html>
  )
}
