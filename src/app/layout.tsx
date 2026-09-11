import type { Metadata, Viewport } from 'next'
import './globals.css'
import SidebarLayout from '@/app/components/Layout/SidebarLayout'
import IdleTimer from '@/app/components/IdleTimer'
import { TK, FONT_STACK } from '@/lib/theme'

// 🔤 한글 웹폰트 — Pretendard Variable (SIL OFL 1.1 · public/fonts/pretendard/LICENSE.txt)
//    왜 바꿨나: 예전엔 next/font/google 의 Inter 를 선언했는데 **한 번도 로드되지 않았다**
//    (2026-09-03 런타임 실측: document.fonts 에 `__Inter:unloaded`). 화면마다 인라인
//    fontFamily: '-apple-system,…,Segoe UI' 가 덮어써서 한국 학생은 전부 **맑은 고딕**으로 봤고,
//    Inter 는 애초에 라틴 전용이라 한글은 어차피 시스템 폰트가 그렸다.
//    → 한글·숫자를 한 벌로 그리는 Pretendard 로 바꾸고 인라인 스택을 걷어낸다.
//    ⚠️ 통짜 variable woff2 는 2,009KB 라 학생 모바일 첫 로드에 부담 → **dynamic-subset**(92조각,
//       조각당 31~37KB)을 쓴다. 브라우저가 unicode-range 로 **실제 쓰는 글자가 든 조각만** 받는다.
//    ⚠️ next/font/local 은 unicode-range 분할을 대신해 주지 않아 통짜만 가능하다 → 정적 CSS 로 넣는다.

export const metadata: Metadata = {
  title: { default: '2026 투자학교', template: '%s · 2026 투자학교' },
  description: '투자학교 포트폴리오 관리 · 피터 린치 6대 분류 · 수익률 분석',
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
}

// viewportFit cover 가 없으면 iOS 에서 env(safe-area-inset-bottom) 이 항상 0 — 하단 탭바 safe-area 패딩의 전제
export const viewport: Viewport = { themeColor: '#080B11', viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
      </head>
      <body style={{
        margin: 0, padding: 0, background: '#0a0a0a', color: TK.slate100,
        fontFamily: FONT_STACK,
        // 숫자가 표에서 자릿수마다 흔들리지 않게 — Pretendard 는 tabular 를 제대로 지원한다
        fontVariantNumeric: 'tabular-nums',
      }}>
        <SidebarLayout>
          {children}
        </SidebarLayout>
        <IdleTimer />
      </body>
    </html>
  )
}
