'use client'
// 🎯 통합 4축 추천 UI — 계절(방향)×펀더멘탈(가치)×수급(연료)×모멘텀(Fwd EPS·주가추세) 융합 + 투명 소점수
import { useState, useEffect } from 'react'
import type { UnifiedRecoResult, UnifiedRecoItem, RegionRefItem } from '@/app/api/unified-reco/route'
import type { CountryVolItem } from '@/lib/countryVolShared'
import { VOL_META, volForStock } from '@/lib/countryVolShared'
import InvestorTimeline from '@/app/components/InvestorTimeline'
import TimingBadge from '@/app/components/TimingBadge'
import TradePlanCard from '@/app/components/TradePlanCard'
import { TK } from '@/lib/theme'
import { marketFlag } from '@/lib/globalTickers'

const CARD = TK.bg6, BORDER = TK.border
const AX = { season: TK.amber500, value: TK.green500, quality: '#2dd4bf', supply: TK.blue400, momentum: TK.violet400, rotation: '#f472b6' }  // 가치/퀄리티/모멘텀/주도섹터/수급/계절 축 색
const fmtWon = (w: number) => w >= 1e8 ? `${(w / 1e8).toFixed(1)}억원` : `${Math.round(w / 1e4)}만원`
// 해외 접미사(.PA·.T·.HK 등)가 없는 티커 = 미국 상장 ADR → 국기가 🇺🇸로 나옴(에퀴노르·핀둬둬 등). 원래 국적을 별도 마커로 표시
const isUsListedForeign = (ticker: string) => !/\.(PA|DE|MI|SW|L|AS|MC|CO|ST|OL|HE|HK|T|SS|SZ)$/i.test(ticker)
// 원래 국적 마커 pill(미국 ADR로 상장된 유럽/일본/중국 기업 옆에 "원래 ○○ 기업" 표시)
const OriginTag = ({ origin }: { origin: 'EU' | 'JP' | 'CN' }) => {
  const label = origin === 'EU' ? '🇪🇺 유럽 기업·미국 ADR' : origin === 'JP' ? '🇯🇵 일본 기업·미국 ADR' : '🇨🇳 중국 기업·미국 ADR'
  return <span style={{ fontSize: 9, fontWeight: 700, color: '#93c5fd', background: 'rgba(59,130,246,0.13)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{label}</span>
}
// ⚠️ 중국 고유 리스크 칩(ADR VIE·상장폐지·정부개입) — 교육용 캐비엇. 중국 종목 옆에 표시
const ChinaRiskChip = () => (
  <span title="중국 종목 고유 리스크 — 미국 ADR은 VIE 구조(실소유 아님)·미·중 갈등 상장폐지 위험, 본토 A주는 외국인 접근 제한(Stock Connect), 정부 개입·자본통제. 변동성·규제 리스크가 큰 편." style={{ fontSize: 9, fontWeight: 700, color: TK.red400, background: `${TK.red400}18`, border: `1px solid ${TK.red400}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>⚠️ 중국 리스크</span>
)

// 🎯 매수 타점 하이라이트 — 타점 신호등(green)·라쉬케(첫 눌림목)·스퀴즈(상방 분출) SSOT 재사용.
//   ⛔ 점수·선정·정렬 불변(시각 강조만). prime=진입적기+급소 트리거·깨끗 / ready=진입적기·깨끗. 과대이격·하락 다이버전스면 제외
type BuyTier = 'prime' | 'ready' | null
function buyTierOf(t: UnifiedRecoItem['timing']): { tier: BuyTier; reason: string } {
  if (!t) return { tier: null, reason: '' }
  const rk = t.raschke, sp = t.supply
  const dirty = !!(sp?.overExtended || rk?.bearDiv)   // 기관평단 과대이격·신고가권 에너지 소진 = 깨끗한 매수 타점 아님
  const trig: string[] = []
  if (rk?.pullback) trig.push('🎼 첫 눌림목(최적 타점)')
  if (sp?.squeezeFired === 'up') trig.push('🔥 변동성 상방 분출')
  if (t.light === 'green' && !dirty && trig.length) return { tier: 'prime', reason: trig.join(' · ') }
  if (t.light === 'green' && !dirty) return { tier: 'ready', reason: '정배열 · 구름 위' }
  return { tier: null, reason: '' }
}

function MiniBar({ label, score, color, unknown }: { label: string; score: number; color: string; unknown?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 78 }}>
      {/* 라벨 옆에 점수를 바로 붙여 표시 — 세 축 모두 명확히(수급 점수 낮아도 안 묻힘) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 9.5, marginBottom: 2 }}>
        <span style={{ color: TK.sub }}>{label}</span>
        <span style={{ color: unknown ? TK.sub2 : color, fontWeight: 800, fontFamily: 'monospace', fontSize: 11 }}>{unknown ? '미집계' : score}</span>
      </div>
      <div style={{ height: 5, background: TK.bg3, borderRadius: 3, overflow: 'hidden' }}>
        {unknown
          ? <div style={{ width: '100%', height: '100%', background: `repeating-linear-gradient(45deg,${TK.border},${TK.border} 3px,${TK.bg3} 3px,${TK.bg3} 6px)` }} />
          : <div style={{ width: `${score}%`, height: '100%', background: color }} />}
      </div>
    </div>
  )
}

// 🌪️ 국가 시장 변동성 칩 — 극단·높음일 때만(평온·보통은 노이즈라 생략). ⛔ 점수 미반영, 리스크 맥락만
function CountryVolChip({ v }: { v: CountryVolItem }) {
  if (v.verdict !== 'extreme' && v.verdict !== 'high') return null
  const m = VOL_META[v.verdict]
  const tip = `${v.label} 20일 실현변동성 ${v.vol20}%(자국 5년 백분위 ${v.pctile}%) · 최근 20일 중 ±3% 급변동 ${v.big3}일 · 52주 고점 대비 ${v.drawdown}%. ${m.guide}`
  return (
    <span title={tip} style={{ fontSize: 9.5, fontWeight: 800, color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      🌪️ {v.flag} {v.verdict === 'extreme' ? '시장 극단 변동' : '시장 변동성↑'}
    </span>
  )
}

function Item({ it, portfolioKrw, vol }: { it: UnifiedRecoItem; portfolioKrw: number; vol?: CountryVolItem | null }) {
  const [open, setOpen] = useState(false)
  const cc = it.combined >= 80 ? TK.green500 : it.combined >= 60 ? TK.amber500 : TK.sub
  const { tier, reason } = buyTierOf(it.timing)
  const prime = tier === 'prime', ready = tier === 'ready'
  const cardStyle = prime
    ? { background: `linear-gradient(135deg,rgba(251,191,36,0.13),rgba(34,197,94,0.05) 45%,${TK.bg3} 78%)`, borderRadius: 10, border: `1.5px solid ${TK.amber400}`, padding: '11px 13px', overflow: 'hidden' as const }
    : ready
      ? { background: `linear-gradient(135deg,rgba(34,197,94,0.09),${TK.bg3} 62%)`, borderRadius: 10, border: `1.5px solid ${TK.green500}99`, padding: '11px 13px', overflow: 'hidden' as const, boxShadow: '0 0 14px rgba(34,197,94,0.12)' }
      : { background: TK.bg3, borderRadius: 10, border: `1px solid ${cc}33`, padding: '11px 13px' }
  return (
    <div className={prime ? 'ur-prime' : undefined} style={cardStyle}>
      {tier && (
        <div className={prime ? 'ur-prime-strip' : undefined} style={{ margin: '-11px -13px 10px', padding: '6px 13px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, ...(prime ? { color: '#3a2c05' } : { background: 'rgba(34,197,94,0.15)', color: TK.green300 }) }}>
          <span style={{ fontSize: 13 }}>{prime ? '🎯' : '🟢'}</span>
          <span>{prime ? '지금이 매수 타점' : '진입 적기'}</span>
          <span style={{ fontWeight: 600, opacity: 0.9, fontSize: 10.5 }}>· {reason}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 11 }}>{marketFlag(it.ticker, it.market === 'KR' ? 'KR' : 'US')}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>{it.name}</span>
        {(it.origin === 'EU' || it.origin === 'JP' || it.origin === 'CN') && isUsListedForeign(it.ticker) && <OriginTag origin={it.origin} />}
        {it.origin === 'CN' && <ChinaRiskChip />}
        {vol && <CountryVolChip v={vol} />}
        <span style={{ color: TK.sub, fontSize: 11 }}>{it.sector}</span>
        {it.peg != null && it.peg > 0 && it.peg < 1 && <span style={{ color: TK.blue400, fontSize: 10.5, fontFamily: 'monospace' }}>PEG {it.peg.toFixed(2)}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ color: cc, fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{it.combined}</span>
          <span style={{ color: TK.sub, fontSize: 10 }}>통합</span>
        </span>
      </div>
      {/* 투명 6축 — 가치·퀄리티·모멘텀·주도섹터·수급·계절 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <MiniBar label="💎 가치" score={it.valueScore} color={AX.value} />
        <MiniBar label="🏰 퀄리티" score={it.qualityScore} color={AX.quality} />
        <MiniBar label="📈 모멘텀" score={it.momentumScore} color={AX.momentum} />
        <MiniBar label="🧭 주도섹터" score={it.rotationScore} color={AX.rotation} />
        <MiniBar label={it.supplyProxy ? '💰 수급*' : '💰 수급'} score={it.supplyScore} color={AX.supply} unknown={!it.supplyKnown} />
        <MiniBar label="🌦️ 계절" score={it.seasonScore} color={AX.season} />
      </div>
      {/* 💰 권장 편입 금액 + 배지 */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        {it.suggestWon > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.12)', border: `1px solid ${TK.green500}55`, borderRadius: 7, padding: '2px 9px' }}>
            <span style={{ color: TK.green500, fontWeight: 800, fontSize: 10.5 }}>💰 권장 편입</span>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{fmtWon(it.suggestWon)}</span>
            <span style={{ color: TK.sub, fontSize: 9.5 }}>(포트 {it.suggestWeight}%)</span>
          </span>
        )}
        {it.badges.map(b => <span key={b} style={{ background: 'rgba(148,163,184,0.1)', color: TK.slate300, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '1px 7px', fontSize: 10 }}>{b}</span>)}
        {/* 💪 상대강도 — 지수 대비 20일 초과수익. ⛔ 점수 미반영·표시 전용.
            ⚠️ 툴팁에 백테스트 한계를 반드시 병기한다 — 수치만 보면 학생이 '이거 사면 되겠네'로 읽는데
               우리 실측은 그 반대다(하락장에서 버틴 종목이 이후 20봉 −2.83%p). */}
        {it.rsVsMarket != null && Math.abs(it.rsVsMarket) >= 5 && (
          <span title={`자국 지수 대비 최근 20거래일 초과수익 ${it.rsVsMarket > 0 ? '+' : ''}${it.rsVsMarket}%p — 시장보다 ${it.rsVsMarket > 0 ? '잘 버텼다' : '더 빠졌다'}는 '과거' 사실입니다.

⚠️ 앞으로의 예측이 아닙니다. 자체 백테스트(58종목·28,910봉)에서 상대강도는 예측력이 확인되지 않았고, 특히 하락장에서는 잘 버틴 종목이 이후 20봉 동안 오히려 못했습니다(−2.83%p). 그래서 점수에는 반영하지 않습니다.`}
            style={{ background: it.rsVsMarket > 0 ? 'rgba(45,212,191,0.10)' : 'rgba(248,113,113,0.10)',
              color: it.rsVsMarket > 0 ? TK.teal400 : TK.red400,
              border: `1px solid ${it.rsVsMarket > 0 ? TK.teal400 : TK.red400}44`,
              borderRadius: 6, padding: '1px 7px', fontSize: 10, whiteSpace: 'nowrap' }}>
            💪 지수 대비 {it.rsVsMarket > 0 ? '+' : ''}{it.rsVsMarket}%p<span style={{ opacity: 0.7 }}> (과거·점수 미반영)</span>
          </span>
        )}
      </div>
      {/* 🚦 타점 신호등(WHEN 레이어) — 점수·순위와 무관, 진입 타이밍+ATR 손절 참고. ticker 전달 → 🇪🇺 유럽 종목은 €·CHF 등 손절가 정확 표기 */}
      {it.timing && <div style={{ marginBottom: 6 }}><TimingBadge t={it.timing} market={it.market} ticker={it.ticker} /></div>}
      {/* 📋 매매 플랜(1% 리스크 룰 포지션 사이저) — 종목 통화(EUR·CHF·GBp 등)를 ₩로 환산해 수량 계산(🇪🇺 유럽 종목 포함) */}
      {it.timing && it.timing.price != null && portfolioKrw > 0 && (
        <TradePlanCard market={it.market} timing={it.timing} portfolioKrw={portfolioKrw} currency={it.currency}
          volWarn={vol && vol.verdict === 'extreme' ? { flag: vol.flag, label: vol.label, pctile: vol.pctile, big3: vol.big3, vol20: vol.vol20 } : null} />
      )}
      {/* 🔬 ETF 분산 대안 — 같은 섹터를 ETF로 분산 진입(점수·순위와 무관, 분산 선택지 병기) */}
      {it.etfAlt && (
        <div style={{ marginTop: 2, marginBottom: 6, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ color: TK.blue300, fontWeight: 800, fontSize: 10.5 }}>🔬 ETF 분산 대안</span>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>{it.etfAlt.market === 'KR' ? '🇰🇷' : '🇺🇸'} {it.etfAlt.name}</span>
            <span style={{ color: TK.sub, fontSize: 10, fontFamily: 'monospace' }}>{it.etfAlt.ticker}</span>
            <span style={{ color: TK.sub, fontSize: 10 }}>· {it.etfAlt.sectorLabel} 섹터 분산</span>
            {it.etfAlt.blendedPeg != null && (
              <span style={{ color: TK.blue400, fontSize: 10, fontFamily: 'monospace' }}>합산 PEG {it.etfAlt.blendedPeg.toFixed(2)}{it.etfAlt.pegCoverage != null ? ` (커버 ${it.etfAlt.pegCoverage}%)` : ''}</span>
            )}
          </div>
          {it.etfAlt.timing && <div style={{ marginBottom: 3 }}><TimingBadge t={it.etfAlt.timing} market={it.etfAlt.market} compact /></div>}
          <div style={{ color: TK.sub, fontSize: 9, lineHeight: 1.4 }}>
            개별주가 부담되면 같은 섹터를 ETF로 분산 진입{it.etfAlt.isFallback ? ' · ⚠️ 국내 대응 ETF 없어 미국 섹터 ETF' : ''} · 광의 섹터라 세부 업종과는 다를 수 있음(참고)
          </div>
        </div>
      )}
      {it.market === 'KR' && (
        <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: open ? TK.indigo300 : TK.indigo400, border: `1px solid ${open ? `${TK.indigo400}66` : `${TK.indigo400}33`}` }}>
          📅 {open ? '매매동향 접기' : '최근 20일 매매동향'}
        </button>
      )}
      {open && it.market === 'KR' && <div style={{ marginTop: 6 }}><InvestorTimeline ticker={it.ticker} name={it.name} /></div>}
    </div>
  )
}

// 🌍 지역 커버리지 참고 행(순위 무관·경량) — merit 밖 한국·유럽 대표 후보
function RefRow({ r }: { r: RegionRefItem }) {
  return (
    <div style={{ background: TK.bg3, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '7px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ fontSize: 11 }}>{marketFlag(r.ticker, r.market === 'KR' ? 'KR' : 'US')}</span>
        <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12.5 }}>{r.name}</span>
        {(r.region === 'EU' || r.region === 'JP' || r.region === 'CN') && isUsListedForeign(r.ticker) && <OriginTag origin={r.region} />}
        {r.region === 'CN' && <ChinaRiskChip />}
        <span style={{ color: TK.sub, fontSize: 10.5 }}>{r.sector}</span>
        {r.peg != null && r.peg > 0 && r.peg < 1 && <span style={{ color: TK.blue400, fontSize: 10, fontFamily: 'monospace' }}>PEG {r.peg.toFixed(2)}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ color: TK.slate300, fontWeight: 800, fontSize: 15, fontFamily: 'monospace' }}>{r.combined}</span>
          <span style={{ color: TK.sub, fontSize: 9 }}>통합</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <MiniBar label="💎 가치" score={r.valueScore} color={AX.value} />
        <MiniBar label="🏰 퀄리티" score={r.qualityScore} color={AX.quality} />
        <MiniBar label="📈 모멘텀" score={r.momentumScore} color={AX.momentum} />
        <MiniBar label="🧭 주도섹터" score={r.rotationScore} color={AX.rotation} />
        <MiniBar label={r.supplyProxy ? '💰 수급*' : '💰 수급'} score={r.supplyScore} color={AX.supply} unknown={!r.supplyKnown} />
        <MiniBar label="🌦️ 계절" score={r.seasonScore} color={AX.season} />
      </div>
    </div>
  )
}

export default function UnifiedReco() {
  const [data, setData] = useState<UnifiedRecoResult & { warming?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/unified-reco', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j.error ? null : j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🎯 가치·퀄리티·모멘텀·주도섹터·수급·계절 6축을 융합해 통합 추천을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>통합 추천 데이터를 불러오지 못했습니다.</div>
  if (data.warming || data.items.length === 0) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🎯 추천 유니버스를 준비 중입니다. 거시경제 AI 추천 탭을 한 번 열어 데이터를 적재한 뒤 다시 시도해 주세요.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        @keyframes urcGlow{0%,100%{box-shadow:0 0 0 1px rgba(251,191,36,.32),0 3px 16px rgba(251,191,36,.14)}50%{box-shadow:0 0 0 1px rgba(251,191,36,.62),0 5px 26px rgba(251,191,36,.34)}}
        @keyframes urcShine{0%{background-position:-160% 0}100%{background-position:160% 0}}
        .ur-prime{animation:urcGlow 2.6s ease-in-out infinite}
        .ur-prime-strip{background:linear-gradient(100deg,rgba(251,191,36,.4),rgba(253,224,71,.72) 50%,rgba(251,191,36,.4));background-size:200% 100%;animation:urcShine 3.2s linear infinite}
        @media (prefers-reduced-motion:reduce){.ur-prime{animation:none;box-shadow:0 0 0 1px rgba(251,191,36,.55),0 4px 18px rgba(251,191,36,.2)}.ur-prime-strip{animation:none}}
      `}</style>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg,rgba(245,158,11,0.10),rgba(96,165,250,0.06))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ color: TK.amber500, fontWeight: 800, fontSize: 12, marginBottom: 3 }}>통합 추천 — 가치 × 퀄리티 × 모멘텀 × 주도섹터 × 수급 × 계절 융합</div>
          <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6 }}>
            💎가치(PEG·어닝일드·FCF)·🏰퀄리티(영업이익률·ROE·저부채·이익질)·📈모멘텀(Fwd EPS·주가추세)·🧭주도섹터(지금 돈이 도는 섹터)·💰수급(스마트머니)·🌦️계절(매크로)을 <b>하나의 점수</b>로 합칩니다. <b>펀더멘탈(가치+퀄리티 45%)이 앵커</b>이고 수급·모멘텀·주도섹터는 가볍게 — 여섯 축이 모두 높은 종목이 최상위. 왜 추천됐는지 소점수로 투명하게.
          </div>
          <div style={{ color: TK.sub2, fontSize: 11, marginTop: 4 }}>
            통합 = 💎 가치 {Math.round(data.weights.value * 100)}% + 🏰 퀄리티 {Math.round(data.weights.quality * 100)}% + 📈 모멘텀 {Math.round(data.weights.momentum * 100)}% + 🧭 주도섹터 {Math.round(data.weights.rotation * 100)}% + 💰 수급 {Math.round(data.weights.supply * 100)}% + 🌦️ 계절 {Math.round(data.weights.season * 100)}%
            {data.usSeason && <> · 🇺🇸 {data.usSeason.label.split(' ')[0]} · 🇰🇷 {data.krSeason.label.split(' ')[0]}</>}
          </div>
          {data.selectionRule && <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 3 }}>📋 선별 기준: {data.selectionRule} → 총 <b style={{ color: TK.slate300 }}>{data.items.length}종</b></div>}
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 3 }}>🎯 <b style={{ color: TK.amber400 }}>금색 하이라이트</b> = 기술적 <b>매수 타점(진입 적기 + 급소 트리거)</b>이 온 종목 · 🟢 초록 = 진입 적기. <span style={{ color: TK.sub2 }}>WHAT(점수)은 펀더멘탈, WHEN(타점)은 기술 — 점수엔 미반영, 시각 강조만.</span></div>
          {data.portfolioKrw > 0 && <div style={{ color: TK.green300, fontSize: 10.5, marginTop: 2 }}>💰 권장 편입 = 포트폴리오({fmtWon(data.portfolioKrw)}) 기준 통합점수 1.5~2.5%{data.regimeMult < 1 && <> × 국면 조정 {Math.round(data.regimeMult * 100)}%</>} · 분할 신규 편입 기준</div>}
          {data.momCrash && (
            <div style={{ marginTop: 7, background: '#2a1c0e', border: `1px solid ${TK.amber700}`, borderRadius: 8, padding: '7px 11px', fontSize: 11, color: '#fdba74', lineHeight: 1.55 }}>
              ⚠️ <b>모멘텀 크래시 주의 국면</b>(승패 해부실 실측) — 지금은 낙폭과대주(12개월 패자)가 승자보다 더 오르는 반전 장입니다.
              모멘텀 좋은 종목의 추격 매수가 가장 잘 무너지는 구간(Daniel-Moskowitz 2016) — 분할·신중 진입을 권합니다. 점수에는 미반영(정보 캐비엇).
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map(it => <Item key={`${it.market}-${it.ticker}`} it={it} portfolioKrw={data.portfolioKrw} vol={volForStock(it.ticker, it.origin, data.volByOrigin)} />)}
      </div>

      {/* 🌍 지역 커버리지(참고 · 순위 무관) — merit 밖의 한국·유럽 대표 후보 */}
      {data.reference && data.reference.length > 0 && (
        <div style={{ background: TK.bg6, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: TK.slate200, marginBottom: 3 }}>🌍 지역 커버리지 <span style={{ fontSize: 10.5, color: TK.sub, fontWeight: 600 }}>— 참고 · 순위 무관</span></div>
          <div style={{ fontSize: 10.5, color: TK.sub, lineHeight: 1.55, marginBottom: 10 }}>
            종합 랭킹(위 {data.items.length}종)엔 못 들었지만 앱이 함께 채점·커버하는 <b>🇰🇷 한국·🇪🇺 유럽·🇯🇵 일본·🇨🇳 중국</b> 대표 후보입니다. <b>억지로 순위에 끼우지 않고</b> 참고로만 — 이 지역이 계절·수급에서 유리해지는 국면엔 위 랭킹으로 올라옵니다.
            {data.euSeason && <> 지금 🇪🇺 <b style={{ color: TK.sub2 }}>{data.euSeason.label.split(' ')[0]}</b></>}{data.jpSeason && <> · 🇯🇵 <b style={{ color: TK.sub2 }}>{data.jpSeason.label.split(' ')[0]}</b></>}{data.cnSeason && <> · 🇨🇳 <b style={{ color: TK.sub2 }}>{data.cnSeason.label.split(' ')[0]}</b> 국면.</>}
          </div>
          {(['KR', 'EU', 'JP', 'CN'] as const).map(reg => {
            const rows = data.reference!.filter(r => r.region === reg)
            if (!rows.length) return null
            const label = reg === 'KR' ? '🇰🇷 한국' : reg === 'EU' ? '🇪🇺 유럽' : reg === 'JP' ? '🇯🇵 일본' : '🇨🇳 중국'
            return (
              <div key={reg} style={{ marginBottom: reg === 'CN' ? 0 : 9 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: TK.sub2, marginBottom: 5 }}>{label} <span style={{ color: TK.sub, fontWeight: 500 }}>({rows.length}종)</span>{reg === 'CN' && <span style={{ color: TK.red400, fontWeight: 500, marginLeft: 6 }}>⚠️ ADR VIE·상장폐지·정부개입 리스크 — 참고만</span>}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {rows.map(r => <RefRow key={r.ticker} r={r} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 통합 점수 = 💎가치(PEG 촘촘·어닝일드 E/P·FCF수익률) + 🏰퀄리티(영업이익률·ROE 자본효율·저부채 재무안정성·이익질) + 📈모멘텀(Fwd EPS·주가추세) + 🧭주도섹터(RRG 상대강도×모멘텀 — 지금 돈이 도는 섹터) + 💰수급(연료) + 🌦️계절(매크로 우대 섹터/분류). 펀더멘탈(가치+퀄리티)이 45%로 앵커입니다. 최종 선별 종목은 ⚙️ <b>ROIC 복리기계</b>(빚까지 반영한 정밀 자본효율)·📈 <b>Fwd EPS 리비전</b>으로 심화 검증해 배지로 표시합니다. <b>수급*</b>는 미국·유럽·일본·중국 종목으로, 해당 거래소가 외국인/기관 일별 수급을 공시하지 않아 MFI·내부자·13F 거인 <b>프록시</b>입니다(한국만 외인/기관/개인 실수급). 프록시조차 못 구한 종목은 <b>빗금(미집계)</b>으로 표시하고 중립 처리합니다 — 잰 척하지 않습니다. PEG는 stock-info SSOT 기준. 보유 종목은 제외했습니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
