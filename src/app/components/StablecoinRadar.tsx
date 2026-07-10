'use client'
// 💵 스테이블코인 레이더 — ① 유동성 게이지(시총 추이) ② 페그·종류 모니터 ③ 디페깅 스트레스 시뮬레이터
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import type { StablecoinResult, StableRisk } from '@/app/api/stablecoin/route'

const CARD = '#161b25', BORDER = '#1e293b'
const RISK: Record<StableRisk, { c: string; ko: string }> = {
  low: { c: '#22c55e', ko: '상대적 안전' }, mid: { c: '#fbbf24', ko: '중위험' }, high: { c: '#ef4444', ko: '초고위험' },
}
const fmtB = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(1)}B`
/* eslint-disable @typescript-eslint/no-explicit-any */
const mcapTip = (v: any) => [fmtB(Number(v)), '스테이블 시총']
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function StablecoinRadar() {
  const [d, setD] = useState<StablecoinResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/stablecoin', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, color: '#8a9aaa', fontSize: 12 }}>💵 스테이블코인 시장을 분석하는 중…</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, color: '#8a9aaa', fontSize: 12 }}>스테이블코인 데이터를 불러오지 못했습니다.</div>

  const liqUp = (d.mcapChange30d ?? 0) >= 0
  const top1 = d.coins[0], top2 = d.coins[1]
  const concentration = (top1?.share ?? 0) + (top2?.share ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(38,161,123,0.1),rgba(96,165,250,0.05))', border: '1px solid rgba(38,161,123,0.3)', borderRadius: 12, padding: '14px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>💵</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>스테이블코인 레이더</span>
          <span style={{ color: '#8a9aaa', fontSize: 11.5 }}>암호시장의 디지털 달러·유동성</span>
        </div>
        <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>
          비트코인이 <b style={{ color: '#f7931a' }}>디지털 금</b>이면, 스테이블코인은 <b style={{ color: '#26a17b' }}>디지털 달러</b> — 암호시장의 현금·유동성입니다. <b>시총이 늘면 살 돈이 대기 중(강세 연료)</b>, 줄면 자금 이탈, <b>페그가 깨지면 시스템 위기</b>(테라 사태). &ldquo;차트만 보지 말고 들어온 달러를 봐라.&rdquo;
        </div>
      </div>

      {/* ① 유동성 게이지 — 전체 시총 추이 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>💧 시장 유동성 게이지</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>전체 USD 스테이블코인 시총(매수 대기 자금)</span>
          <span style={{ marginLeft: 'auto', color: '#26a17b', fontWeight: 800, fontSize: 14 }}>{fmtB(d.totalMcap)}</span>
          {d.mcapChange30d != null && <span style={{ color: liqUp ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 12 }}>30일 {liqUp ? '▲' : '▼'} {d.mcapChange30d}%</span>}
        </div>
        <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          {liqUp ? '🟢 스테이블 시총 증가 = 신규 달러가 시장에 유입(매수 대기 자금↑·강세 연료)' : '🔴 스테이블 시총 감소 = 자금이 빠져나가는 중(현금화·유동성 둔화)'}
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={d.mcapSeries} margin={{ top: 6, right: 10, left: 6, bottom: 2 }}>
            <defs><linearGradient id="stbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#26a17b" stopOpacity={0.4} /><stop offset="100%" stopColor="#26a17b" stopOpacity={0.02} /></linearGradient></defs>
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(0, 7)} tick={{ fill: '#8599ae', fontSize: 10 }} minTickGap={44} />
            <YAxis tick={{ fill: '#8599ae', fontSize: 10 }} tickFormatter={fmtB} width={48} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={mcapTip} labelStyle={{ color: '#cbd5e1' }} />
            <Area dataKey="mcap" stroke="#26a17b" strokeWidth={2} fill="url(#stbl)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 🪙 스테이블코인 도미넌스 — 코인판 현금 비중 */}
      {d.dominance != null && (() => {
        const z = d.dominanceZone
        const zc = z === 'high' ? '#22c55e' : z === 'low' ? '#ef4444' : '#fbbf24'
        const zlabel = z === 'high' ? '🟢 대기 현금 풍부 (공포·바닥 가능)' : z === 'low' ? '🔴 현금 거의 소진 (과열·리스크온 정점 가능)' : '🟡 중립'
        const zdesc = z === 'high'
          ? '스테이블코인(현금)이 시장에 많이 쌓여 있습니다 — 투자자들이 위험을 줄이고 대기 중. 역사적으로 공포·바닥 구간에서 높아지며, 이 현금이 다시 코인으로 들어오면 강세 연료가 됩니다.'
          : z === 'low'
          ? '현금이 대부분 코인에 들어가 있습니다 — 추가 매수 여력이 적은 과열 신호일 수 있습니다. 조정 시 받쳐줄 현금이 부족합니다.'
          : '현금 비중이 중간 수준입니다.'
        // 게이지 위치: 5~16% 범위로 매핑
        const pos = Math.max(0, Math.min(100, ((d.dominance - 5) / 11) * 100))
        return (
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>🪙 스테이블코인 도미넌스</span>
              <span style={{ color: '#8a9aaa', fontSize: 11 }}>= 스테이블 시총 ÷ 전체 암호 시총 = 코인판 &lsquo;현금 비중&rsquo;</span>
              <span style={{ marginLeft: 'auto', color: zc, fontWeight: 900, fontSize: 18, fontFamily: 'monospace' }}>{d.dominance}%</span>
            </div>
            {/* 게이지 바: 좌=현금소진(과열) ↔ 우=현금풍부(공포) */}
            <div style={{ position: 'relative', height: 12, background: 'linear-gradient(90deg,#ef4444,#fbbf24,#22c55e)', borderRadius: 6, opacity: 0.85, marginBottom: 4 }}>
              <div style={{ position: 'absolute', left: `${pos}%`, top: -3, transform: 'translateX(-50%)', width: 4, height: 18, background: '#e2e8f0', borderRadius: 2, boxShadow: '0 0 4px #000' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#8a9aaa', marginBottom: 8 }}>
              <span>5% 현금소진(과열)</span><span>~10% 중립</span><span>16% 현금풍부(공포)</span>
            </div>
            <div style={{ background: `${zc}12`, border: `1px solid ${zc}33`, borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ color: zc, fontWeight: 800, fontSize: 12, marginBottom: 2 }}>{zlabel}</div>
              <div style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.6 }}>{zdesc}</div>
            </div>
            <div style={{ color: '#8a9aaa', fontSize: 9.5, marginTop: 6 }}>※ 주식의 &lsquo;현금 비중·칵테일 파티 지수&rsquo;와 같은 역발상 지표 — 전체 암호 시총 {d.cryptoMcap != null ? fmtB(d.cryptoMcap) : '—'} 기준. 절대 매매 신호 아님(교육용).</div>
          </div>
        )
      })()}

      {/* ② 페그·종류 모니터 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* 종류별 위험도 */}
        <div style={{ flex: '1 1 300px', background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 3 }}>🔍 담보 종류별 위험도</div>
          <div style={{ color: '#7f93a8', fontSize: 10.5, marginBottom: 10 }}>무엇으로 1달러를 보증하나 — 담보 구조가 안전도를 가른다</div>
          {d.byMech.map(m => (
            <div key={m.mechanism} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: RISK[m.risk].c, display: 'inline-block' }} />
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{m.ko}</span>
                <span style={{ color: RISK[m.risk].c, fontSize: 10, fontWeight: 700 }}>{RISK[m.risk].ko}</span>
                <span style={{ marginLeft: 'auto', color: '#cbd5e1', fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace' }}>{fmtB(m.mcap)} · {m.share}%</span>
              </div>
              <div style={{ height: 7, background: '#0f1117', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${m.share}%`, height: '100%', background: RISK[m.risk].c, borderRadius: 4 }} />
              </div>
            </div>
          ))}
          <div style={{ color: '#8a9aaa', fontSize: 9.5, lineHeight: 1.5, marginTop: 4 }}>
            법정담보(USDT·USDC)=현금·국채 보유 → 상대 안전 · 알고리즘(무담보)=코드로 페그 유지 → <b style={{ color: '#f87171' }}>테라(UST) 붕괴의 주범</b>. 알고리즘 비중이 0%에 가까운 건 시장이 위험을 학습한 결과.
          </div>
        </div>

        {/* 페그 모니터 + Top */}
        <div style={{ flex: '1 1 340px', background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🎯 페그 안정성 모니터</span>
            <span style={{ marginLeft: 'auto', color: d.depegAlerts.length ? '#f87171' : '#4ade80', fontSize: 11, fontWeight: 700 }}>{d.depegAlerts.length ? `⚠️ ${d.depegAlerts.length}종 이탈` : '✓ 주요 코인 페그 안정'}</span>
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10.5, marginBottom: 9 }}>$1 페그 유지 여부 — 0.5%↑ 벗어나면 경보(USDC SVB 사태 $0.87)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.coins.slice(0, 7).map(c => {
              const dev = c.depegPct ?? 0
              // +2%↑ 지속 초과 = 이자 누적형(yield, 의도적 $1 초과) — 페그 깨진 게 아니라 정상. 경보(빨강) 아님
              const isYield = dev > 2
              const alert = !isYield && Math.abs(dev) >= 0.5   // 진짜 페그 이탈만 빨강
              return (
                <div key={c.symbol} title={isYield ? '이자 누적형(yield-bearing) — $1 초과가 설계상 정상(고정 페그 코인 아님)' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f1117', border: `1px solid ${alert ? '#ef444455' : BORDER}`, borderRadius: 8, padding: '6px 11px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12, minWidth: 52 }}>{c.symbol}</span>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: RISK[c.risk].c, display: 'inline-block' }} title={c.mechKo} />
                  {isYield && <span style={{ color: '#a78bfa', fontSize: 9, fontWeight: 700 }}>이자형</span>}
                  <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{fmtB(c.mcap)} · {c.share}%</span>
                  <span style={{ marginLeft: 'auto', color: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}>${c.price != null ? c.price.toFixed(4) : '—'}</span>
                  <span style={{ color: alert ? '#f87171' : isYield ? '#a78bfa' : '#8a9aaa', fontSize: 10.5, fontWeight: 700, fontFamily: 'monospace', minWidth: 48, textAlign: 'right' }}>{dev >= 0 ? '+' : ''}{dev}%</span>
                </div>
              )
            })}
          </div>
          <div style={{ color: '#8a9aaa', fontSize: 9.5, marginTop: 6 }}>상위 2종(USDT·USDC) 점유율 {concentration.toFixed(0)}% — 소수 집중도 자체가 시스템 리스크(한 곳 흔들리면 전체 충격).</div>
        </div>
      </div>

      {/* ⛓️ 체인별 분포 — 어느 생태계로 달러가 흐르나 */}
      {d.chains && d.chains.length > 0 && (() => {
        const CHC = ['#627eea', '#ef4444', '#14f195', '#f3ba2f', '#06b6d4', '#a78bfa', '#64748b']
        return (
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>⛓️ 체인별 분포</span>
              <span style={{ color: '#8a9aaa', fontSize: 11 }}>스테이블코인(달러)이 어느 생태계에 있나</span>
            </div>
            <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 9, lineHeight: 1.5 }}>
              달러가 모인 체인이 곧 거래·디파이가 활발한 생태계 — <b style={{ color: '#aab6c4' }}>자금이 어디로 이동하는지</b>(예: 솔라나 부상)를 읽는 단서.
            </div>
            {/* 누적 바 */}
            <div style={{ display: 'flex', height: 14, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
              {d.chains.map((c, i) => <div key={c.name} style={{ width: `${c.share}%`, background: CHC[i % CHC.length] }} title={`${c.name} ${c.share}%`} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.chains.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: CHC[i % CHC.length], display: 'inline-block' }} />
                  <span style={{ color: '#e2e8f0', fontWeight: 600, minWidth: 110 }}>{c.name}</span>
                  <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontFamily: 'monospace' }}>{fmtB(c.mcap)}</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace', minWidth: 44, textAlign: 'right' }}>{c.share}%</span>
                </div>
              ))}
            </div>
            <div style={{ color: '#8a9aaa', fontSize: 9.5, marginTop: 7, lineHeight: 1.5 }}>이더리움·트론이 양대 축(USDT는 트론에서 송금·USDC는 이더리움 중심) · 신생 체인(솔라나·Base) 비중 증가 = 그쪽으로 자금·활동이 이동 중이라는 신호.</div>
          </div>
        )
      })()}

      {/* ③ 디페깅 스트레스 시뮬레이터 */}
      <DepegSimulator />

      <div style={{ color: '#8a9aaa', fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 데이터=DefiLlama 스테이블코인(무료·무키, USD 페그 기준) · 6h 캐시 · 담보 상세 구성(국채 vs 현금 %)은 분기 공시(attestation)라 종류·페그로 대체 · 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}

// ③ 디페깅 스트레스 시뮬레이터 — 법정담보 vs 알고리즘 붕괴 메커니즘 체감(데이터 무관·순수 교육)
function DepegSimulator() {
  const [shock, setShock] = useState(20)   // 시장 신뢰 충격(매도 압력) %
  const [amount, setAmount] = useState(1000)   // 내 투자금(만원) — 손실 체감용
  const fmtMan = (won: number) => won >= 1e8 ? `${(won / 1e8).toFixed(2)}억` : `${Math.round(won).toLocaleString('ko-KR')}만`

  const sim = useMemo(() => {
    // 법정담보: 담보(현금·국채)로 1:1 상환 → 충격의 일부만 일시 반영, 빠르게 회복. 60% 충격까진 0.97 사수
    const fiatPrice = Math.max(0.95, 1 - (shock / 100) * 0.06)
    // 알고리즘(UST식): 담보 없이 자매코인(LUNA) 차익거래로 페그 유지. 임계(약 25%) 넘으면 데스스파이럴 → 0
    const k = shock / 100
    const algoPrice = k < 0.25 ? 1 - k * 0.3 : Math.max(0, 0.925 - (k - 0.25) * 1.23)   // 25%↑부터 급락 → 100%서 0
    return {
      fiat: +fiatPrice.toFixed(3),
      algo: +algoPrice.toFixed(3),
      spiral: k >= 0.25,
    }
  }, [shock])

  const Bar = ({ label, price, color, note }: { label: string; price: number; color: string; note: string }) => {
    const remainWon = amount * 1e4 * price
    const lossPct = Math.round((1 - price) * 100)
    return (
    <div style={{ flex: '1 1 200px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '11px 13px' }}>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative', height: 12, background: '#1e293b', borderRadius: 6, marginBottom: 5 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, price * 100)}%`, background: color, borderRadius: 6, transition: 'width 0.2s' }} />
      </div>
      <div style={{ color: price >= 0.97 ? '#4ade80' : price >= 0.9 ? '#fbbf24' : '#f87171', fontWeight: 900, fontSize: 18, fontFamily: 'monospace' }}>${price.toFixed(3)} <span style={{ fontSize: 11, color: '#8a9aaa' }}>(페그 −{lossPct}%)</span></div>
      {/* 💸 내 자산 손실 체감 */}
      <div style={{ marginTop: 5, fontSize: 11 }}>
        <span style={{ color: '#8a9aaa' }}>내 {fmtMan(amount * 1e4)}원 → </span>
        <b style={{ color: price >= 0.97 ? '#4ade80' : price >= 0.5 ? '#fbbf24' : '#f87171' }}>{fmtMan(remainWon)}원 남음</b>
        {lossPct > 0 && <span style={{ color: '#f87171' }}> (−{fmtMan(amount * 1e4 - remainWon)}원)</span>}
      </div>
      <div style={{ color: '#8a9aaa', fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>{note}</div>
    </div>
  )}

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 3 }}>📉 디페깅 스트레스 시뮬레이터</div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 11, lineHeight: 1.5 }}>시장 신뢰 충격(대량 매도)을 키워보세요 — 같은 충격에도 <b style={{ color: '#22c55e' }}>법정담보</b>는 버티고 <b style={{ color: '#ef4444' }}>알고리즘</b>은 어느 순간 붕괴합니다. <b style={{ color: '#aab6c4' }}>내 투자금</b>을 넣으면 손실이 얼마인지 직접 보입니다.</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ color: '#8a9aaa', fontSize: 11, minWidth: 90 }}>신뢰 충격(매도)</span>
        <input type="range" min={0} max={100} value={shock} onChange={e => setShock(Number(e.target.value))} style={{ flex: 1, accentColor: '#ef4444' }} />
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, fontFamily: 'monospace', minWidth: 44, textAlign: 'right' }}>{shock}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ color: '#8a9aaa', fontSize: 11, minWidth: 90 }}>내 투자금</span>
        <input value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1))}
          style={{ width: 70, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }} />
        <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>만원</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Bar label="🏦 법정화폐 담보 (USDC식)" price={sim.fiat} color="#22c55e" note="현금·국채를 1:1 보유 → 들고 오면 1달러로 상환. 일시 흔들려도 담보가 페그를 방어." />
        <Bar label="⚙️ 알고리즘 무담보 (UST식)" price={sim.algo} color={sim.spiral ? '#ef4444' : '#fbbf24'} note={sim.spiral ? '🚨 데스 스파이럴! 페그 하락→자매코인 무한 발행→가격 폭락→더 큰 이탈. 2022 테라 $18B가 며칠 만에 $0.' : '담보 없이 차익거래로 페그 유지 — 신뢰가 깨지는 임계점(약 25%)까진 버티는 듯 보임.'} />
      </div>

      <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, padding: '9px 12px', color: '#dbe3ec', fontSize: 11, lineHeight: 1.7 }}>
        🎓 <b style={{ color: '#f87171' }}>2022년 테라/루나 사태</b> — 알고리즘 스테이블코인 UST는 평소 $1을 잘 지켰지만, 대량 인출이 임계를 넘자 <b>며칠 만에 $1→$0.01</b>로 붕괴(시총 $18B 증발). &ldquo;평소 멀쩡하다&rdquo;가 안전을 보장하지 않습니다 — <b>담보의 질</b>이 본질입니다. 고수익(이자)을 미끼로 한 무담보 코인을 특히 경계하세요.
      </div>
    </div>
  )
}
