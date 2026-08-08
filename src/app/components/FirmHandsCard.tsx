'use client'
// 🤲 단단한 손 점검 카드 — 코스톨라니 3조건(돈·생각·인내)을 한자리에서 보고, 지금 국면에서 할 일까지.
//    판정은 lib/firmHands SSOT(결정론) · 현금은 /api/cash-position 원본을 그대로 읽는다(제2원칙).
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { computeFirmHands, type FirmHandsResult, type AxisLevel } from '@/lib/firmHands'
import type { CashPosition } from '@/lib/cashPosition'
import type { FirmHandsApi } from '@/app/api/firm-hands/route'

const CARD = '#12151f'
const LV: Record<AxisLevel, { c: string; mark: string; ko: string }> = {
  strong:  { c: TK.green400,  mark: '🟢', ko: '갖춤' },
  mid:     { c: TK.amber400,  mark: '🟡', ko: '보통' },
  weak:    { c: TK.red400,    mark: '🔴', ko: '부족' },
  unknown: { c: TK.sub2,      mark: '⚪', ko: '미확인' },
}
const GRADE_C: Record<FirmHandsResult['grade'], string> = {
  firm: TK.green400, mixed: TK.amber400, trembling: TK.red400, na: TK.sub2,
}

export default function FirmHandsCard() {
  const [d, setD] = useState<FirmHandsResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail' | 'unauth'>('loading')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [fhRes, cashRes] = await Promise.all([
          fetch('/api/firm-hands', { cache: 'no-store' }),
          fetch('/api/cash-position', { cache: 'no-store' }),
        ])
        if (!alive) return
        if (fhRes.status === 401) { setState('unauth'); setD(null); return }   // 실패/미로그인/빈값을 한 문구로 뭉치지 않는다
        if (!fhRes.ok) { setState('fail'); setD(null); return }
        const fh = await fhRes.json() as FirmHandsApi
        const cash = cashRes.ok ? await cashRes.json() as CashPosition & { needsSetup?: boolean } : null
        if (!alive) return
        setD(computeFirmHands({ cash: cash && !cash.needsSetup ? cash : null, snapshot: fh.snapshot, holding: fh.holding }))
        setState('ok')
      } catch { if (alive) { setState('fail'); setD(null) } }
    })()
    return () => { alive = false }
  }, [])

  if (state === 'loading') return <div style={{ height: 118, background: '#171b26', borderRadius: RAD.md, animation: 'pulse 1.5s infinite' }} />
  if (state === 'unauth') return null
  if (state === 'fail' || !d) {
    return <div style={{ background: CARD, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px`, fontSize: FS.tiny, color: TK.sub2 }}>
      🤲 단단한 손 점검을 불러오지 못했습니다 — 새로고침 해보세요
    </div>
  }

  const gc = GRADE_C[d.grade]
  return (
    <div style={{ background: `linear-gradient(135deg, ${gc}0f, ${CARD} 62%)`, border: `1px solid ${gc}44`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>{d.headline}</b>
        {d.temp != null && (
          <span title="막스 사이클 시계추의 탐욕 온도 — 코스톨라니의 달걀(바닥·상승·상투·하락)에서 지금 어디쯤인지"
            style={{ fontSize: FS.micro, fontWeight: 800, color: TK.violet300, background: `${TK.violet400}18`, border: `1px solid ${TK.violet400}44`, borderRadius: RAD.pill, padding: '2px 9px' }}>
            🕰️ {d.tempLabel} {d.temp}
          </span>
        )}
        {/* 분모는 '판정 가능한 축' — 현금 미등록을 '못 갖춤'으로 세면 억울한 낙인이 된다 */}
        <span style={{ marginLeft: 'auto', fontSize: FS.micro, color: TK.sub3 }}>
          {d.knownCount < 3 ? `판정 가능한 ${d.knownCount}조건 중 ${d.strongCount}개 갖춤` : `3조건 중 ${d.strongCount}개 갖춤`}
        </span>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: 3, lineHeight: 1.55 }}>
        폭락은 돈이 사라지는 게 아니라 <b style={{ color: TK.sub }}>떨리는 손에서 단단한 손으로 주식이 옮겨가는 과정</b>입니다 — 코스톨라니.
        단단한 손은 타고나는 게 아니라 <b style={{ color: TK.sub }}>미리 준비할 수 있는 세 가지 조건</b>이에요.
      </div>

      {/* 3축 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: SP.sm, marginTop: SP.md }}>
        {d.axes.map(a => {
          const lv = LV[a.level]
          return (
            <div key={a.key} style={{ background: TK.bg3, border: `1px solid ${lv.c}33`, borderRadius: RAD.sm, padding: `${SP.sm}px ${SP.md}px` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: FS.body }}>{a.icon}</span>
                <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>{a.label}</b>
                <b style={{ marginLeft: 'auto', fontSize: FS.tiny, color: lv.c, fontFamily: 'monospace' }}>{a.value}</b>
                <span style={{ fontSize: FS.micro, color: lv.c }}>{lv.mark}</span>
              </div>
              <div style={{ fontSize: FS.micro, color: TK.sub13, lineHeight: 1.55, marginTop: 4 }}>{a.detail}</div>
              {a.fix && (
                <div style={{ fontSize: FS.micro, color: TK.sky400, lineHeight: 1.5, marginTop: 4 }}>→ {a.fix}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 국면 × 실탄 → 지금 할 일 */}
      <div style={{ marginTop: SP.md, background: TK.slate900, borderLeft: `3px solid ${gc}`, borderRadius: RAD.sm, padding: `${SP.sm}px ${SP.md}px`, fontSize: FS.tiny, color: TK.slate200, lineHeight: 1.6 }}>
        <b style={{ color: gc }}>지금 국면에서 할 일</b> — {d.action}
      </div>

      <div style={{ fontSize: FS.micro, color: TK.sub4, marginTop: SP.sm, lineHeight: 1.55 }}>
        ⚠️ 매매 지시가 아니라 <b>내 자금의 상태 점검</b>입니다 · 판정은 기존 지표(현금 포지션·매수 근거 기록·보유일)를 합친 것이며 새로 지어낸 점수가 아닙니다 ·
        국면(달걀 모델)은 <b>지나고 나서야</b> 어디였는지 알 수 있습니다 — 바닥을 맞히는 도구가 아니에요
      </div>
    </div>
  )
}
