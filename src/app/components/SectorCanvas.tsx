'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
// 🧬 테마·섹터 분석 제네릭 캔버스 — 서브섹터 히트맵 + 테마지수/MDD + 대장주 베타·상관 + 미니차트 + 실적 D-day + (옵션)정책/Pre-IPO
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { SectorResult, SectorStockOut } from '@/lib/sectorEngine'
import { QMARKET_FLAG } from '@/lib/quantumUniverse'
import { etfFor } from '@/lib/sectorConfigs'

const CARD = '#161b25', BORDER = '#1e293b'
const UP = '#34d399', DN = '#f87171'
const OVL = ['#a78bfa', '#22d3ee', '#34d399', '#f59e0b', '#ec4899']   // 오버레이 5색
const pctCol = (v: number | null) => v == null ? '#8a9aaa' : v > 0 ? UP : v < 0 ? DN : '#8a9aaa'
const fmtPct = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`
const usdM = (m: number) => m >= 1000 ? `${m / 1000}B` : `${m}M`

function MiniChart({ prices, w = 130, h = 30 }: { prices: number[]; w?: number; h?: number }) {
  if (!prices || prices.length < 2) return <div style={{ width: w, height: h }} />
  const P = 2, min = Math.min(...prices), max = Math.max(...prices), rng = max - min || 1
  const xs = prices.map((_, i) => P + (i / (prices.length - 1)) * (w - 2 * P))
  const ys = prices.map(p => P + (1 - (p - min) / rng) * (h - 2 * P))
  const line = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${P},${h - P} ${line} ${(w - P).toFixed(1)},${h - P}`
  const up = prices[prices.length - 1] >= prices[0], col = up ? UP : DN, gid = `sg${up ? 'u' : 'd'}`
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity={0.28} /><stop offset="100%" stopColor={col} stopOpacity={0.02} /></linearGradient></defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={col} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={1.8} fill={col} />
    </svg>
  )
}

export default function SectorCanvas({ sectorKey }: { sectorKey: string }) {
  const [d, setD] = useState<SectorResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [pureOnly, setPureOnly] = useState(false)

  useEffect(() => {
    let alive = true; setLoading(true); setD(null)
    fetch(`/api/sector?key=${sectorKey}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sectorKey])

  const Wrap = (child: React.ReactNode) => (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>{d?.emoji ?? '🧬'}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>{d?.label ?? '섹터 분석'}</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>⚠️ {d?.tagline ?? ''}</div>
      {child}
    </div>
  )

  if (loading) return Wrap(<div style={{ color: '#8a9aaa', fontSize: 12.5, padding: '12px 0' }}>🧬 섹터 데이터를 모으는 중…</div>)
  if (!d) return Wrap(<div style={{ color: '#8a9aaa', fontSize: 12.5, padding: '12px 0' }}>데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>)

  const stocks = pureOnly ? d.stocks.filter(s => s.purePlay) : d.stocks
  const maxBeta = Math.max(2, ...d.stocks.map(s => s.beta ?? 0))
  const tc = d.themeChart
  const subMap: Record<string, { label: string; emoji: string; color: string }> = Object.fromEntries(d.subsectors.map(s => [s.key, { label: s.label, emoji: s.emoji, color: s.color }]))

  // 💰 소섹터 자금 순환 — 로테이션 시계와 동일 로직(상대강도×모멘텀)을 소섹터에 적용(제2원칙)
  type SQ = 'leading' | 'weakening' | 'lagging' | 'improving'
  const SQI: Record<SQ, string> = { leading: '🌱', weakening: '🔥', lagging: '🍂', improving: '❄️' }
  const SQC: Record<SQ, string> = { leading: '#22c55e', weakening: '#f59e0b', lagging: '#94a3b8', improving: '#38bdf8' }
  const SQN: Record<SQ, string> = { leading: '주도', weakening: '과열', lagging: '이탈', improving: '태동' }
  const sv = d.subsectors.filter(s => s.ret1m != null && s.ret1w != null)
  const smM = sv.length ? sv.reduce((a, s) => a + (s.ret1m as number), 0) / sv.length : 0
  const smW = sv.length ? sv.reduce((a, s) => a + (s.ret1w as number), 0) / sv.length : 0
  const smScore: Record<string, { q: SQ; score: number }> = {}
  if (sv.length >= 2) d.subsectors.forEach(s => {
    if (s.ret1m == null || s.ret1w == null) return
    const rs = s.ret1m - smM, mom = s.ret1w - smW
    smScore[s.key] = { q: rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging', score: Math.round((0.6 * rs + 0.4 * mom) * 10) / 10 }
  })
  const smRanked = Object.entries(smScore).sort((a, b) => b[1].score - a[1].score)
  const smTop = smRanked[0]?.[0], smBot = smRanked.length > 1 ? smRanked[smRanked.length - 1][0] : undefined
  const subByKey = Object.fromEntries(d.subsectors.map(s => [s.key, s]))
  // 매수 적격 = 상대강세(주도·태동) + 실제 상승(⭐보수 게이트: 1주 AND 1개월 둘 다 양수 — 칼날·일시반등 이중 차단)
  const isBuy = (key: string) => {
    const q = smScore[key]?.q, s = subByKey[key]
    return (q === 'leading' || q === 'improving') && (s?.ret1w ?? 0) > 0 && (s?.ret1m ?? 0) > 0
  }
  // 배너 주인공 = '매수 적격 중 쏠림 1위'(카드 신호와 반드시 일치 — 과열 1위를 돈몰림으로 광고하던 모순 차단)
  const smBuyTop = smRanked.find(([k]) => isBuy(k))?.[0]
  const smTopIsSell = !smBuyTop && smScore[smTop ?? '']?.q === 'weakening'

  return Wrap(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 💰 소섹터 자금 순환 요약 배너 — 섹터 안에서 지금 돈 몰리는 소섹터 vs 빠지는 소섹터 */}
      {smTop && (
        <div style={{ background: 'linear-gradient(135deg,#131a17,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>💰 이 섹터 안 자금 흐름</span>
          {(() => {
            // ① 매수 적격 1위가 있으면 그게 주인공(카드 신호와 100% 일치)
            if (smBuyTop) {
              const t = subByKey[smBuyTop]; const e = etfFor(sectorKey, smBuyTop)
              return (
                <span style={{ fontSize: 11.5, color: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  🔥 <b style={{ color: '#22c55e' }}>돈 몰림·상승</b>: {t?.emoji} {t?.label} <span style={{ color: pctCol(t?.ret1m ?? null), fontFamily: 'monospace', fontWeight: 700 }}>(1주 {fmtPct(t?.ret1w ?? null)} · 1개월 {fmtPct(t?.ret1m ?? null)})</span>
                  {e && <span style={{ display: 'inline-flex', gap: 5 }}>
                    {e.us && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e66', borderRadius: 5, padding: '1px 7px', fontSize: 10.5 }}>🇺🇸 {e.us.t}</b>}
                    {e.kr && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e66', borderRadius: 5, padding: '1px 7px', fontSize: 10.5 }}>🇰🇷 {e.kr.name}</b>}
                  </span>}
                </span>
              )
            }
            // ② 매수 적격이 없으면 — 쏠림 1위의 실제 국면대로 정직하게(과열=매도경계 / 그 외=보류)
            const t = subByKey[smTop!]
            return (
              <span style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                {smTopIsSell
                  ? <><b style={{ color: '#f59e0b' }}>⚠️ 매수 적격 소섹터 없음</b> — 쏠림 1위 {t?.emoji}{t?.label}도 <b style={{ color: '#f59e0b' }}>과열(익절 구간)</b></>
                  : <><b style={{ color: '#eab308' }}>⏳ 매수 적격 소섹터 없음</b> — 상대 강세는 있으나 실제 상승(1주+1개월) 미확인, 반등 확인 후</>}
              </span>
            )
          })()}
          {smBot && smBot !== smTop && (() => { const b = subByKey[smBot]; return (
            <span style={{ fontSize: 11.5, color: '#cbd5e1' }}>
              🧊 <b style={{ color: '#94a3b8' }}>소외·이탈</b>: {b?.emoji} {b?.label} <span style={{ color: pctCol(b?.ret1w ?? null), fontFamily: 'monospace', fontWeight: 700 }}>(1주 {fmtPct(b?.ret1w ?? null)})</span>
            </span>
          )})()}
          <span style={{ fontSize: 10, color: '#6e7f8f', marginLeft: 'auto' }}>상대강도(1M)+모멘텀(1W) — 로테이션 시계와 동일 기준</span>
        </div>
      )}

      {/* ① 서브섹터 히트맵 (자금 순환 순 정렬 + 국면 배지) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[...d.subsectors].sort((a, b) => (smScore[b.key]?.score ?? -999) - (smScore[a.key]?.score ?? -999)).map(s => {
          const sm = smScore[s.key]; const isTop = s.key === smBuyTop   // 초록 강조 = '매수 적격 1위'만(과열 1위에 초록 두르던 모순 차단)
          return (
          <div key={s.key} style={{ flex: '1 1 190px', minWidth: 175, background: '#0f1117', borderRadius: 12, border: `1.5px solid ${isTop ? '#22c55e88' : s.color + '44'}`, padding: '12px 14px', boxShadow: isTop ? '0 0 0 1px #22c55e33' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 15 }}>{s.emoji}</span>
              <span style={{ color: s.color, fontWeight: 800, fontSize: 13 }}>{s.label}</span>
              {sm && <span style={{ fontSize: 9.5, fontWeight: 700, color: SQC[sm.q], background: SQC[sm.q] + '22', borderRadius: 4, padding: '1px 5px' }}>{SQI[sm.q]}{SQN[sm.q]}</span>}
              <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 10 }}>{s.count}종목</span>
            </div>
            <div style={{ color: isTop ? '#4ade80' : '#7f93a8', fontSize: 9.5, marginBottom: 8, fontWeight: isTop ? 700 : 400 }}>{isTop ? '🔥 지금 돈이 몰리며 실제로 오르는 소섹터' : s.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {([['1주', s.ret1w], ['1개월', s.ret1m], ['1년', s.ret1y]] as const).map(([lab, v]) => (
                <div key={lab} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ color: '#7f93a8', fontSize: 9, marginBottom: 2 }}>{lab}</div>
                  <div style={{ color: pctCol(v), fontWeight: 800, fontSize: 12.5, fontFamily: 'monospace' }}>{fmtPct(v)}</div>
                </div>
              ))}
            </div>
            {/* 💰 액션 — ETF 매수 제안 / 매도 신호. ⭐보수 게이트: 매수 = 상대강세 AND 1주>0 AND 1개월>0 */}
            {sm && (() => {
              const etf = etfFor(sectorKey, s.key)
              const strong = sm.q === 'leading' || sm.q === 'improving'
              const buy = isBuy(s.key)
              const wait = strong && !buy        // 상대강세지만 1주·1개월 중 하나라도 음수 → 보류(칼날·일시반등 방지)
              const sell = sm.q === 'weakening'
              if (buy && etf) return (
                // 📈 매수 — 초록 강조 박스 + ETF 배지(미국+한국)
                <div style={{ marginTop: 8, background: '#14532d33', border: '1px solid #22c55e55', borderRadius: 8, padding: '7px 9px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#4ade80' }}>📈 자금 유입·상승 — 추천 ETF 분할매수 관심</div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {etf.us && <span style={{ background: '#14532d', border: '1px solid #22c55e66', borderRadius: 6, padding: '2px 8px', fontSize: 10.5 }}>🇺🇸 <b style={{ color: '#4ade80' }}>{etf.us.t}</b> <span style={{ color: '#86efac' }}>{etf.us.name}</span></span>}
                    {etf.kr && <span style={{ background: '#14532d', border: '1px solid #22c55e66', borderRadius: 6, padding: '2px 8px', fontSize: 10.5 }}>🇰🇷 <b style={{ color: '#4ade80' }}>{etf.kr.name}</b></span>}
                  </div>
                </div>
              )
              if (sell) return (
                // ⚠️ 매도·익절 — 주황 강조 박스(보유자 관점 최우선 신호)
                <div style={{ marginTop: 8, background: '#7c2d1222', border: '1.5px solid #f59e0b77', borderRadius: 8, padding: '7px 9px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#fbbf24' }}>⚠️ 매도·익절 신호 — 돈 빠지기 시작(모멘텀 반전)</div>
                  <div style={{ fontSize: 9.5, color: '#d6bfa3', marginTop: 3 }}>강세였으나 최근 페이스 꺾임 — 보유 중이면 분할 익절 검토{etf ? ` (보유 ETF: ${[etf.us?.t, etf.kr?.name].filter(Boolean).join('·')})` : ''}</div>
                </div>
              )
              return (
                <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: wait ? '#eab308' : '#94a3b8' }}>
                    {wait ? '⏳ 상대 강세이나 실제 상승(1주+1개월) 미확인 — 반등 확인 후 진입' : buy ? '📈 자금 유입·상승 — ETF 없음, 개별종목(아래 표) 참고' : '🔻 이탈 — 신규 진입 자제'}
                  </div>
                  {etf && <div style={{ fontSize: 9.5, color: '#6e7f8f', marginTop: 3 }}>관련 ETF: {[etf.us && `🇺🇸${etf.us.t}`, etf.kr && `🇰🇷${etf.kr.name}`].filter(Boolean).join(' · ')}</div>}
                </div>
              )
            })()}
          </div>
        )})}
      </div>

      {/* ② 테마 지수 + MDD + 오버레이 */}
      {tc && (() => {
        const data = Array.from({ length: tc.len }, (_, i) => {
          const row: Record<string, number> = { i, theme: tc.theme[i] }
          tc.overlay.forEach(o => { row[o.ticker] = o.norm[i] })
          return row
        })
        const tipFmt = ((v: any, n: string): [string, string] => [`${v}`, n === 'theme' ? '테마지수' : (tc.overlay.find(o => o.ticker === n)?.name ?? n)]) as any
        return (
          <div style={{ background: '#0f1117', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 13 }}>📈 테마 지수 &amp; 모멘텀</span>
              <span style={{ color: '#7f93a8', fontSize: 10 }}>퓨어플레이 동일가중 · 최근 {tc.len}주봉 · 로그스케일(시작=100)</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
                <span style={{ color: pctCol(tc.fromPeak), fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>고점대비 {fmtPct(tc.fromPeak)}</span>
                <span style={{ color: '#f87171', fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>MDD {tc.mdd}%</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
                <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${tc.len - v}주전`} interval={Math.floor(tc.len / 6)} />
                <YAxis scale="log" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}`} width={40} />
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, fontSize: 11, padding: '6px 10px' }} formatter={tipFmt} labelFormatter={(l => `${tc.len - (l as number)}주 전`)} />
                <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
                {tc.overlay.map((o, i) => <Line key={o.ticker} type="monotone" dataKey={o.ticker} stroke={OVL[i % OVL.length]} strokeWidth={1.3} dot={false} opacity={0.75} />)}
                <Line type="monotone" dataKey="theme" stroke="#fbbf24" strokeWidth={2.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9aa7b4' }}><span style={{ width: 10, height: 3, background: '#fbbf24', borderRadius: 2 }} />테마지수</span>
              {tc.overlay.map((o, i) => <span key={o.ticker} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9aa7b4' }}><span style={{ width: 10, height: 3, background: OVL[i % OVL.length], borderRadius: 2 }} />{o.name}</span>)}
            </div>
          </div>
        )
      })()}

      {/* ③ 실적 D-day */}
      {(() => {
        const now = Date.now(), DAY = 86400000
        const list = d.stocks.filter(s => s.earningsTs != null && s.earningsTs > now - 2 * DAY).sort((a, b) => (a.earningsTs as number) - (b.earningsTs as number)).slice(0, 12)
        if (!list.length) return null
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📅 실적 발표 D-day</span>
              <span style={{ color: '#7f93a8', fontSize: 10 }}>실적 전후 변동성 극대 — 임박순 · D-7 이내 강조</span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {list.map(s => {
                const dd = Math.ceil(((s.earningsTs as number) - now) / DAY), urgent = dd <= 7
                const date = new Date(s.earningsTs as number)
                return (
                  <div key={s.ticker} style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${urgent ? '#f59e0b66' : BORDER}`, padding: '7px 11px', minWidth: 92 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12 }}>{s.ticker}</span>{s.purePlay && <span style={{ color: '#34d399', fontSize: 8 }}>퓨어</span>}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
                      <span style={{ color: urgent ? '#fbbf24' : '#a78bfa', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{dd <= 0 ? '오늘·발표' : `D-${dd}`}</span>
                      <span style={{ color: '#7f93a8', fontSize: 9.5, fontFamily: 'monospace' }}>{date.getMonth() + 1}/{date.getDate()}</span>
                    </div>
                    <div style={{ fontSize: 9, color: pctCol(s.ret1w), fontFamily: 'monospace', marginTop: 1 }}>1주 {fmtPct(s.ret1w)}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ color: '#6e7f8f', fontSize: 9, marginTop: 6 }}>※ Yahoo 추정 실적일(US·해외) · 변동될 수 있음 · KR은 미제공.</div>
          </div>
        )
      })()}

      {/* ④ 대장주 베타·상관 + 미니차트 + 퓨어플레이 토글 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🧲 테마 동조화 — {d.anchor}(대장주) 베타·상관</span>
          <button onClick={() => setPureOnly(p => !p)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: pureOnly ? 'rgba(167,139,250,0.2)' : '#0f1117', color: pureOnly ? '#a78bfa' : '#8a9aaa', border: `1px solid ${pureOnly ? '#a78bfa66' : BORDER}` }}>{pureOnly ? '✓ 퓨어플레이만' : '전체 종목'}</button>
        </div>
        <div style={{ color: '#7f93a8', fontSize: 10, marginBottom: 8, lineHeight: 1.6 }}>📊 <b style={{ color: '#cbd5e1' }}>베타</b> = {d.anchor} 대비 <b>움직임 폭</b>(1.0=같은 폭·0.1=거의 안 따라감) · <b style={{ color: '#cbd5e1' }}>상관(동행도)</b> = <b>방향 일치도</b>(1=완전 동행·노랑=따로 놂) · ⚠️ 비퓨어+저베타 = ‘무늬만’</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 840 }}>
            <thead><tr style={{ color: '#7f93a8', fontSize: 10 }}>
              <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px' }}>종목</th>
              <th style={{ textAlign: 'center', fontWeight: 700, padding: '0 6px 7px', width: 96 }}>소테마</th>
              <th style={{ textAlign: 'center', fontWeight: 700, padding: '0 6px 7px', width: 140 }}>주가 (1년·주봉)</th>
              <th style={{ textAlign: 'center', fontWeight: 700, padding: '0 6px 7px' }}>{d.tagHeader}</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1주</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1개월</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1년</th>
              <th title={`${d.anchor}가 1% 움직일 때 이 종목이 평균 몇 % 움직이나 — 테마 레버리지 폭`} style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px', width: 120, cursor: 'help' }}>베타(움직임 폭) ⓘ</th>
              <th title="방향이 얼마나 같이 가나(-1~+1). 노랑=저상관(테마와 따로 놂)" style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 64, cursor: 'help' }}>상관(동행도) ⓘ</th>
            </tr></thead>
            <tbody>{stocks.map(s => <Row key={s.ticker} s={s} maxBeta={maxBeta} anchor={d.anchor} subMap={subMap} />)}</tbody>
          </table>
        </div>
      </div>

      {/* ⑤ (옵션) 정책 바스켓 + Pre-IPO proxy */}
      {(d.policy?.length || d.preIpo?.length) && (
        <div>
          {d.policy?.length ? <>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🇺🇸 미정부 투자 바스켓</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {d.policy.map((p, i) => (
                <div key={i} style={{ flex: '1 1 150px', minWidth: 145, background: '#0f1117', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5 }}>{p.name}</span>{p.listed && <span style={{ color: '#a78bfa', fontSize: 9.5, fontWeight: 700 }}>{p.listed}</span>}</div>
                  <div style={{ color: '#34d399', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', margin: '2px 0' }}>{p.cap ? '최대 ' : ''}${usdM(p.usdM)}</div>
                  <div style={{ color: '#7f93a8', fontSize: 9.5 }}>#{p.modality} · {p.structure}</div>
                </div>
              ))}
            </div>
          </> : null}
          {d.preIpo?.length ? <>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🚀 Pre-IPO 비상장사 — 상장 대용주(proxy)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.preIpo.map((p, i) => (
                <div key={i} style={{ flex: '1 1 230px', minWidth: 220, background: '#0f1117', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}><span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5 }}>{p.name}</span><span style={{ background: 'rgba(167,139,250,0.14)', color: '#a78bfa', borderRadius: 5, padding: '0 6px', fontSize: 9.5, fontWeight: 700 }}>#{p.modality}</span>{p.govAwardUsdM && <span style={{ color: '#34d399', fontSize: 9.5, fontWeight: 700 }}>미정부 ${p.govAwardUsdM}M</span>}</div>
                  <div style={{ color: '#9aa7b4', fontSize: 10, margin: '3px 0 5px' }}>{p.note}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><span style={{ color: '#7f93a8', fontSize: 10 }}>대용주:</span>{p.proxy.map((px, j) => <span key={j} style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{px.ticker} · {px.name}</span>)}</div>
                </div>
              ))}
            </div>
          </> : null}
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.6 }}>
        ※ 수익률·베타=주봉(US/해외 Yahoo·KR 네이버) · 서브섹터=동일가중(테마 폭 측정) · 미니차트=실제 주봉 종가 · 비상장/정책=공개자료 큐레이션 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}

function Row({ s, maxBeta, anchor, subMap }: { s: SectorStockOut; maxBeta: number; anchor: string; subMap: Record<string, { label: string; emoji: string; color: string }> }) {
  const isNew = s.weeks < 52 && s.ret1y == null   // 상장 1년 미만 → 1년수익률·베타 빈칸
  const fake = !isNew && !s.purePlay && (s.beta == null || s.beta < 0.5)
  const betaW = s.beta != null ? Math.min(100, Math.max(4, (s.beta / maxBeta) * 100)) : 0
  const sm = subMap[s.sub]
  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td style={{ padding: '7px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11 }}>{QMARKET_FLAG[s.market]}</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12.5 }}>{s.name}</span>
          <span style={{ color: '#7f93a8', fontSize: 9.5 }}>{s.ticker}</span>
          {s.ticker === anchor && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>대장주</span>}
          {s.purePlay
            ? <span style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>퓨어</span>
            : <span style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>대형주</span>}
          {s.govAwardUsdM && <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>🇺🇸${usdM(s.govAwardUsdM)}</span>}
          {fake && <span title="대형주 + 테마 연동 낮음(베타<0.5)" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>⚠️무늬만</span>}
          {isNew && <span title={`상장한 지 ${s.weeks}주 — 1년 수익률·베타는 데이터가 1년 쌓여야 계산됩니다`} style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>🆕 신규상장 {s.weeks}주차</span>}
        </div>
        <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 1 }}>{s.note}</div>
      </td>
      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
        {sm && <span style={{ display: 'inline-block', background: `${sm.color}1f`, color: sm.color, border: `1px solid ${sm.color}44`, borderRadius: 6, padding: '2px 7px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{sm.emoji} {sm.label}</span>}
      </td>
      <td style={{ padding: '7px 6px' }}><div style={{ display: 'flex', justifyContent: 'center' }}><MiniChart prices={s.spark} /></div></td>
      <td style={{ textAlign: 'center', padding: '7px 6px', fontSize: 9.5, color: '#9aa7b4' }}>{s.tags.join('·') || '—'}</td>
      <td style={{ padding: '7px 6px', textAlign: 'right' }}><span style={{ color: pctCol(s.ret1w), fontWeight: 800, fontFamily: 'monospace', fontSize: 12 }}>{fmtPct(s.ret1w)}</span></td>
      <td style={{ padding: '7px 6px', textAlign: 'right' }}><span style={{ color: pctCol(s.ret1m), fontWeight: 800, fontFamily: 'monospace', fontSize: 12 }}>{fmtPct(s.ret1m)}</span></td>
      <td style={{ padding: '7px 6px', textAlign: 'right' }}><span style={{ color: pctCol(s.ret1y), fontWeight: 800, fontFamily: 'monospace', fontSize: 12 }}>{fmtPct(s.ret1y)}</span></td>
      <td style={{ padding: '7px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 7, background: '#0f1117', borderRadius: 4, overflow: 'hidden', minWidth: 50 }}><div style={{ width: `${betaW}%`, height: '100%', background: s.beta != null && s.beta >= 1.5 ? '#a78bfa' : '#60a5fa', borderRadius: 4 }} /></div>
          <span style={{ color: s.beta != null && s.beta >= 1.5 ? '#a78bfa' : '#cbd5e1', fontWeight: 800, fontFamily: 'monospace', fontSize: 11.5, width: 30, textAlign: 'right' }}>{s.beta == null ? '—' : s.beta.toFixed(1)}</span>
        </div>
      </td>
      <td style={{ textAlign: 'right', padding: '7px 6px', fontFamily: 'monospace', fontSize: 11, color: s.corr == null ? '#8a9aaa' : Math.abs(s.corr) < 0.3 ? '#fbbf24' : '#9aa7b4' }}>{s.corr == null ? '—' : s.corr.toFixed(2)}</td>
    </tr>
  )
}
