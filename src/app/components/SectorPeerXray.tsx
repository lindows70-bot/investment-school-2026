'use client'

/**
 * ⚔️ SectorPeerXray — 피터 린치의 쇼핑몰 (킬러 기능 9단계)
 *
 * 보유 종목을 동종 경쟁사 3~4개와 PEG·영업이익률·부채비율로 나란히 상대평가.
 * "더 싸고 더 탄탄한 1등"이 옆에 있으면 로테이션 인사이트를 준다.
 *
 * 데이터: 서버액션 getSectorPeers (Yahoo peers + 지표, 6h 캐시)
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import { getSectorPeers, type SectorPeerResult } from '@/app/actions/getSectorPeers'
import { isHoldingCompany } from '@/lib/assetClassifier'   // 🏢 지주사 — 섹터 비교 부적합(NAV 평가)

interface Props { ticker: string; name: string; market: string }

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// PEG 색상: 낮을수록 저평가(좋음)
const pegColor = (p: number | null) => p == null || p <= 0 ? C.textLow : p < 1 ? C.green : p < 1.5 ? C.blue : p < 2 ? C.gold : C.red
const marginColor = (m: number | null) => m == null ? C.textLow : m >= 25 ? C.green : m >= 10 ? C.blue : m >= 0 ? C.gold : C.red
// 시총(USD 통일) — 체급 비교용 (글로벌 1등 대비 위치)
const mcapFmt = (n: number | null) => n == null ? '—' : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(0)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n / 1e3)}K`

export default function SectorPeerXray({ ticker, name, market }: Props) {
  const [data, setData] = useState<SectorPeerResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    getSectorPeers({ ticker, name, market })
      .then(r => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market, name])

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>⚔️</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>피터 린치의 쇼핑몰 — 섹터 피어 X-Ray</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>SECRET · 상대평가</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>{Header}{child}</div>
  )

  if (loading) return Wrap(<div style={{ fontSize: 12.5, color: C.textLow }}>⚔️ 동종업계 경쟁사를 불러와 상대평가 중…</div>)
  if (!data) return null
  if (data.status !== 'ok') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>⚔️ {data.message || '비교 데이터를 불러오지 못했습니다.'}</div>)

  const holding = isHoldingCompany(ticker, name)   // 🏢 지주사 — 섹터(자회사 업종) 비교 부적합
  const early = data.verdict === 'early_stage'
  const noPeerInd = !early && data.sameIndCount === 0
  const vColor = early ? '#a78bfa' : noPeerInd ? C.textLow : data.verdict === 'consider_rotate' ? C.gold : data.verdict === 'hold_best' ? C.green : C.blue
  const vLabel = early ? '🌱 초기 단계 — PEG 대신 다른 잣대로'
    : noPeerInd ? '⚠️ 동일업종 경쟁사 없음 — 참고용'
    : data.verdict === 'consider_rotate' ? '🔄 더 나은 대안 발견' : data.verdict === 'hold_best' ? '🏆 업종 내 최저 PEG' : '〰️ 평범한 가성비'

  return Wrap(
    <>
      {/* 🏢 지주사 캐비엇 — 섹터(자회사 업종) 비교 부적합 */}
      {holding && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.35)', marginBottom: 12, color: '#ddd6fe', fontSize: 11.5, lineHeight: 1.6 }}>
          🏢 <b>지주사</b>는 동종(섹터) 비교가 부적합합니다 — Yahoo가 섹터를 <b>자회사 업종</b>(예: SK스퀘어→반도체)으로 분류해 칩메이커 등과 섞입니다. 영업이익률·PSR도 매출원가 거의 없는 구조라 왜곡되니, 가치는 <b>NAV·SOTP(자회사 가치 합산)</b>로 평가하세요.
        </div>
      )}
      {/* 판정 배너 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 12, background: `${vColor}14`, border: `1px solid ${vColor}44`, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: vColor }}>{vLabel}</span>
        <span style={{ fontSize: 11, color: C.textLow }}>
          · {name} ({data.targetIndustry || '업종?'}) · {data.source === 'curated'
            ? `글로벌 동종업계 ${data.sameIndCount}개사 (美·韓 통합)`
            : `동일업종 ${data.sameIndCount}개사`}{noPeerInd ? ' · ⚠️ 표의 다른 종목은 타 업종(Yahoo 추천)' : ''}
        </span>
      </div>

      {/* 비교 표 */}
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 440 }}>
          <thead>
            <tr style={{ color: C.textLow, fontSize: 10.5, textAlign: 'right' }}>
              <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 8px' }}>종목</th>
              <th style={{ fontWeight: 700, padding: '0 0 8px' }}>체급(시총)</th>
              <th style={{ fontWeight: 700, padding: '0 0 8px' }}>PEG ↓싸다</th>
              <th style={{ fontWeight: 700, padding: '0 0 8px' }} title="주가매출비율(P/S) — 적자기업도 매출 대비 밸류를 보는 척도. 동종 중앙값 대비 색칠(절대 임계 아님)">PSR ↓싸다</th>
              <th style={{ fontWeight: 700, padding: '0 0 8px' }}>영업이익률 ↑탄탄</th>
              <th style={{ fontWeight: 700, padding: '0 0 8px' }}>부채/시총 ↓안전</th>
            </tr>
          </thead>
          <tbody style={{ fontFamily: 'monospace' }}>
            {data.peers.map(p => {
              const hl = p.isTarget
              const isRival = p.ticker === data.rivalTicker
              return (
                <tr key={p.ticker} style={{
                  background: hl ? `${C.cyan}10` : isRival ? `${C.gold}0d` : 'transparent',
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <td style={{ textAlign: 'left', padding: '9px 4px' }}>
                    <div>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: hl ? C.cyan : (p.sameInd || hl) ? C.text : C.textSub }}>{p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name}</span>
                      <span style={{ fontSize: 9.5, color: C.textLow, marginLeft: 5 }}>{p.ticker}</span>
                      {hl && <span style={{ fontSize: 9, color: C.cyan, marginLeft: 6, fontWeight: 700 }}>← 내 종목</span>}
                      {isRival && <span style={{ fontSize: 9, color: C.gold, marginLeft: 6, fontWeight: 700 }}>더 싸고 탄탄</span>}
                    </div>
                    {p.industry && (
                      <div style={{ fontSize: 9, color: !hl && !p.sameInd ? C.red : C.textLow, marginTop: 1, fontFamily: FONT }}>
                        {p.industry}{!hl && !p.sameInd ? ' · 타 업종' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: p.mcapUsd == null ? C.textLow : hl ? C.cyan : C.textSub, padding: '9px 4px' }}>{mcapFmt(p.mcapUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: pegColor(p.peg), padding: '9px 4px' }}>
                    {p.peg != null && p.peg > 0 ? p.peg.toFixed(2) : '—'}
                    {p.pegBaseEffect && (
                      <span title="작년 이익 붕괴 후 회복(성장률 100%↑)으로 원시 PEG가 0에 수렴하는 착시(경기순환주 저PEG 함정) — 내년 예상 성장 기준으로 정상화하거나, 그마저 왜곡이면 —(비교 제외) 처리합니다." style={{ display: 'block', fontSize: 8.5, color: C.gold, fontWeight: 700 }}>
                        ⚠️ 기저효과
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '9px 4px',
                    color: p.psr == null ? C.textLow
                      : data.psrMedian != null && p.psr < data.psrMedian * 0.85 ? C.green
                      : data.psrMedian != null && p.psr > data.psrMedian * 1.15 ? C.red
                      : C.textSub }}>{p.psr != null ? `${p.psr.toFixed(1)}×` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: marginColor(p.opMargin), padding: '9px 4px' }}>{p.opMargin != null ? `${p.opMargin}%` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: p.debtRatio == null ? C.textLow : p.debtRatio > 50 ? C.red : C.textSub, padding: '9px 4px' }}>{p.debtRatio != null ? (p.debtRatio > 300 ? '>300%' : `${p.debtRatio}%`) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 린치 코멘트 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${vColor}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75, fontStyle: 'italic' }}>&ldquo;{data.lynchComment}&rdquo;</div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        ⚔️ 체급(시총)=USD로 통일해 글로벌 1등과 체급 비교(원화는 대략 환산) · PEG=낮을수록 저평가 · PSR=주가매출비율(매출 대비 밸류, 적자기업도 평가 가능){data.psrMedian != null ? ` · 동종 중앙값 ${data.psrMedian.toFixed(1)}× 대비 15%↓ 초록(저평가)·15%↑ 빨강(고평가)` : ''}(절대 임계 아님 — 산업마다 정상 PSR이 달라 같은 업종끼리만 비교) · 영업이익률=높을수록 가격결정력(해자) · 부채/시총=낮을수록 안전(자동차·은행은 금융자회사 부채 포함되어 높게 나옴, 300%↑는 생략) · ⚠️기저효과 보정=이익 붕괴 후 회복으로 성장률이 100%↑ 튄 종목은 원시 PEG가 0에 수렴(저평가 착시) → 내년 예상 성장 기준으로 정상화(린치의 경기순환주 함정 경고).
        {data.source === 'curated'
          ? ' 글로벌 GICS 동종업계 대표기업 기준(美·韓 통합 · 비율 지표라 환율 무관) · 교육용 참고.'
          : ' Yahoo 동종업계 추천 기준 · 교육용 참고.'}
      </div>
    </>,
    `${vColor}55`
  )
}
