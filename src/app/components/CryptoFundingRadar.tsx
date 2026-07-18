'use client'
// 🪙 크립토 펀딩비·OI 과열 레이더 — BTC·ETH·SOL 무기한 선물 펀딩비 + 미결제약정(OI)로 레버리지 froth 감지
//    펀딩 高양(+)=롱 과열(청산 위험) / 음(−)=숏 과밀(역발상 반등). 코인 랩 ₿ 뷰. 경보만.
import { useEffect, useState } from 'react'
import type { CryptoFundingResult, CoinFroth, FundVerdict } from '@/app/api/crypto-funding/route'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'
const V_META: Record<FundVerdict, { color: string; label: string }> = {
  long_hot: { color: TK.red400, label: '롱 과열' },
  short_skew: { color: '#38bdf8', label: '숏 과밀' },
  neutral: { color: TK.green500, label: '정상' },
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${Math.round(v).toLocaleString()}`
}

/** 미니 스파크라인 — 연율화 펀딩(0 기준선, 양=빨강/음=파랑) */
function Spark({ vals }: { vals: number[] }) {
  if (vals.length < 3) return null
  const w = 120, h = 30
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals)
  const rng = max - min || 1
  const x = (i: number) => (i / (vals.length - 1)) * w
  const y = (v: number) => h - ((v - min) / rng) * h
  const zeroY = y(0)
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = vals[vals.length - 1]
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke={TK.slate600} strokeWidth={0.7} strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke={last >= 0 ? TK.red400 : '#38bdf8'} strokeWidth={1.4} />
    </svg>
  )
}

function CoinCard({ c }: { c: CoinFroth }) {
  const m = V_META[c.verdict]
  // 펀딩 게이지: −50%~+100% 매핑
  const gPct = Math.max(0, Math.min(100, ((c.fundingAnnual + 50) / 150) * 100))
  return (
    <div style={{ flex: '1 1 240px', background: TK.bg3, border: `1px solid ${c.verdict !== 'neutral' ? m.color + '55' : BORDER}`, borderRadius: 12, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{c.emoji}</span>
        <b style={{ fontSize: 13.5, color: TK.slate100 }}>{c.name}</b>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: m.color, background: `${m.color}22`, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '2px 7px' }}>
          {c.severity === 'high' ? '🔥 ' : ''}{m.label}
        </span>
      </div>

      {/* 펀딩 연율화 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: c.fundingAnnual >= 30 ? TK.red400 : c.fundingAnnual <= -5 ? '#38bdf8' : TK.slate100, fontFamily: 'monospace' }}>
          {c.fundingAnnual > 0 ? '+' : ''}{c.fundingAnnual.toFixed(1)}%
        </span>
        <span style={{ fontSize: 10, color: TK.sub3 }}>연율 펀딩비</span>
      </div>
      {/* 게이지 */}
      <div style={{ position: 'relative', height: 6, background: TK.bg1, borderRadius: 3, margin: '6px 0 8px' }}>
        <div style={{ position: 'absolute', left: `${(50 / 150) * 100}%`, top: -2, width: 1, height: 10, background: TK.slate500 }} />
        <div style={{ position: 'absolute', left: `${Math.min(gPct, 50 / 150 * 100)}%`, width: `${Math.abs(gPct - 50 / 150 * 100)}%`, height: 6, borderRadius: 3, background: c.fundingAnnual >= 0 ? TK.red400 : '#38bdf8' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: TK.sub2, flexWrap: 'wrap' }}>
        <span>30일평균 <b style={{ color: TK.slate300 }}>{c.fundingAvg30 > 0 ? '+' : ''}{c.fundingAvg30.toFixed(1)}%</b></span>
        <span>백분위 <b style={{ color: TK.slate300 }}>{c.fundingPctile}%</b></span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: TK.sub2, marginTop: 3, flexWrap: 'wrap' }}>
        <span>OI <b style={{ color: TK.slate300 }}>{fmtUsd(c.oiValueUsd)}</b></span>
        {c.oiChange30 != null && (
          <span>30일 <b style={{ color: c.oiBuildup ? TK.amber400 : (c.oiChange30 >= 0 ? TK.green400 : TK.slate400) }}>{c.oiChange30 > 0 ? '+' : ''}{c.oiChange30}%</b>{c.oiBuildup ? ' 🔥' : ''}</span>
        )}
      </div>
      <div style={{ marginTop: 8 }}><Spark vals={c.fundingSpark} /></div>
    </div>
  )
}

export default function CryptoFundingRadar() {
  const [data, setData] = useState<CryptoFundingResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crypto-funding').then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(() => setErr('펀딩비 데이터를 불러오지 못했습니다.'))
  }, [])

  if (err) return (
    <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, fontSize: 12, color: TK.sub3 }}>
      🪙 펀딩비·OI 레이더 — {err === 'binance_unreachable' ? 'Binance 선물 데이터에 일시적으로 접근할 수 없습니다.' : err}
    </div>
  )
  if (!data) return <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, fontSize: 12, color: TK.sub3, textAlign: 'center' }}>🪙 펀딩비·OI 계산 중…</div>

  const om = V_META[data.overall]
  return (
    <div style={{ background: TK.bg2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: TK.slate100 }}>🪙 펀딩비·미결제약정(OI) 과열 레이더</div>
        <div style={{ fontSize: 11, color: TK.sub3, marginTop: 3, lineHeight: 1.5 }}>
          무기한 선물의 <b style={{ color: TK.slate300 }}>펀딩비</b>=롱/숏 어느 쪽이 과밀한가의 온도. 高양(+)=<b style={{ color: TK.red400 }}>롱 과열</b>(청산 위험) / 음(−)=<b style={{ color: '#38bdf8' }}>숏 과밀</b>(역발상 반등). Binance 무료 데이터.
        </div>
      </div>

      {/* 종합 배너 */}
      <div style={{ background: `${om.color}14`, border: `1px solid ${om.color}55`, borderRadius: 10, padding: '10px 13px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TK.slate100 }}>{data.headline}</div>
        <div style={{ fontSize: 11, color: TK.sub2, marginTop: 5, lineHeight: 1.55 }}>{data.note}</div>
      </div>

      {/* 코인 카드 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {data.coins.map(c => <CoinCard key={c.key} c={c} />)}
      </div>

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.55 }}>
        연율 펀딩 = 8h 펀딩비 × 3 × 365. 🔴 ≥30% 롱 과열 / 🔵 ≤−5% 숏 과밀. OI = 미결제약정 명목가(레버리지 총량). ⚠️ 펀딩비는 후행·단기 지표이며 과열이 곧 하락은 아니다(고펀딩 지속 랠리도 흔함) — 경보는 비중·레버리지 점검 신호이지 매매 지시가 아니다. 코인은 ≤5% 소액·잃어도 되는 돈만.
      </div>
    </div>
  )
}
