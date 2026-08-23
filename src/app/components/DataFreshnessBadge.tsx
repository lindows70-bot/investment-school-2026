'use client'
// 🕒 데이터 신선도 배지 — "이 숫자가 언제 것인가"를 화면이 스스로 밝힌다.
//   2026-08-23 교차검증에서 "부동산 값이 한 달 늦었다"는 지적이 나왔는데, 실측하니 앱은 원천 최신값을
//   정확히 쓰고 있었고 **원천 자체가 늦은 것**이었다. 화면이 기준월만 보여주고 "지금으로부터 얼마나 전인지"를
//   말하지 않아 생긴 오해다 — 지연을 숨기지 말고 정상/이상까지 판정해 보여준다.
//   판정은 lib/dataFreshness SSOT.
import { freshness, TYPICAL_LAG } from '@/lib/dataFreshness'
import { TK, FS, RAD } from '@/lib/theme'

const LEVEL = {
  fresh: { c: TK.green400, icon: '🟢' },
  normal: { c: TK.amber400, icon: '🟡' },
  stale: { c: TK.red400, icon: '🔴' },
} as const

export default function DataFreshnessBadge({ statKey, period, weekly, compact }: {
  /** TYPICAL_LAG 의 키 — 통상 지연·원천명이 거기서 온다(리터럴 금지) */
  statKey: keyof typeof TYPICAL_LAG
  /** 데이터 기준 시점 */
  period: string | null | undefined
  weekly?: boolean
  /** true 면 아이콘+기준월만(표 안에 넣을 때) */
  compact?: boolean
}) {
  if (!period) return null
  // 🛡️ 등록되지 않은 키가 오면(오타·새 지표 미등록) 배지를 접는다 — 화면 전체를 죽이지 않는다
  const t = TYPICAL_LAG[statKey]
  if (!t) return null
  const f = freshness({ period, typicalLagM: t.lagM, source: t.source, weekly })
  const L = LEVEL[f.level]

  return (
    <span
      title={`${f.why}\n출처: ${t.source}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: `${L.c}14`, border: `1px solid ${L.c}44`, borderRadius: RAD.pill,
        padding: compact ? '1px 7px' : '2px 9px',
        // 🔠 배지는 작게 만들고 싶어지지만, 이 앱의 상시 요구는 "설명 글자를 또렷하게"다.
        //    micro(9.5) 로는 '2026-06 기준 · 2개월 전'이 읽히지 않아 배지 자체가 무의미해진다.
        fontSize: compact ? FS.tiny : FS.body, color: L.c, whiteSpace: 'nowrap',
      }}>
      <span>{L.icon}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{f.badge}</b>
      {!compact && f.level === 'stale' && <span style={{ color: TK.red400 }}>· 확인 필요</span>}
    </span>
  )
}

/** 여러 배지를 한 줄에 + 왜 늦는지 한 문장. 카드 하단에 붙이는 용도 */
export function FreshnessRow({ items, note }: {
  items: { statKey: keyof typeof TYPICAL_LAG; period: string | null | undefined; label: string; weekly?: boolean }[]
  note?: string
}) {
  const shown = items.filter(i => i.period)
  if (!shown.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
      {shown.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: FS.body, color: TK.sub2 }}>{i.label}</span>
          <DataFreshnessBadge statKey={i.statKey} period={i.period} weekly={i.weekly} compact />
        </span>
      ))}
      {note && <span style={{ fontSize: FS.body, color: TK.sub2, lineHeight: 1.7, width: '100%', marginTop: 3 }}>{note}</span>}
    </div>
  )
}
