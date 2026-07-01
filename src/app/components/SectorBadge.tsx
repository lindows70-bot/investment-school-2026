'use client'
// GICS 섹터 배지 — 리밸런싱·퀀트빌더 추천/탈락 종목 옆에 붙여 어느 섹터인지 한눈에(🏛️GICS 섹터 탭과 동일 아이콘)
import { sectorMeta } from '@/lib/gicsSectorMeta'

export default function SectorBadge({ sector, size = 'sm' }: { sector: string | null | undefined; size?: 'sm' | 'xs' }) {
  const m = sectorMeta(sector)
  if (!m) return null
  const fontSize = size === 'xs' ? 9 : 10.5
  return (
    <span title={`GICS 섹터: ${m.ko}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 5, padding: size === 'xs' ? '0px 5px' : '1px 7px',
      fontSize, fontWeight: 700, whiteSpace: 'nowrap',
      background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55`,
    }}>
      {m.icon}{m.ko}
    </span>
  )
}
