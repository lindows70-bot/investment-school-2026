'use client'
// 학생 홈 바로가기 4칸 — 일정 · 거장 · 코인 · 부동산
//   ⏳ 목적지는 아직 분석 화면 — phase5-plan 2·3단계에서 /s/calendar·/s/gurus·/s/coin·/s/realestate 로 바꾼다(verify-simple-mode-exits 임시 허용)
import Link from 'next/link'
import { Bitcoin, Building2, CalendarDays, Crown } from 'lucide-react'
import { TK, FS, RAD, SP } from '@/lib/theme'

// 5단계: 목적지는 전부 간편 화면(/s/…) — 분석 화면으로 새지 않는다(코인·부동산은 3단계에서 옮긴다)
const ITEMS = [
  { href: '/s/calendar', label: '일정', Icon: CalendarDays },
  { href: '/s/gurus', label: '거장', Icon: Crown },
  { href: '/dashboard?tab=coinlab&cv=btc', label: '코인', Icon: Bitcoin },
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
