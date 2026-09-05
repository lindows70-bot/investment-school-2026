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
      {/* 개념 설명 — 학생이 처음 봐도 '떨리는 손'이 뭔지 알게(2026-08-20 사용자: 더 또렷하게·의미 보강) */}
      <div style={{ fontSize: FS.tiny, color: TK.sub13, marginTop: 5, lineHeight: 1.7 }}>
        <b style={{ color: TK.red300 }}>떨리는 손</b> = 폭락이 오면 겁에 질려 <b style={{ color: TK.slate200 }}>바닥에서 파는 손</b> ·{' '}
        <b style={{ color: TK.green300 }}>단단한 손</b> = 미리 준비한 돈으로 <b style={{ color: TK.slate200 }}>그때 사 모으는 손</b>.
        폭락 때 돈은 사라지는 게 아니라 <b style={{ color: TK.slate200 }}>떨리는 손에서 단단한 손으로 옮겨갑니다</b>(코스톨라니).
        어느 손이 될지는 배짱이 아니라 <b style={{ color: TK.slate200 }}>아래 세 가지 준비물</b>이 정해요 — 셋 다 지금부터 채울 수 있습니다.
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
              {/* ⚠️ 판정 근거와 처방은 **설명 문장**이다 — FS.micro(각주 크기)로 쓰지 않는다(사용자 상설 규칙).
                  색은 그대로 둔다(⛔ 회색 또 밝히기 금지 — 대비는 이미 WCAG AA 통과, 문제는 크기였다). */}
              <div style={{ fontSize: FS.tiny, color: TK.sub13, lineHeight: 1.55, marginTop: 4 }}>{a.detail}</div>
              {a.fix && (
                <div style={{ fontSize: FS.tiny, color: TK.sky400, lineHeight: 1.5, marginTop: 4 }}>→ {a.fix}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 국면 × 실탄 → 지금 할 일 */}
      <div style={{ marginTop: SP.md, background: TK.slate900, borderLeft: `3px solid ${gc}`, borderRadius: RAD.sm, padding: `${SP.sm}px ${SP.md}px`, fontSize: FS.tiny, color: TK.slate200, lineHeight: 1.6 }}>
        <b style={{ color: gc }}>지금 국면에서 할 일</b> — {d.action}
      </div>

      {/* 읽는 법 + 캐비엇 — micro·흐린 색이라 학생이 안 읽고 지나쳤다(2026-08-20) → tiny·밝게, 문장을 갈라서 */}
      <div style={{ marginTop: SP.sm, background: TK.bg3, borderRadius: RAD.sm, padding: `${SP.sm}px ${SP.md}px`, fontSize: FS.tiny, color: TK.sub13, lineHeight: 1.75 }}>
        <b style={{ color: TK.slate200 }}>💡 이 점검을 읽는 법</b>
        <div>· <b style={{ color: TK.slate200 }}>💰 여유 자금</b> — 폭락이 세일이 되려면 <b style={{ color: TK.slate200 }}>살 돈</b>이 남아 있어야 해요. 다 들어가 있으면 세일 날 구경만 합니다.</div>
        <div>· <b style={{ color: TK.slate200 }}>🧠 산 이유</b> — 살 때의 근거가 적혀 있어야 폭락 때 <b style={{ color: TK.slate200 }}>&ldquo;이유가 사라졌나?&rdquo;로 판단</b>하고, 없으면 공포로 팝니다.</div>
        <div>· <b style={{ color: TK.slate200 }}>⏳ 보유 기간</b> — 하락을 견뎌본 시간이에요. 산 지 얼마 안 된 주식일수록 작은 흔들림에도 손이 먼저 나갑니다.</div>
        <div style={{ marginTop: 4, color: TK.sub3 }}>
          ⚠️ 이 카드는 <b style={{ color: TK.sub }}>매도·매수 지시가 아니라 내 준비 상태 점검</b>입니다 — 부족한 축을 지금부터 채우라는 뜻이지, 뭘 팔라는 뜻이 아닙니다.
          판정은 기존 지표(현금 포지션·매수 근거 기록·보유일)를 합친 것이고 새로 지어낸 점수가 아니에요.
          국면 온도(달걀 모델)는 <b style={{ color: TK.sub }}>지나고 나서야 정답을 아는 지표</b>라 바닥·꼭대기를 맞히는 도구가 아닙니다.
        </div>
      </div>
    </div>
  )
}
