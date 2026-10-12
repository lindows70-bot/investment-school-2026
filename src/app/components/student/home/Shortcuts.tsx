'use client'
// 학생 홈 바로가기 — 둥근 아이콘 타일을 가로로 넘기는 한 줄(2026-10-12 사용자 "더리치 메인처럼"). 기록 · 시장 · 일정 · 거장 · 코인 · 부동산 · 브리핑 · 뉴스 · 저울
//   5단계(2026-09-28): 목적지는 전부 간편 화면(/s/…) — 분석 화면으로 새지 않는다(verify-simple-mode-exits 가 매일 센다)
//   폰에선 화면 가장자리까지 흘러 다음 타일이 살짝 보인다(.sh-bleed · page 의 CSS) — "더 있다"는 신호가 글 없이 전해진다
import Link from 'next/link'
import { Bitcoin, Building2, CalendarDays, ChartLine, Crown, Newspaper, PencilLine, Scale, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TK, FS, SP } from '@/lib/theme'

/** tint = 아이콘 색 — 기록만 역할색(amber400 · 기록 칩과 같은 뜻), 나머지는 틴트 blue400 */
const ITEMS: { href: string; label: string; Icon: LucideIcon; tint?: string }[] = [
  { href: '/s/record', label: '기록', Icon: PencilLine, tint: TK.amber400 },
  { href: '/s/market', label: '시장', Icon: ChartLine },
  { href: '/s/calendar', label: '일정', Icon: CalendarDays },
  { href: '/s/gurus', label: '거장', Icon: Crown },
  { href: '/s/coin', label: '코인', Icon: Bitcoin },
  { href: '/s/realestate', label: '부동산', Icon: Building2 },
  { href: '/s/brief', label: '브리핑', Icon: Sparkles },
  { href: '/s/news', label: '뉴스', Icon: Newspaper },
  { href: '/s/scale', label: '저울', Icon: Scale },
]

export default function Shortcuts() {
  return (
    <nav aria-label="바로가기" className="sh-row sh-bleed" style={{ gap: SP.sm }}>
      {ITEMS.map(({ href, label, Icon, tint = TK.blue400 }) => (
        <Link key={href} href={href} style={{ flex: '0 0 auto', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SP.xs, width: 68, minHeight: 44, textDecoration: 'none', color: TK.slate200, fontSize: FS.tiny, fontWeight: 600, textAlign: 'center', wordBreak: 'keep-all' }}>
          <span aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: TK.card, border: `1px solid ${TK.border}` }}>
            <Icon size={24} color={tint} />
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
