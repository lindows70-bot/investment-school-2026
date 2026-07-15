'use client'
// 🌟 종목 투자 프로필 카드 — 해자·스타등급(공정가치)·상대 PSR 3초 요약(리서치 상단 캡스톤)
import { isHoldingCompany } from '@/lib/assetClassifier'   // 🏢 지주사 — PSR·동종 비교 부적합(NAV 평가)
import { useState, useEffect } from 'react'
import type { StockProfile } from '@/lib/stockProfile'
import { UNCERTAINTY_KO, MOAT_KO, TREND_KO, STEWARD_KO } from '@/lib/morningstarRating'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const starColor = (n: number) => n >= 4 ? TK.green400 : n >= 3 ? TK.amber400 : TK.red400
const moatColor = (w: string) => w === 'wide' ? TK.amber400 : w === 'moderate' ? TK.blue400 : w === 'narrow' ? TK.sub9 : TK.sub
const trendColor = (t: string) => t === 'positive' ? TK.green400 : t === 'negative' ? TK.red400 : TK.slate400

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = n >= i ? 1 : n >= i - 0.5 ? 0.5 : 0
        return (
          <span key={i} style={{ position: 'relative', width: 18, fontSize: 18, lineHeight: 1, color: '#2c3340' }}>
            ★<span style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', width: `${fill * 100}%`, color: starColor(n) }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

const fmtPrice = (v: number | null, cur: string) => v == null ? '—' : cur === 'KRW' ? `₩${Math.round(v).toLocaleString()}` : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function StockProfileCard({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [d, setD] = useState<StockProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setD(null)
    const mkt = market === 'KR' ? 'KR' : 'US'
    fetch(`/api/stock-profile?ticker=${encodeURIComponent(ticker)}&market=${mkt}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', color: TK.sub, fontSize: 12 }}>🌟 {name}의 투자 프로필을 분석 중입니다…</div>
  if (!d) return null

  const disc = d.discountPct
  const holding = isHoldingCompany(ticker, name)   // 🏢 지주사 — PSR·동종(섹터) 비교 부적합(매출이 작고 자회사 지분법이익)
  const psrRatio = (d.psr != null && d.psrMedian != null && d.psrMedian > 0) ? d.psr / d.psrMedian : null
  // 상대 PSR 막대 폭(중앙값=50% 기준, 2배=100%)
  const psrBar = (v: number | null) => v == null ? 0 : Math.min(100, (v / ((d.psrMedian ?? v) * 2)) * 100)

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(34,197,94,0.04))', borderRadius: 12, border: '1px solid rgba(251,191,36,0.28)', padding: '15px 17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🌟</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>투자 프로필</span>
        <span style={{ color: TK.sub, fontSize: 11 }}>해자 × 공정가치 × 상대 밸류 — 3초 요약</span>
        {/* ① 해자 배지 — 상단 우측 */}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span title={`해자 추세: ${TREND_KO[d.moatTrend]}`} style={{ background: `${moatColor(d.moatWidth)}1f`, color: moatColor(d.moatWidth), border: `1px solid ${moatColor(d.moatWidth)}66`, borderRadius: 7, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
            🏰 해자 {MOAT_KO[d.moatWidth]}
          </span>
          {d.baseEffect && <span title="작년 이익 붕괴 후 폭증(기저효과)으로 공정가치가 부풀려질 수 있어 '저평가' 신호를 과신하면 안 됩니다." style={{ background: 'rgba(251,191,36,0.14)', color: TK.amber400, border: `1px solid ${TK.amber400}55`, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>⚠️ 기저효과</span>}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* ② 스타 레이팅 게이지 — 공정가치 vs 현재가 */}
        <div style={{ flex: '1 1 230px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ color: TK.sub, fontSize: 10.5, marginBottom: 6 }}>스타 등급 (공정가치 대비 가격)</div>
          {d.stars != null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Stars n={d.stars} />
                <span style={{ color: starColor(d.stars), fontWeight: 900, fontSize: 16 }}>★{d.stars}</span>
              </div>
              {/* 공정가치 라인 게이지: 현재가가 공정가치 위(고평가)/아래(저평가) */}
              <div style={{ position: 'relative', height: 8, background: TK.border, borderRadius: 4, marginBottom: 8 }}>
                <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: TK.slate400 }} title="공정가치" />
                {disc != null && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
                    ...(disc >= 0
                      ? { right: '50%', width: `${Math.min(48, disc / 2)}%`, background: TK.green500 }
                      : { left: '50%', width: `${Math.min(48, Math.abs(disc) / 2)}%`, background: TK.red500 }) }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: TK.sub }}>현재가 <b style={{ color: TK.slate300 }}>{fmtPrice(d.currentPrice, d.currency)}</b></span>
                <span style={{ color: TK.sub }}>공정가치 <b style={{ color: TK.slate300 }}>{fmtPrice(d.fairValue, d.currency)}</b></span>
              </div>
              {disc != null && (
                <div style={{ marginTop: 6, color: disc >= 0 ? TK.green400 : TK.red400, fontWeight: 800, fontSize: 12.5 }}>
                  {disc >= 0 ? `▼ ${disc.toFixed(0)}% 저평가` : `▲ ${Math.abs(disc).toFixed(0)}% 고평가`}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: TK.sub3, fontSize: 11.5, lineHeight: 1.6 }}>
              별점 보류 — {d.baseEffect ? '기저효과(이익 폭증)로 공정가치 과대 착시' : '적자·현금흐름 음수·데이터 부족'}으로 공정가치 신뢰 불가. 해자·매출 성장으로 보세요.
            </div>
          )}
        </div>

        {/* 보조 지표 — 불확실성 · 자본배분 */}
        <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
          <Kv k="불확실성" v={UNCERTAINTY_KO[d.uncertainty]} sub="높을수록 더 큰 안전마진 요구" />
          <Kv k="해자 추세" v={TREND_KO[d.moatTrend]} c={trendColor(d.moatTrend)} />
          <Kv k="자본배분(경영진)" v={STEWARD_KO[d.stewardship]} />
        </div>
      </div>

      {/* 💡 관점 충돌 융합 띠 — 린치 PEG(성장가치) vs 버핏 DCF(절대가치)가 반대 신호일 때 교육 (기저효과 PEG는 신뢰 불가라 제외) */}
      {(() => {
        if (d.baseEffect || d.peg == null || d.peg <= 0 || d.discountPct == null) return null
        const dcfExpensive = d.discountPct < 0, dcfCheap = d.discountPct >= 10
        const pegCheap = d.peg <= 1.0, pegExpensive = d.peg > 2.2
        let msg: string | null = null
        if (dcfExpensive && pegCheap) msg = `린치 PEG(${d.peg})로는 성장 대비 저평가지만, 버핏식 보수 DCF로는 ${Math.abs(d.discountPct).toFixed(0)}% 고평가입니다 — 고성장을 어디까지 신뢰하느냐의 관점 차이. PEG는 미래 성장을 인정하고, DCF는 성장률을 35%로 깎아 보수적으로 봅니다. 두 관점을 함께 보고 판단하세요.`
        else if (dcfCheap && pegExpensive) msg = `버핏식 DCF로는 ${d.discountPct.toFixed(0)}% 저평가지만, 린치 PEG(${d.peg})로는 성장 대비 고평가입니다 — 현재 현금흐름은 싸 보여도 성장 둔화가 우려된다는 신호. 성장률이 꺾이지 않는지 확인하세요.`
        if (!msg) return null
        return (
          <div style={{ marginTop: 12, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, padding: '10px 13px' }}>
            <div style={{ color: TK.blue300, fontWeight: 800, fontSize: 11, marginBottom: 3 }}>💡 성장가치(린치 PEG) vs 절대가치(버핏 DCF)</div>
            <div style={{ color: TK.slate300, fontSize: 11.5, lineHeight: 1.65 }}>{msg}</div>
          </div>
        )
      })()}

      {/* ③ 상대 PSR 비교 — 종목 vs 동종 중앙값 */}
      {d.psr != null && (
        <div style={{ marginTop: 12, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>상대 밸류 — 매출 대비 가격(PSR){d.sectorLabel ? ` · ${d.sectorLabel}` : ''}</span>
            {!holding && psrRatio != null && (
              <span style={{ marginLeft: 'auto', color: psrRatio <= 0.85 ? TK.green400 : psrRatio >= 1.15 ? TK.red400 : TK.slate400, fontWeight: 800, fontSize: 11.5 }}>
                {psrRatio <= 0.85 ? `동종 대비 ${Math.round((1 - psrRatio) * 100)}% 저평가` : psrRatio >= 1.15 ? `동종 대비 ${Math.round((psrRatio - 1) * 100)}% 고평가` : '동종과 비슷'}
              </span>
            )}
            {holding && <span style={{ marginLeft: 'auto', color: TK.violet400, fontWeight: 800, fontSize: 11 }}>🏢 지주사 — 비교 부적합</span>}
          </div>
          <PsrBar label={`${name.slice(0, 10)} (이 종목)`} v={d.psr} pct={psrBar(d.psr)} color={TK.blue400} />
          {d.psrMedian != null
            ? <PsrBar label={`동종 피어 중앙값${d.peerCount ? ` (${d.peerCount}종)` : ''}`} v={d.psrMedian} pct={psrBar(d.psrMedian)} color={TK.sub3} />
            : <div style={{ color: TK.sub, fontSize: 10, marginTop: 4 }}>동종 피어 PSR 데이터가 부족해 절대값만 표시(상대 비교 보류).</div>}
          <div style={{ color: holding ? TK.violet300 : TK.sub, fontSize: 9.5, marginTop: 7, lineHeight: 1.5 }}>
            {holding
              ? '🏢 지주사는 매출이 작고 자회사 지분법이익 구조라 PSR·동종(섹터) 비교가 부적합합니다 — 보유 자회사 가치 합산(NAV·SOTP)으로 평가하세요. (Yahoo가 섹터를 자회사 업종으로 분류해 칩메이커 등과 섞여 보일 수 있음)'
              : <>PSR=시총÷매출 · 산업마다 정상치가 달라 <b style={{ color: TK.sub }}>같은 업종끼리만</b> 비교(절대 임계 아님) · 적자기업도 매출 대비 밸류를 볼 수 있는 척도.</>}
          </div>
        </div>
      )}

      <div style={{ marginTop: 11, color: TK.sub, fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 아래 ⚔️섹터 피어 X-Ray·🏰해자 경보기에서 상세 분석을 볼 수 있습니다. 별점=공정가치(버핏식 보수적 DCF) 대비 가격이며 &lsquo;타이밍&rsquo; 보장이 아닙니다 · 모닝스타 공개 방법론을 우리 엔진으로 재현한 교육용 · 투자 추천 아님.
      </div>
    </div>
  )
}

function Kv({ k, v, c, sub }: { k: string; v: string; c?: string; sub?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
        <span style={{ color: TK.sub }}>{k}</span>
        <span style={{ color: c ?? TK.slate300, fontWeight: 700 }}>{v}</span>
      </div>
      {sub && <div style={{ color: TK.sub, fontSize: 9 }}>{sub}</div>}
    </div>
  )
}

function PsrBar({ label, v, pct, color }: { label: string; v: number; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
      <span style={{ color: TK.sub5, fontSize: 11, width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: TK.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ color: TK.slate300, fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace', width: 44, textAlign: 'right' }}>{v.toFixed(1)}×</span>
    </div>
  )
}
