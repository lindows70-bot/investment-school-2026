'use client'
// 학생 홈 바로가기 4칸 — 배당·실적 일정 · 거장 · 코인 랩 · 부동산(기존 분석 화면으로 연다)
import Link from 'next/link'
import { Bitcoin, Building2, CalendarDays, Crown } from 'lucide-react'
import { TK, FS, RAD, SP } from '@/lib/theme'

// 경로는 phase2-plan '캔버스와 달라지는 것' 표 그대로 — 배당·실적 일정은 /assets 의 일정 패널 한 곳
const ITEMS = [
  { href: '/assets', label: '배당·실적 일정', Icon: CalendarDays },
  { href: '/guru-portfolio', label: '거장', Icon: Crown },
  { href: '/dashboard?tab=coinlab&cv=btc', label: '코인 랩', Icon: Bitcoin },
  { href: '/real-estate', label: '부동산', Icon: Building2 },
]

export default function Shortcuts() {
  return (
    <nav aria-label="바로가기" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: SP.sm }}>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.xs, minHeight: 72, padding: `${SP.sm}px ${SP.xs}px`, borderRadius: RAD.md, background: TK.card, border: `1px solid ${TK.border}`, color: TK.slate200, fontSize: FS.tiny, textAlign: 'center', textDecoration: 'none', wordBreak: 'keep-all', minWidth: 0 }}>
          <Icon size={22} color={TK.sky400} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
