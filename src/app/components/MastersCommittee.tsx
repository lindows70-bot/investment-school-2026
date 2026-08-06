'use client'
// 🎩 거장 위원회 패널 — 버핏·멍거·단요핑·리루 4인의 독립 판정 → 교차 반박 → 강제 결론
// 판정은 서버 결정론(mastersCommittee SSOT), 이 컴포넌트는 표시만. 매수 관점 — 매도 지시 아님(캐비엇 고정).

import { useState, useEffect } from 'react'
import { TK, FS, SP, RAD } from '@/lib/theme'
import type { MastersVerdictResponse } from '@/app/api/masters-verdict/route'

const V_COLOR = { pass: TK.green400, gray: TK.amber400, fail: TK.red400 } as const
const V_LABEL = { pass: '통과', gray: '회색지대', fail: '불통과' } as const
const S_ICON = { pass: '✅', warn: '⚠️', fail: '❌' } as const

export default function MastersCommittee({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [data, setData] = useState<MastersVerdictResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    const run = async () => {
      setLoading(true); setFailed(false); setData(null)
      try {
        const r = await fetch(`/api/masters-verdict?ticker=${encodeURIComponent(ticker)}&market=${market === 'KR' ? 'KR' : 'US'}`, { cache: 'no-store' })
        const j = await r.json()
        if (!cancelled) {
          if (r.ok && j?.masters) { setData(j); setFailed(false) }
          else setFailed(true)
          setLoading(false)
        }
      } catch { if (!cancelled) { setFailed(true); setLoading(false) } }
    }
    run()
    return () => { cancelled = true }
  }, [ticker, market])

  const fmtP = (v: number) => data?.currency === 'KRW' ? `₩${Math.round(v).toLocaleString('ko-KR')}` : `$${v.toFixed(2)}`

  return (
    <div style={{ background: TK.bg8, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🎩 거장 위원회 — {name}</b>
        <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>
          버핏·멍거·단요핑·리루 — 4인 독립 판정 → 교차 반박 → 강제 결론 · 판정은 앱 데이터 기준 결정론(교육용 재현)
        </span>
      </div>

      {loading && <div style={{ color: TK.sub13, fontSize: FS.body, padding: SP.md }}>위원회 소집 중… (4인 판정 + 토론 생성, 최대 40초)</div>}
      {!loading && failed && <div style={{ color: TK.amber400, fontSize: FS.body, padding: SP.md }}>위원회 판정을 불러오지 못했습니다 — 잠시 후 다시 시도해 주세요.</div>}

      {!loading && data && (<>
        {/* ── 강제 결론 배너 ── */}
        <div style={{ marginTop: SP.md, background: `${V_COLOR[data.final]}14`, border: `1px solid ${V_COLOR[data.final]}55`, borderRadius: RAD.sm, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
            <b style={{ fontSize: FS.xl, color: V_COLOR[data.final] }}>
              {data.final === 'pass' ? '🟢' : data.final === 'gray' ? '🟡' : '🔴'} 위원회 {V_LABEL[data.final]}
            </b>
            <span style={{ fontSize: FS.tiny, color: TK.sub11 }}>{data.finalReason}</span>
          </div>
          {data.buyBand ? (
            <div style={{ fontSize: FS.body, color: TK.slate200, marginTop: 4 }}>
              💰 매수 고려 구간(안전마진 30~15%): <b style={{ fontFamily: 'monospace' }}>{fmtP(data.buyBand.low)} ~ {fmtP(data.buyBand.high)}</b>
              <span style={{ fontSize: FS.micro, color: TK.sub2 }}> · 내재가치 {fmtP(data.buyBand.fairValue)} (버핏식 보수 DCF — 성장률 35% 클램프라 성장주는 낮게 나올 수 있음)</span>
              {data.currentPrice != null && <span style={{ fontSize: FS.tiny, color: TK.sub11 }}> · 현재가 {fmtP(data.currentPrice)}</span>}
              {(data.buyBand.stretch ?? 0) > 2.5 && (
                <div style={{ fontSize: FS.micro, color: TK.amber400, marginTop: 3, lineHeight: 1.6 }}>
                  ⚠️ 내재가치가 현재가의 <b>{data.buyBand.stretch!.toFixed(1)}배</b>입니다 — 최근 성장률을 5년 복리로 외삽한 결과에 크게 기대고 있습니다.
                  성장이 꺾이면 이 구간도 함께 내려갑니다. <b>안전마진을 액면 그대로 믿지 마세요.</b>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: FS.tiny, color: TK.sub2, marginTop: 4 }}>💰 매수 가격 구간: 산정 보류 — {
              data.redlineHit ? '레드라인 상태에선 가격을 논하지 않는다'
              : data.unitSuspect ? '💱 통화 단위 불일치 의심(재무는 현지통화·주가는 달러로 보이는 해외 상장사) — 틀린 가격을 보여주느니 보류한다'
              : data.masters.some(m => m.checks.some(c => c.value.includes('금융주'))) ? '🏦 금융주 — 예금·대출·보험 float 탓에 FCF 기반 DCF가 성립하지 않는다(PBR·ROE 축으로 판단)'
              : 'DCF 불가(적자·기저효과·데이터 부족)'}</div>
          )}
        </div>

        {/* ── 레드라인(걸린 것만 강조) ── */}
        {data.redlineHit && (
          <div style={{ marginTop: SP.sm, background: `${TK.red500}10`, border: `1px solid ${TK.red500}44`, borderRadius: RAD.sm, padding: '8px 12px' }}>
            <b style={{ fontSize: FS.body, color: TK.red400 }}>🚧 레드라인 — 하나라도 걸리면 다른 점수와 무관하게 불통과</b>
            {data.redlines.filter(r => r.hit).map(r => (
              <div key={r.key} style={{ fontSize: FS.tiny, color: TK.sub11, marginTop: 3 }}>❌ <b style={{ color: TK.red400 }}>{r.label}</b> — {r.detail}</div>
            ))}
          </div>
        )}

        {/* ── 4인 카드 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: SP.md, marginTop: SP.md }}>
          {data.masters.map(m => {
            const say = data.debate?.statements.find(s => s.id === m.id)?.text
            return (
              <div key={m.id} style={{ background: TK.bg3, border: `1px solid ${V_COLOR[m.verdict]}44`, borderRadius: RAD.sm, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <b style={{ fontSize: FS.body, color: TK.slate100 }}>{m.emoji} {m.name}</b>
                  <b style={{ marginLeft: 'auto', fontSize: FS.tiny, color: V_COLOR[m.verdict] }}>{V_LABEL[m.verdict]}</b>
                </div>
                <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 2 }}>{m.philosophy}</div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.checks.map(c => (
                    <div key={c.key} style={{ fontSize: FS.tiny, color: TK.sub11, display: 'flex', gap: 5 }}>
                      <span>{S_ICON[c.status]}</span>
                      <span style={{ color: TK.slate300 }}>{c.label}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: c.status === 'fail' ? TK.red400 : c.status === 'warn' ? TK.amber400 : TK.sub11 }}>{c.value}</span>
                    </div>
                  ))}
                </div>
                {say && <div style={{ marginTop: 7, fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.6, borderTop: `1px solid ${TK.border}`, paddingTop: 6 }}>💬 {say}</div>}
              </div>
            )
          })}
        </div>

        {/* ── 교차 반박 + 의장 종합 ── */}
        {data.debate ? (
          <div style={{ marginTop: SP.md, background: TK.bg3, borderRadius: RAD.sm, padding: '10px 14px' }}>
            <b style={{ fontSize: FS.body, color: TK.amber400 }}>⚔️ 교차 반박 — 양비론을 구조로 깬다</b>
            {data.debate.rebuttals.map((r, i) => (
              <div key={i} style={{ fontSize: FS.tiny, color: TK.sub11, marginTop: 5, lineHeight: 1.6 }}>
                <b style={{ color: TK.slate300 }}>{r.from} → {r.to}:</b> {r.text}
              </div>
            ))}
            <div style={{ marginTop: SP.sm, borderTop: `1px solid ${TK.border}`, paddingTop: 8 }}>
              <b style={{ fontSize: FS.body, color: TK.slate100 }}>🎖️ 의장 종합</b>
              <div style={{ fontSize: FS.tiny, color: TK.slate300, marginTop: 4, lineHeight: 1.7 }}>{data.debate.chairman}</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: SP.md, fontSize: FS.tiny, color: TK.amber400 }}>⚠️ 토론 생성 실패 — 위 판정(결정론)은 유효하며, 다시 열면 토론이 채워집니다.</div>
        )}

        {/* ── 거울 테스트 ── */}
        {data.debate?.mirror && data.debate.mirror.length > 0 && (
          <div style={{ marginTop: SP.md, background: TK.bg3, borderRadius: RAD.sm, padding: '10px 14px' }}>
            <b style={{ fontSize: FS.body, color: TK.sky400 }}>🪞 거울 테스트</b>
            <span style={{ fontSize: FS.micro, color: TK.sub2 }}> — 멍거: &ldquo;5문장으로 설명 못 하면 사지 마라&rdquo;. 판정엔 미반영 — 읽고 스스로 판단하는 교육 장치</span>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {data.debate.mirror.slice(0, 5).map((s, i) => (
                <li key={i} style={{ fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.7 }}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        {/* ── 결측 + 캐비엇 ── */}
        <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: SP.md, lineHeight: 1.7 }}>
          {data.missingKeys.length > 0 && <>⚠️ 결측 데이터: {data.missingKeys.join('·')} — 해당 체크는 ⚠️(보류)로 반영했습니다(결측을 통과로 치지 않음).<br /></>}
          {data.unitSuspect && <>💱 <b style={{ color: TK.amber400 }}>통화 단위 불일치 의심</b> — 이 종목은 재무제표가 현지통화, 주가가 달러로 들어오는 것으로 보입니다(해외 상장·ADR에서 발생). 현금 관련 판정과 가격 구간을 보류했습니다.<br /></>}
          ※ <b>매수 관점 판정</b>입니다 — 보유 중인 종목이 불통과여도 매도 지시가 아닙니다(보유분 관리는 대시보드 출구 플랜에서).
          판정은 거장 본인의 의견이 아니라 공개된 투자 철학을 앱 데이터로 재현한 결정론이며, 6축 통합점수에는 반영되지 않습니다.
          거장 4인 구조는 오픈소스 &lsquo;AI Berkshire&rsquo;에서 착안했습니다. 교육용 · 투자 추천 아님.
        </div>
      </>)}
    </div>
  )
}
