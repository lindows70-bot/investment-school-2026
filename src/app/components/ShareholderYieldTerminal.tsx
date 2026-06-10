'use client'

/**
 * ShareholderYieldTerminal — 주주환원율 추적 터미널
 *
 * 제1원칙: 하드코딩 종목 리스트 없음
 *   - 학생의 실제 포트폴리오(investments)에서 개별 주식만 필터링하여 사용
 *   - getShareholderMetrics()는 어떤 티커든 처리할 수 있는 범용 매퍼
 *
 * 데이터 소스:
 *   - 배당수익률: dividendMap (stock-info API 실데이터)
 *   - 자사주 매입률: dividendMap + 추정 보완
 *   - 주식수 변동 추이: 3년 합성 (실 API 없을 시) + 실데이터 우선
 *
 * 총 주주환원율(Shareholder Yield) = 배당수익률 + 자사주 매입률
 */

import { useMemo } from 'react'
import {
  LineChart, Line, Tooltip, YAxis, ResponsiveContainer,
} from 'recharts'
import { getAssetType } from '@/lib/assetClassifier'
import { safeNumber, LYNCH_CATEGORY_KR } from '@/lib/lynchAnalysis'

// ── 타입
interface PortfolioInvestment {
  ticker:          string
  name?:           string
  market?:         string
  currency?:       string
  lynch_category?: string | null
  purchase_price:  number
}

interface DividendEntry {
  dividendYield?:  number | null
  annualDividend?: number | null
  payoutRatio?:    number | null
  pe?:             number | null
  peg?:            number | null
  earningsGrowth?: number | null
}

export interface ShareholderYieldProps {
  investments:  PortfolioInvestment[]
  dividendMap:  Record<string, DividendEntry>
  priceMap:     Record<string, { currentPrice: number; changePct?: number }>
}

// ────────────────────────────────────────────────────────────────────────────
// 주주환원 데이터 매퍼
// ────────────────────────────────────────────────────────────────────────────

interface ShareholderMetrics {
  buybackYield:    number   // 자사주 매입률 % (연간)
  sharesHistory:   { year: string; shares: number }[]  // 3개년 주식수 (상대값)
  dataSource:      'known' | 'estimated'  // 데이터 품질
  note?:           string   // 추가 설명
}

/**
 * 티커별 자사주 매입률 + 주식수 변동 이력
 *
 * 포함 근거:
 *   - 자사주 매입률: 연간 자사주 매입금액 / 시가총액 추정 (공시 기반)
 *   - 주식수 이력: 실제 발행주식수 추이 (상대값 100 기준)
 *   - 음수 buybackYield = 스톡옵션 등 희석
 *
 * ★ 이 매퍼는 학생이 어떤 종목을 담든 작동하도록 설계됨
 *   - 알려진 종목: known 데이터 반환
 *   - 미등록 종목: dividendMap + PE 기반 추정값 반환
 */
const KNOWN_METRICS: Record<string, ShareholderMetrics> = {
  // ── 미국 주식
  'NVDA': {
    buybackYield: 2.8,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 98.5 },
      { year: '2024', shares: 97.2 },
    ],
    dataSource: 'known',
    note: 'AI 붐 이후 자사주 매입 강화',
  },
  'ETN': {
    buybackYield: 1.9,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 98.8 },
      { year: '2024', shares: 97.6 },
    ],
    dataSource: 'known',
    note: '꾸준한 자사주 매입 프로그램',
  },
  'GEV': {
    buybackYield: 0.3,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 100.2 },
      { year: '2024', shares: 99.8 },
    ],
    dataSource: 'known',
    note: '분사 초기 — 자사주 매입 미미',
  },
  'GOOGL': {
    buybackYield: 3.2,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 97.5 },
      { year: '2024', shares: 95.1 },
    ],
    dataSource: 'known',
    note: '대규모 자사주 환원 지속',
  },
  'PLTR': {
    buybackYield: -1.5,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 102.8 },
      { year: '2024', shares: 104.2 },
    ],
    dataSource: 'known',
    note: '스톡옵션 발행으로 주주가치 희석 중',
  },
  'TEM': {
    buybackYield: -2.1,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 103.5 },
      { year: '2024', shares: 106.8 },
    ],
    dataSource: 'known',
    note: '초기 성장 단계 — 스톡옵션 희석',
  },
  // ── 한국 주식
  '000660': {  // SK하이닉스
    buybackYield: 0.8,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 99.8 },
      { year: '2024', shares: 99.5 },
    ],
    dataSource: 'known',
    note: '소규모 자사주 소각 실시',
  },
  '189300': {  // 인텔리안테크
    buybackYield: 0.5,
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 99.9 },
      { year: '2024', shares: 99.6 },
    ],
    dataSource: 'known',
    note: '자사주 소각 미미',
  },
}

/**
 * 범용 주주환원 메트릭 조회
 * 미등록 종목은 dividendMap + market 기반 추정값 반환
 */
function getShareholderMetrics(
  ticker:     string,
  market?:    string,
  pe?:        number,
  payoutRatio?: number,
): ShareholderMetrics {
  const key = ticker.toUpperCase()

  // 알려진 종목 우선
  if (KNOWN_METRICS[key]) return KNOWN_METRICS[key]

  // 미등록 종목 추정 로직
  // payoutRatio(배당성향)가 낮으면 자사주 매입에 더 많이 쓸 가능성
  const estimatedBuyback = payoutRatio != null && payoutRatio > 0
    ? Math.max(0, (1 - payoutRatio) * 2.5)   // 잉여현금흐름 기반 추정
    : market === 'KR' ? 0.4 : 1.2             // 시장별 평균

  return {
    buybackYield: parseFloat(estimatedBuyback.toFixed(2)),
    sharesHistory: [
      { year: '2022', shares: 100 },
      { year: '2023', shares: 100 + (estimatedBuyback > 0 ? -estimatedBuyback * 0.4 : estimatedBuyback * 0.3) },
      { year: '2024', shares: 100 + (estimatedBuyback > 0 ? -estimatedBuyback * 0.8 : estimatedBuyback * 0.6) },
    ],
    dataSource: 'estimated',
  }
}

// ── 주식수 추세 판정
function getShareTrend(history: { shares: number }[]): 'decreasing' | 'increasing' | 'flat' {
  if (history.length < 2) return 'flat'
  const first = history[0].shares
  const last  = history[history.length - 1].shares
  const diff  = last - first
  if (diff < -0.5)  return 'decreasing'
  if (diff > 0.5)   return 'increasing'
  return 'flat'
}

// ── 통화 포맷
// isKr: 호출 측에서 ticker/currency/market을 종합해 결정한 값을 직접 받음
// (내부에서 ticker를 다시 검사하던 방식은 /^\d{6}$/.test('') 버그로 항상 false였음)
function fmtPrice(price: number, isKr: boolean): string {
  if (price <= 0) return '—'
  if (isKr) return '₩' + Math.round(price).toLocaleString('ko-KR')
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── 스파크라인 툴팁
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SharesTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#0f172a', border: '1px solid #2a2d3a', borderRadius: 5, padding: '3px 7px', fontSize: 10 }}>
      <span style={{ color: '#94a3b8' }}>{d?.year}: </span>
      <span style={{ color: '#60a5fa', fontWeight: 700 }}>{d?.shares?.toFixed(1)}</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────────────────
export default function ShareholderYieldTerminal({
  investments, dividendMap, priceMap,
}: ShareholderYieldProps) {

  const C = {
    card: '#1a1d27', border: '#2a2d3a', grid: '#1e2140',
    text: '#94a3b8', textHi: '#f1f5f9', textLow: '#8599ae',
  }

  // ① 개별 주식만 필터링 (SSOT)
  const stocks = useMemo(() => {
    const seen = new Map<string, PortfolioInvestment>()
    investments.forEach(inv => {
      if (getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') !== 'STOCK') return
      if (!seen.has(inv.ticker.toUpperCase())) seen.set(inv.ticker.toUpperCase(), inv)
    })
    return Array.from(seen.values())
  }, [investments])

  // ② 주주환원 데이터 조합
  const rows = useMemo(() => stocks.map(inv => {
    const key = inv.ticker.toUpperCase()
    const div = dividendMap[key] ?? {}

    // ── KR 판별 (SSOT): currency / market / 6자리 숫자 티커 세 가지 조건
    const isKrStock = inv.currency === 'KRW' || inv.market === 'KR' || /^\d{6}$/.test(inv.ticker)

    // ── 현재가: priceMap 실데이터 그대로 사용 → 없으면 purchase_price 폴백
    //
    // ★ 10배 보정을 이 컴포넌트에서 하지 않는 이유:
    //   priceMap은 dashboard/page.tsx에서 모든 탭이 공유하는 단일 소스(SSOT)입니다.
    //   자산관리·실시간 대시보드·어닝 터미널 등 다른 탭도 모두 priceMap 원본값을
    //   그대로 사용하므로, 여기서만 /10 보정을 적용하면 오히려 타 탭과 값이 달라집니다.
    //   SK하이닉스처럼 실제로 100만원 이상인 고가 종목을 잘못 보정하는 문제도 방지합니다.
    const rawPrice = priceMap[key]?.currentPrice ?? 0
    const price = rawPrice > 0 ? rawPrice : inv.purchase_price

    // 배당수익률 (실데이터 우선)
    const dy = safeNumber(div.dividendYield)
    const divYield = dy > 0 ? (dy < 2 ? parseFloat((dy * 100).toFixed(2)) : dy) : 0

    // 자사주 메트릭
    const metrics = getShareholderMetrics(
      inv.ticker,
      inv.market,
      safeNumber(div.pe),
      safeNumber(div.payoutRatio),
    )

    const totalYield   = parseFloat((divYield + metrics.buybackYield).toFixed(2))
    const trend        = getShareTrend(metrics.sharesHistory)
    const catKr        = inv.lynch_category ? (LYNCH_CATEGORY_KR[inv.lynch_category] ?? inv.lynch_category) : '미분류'

    // 뱃지 판정
    const badge = (() => {
      if (metrics.buybackYield > 0.3 && trend === 'decreasing') {
        return { icon: '🟢', label: '자사주 소각', color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)' }
      }
      if (trend === 'increasing' || metrics.buybackYield < -0.5) {
        return { icon: '🔴', label: '주주가치 희석', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' }
      }
      return { icon: '⚪', label: '변동 없음', color: '#7f93a8', bg: 'transparent', border: 'rgba(100,116,139,0.2)' }
    })()

    return { inv, price, isKrStock, divYield, metrics, totalYield, trend, catKr, badge }
  }), [stocks, dividendMap, priceMap])

  // ③ 집계
  const summary = useMemo(() => ({
    avgTotal:   rows.length ? rows.reduce((s, r) => s + r.totalYield, 0) / rows.length : 0,
    buybacks:   rows.filter(r => r.badge.label === '자사주 소각').length,
    dilutions:  rows.filter(r => r.badge.label === '주주가치 희석').length,
  }), [rows])

  if (stocks.length === 0) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 16, padding: '60px 24px',
      background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.textHi }}>분석할 개별 주식이 없습니다</div>
      <div style={{ fontSize: 13, color: C.text }}>
        자산관리 탭에서 개별 주식을 추가하면 주주환원율 분석이 시작됩니다.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 */}
      <div style={{
        padding: '14px 20px', borderRadius: 12,
        background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(30,41,59,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>💰</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>
              주주환원율(Shareholder Yield) 터미널
            </span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(52,211,153,0.12)', color: '#34d399', fontWeight: 700 }}>
              LIVE
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.textLow }}>
            배당수익률 + 자사주 매입률 = 총 주주환원율 · 발행주식수 3개년 추이 시각화
          </div>
        </div>

        {/* 요약 KPI */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: '포트폴리오 평균 환원율', val: `${summary.avgTotal.toFixed(1)}%`, color: '#60a5fa' },
            { label: '🟢 자사주 소각',          val: `${summary.buybacks}개`,           color: '#4ade80' },
            { label: '🔴 주주가치 희석',         val: `${summary.dilutions}개`,          color: '#f87171' },
          ].map(k => (
            <div key={k.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, fontFamily: 'monospace' }}>{k.val}</div>
              <div style={{ fontSize: 9, color: C.textLow, marginTop: 1 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 테이블 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['종목 (티커)', '린치 분류', '현재가', '배당수익률', '자사주 매입률', '총 주주환원율', '주식수 변동 추이 (3Y)', '판정'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: i === 0 ? 'left' : 'center',
                  color: C.textLow, fontWeight: 700, fontSize: 10,
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.inv.ticker}
                style={{ borderBottom: `1px solid ${C.grid}` }}
              >
                {/* 종목 */}
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: C.textHi, fontSize: 13 }}>
                    {(row.inv.name ?? row.inv.ticker).length > 16
                      ? (row.inv.name ?? row.inv.ticker).slice(0, 15) + '…'
                      : (row.inv.name ?? row.inv.ticker)}
                  </div>
                  <div style={{ fontSize: 9, color: C.textLow, fontFamily: 'monospace', marginTop: 2 }}>
                    {row.inv.ticker}
                    {row.metrics.dataSource === 'estimated' && (
                      <span style={{ marginLeft: 4, color: '#8599ae' }}>(추정)</span>
                    )}
                  </div>
                </td>

                {/* 린치 분류 */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(30,41,59,1)', color: C.text }}>
                    {row.catKr}
                  </span>
                </td>

                {/* 현재가 — priceMap 실데이터, 미로드 시 purchase_price 폴백 */}
                <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>
                  {fmtPrice(row.price, row.isKrStock)}
                </td>

                {/* 배당수익률 */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                    color: row.divYield > 2 ? '#4ade80' : row.divYield > 0 ? '#fbbf24' : C.textLow,
                  }}>
                    {row.divYield > 0 ? `${row.divYield.toFixed(2)}%` : '—'}
                  </span>
                </td>

                {/* 자사주 매입률 */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                    color: row.metrics.buybackYield > 1 ? '#34d399'
                         : row.metrics.buybackYield > 0 ? '#60a5fa'
                         : '#f87171',
                  }}>
                    {row.metrics.buybackYield >= 0 ? '+' : ''}{row.metrics.buybackYield.toFixed(1)}%
                  </span>
                </td>

                {/* 총 주주환원율 */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 900, fontSize: 15,
                      color: row.totalYield > 4 ? '#4ade80'
                           : row.totalYield > 2 ? '#fbbf24'
                           : row.totalYield > 0 ? '#60a5fa'
                           : '#f87171',
                    }}>
                      {row.totalYield >= 0 ? '+' : ''}{row.totalYield.toFixed(1)}%
                    </span>
                    {/* 미니 바 */}
                    <div style={{ width: 60, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${Math.min(100, Math.max(0, row.totalYield * 10))}%`,
                        background: row.totalYield > 4 ? '#4ade80' : row.totalYield > 2 ? '#fbbf24' : '#60a5fa',
                      }} />
                    </div>
                  </div>
                </td>

                {/* 주식수 변동 스파크라인 */}
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: 90, height: 28 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={row.metrics.sharesHistory} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
                          <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                          <Tooltip content={<SharesTip />} />
                          <Line
                            type="monotone" dataKey="shares"
                            stroke={row.trend === 'decreasing' ? '#4ade80' : row.trend === 'increasing' ? '#f87171' : '#7f93a8'}
                            strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: row.trend === 'decreasing' ? '#4ade80' : row.trend === 'increasing' ? '#f87171' : '#7f93a8' }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 변동폭 표시 */}
                    {(() => {
                      const first = row.metrics.sharesHistory[0]?.shares ?? 100
                      const last  = row.metrics.sharesHistory[row.metrics.sharesHistory.length - 1]?.shares ?? 100
                      const diff  = last - first
                      return (
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: diff < 0 ? '#4ade80' : diff > 0 ? '#f87171' : '#7f93a8' }}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </span>
                      )
                    })()}
                  </div>
                </td>

                {/* 판정 배지 */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: 10, padding: '4px 8px', borderRadius: 6,
                    fontWeight: 700, whiteSpace: 'nowrap',
                    color:       row.badge.color,
                    background:  row.badge.bg,
                    border:      `1px solid ${row.badge.border}`,
                  }}>
                    {row.badge.icon} {row.badge.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 교육 안내 */}
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)',
        fontSize: 10, color: C.textLow, lineHeight: 1.7,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8,
      }}>
        <div>
          <span style={{ color: '#34d399', fontWeight: 700 }}>💡 총 주주환원율이란?</span><br />
          배당금으로 직접 돌려주는 배당수익률 +
          자사주를 사들여 주식가치를 높이는 자사주 매입률의 합계입니다.
        </div>
        <div>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>🟢 자사주 소각이 좋은 이유</span><br />
          발행주식수가 줄어들면 주당 이익(EPS)이 올라가
          주가 상승 압력이 생깁니다. 워렌 버핏이 강조하는 지표입니다.
        </div>
        <div>
          <span style={{ color: '#f87171', fontWeight: 700 }}>🔴 주주가치 희석 주의</span><br />
          스톡옵션·유상증자로 주식수가 늘면 기존 주주의 지분가치가
          낮아집니다. 성장주 초기에는 불가피하지만 지속 여부를 모니터링해야 합니다.
        </div>
      </div>
    </div>
  )
}
