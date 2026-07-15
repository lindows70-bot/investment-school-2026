'use client'

/**
 * 🌐 MacroAiTerminal — 거시경제 AI 매수 추천 터미널
 *
 * 3단 레이아웃:
 *  ① 매크로 현황판: 금리·CPI·장단기금리차·HY스프레드 배지 + 국면 레이블
 *  ② AI 추천 카드: Top 종목 (aiScore 순) + 매크로 매칭도
 *  ③ 상세 아코디언: 펀더멘탈 분석 + 리스크 + PEG 게이지
 *
 * Stale-while-revalidate: isStale=true 시 "갱신 중" 배너 표시
 * Weekly Cron이 월 04:00 KST에 자동 갱신
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MacroAiResult, AiRecommendation } from '@/app/api/macro-ai-picks/route'
import { TK } from '@/lib/theme'

const C = {
  bg:      TK.slate950,
  card:    '#0d1a2d',
  card2:   '#0a1322',
  border:  '#1e3050',
  text:    TK.slate100,
  textSub: '#b0bec8',
  textLow: '#8a9db5',
  gold:    TK.amber500,
  green:   TK.green400,
  red:     TK.red400,
  cyan:    TK.cyan400,
  purple:  TK.violet400,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const LYNCH_KR: Record<string, string> = {
  fast_grower: '고성장주', stalwart: '대형우량주', cyclical: '경기순환주',
  turnaround: '회생기업주', asset_play: '자산주', slow_grower: '저성장주',
}
const LYNCH_COLOR: Record<string, string> = {
  fast_grower: C.green, stalwart: C.cyan, cyclical: C.gold,
  turnaround: C.red, asset_play: C.purple, slow_grower: C.textSub,
}

function fmtPrice(v: number | null, cur: string) {
  if (!v) return '—'
  return cur === 'KRW' ? '₩' + v.toLocaleString() : '$' + v.toFixed(2)
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`@keyframes aiShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${C.border}55,transparent)`, animation: `aiShimmer 1.4s infinite`, animationDelay: `${i*.1}s` }} />
        </div>)}
      </div>
      {[0,1,2].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${C.border}55,transparent)`, animation: `aiShimmer 1.4s infinite`, animationDelay: `${i*.15}s` }} />
      </div>)}
    </div>
  )
}

// ── PEG 게이지 ─────────────────────────────────────────────────────────────────
function PegGauge({ peg }: { peg: number | null }) {
  if (!peg) return <span style={{ color: C.textLow, fontSize: 11 }}>—</span>
  const w = Math.min(100, peg * 25)  // 0~4 → 0~100%
  const color = peg < 1 ? C.green : peg < 2 ? C.gold : C.red
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textLow, marginBottom: 3 }}>PEG {peg.toFixed(2)}</div>
      <div style={{ height: 5, borderRadius: 3, background: TK.border, overflow: 'hidden', width: 80 }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ── 추천 카드 (아코디언) ────────────────────────────────────────────────────────
function RecommCard({ rec, rank, isHeld }: { rec: AiRecommendation; rank: number; isHeld: boolean }) {
  // 보유 중 종목은 기본 접힘, 미보유 신규 추천만 처음 카드 펼침
  const [open, setOpen] = useState(!isHeld && rank === 0)
  const lColor = LYNCH_COLOR[rec.lynchCategory] || C.textSub
  const scoreColor = rec.aiScore >= 80 ? C.green : rec.aiScore >= 60 ? C.gold : C.textSub

  // ── 보유 중 종목: 흐릿한 컴팩트 카드 ──────────────────────────────────────
  if (isHeld) {
    return (
      <div style={{
        borderRadius: 12, border: `1px solid ${C.border}`,
        background: C.card2, marginBottom: 8, opacity: 0.6,
        transition: 'opacity .2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* 보유 배지 */}
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${C.green}18`, color: C.green, fontWeight: 700, border: `1px solid ${C.green}44`, flexShrink: 0 }}>
            ✅ 보유 지속 추천
          </span>
          {/* 종목 */}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.textSub }}>{rec.name}</span>
            <span style={{ fontSize: 10, color: C.textLow, marginLeft: 6, fontFamily: MONO }}>{rec.ticker} · {rec.market}</span>
          </div>
          {/* 린치 분류 */}
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: `${lColor}14`, color: lColor, fontWeight: 600 }}>
            {LYNCH_KR[rec.lynchCategory] || rec.lynchCategory}
          </span>
          {/* AI 점수 작게 */}
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.textLow }}>
            {rec.aiScore}점
          </span>
        </div>
        {/* 한 줄 멘트 */}
        <div style={{ padding: '0 16px 10px', fontSize: 11.5, color: C.textLow, lineHeight: 1.6 }}>
          💡 AI가 현재 국면에서도 추천하는 종목입니다. 보유를 이어가되, 리스크 — {rec.riskFactor?.slice(0, 60)}{rec.riskFactor?.length > 60 ? '…' : ''}
        </div>
      </div>
    )
  }

  // ── 미보유 종목: 강조 풀 카드 ──────────────────────────────────────────────
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${open ? lColor + '55' : C.border}`, background: open ? C.card : C.card2, transition: 'all .2s', marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, flexWrap: 'wrap',
      }}>
        {/* 신규 추천 배지 + 순위 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: rank === 0 ? C.gold : rank === 1 ? TK.slate400 : TK.amber700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#000' }}>
            {rank + 1}
          </div>
          <span style={{ fontSize: 8.5, color: C.green, fontWeight: 700, whiteSpace: 'nowrap' }}>🆕 신규</span>
        </div>
        {/* 종목 */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{rec.name}</div>
          <div style={{ fontSize: 10.5, color: C.textLow, fontFamily: MONO }}>{rec.ticker} · {rec.market}</div>
        </div>
        {/* 린치 분류 */}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${lColor}18`, color: lColor, fontWeight: 700 }}>
          {LYNCH_KR[rec.lynchCategory] || rec.lynchCategory}
        </span>
        {/* AI 점수 */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: MONO, color: scoreColor }}>{rec.aiScore}</div>
          <div style={{ fontSize: 9, color: C.textLow }}>AI 점수</div>
        </div>
        <div style={{ color: C.textLow, fontSize: 14 }}>{open ? '▲' : '▼'}</div>
      </button>

      {/* 확장 패널 */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
          {/* 플래그 */}
          {rec.flags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
              {rec.flags.map((f, i) => <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}44` }}>⚠️ {f}</span>)}
            </div>
          )}

          {/* 지표 요약 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '10px 0', padding: '10px 12px', borderRadius: 9, background: C.bg }}>
            <div>
              <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 3 }}>현재가</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.text }}>{fmtPrice(rec.price, rec.currency)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 3 }}>영업이익률</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: rec.opMargin != null && rec.opMargin > 20 ? C.green : C.gold }}>
                {rec.opMargin != null ? rec.opMargin.toFixed(1) + '%' : '—'}
              </div>
            </div>
            <PegGauge peg={rec.peg} />
          </div>

          {/* LLM 분석 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {[
              { icon: '🌐', title: '왜 지금 사야 하는가? (매크로 궁합)', text: rec.macroFitReason, color: C.cyan },
              { icon: '🔬', title: '핵심 펀더멘탈 분석', text: rec.fundamentalReason, color: C.green },
              { icon: '⚡', title: '리스크 & 진입 전략', text: rec.riskFactor, color: C.gold },
            ].map(({ icon, title, text, color }) => (
              <div key={title} style={{ padding: '10px 12px', borderRadius: 9, background: C.bg, borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color, marginBottom: 5 }}>{icon} {title}</div>
                <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.7 }}>{text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function MacroAiTerminal() {
  const [data,       setData]       = useState<MacroAiResult | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [heldTickers, setHeldTickers] = useState<Set<string>>(new Set())

  // 로그인 사용자의 보유 종목 로드 (Supabase)
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      sb.from('investments').select('ticker').eq('user_id', user.id)
        .then(({ data: invs }) => {
          if (invs) setHeldTickers(new Set(invs.map(i => i.ticker.toUpperCase())))
        })
    })
  }, [])

  const load = (refresh = false) => {
    setLoading(true); setError(null)
    fetch(`/api/macro-ai-picks${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setData(j) })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>

      {/* ── 헤더 ── */}
      <div style={{ padding: '16px 20px', borderRadius: 14, background: `linear-gradient(135deg,#030b1a,${C.card})`, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>거시경제 AI 매수 추천 터미널</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontWeight: 700 }}>Macro × Lynch × Gemini</span>
          {data && !loading && (
            <button onClick={() => load(true)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, color: C.textLow, fontSize: 11, cursor: 'pointer' }}>
              🔄 강제 갱신
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.textLow }}>FRED 매크로 → 린치 6대 가중치 → 퀀트 스크리닝(US7+KR5) → Gemini AI 추천 · 주간 캐시</div>
      </div>

      {/* Stale 배너 */}
      {data?.isStale && (
        <div style={{ padding: '9px 14px', borderRadius: 10, background: `${C.gold}12`, border: `1px solid ${C.gold}44`, fontSize: 12, color: C.gold }}>
          ⏳ AI 분석 데이터 갱신 중… (기존 리포트 표시 중)
        </div>
      )}

      {loading && <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}><Skeleton /></div>}
      {error && !loading && (
        <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: TK.red300, fontSize: 13 }}>⚠️ {error}</div>
      )}

      {!loading && data && (
        <>
          {/* ── ① 매크로 현황판 ── */}
          <div style={{ padding: '16px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
            {/* 국면 레이블 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20 }}>{data.phase.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: data.phase.color }}>{data.phase.label}</span>
              <span style={{ fontSize: 12, color: C.textSub, flex: 1 }}>{data.macroSummary}</span>
            </div>

            {/* 지표 4개 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }} className="macro-grid">
              {[
                { k: '기준금리(Fed)', v: data.macroData.fedRate.toFixed(2) + '%', c: data.macroData.fedRate > 4 ? C.red : C.green, sub: data.macroData.fedRate > 4 ? '고금리' : '완화기조' },
                { k: 'CPI 상승률', v: data.macroData.cpiYoY.toFixed(1) + '%', c: data.macroData.cpiYoY > 4 ? C.red : data.macroData.cpiYoY > 2.5 ? C.gold : C.green, sub: data.macroData.cpiYoY > 4 ? '인플레 압박' : '완화 중' },
                { k: '장단기 금리차', v: (data.macroData.yieldCurve >= 0 ? '+' : '') + data.macroData.yieldCurve.toFixed(2) + '%p', c: data.macroData.yieldCurve < -0.3 ? C.red : data.macroData.yieldCurve > 0 ? C.green : C.gold, sub: data.macroData.yieldCurve < 0 ? '역전(침체 경보)' : '정상화' },
                { k: 'HY 스프레드', v: data.macroData.hySpread.toFixed(2) + '%', c: data.macroData.hySpread > 5 ? C.red : data.macroData.hySpread < 3 ? C.green : C.gold, sub: data.macroData.hySpread < 3 ? 'Risk-On' : 'Risk-Off' },
              ].map(m => (
                <div key={m.k} style={{ padding: '11px 13px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 4 }}>{m.k}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: MONO, color: m.c }}>{m.v}</div>
                  <div style={{ fontSize: 9.5, color: m.c, marginTop: 2, opacity: 0.75 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ② AI 추천 카드 ── */}
          <div style={{ padding: '16px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>🏆 AI 추천 종목</span>
              <span style={{ fontSize: 10.5, color: C.textLow }}>
                {data.screenedCount}개 스크리닝 → {data.recommendations.length}개 선정 ·
                생성: {data.generatedAt.slice(0, 10)} ·
                다음 갱신: {data.nextRefreshAt.slice(0, 10)}
              </span>
            </div>
            {data.recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: C.textLow, fontSize: 13 }}>
                현재 추천 종목이 없습니다. 잠시 후 다시 시도해주세요.
              </div>
            ) : (() => {
              const isHeld = (r: AiRecommendation) => heldTickers.has(r.ticker.toUpperCase())
              // 미보유 최대 5개(신규) + 보유 종목 모두(뒤에 흐릿) 분리
              const allNew  = [...data.recommendations].filter(r => !isHeld(r)).slice(0, 5)
              const allHeld = [...data.recommendations].filter(r =>  isHeld(r))
              const sorted  = [...allNew, ...allHeld]
              const newCount  = allNew.length
              const heldCount = allHeld.length
              return (
                <>
                  {/* 개인화 안내 (로그인 시에만) */}
                  {heldTickers.size > 0 && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, padding: '9px 13px', borderRadius: 10, background: `${C.green}0c`, border: `1px solid ${C.green}33`, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: C.green, fontWeight: 700 }}>🎯 내 포트폴리오 기반 개인화</span>
                      <span style={{ fontSize: 11.5, color: C.textSub }}>
                        🆕 신규 매수 추천 <b style={{ color: C.green }}>{newCount}종목</b>
                        {heldCount > 0 && <> · ✅ 보유 지속 <b style={{ color: C.textLow }}>{heldCount}종목</b></>}
                      </span>
                      {newCount < 5 && (
                        <span style={{ fontSize: 10.5, color: C.gold }}>
                          ⚡ 보유 종목 수에 따라 신규 추천이 {newCount}개로 표시됩니다
                        </span>
                      )}
                    </div>
                  )}
                  {/* 미보유 종목 먼저 (rank는 미보유 내 순서) */}
                  {sorted.map((rec, i) => (
                    <RecommCard
                      key={rec.ticker}
                      rec={rec}
                      rank={isHeld(rec) ? 0 : sorted.filter((r, j) => j < i && !isHeld(r)).length}
                      isHeld={isHeld(rec)}
                    />
                  ))}
                </>
              )
            })()}
          </div>

          {/* 면책 고지 */}
          <div style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.7, padding: '0 4px' }}>
            🌐 본 AI 추천은 FRED 매크로 지표 + 퀀트 스크리닝 + Gemini AI 분석 기반의 <b>교육용 참고 자료</b>입니다.
            실제 투자 결정에는 본인의 판단과 전문 투자 상담사 검토를 병행하시기 바랍니다.
            주간 자동 갱신 (매주 월 04:00 KST) · 데이터 지연 및 AI 오류 가능성 있음.
          </div>
        </>
      )}
      <style>{`@media(max-width:640px){.macro-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </div>
  )
}
