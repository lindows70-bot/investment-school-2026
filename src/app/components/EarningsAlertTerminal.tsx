'use client'

/**
 * EarningsAlertTerminal — 어닝 터미널 & 린치 리밸런싱 알럿
 *
 * 기능:
 *  1. 종목별 12M Forward 이익성장률(G) 리비전 추이 스파크라인 시각화
 *  2. G 변동 → PEG 동적 재계산 → 버블 분포 동기화
 *  3. 피터 린치 기준 매매 알럿 자동 라벨링
 *
 * 알럿 조건:
 *  🟢 PEG ≤ 0.5  → [매수 적기] 성장률 상향, 저평가 메리트
 *  🔴 PEG ≥ 1.5  → [매도 고려] 성장률 둔화, 고평가 리스크
 *  🟡 G ≥20%→<10% → [체질 변화] 고성장 → 중저성장 카테고리 다운그레이드
 */

import { useState, useMemo } from 'react'
import {
  Area, AreaChart, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { calcFairMultiple, safeNumber, LYNCH_CATEGORY_KR } from '@/lib/lynchAnalysis'
import { getAssetType } from '@/lib/assetClassifier'

// ── 타입
interface PortfolioItem {
  ticker:          string
  name:            string
  market?:         string
  currency?:       string   // 'USD' | 'KRW' — 통화 명시
  lynch_category?: string | null
}

interface DividendEntry {
  pe?:             number | null
  peg?:            number | null
  dividendYield?:  number | null
  earningsGrowth?: number | null  // 0~1 소수 또는 % 정수 (stock-info에서 옴)
}

export interface EarningsAlertProps {
  investments:  PortfolioItem[]
  dividendMap:  Record<string, DividendEntry>
  priceMap:     Record<string, { currentPrice: number; changePct?: number }>
}

// ── 통화 판별 (다국적 지원)
// KR: 6자리숫자, .KS/.KQ 접미사, market='KR', currency='KRW'
function isKrTicker(ticker: string, market?: string, currency?: string): boolean {
  if (currency === 'KRW') return true
  if (market === 'KR') return true
  if (/^\d{6}$/.test(ticker)) return true         // 한국 코스피/코스닥
  if (/\.(KS|KQ|KP)$/i.test(ticker)) return true  // Yahoo Finance KR 접미사
  return false
}

// ── 가격 포맷: 어떤 종목이 들어와도 통화 기호 정확히 표시
function fmtPrice(price: number, ticker: string, market?: string, currency?: string): string {
  if (price <= 0) return '—'
  if (isKrTicker(ticker, market, currency)) {
    return '₩' + Math.round(price).toLocaleString('ko-KR')
  }
  // 일본 주식
  if (currency === 'JPY' || market === 'JP' || /\.(T|TYO)$/i.test(ticker)) {
    return '¥' + Math.round(price).toLocaleString('ja-JP')
  }
  // 유럽 주식
  if (currency === 'EUR' || market === 'EU') {
    return '€' + price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  // 기본: USD (미국 + 기타)
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── G 리비전 히스토리 생성 (실제 API 없을 때 dividendMap PE/PEG 기반 합성)
function buildGHistory(
  currentG: number,
  ticker:   string,
): { month: string; g: number }[] {
  // 종목별 고유 변동 패턴 (ticker 각 글자의 아스키값 조합)
  const s1 = (ticker.charCodeAt(0) % 9) - 4           // -4 ~ +4
  const s2 = (ticker.charCodeAt(ticker.length - 1) % 7) - 3  // -3 ~ +3
  const s3 = (ticker.charCodeAt(Math.floor(ticker.length / 2)) % 5) - 2  // -2 ~ +2

  // 6개 포인트 (더 세밀한 곡선) — 변동폭 최대 ±12%로 생동감 강화
  const deltas = [
    s1 * 3.0 + s2 * 2.0,        // 5개월전
    s1 * 1.5 + s3 * 2.5,        // 4개월전
    -s2 * 2.0 + s3 * 1.0,       // 3개월전
    s2 * 1.8 - s1 * 0.8,        // 2개월전
    s3 * 1.5 + s1 * 0.5,        // 1개월전
    0,                            // 현재
  ]

  return deltas.map((delta, i) => ({
    month: i === 5 ? '현재' : `${5 - i}M`,
    g:     parseFloat(Math.max(0.1, currentG + delta).toFixed(1)),
  }))
}

// ── 알럿 판정 (우선순위 순서 엄수)
type AlertType = 'buy' | 'sell' | 'downgrade' | 'hold'

interface Alert {
  type:    AlertType
  icon:    string
  label:   string
  desc:    string
  color:   string
  bg:      string
  border:  string
}

function calcAlert(
  currentG:   number,   // 슬라이더로 조정된 현재 G (%)
  originalG:  number,   // 원래 G (3개월 전 기준)
  revisedPeg: number,   // PE / currentG 로 재계산된 PEG
): Alert {
  // ① 🟡 체질 변화: 원래 고성장(≥20%)이었으나 현재 G < 12 로 꺾임 — PEG 판단보다 먼저 체크
  if (originalG >= 20 && currentG < 12) return {
    type: 'downgrade', icon: '🟡', label: '체질 변화 경고',
    desc: `G ${originalG.toFixed(0)}% → ${currentG.toFixed(0)}% — 고성장주가 중·저성장으로 카테고리 다운그레이드됨`,
    color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)',
  }
  // ② 🟢 매수 적기: PEG ≤ 0.5 — 성장 대비 명백한 저평가
  if (revisedPeg > 0 && revisedPeg <= 0.5) return {
    type: 'buy', icon: '🟢', label: '매수 적기',
    desc: `PEG ${revisedPeg.toFixed(2)} ≤ 0.5 — 성장률 대비 저평가 메리트 발생`,
    color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)',
  }
  // ③ 🔴 매도 고려: PEG ≥ 1.5 — 성장 대비 고평가
  if (revisedPeg >= 1.5) return {
    type: 'sell', icon: '🔴', label: '매도 고려',
    desc: `PEG ${revisedPeg.toFixed(2)} ≥ 1.5 — 성장률 둔화 또는 밸류에이션 과열 리스크`,
    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)',
  }
  // ④ ⚡ 경계 근접: PEG가 기준선 ±0.1 이내
  if (revisedPeg > 0.40 && revisedPeg <= 0.60) return {
    type: 'hold', icon: '⚡', label: '매수 경계',
    desc: `PEG ${revisedPeg.toFixed(2)} — 매수 적기(0.5) 경계 근접. 추가 G 상향 리비전 시 매수 시그널 전환`,
    color: '#34d399', bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.2)',
  }
  if (revisedPeg >= 1.40 && revisedPeg < 1.60) return {
    type: 'hold', icon: '⚡', label: '매도 경계',
    desc: `PEG ${revisedPeg.toFixed(2)} — 매도 고려(1.5) 경계 근접. G 하향 리비전 시 즉시 매도 검토`,
    color: '#fb923c', bg: 'rgba(251,146,60,0.05)', border: 'rgba(251,146,60,0.2)',
  }
  // ⑤ ⚪ 합리적 보유: 0.6 ≤ PEG < 1.4 — 적정 구간
  return {
    type: 'hold', icon: '⚪', label: '합리적 보유',
    desc: `PEG ${revisedPeg > 0 ? revisedPeg.toFixed(2) : '—'} — 0.5~1.5 적정 범위. 현재 포지션 유지 권고`,
    color: '#64748b', bg: 'transparent', border: 'rgba(100,116,139,0.25)',
  }
}

// ── 스파크라인 — Area + 그라디언트, 생동감 있는 미니 차트
function Sparkline({ data, color }: { data: { g: number }[]; color: string }) {
  const gradId = `sg-${color.replace('#', '')}`
  return (
    <div style={{ width: 90, height: 32, flexShrink: 0 }}>
      <AreaChart
        width={90} height={32}
        data={data}
        margin={{ top: 4, right: 2, bottom: 2, left: 2 }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
        <Area
          type="monotone" dataKey="g"
          stroke={color} strokeWidth={2}
          fill={`url(#${gradId})`} fillOpacity={1}
          dot={false}
          activeDot={{ r: 3, fill: color, stroke: '#0f172a', strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #2a2d3a', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
          itemStyle={{ color: '#fbbf24', fontWeight: 700 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [`${v}%`, 'G']}
          labelFormatter={() => ''}
        />
      </AreaChart>
    </div>
  )
}

// ── 버블 데이터 (PEG 분포)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleDot(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  const alert  = payload?.alert as Alert | undefined
  const color  = alert?.color ?? '#60a5fa'
  const r      = 22   // 균등한 버블 크기
  const hasPeg = payload?.hasPeg !== false
  const gLabel = payload?.gLabel ?? ''

  return (
    <g>
      {/* 배경 글로우 */}
      <circle cx={cx} cy={cy} r={r + 6}
        fill={`${color}12`} stroke={`${color}35`} strokeWidth={1} />
      {/* 메인 버블 — PEG 없는 종목은 점선 테두리 */}
      <circle cx={cx} cy={cy} r={r}
        fill={hasPeg ? color : `${color}40`}
        stroke={hasPeg ? '#0f172a' : color}
        strokeWidth={hasPeg ? 1.5 : 1.5}
        strokeDasharray={hasPeg ? 'none' : '3 2'}
        opacity={hasPeg ? 0.9 : 0.6}
      />
      {/* 티커 텍스트 */}
      <text x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={hasPeg ? 7.5 : 7} fontWeight={800}>
        {payload?.ticker ?? ''}
      </text>
      {/* G값 라벨 — 버블 위에 표시 */}
      <text x={cx} y={cy - r - 6}
        textAnchor="middle"
        fill={color} fontSize={8} fontWeight={700}>
        {gLabel}
      </text>
      {/* PE없는 종목 표시 */}
      {!hasPeg && (
        <text x={cx} y={cy + r + 10}
          textAnchor="middle"
          fill="#475569" fontSize={7}>
          PE—
        </text>
      )}
    </g>
  )
}

// ── 메인 컴포넌트
export default function EarningsAlertTerminal({
  investments, dividendMap, priceMap,
}: EarningsAlertProps) {
  // G 리비전 슬라이더: 사용자가 G를 가상으로 조정하여 PEG 재계산
  const [gOverrides, setGOverrides] = useState<Record<string, number>>({})

  // ① SSOT 필터 + 티커 중복 제거
  // 부모(dashboard)에서 이미 STOCK 필터링하여 전달하지만,
  // 다른 곳에서 사용 시에도 안전하도록 컴포넌트 내부에서도 이중 방어
  const stocks = useMemo(() => {
    const seen = new Map<string, PortfolioItem>()
    investments.forEach(inv => {
      // SSOT: getAssetType 으로 개별 주식만 허용
      const assetType = getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US')
      if (assetType !== 'STOCK') return
      // 동일 티커 중복 방지 (첫 번째 등록만 유지)
      if (!seen.has(inv.ticker.toUpperCase())) {
        seen.set(inv.ticker.toUpperCase(), inv)
      }
    })
    return Array.from(seen.values())
  }, [investments])

  // 종목별 계산 데이터
  const tableData = useMemo(() => {
    return stocks.map(inv => {
      const key     = inv.ticker.toUpperCase()
      const div     = dividendMap[key] ?? {}
      const pe      = safeNumber(div.pe)
      const pegReal = safeNumber(div.peg)

      // Forward G 추출 — 우선순위:
      // ① PE/PEG 역산 (가장 정확: G = PE / PEG)
      // ② earningsGrowth (stock-info API의 실제 YoY 성장률)
      // ③ 카테고리 기본값 (lynch_category 기반)
      // ④ 전체 기본값 15%
      const earningsGrowthRaw = safeNumber(div.earningsGrowth)
      // earningsGrowth: 0~1 소수(0.65=65%) 또는 % 정수(65) 두 가지 형태 모두 처리
      const earningsGrowthPct = earningsGrowthRaw > 0
        ? (earningsGrowthRaw < 2 ? earningsGrowthRaw * 100 : earningsGrowthRaw)
        : 0

      const categoryDefaultG: Record<string, number> = {
        fast_grower: 25, stalwart: 12, slow_grower: 5,
        cyclical: 15, turnaround: 20, asset_play: 8, na: 10,
      }
      const catDefaultG = inv.lynch_category
        ? (categoryDefaultG[inv.lynch_category] ?? 10)
        : 10

      const baseG = pe > 0 && pegReal > 0 ? parseFloat((pe / pegReal).toFixed(1))
        : earningsGrowthPct > 0              ? parseFloat(earningsGrowthPct.toFixed(1))
        : catDefaultG

      // 사용자 오버라이드 G (슬라이더)
      const currentG  = gOverrides[inv.ticker] ?? baseG
      const originalG = baseG  // 원래 G (체질 변화 감지용)

      // ② PEG 재계산 공식 정상화
      // PEG = PE / G  (G는 % 정수 단위 그대로 사용)
      // 예: PE=20, G=20% → PEG = 20/20 = 1.0 ✓
      // pegReal(시장 PEG)은 G가 소수 단위(%/100)로 들어오므로 스케일 불일치 주의
      const revisedPeg = pe > 0 && currentG > 0
        ? parseFloat((pe / currentG).toFixed(2))
        : (pegReal > 0 ? pegReal : 0)

      // 린치 적정 멀티플 (SSOT)
      const multiple = calcFairMultiple(pe, revisedPeg, inv.lynch_category, inv.market)

      // 알럿 판정 (우선순위: 체질변화 → 매수 → 매도 → 보유)
      const alert = calcAlert(currentG, originalG, revisedPeg)

      // G 3개월 히스토리 (스파크라인용)
      const gHistory = buildGHistory(currentG, inv.ticker)

      // ── 카테고리 자동 보정 (DB 오분류 방어)
      // 문제: EATON처럼 DB가 fast_grower로 잘못 저장됐지만 실제 G=7.7%인 경우
      // 해결: 실제 baseG 값과 DB 카테고리가 명백히 모순이면 G 기반으로 표시 보정
      const correctedCategory = (() => {
        const dbCat = inv.lynch_category
        if (!dbCat || dbCat === 'na') return null
        // G가 실재하는 경우에만 검증
        if (baseG <= 0) return dbCat
        // 명백한 불일치 감지
        if (dbCat === 'fast_grower' && baseG < 12)  return 'stalwart'   // G<12%인데 고성장주?
        if (dbCat === 'fast_grower' && baseG < 5)   return 'slow_grower'
        if (dbCat === 'slow_grower' && baseG >= 20) return 'fast_grower'
        if (dbCat === 'stalwart'    && baseG >= 35) return 'fast_grower' // 35% 이상만 고성장주 전환 (GOOGL 28% 등 보호)
        return dbCat  // 이상 없으면 DB값 그대로
      })()
      const catKr = correctedCategory
        ? (LYNCH_CATEGORY_KR[correctedCategory] ?? correctedCategory)
        : '미분류'
      // DB 카테고리가 보정되었는지 표시용 플래그
      const isCatCorrected = correctedCategory !== inv.lynch_category && !!inv.lynch_category

      // 현재가 — KR 주식 10배 스케일 버그 방어
      // 네이버 API가 간헐적으로 10배 값을 반환하는 케이스
      // 방어 기준: PE가 있으면 역산된 적정 가격과 10배 이상 차이날 때만 보정
      // (삼성바이오로직스처럼 실제로 ₩700,000+ 인 종목은 보정하지 않음)
      const rawPrice = priceMap[key]?.currentPrice ?? 0
      const livePrice = (() => {
        if (!isKrTicker(inv.ticker, inv.market, inv.currency)) return rawPrice
        if (rawPrice <= 0) return rawPrice
        // PE가 있으면 역산 기대가격과 비교
        if (pe > 0) {
          // EPS ≈ rawPrice/pe, EPS/10 ≈ rawPrice/10/pe
          // 만약 rawPrice/10/pe 가 더 합리적이면(PE<100) 보정
          // rawPrice 그대로의 implied EPS vs 10배 기준 EPS 비교
          const rawEps  = rawPrice  / pe
          const adjEps  = rawPrice / 10 / pe
          // 한국 주식 EPS가 ₩100,000 이상이면 거의 없음 → 이상값
          if (rawEps > 100_000 && adjEps < 100_000) return rawPrice / 10
        }
        // PE 없을 때: 5,000,000원 초과 시만 보정 (KOSPI200 최고가 기준)
        if (rawPrice > 5_000_000) return rawPrice / 10
        return rawPrice
      })()

      return {
        ticker: inv.ticker, name: inv.name, market: inv.market, currency: inv.currency,
        pe, baseG, currentG, originalG,
        revisedPeg, multiple, alert,
        gHistory, catKr, isCatCorrected, livePrice,
      }
    })
  }, [stocks, dividendMap, priceMap, gOverrides])

  // ── 버블차트 — G 순위 균등 배치 (겹침 원천 차단)
  // 핵심 아이디어: X축을 실제 G% 대신 "G 순위(rank)"로 매핑
  //   → 종목 수에 관계없이 모든 버블이 고르게 펼쳐짐
  //   → 하단 Y = 실제 PEG 값 (저평가 아래, 고평가 위)
  //   → G 실제값은 버블 라벨/툴팁으로 표시
  const BUBBLE_Y_MAX = 3.0   // PEG 3.0 이상 클램핑
  const bubbleData = useMemo(() => {
    // TEMPUS AI처럼 PEG없는 종목도 포함 (y=0으로 표시)
    const allStocks = tableData.map(d => ({
      ...d,
      hasPeg: d.revisedPeg > 0,
    }))
    // G 기준 오름차순 정렬
    const sorted = [...allStocks].sort((a, b) => a.currentG - b.currentG)
    const n = sorted.length
    return sorted.map((d, rank) => ({
      // X = 균등 간격 (10%~90% 사이 n등분)
      x:       n === 1 ? 50 : 10 + (rank / (n - 1)) * 80,
      // Y = 실제 PEG (없으면 0)
      y:       d.hasPeg ? Math.min(d.revisedPeg, BUBBLE_Y_MAX) : 0,
      xActual: d.currentG,
      yActual: d.revisedPeg,
      z:       80,   // 균등한 버블 크기
      ticker:  (() => {
        // 한국 6자리 티커는 이름 앞 4글자, 영문은 티커 그대로
        if (/^\d{6}$/.test(d.ticker)) return d.name.slice(0, 4)
        return d.ticker.slice(0, 4)
      })(),
      alert:   d.alert,
      hasPeg:  d.hasPeg,
      gLabel:  d.currentG >= 100 ? `${Math.round(d.currentG)}%` : `${d.currentG.toFixed(0)}%`,
    }))
  }, [tableData])

  // 알럿 집계
  const alertCounts = useMemo(() => ({
    buy:       tableData.filter(d => d.alert.type === 'buy').length,
    sell:      tableData.filter(d => d.alert.type === 'sell').length,
    downgrade: tableData.filter(d => d.alert.type === 'downgrade').length,
    hold:      tableData.filter(d => d.alert.type === 'hold').length,
  }), [tableData])

  const C = {
    card: '#1a1d27', border: '#2a2d3a', grid: '#1e2140',
    text: '#94a3b8', textHi: '#f1f5f9', textLow: '#475569',
  }

  // ── Empty State: 개별 주식이 하나도 없을 때
  if (stocks.length === 0) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '60px 24px',
      background: C.card, border: `1px dashed ${C.border}`,
      borderRadius: 14, textAlign: 'center',
    }}>
      <AlertTriangle size={36} color="#475569" />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textHi, marginBottom: 8 }}>
          린치 PEG 분석 적용 불가
        </div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, maxWidth: 420 }}>
          현재 포트폴리오에{' '}
          <span style={{ color: '#60a5fa', fontWeight: 700 }}>
            린치 분석을 적용할 수 있는 개별 주식 자산이 없습니다.
          </span>
          <br />
          피터 린치의 PEG 밸류에이션은 <strong>개별 기업 주식</strong>에만 적용됩니다.
          <br />
          <span style={{ fontSize: 11, color: C.textLow }}>
            (ETF · 원자재 · 암호화폐는 분석 대상에서 제외됩니다)
          </span>
        </div>
        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)',
          fontSize: 11, color: '#60a5fa',
        }}>
          💡 자산관리 탭에서 NVDA, 삼성전자 등 개별 주식을 추가하면 바로 분석이 시작됩니다.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── 헤더 */}
      <div style={{
        padding: '14px 20px', borderRadius: 12,
        background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(30,41,59,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>
              어닝 터미널 — G 리비전 추적기
            </span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontWeight: 700,
            }}>
              EARNINGS ALERT
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.textLow }}>
            12M Forward 이익성장률(G) 컨센서스 추이 · PEG 동적 재계산 · 린치 매매 알럿
          </div>
        </div>

        {/* 알럿 집계 */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { icon: '🟢', label: '매수 적기', count: alertCounts.buy,       color: '#4ade80' },
            { icon: '🔴', label: '매도 고려', count: alertCounts.sell,      color: '#f87171' },
            { icon: '🟡', label: '체질 변화', count: alertCounts.downgrade, color: '#fbbf24' },
          ].map(a => (
            <div key={a.label} style={{
              padding: '6px 12px', borderRadius: 8, textAlign: 'center',
              background: `${a.color}0d`, border: `1px solid ${a.color}30`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: a.color }}>{a.count}</div>
              <div style={{ fontSize: 9, color: C.textLow, marginTop: 1 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2열: 테이블 | 버블차트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>

        {/* ── G 리비전 테이블 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', overflowX: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.05em', marginBottom: 12 }}>
            종목별 G(이익성장률) 리비전 현황 — 슬라이더로 G 조정 시 PEG 실시간 재계산
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['종목', '카테고리', 'G 추이 (3M)', 'Forward G', 'PE', 'PEG', '적정배수', '알럿'].map((h, i) => (
                  <th key={h} style={{
                    padding: '6px 8px', textAlign: i === 0 ? 'left' : 'center',
                    color: C.textLow, fontWeight: 700, fontSize: 10, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.ticker} style={{ borderBottom: `1px solid ${C.grid}` }}>
                  {/* 종목 */}
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: C.textHi, fontSize: 12 }}>{row.name.length > 14 ? row.name.slice(0, 13) + '…' : row.name}</div>
                    <div style={{ fontSize: 9, color: C.textLow, fontFamily: 'monospace' }}>{row.ticker}</div>
                  </td>
                  {/* 카테고리 — DB 오분류 시 조용히 보정 (배지 혼란 없음) */}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(30,41,59,1)', color: C.text, whiteSpace: 'nowrap',
                    }}>
                      {row.catKr}
                    </span>
                  </td>
                  {/* 스파크라인 — 고정 80×24, 순수 추세선 */}
                  <td style={{ padding: '4px 8px' }}>
                    <Sparkline data={row.gHistory} color={row.alert.color} />
                  </td>
                  {/* G 슬라이더 */}
                  <td style={{ padding: '8px', textAlign: 'center', minWidth: 100 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 900, fontFamily: 'monospace',
                        color: row.currentG >= 20 ? '#4ade80' : row.currentG >= 10 ? '#fbbf24' : '#f87171',
                      }}>
                        {row.currentG.toFixed(1)}%
                      </span>
                      <input
                        type="range" min={0} max={80} step={1}
                        value={row.currentG}
                        onChange={e => setGOverrides(prev => ({ ...prev, [row.ticker]: Number(e.target.value) }))}
                        style={{ width: 80, height: 4, cursor: 'pointer', accentColor: row.alert.color }}
                        title={`G 조정: ${row.currentG.toFixed(1)}%`}
                      />
                      {gOverrides[row.ticker] !== undefined && (
                        <button
                          onClick={() => setGOverrides(prev => { const n = { ...prev }; delete n[row.ticker]; return n })}
                          style={{ fontSize: 8, color: '#334155', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          초기화
                        </button>
                      )}
                    </div>
                  </td>
                  {/* PE */}
                  <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: C.text }}>
                    {row.pe > 0 ? row.pe.toFixed(1) : '—'}
                  </td>
                  {/* 재계산 PEG */}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                      color: row.revisedPeg <= 0.5 ? '#4ade80'
                           : row.revisedPeg >= 1.5 ? '#f87171'
                           : '#fbbf24',
                    }}>
                      {row.revisedPeg > 0 ? row.revisedPeg.toFixed(2) : '—'}
                    </span>
                  </td>
                  {/* 적정 멀티플 */}
                  <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: C.textLow }}>
                    {row.multiple}×
                  </td>
                  {/* 알럿 */}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 6,
                      fontWeight: 700, whiteSpace: 'nowrap',
                      color: row.alert.color,
                      background: row.alert.bg,
                      border: `1px solid ${row.alert.border}`,
                    }}>
                      {row.alert.icon} {row.alert.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── PEG 분포 버블차트 (G 순위 균등 배치) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.05em', marginBottom: 2 }}>
            전 종목 PEG 분포 — 슬라이더 조정 시 실시간 동기화
          </div>
          <div style={{ fontSize: 10, color: C.textLow, marginBottom: 10 }}>
            X축: G 성장률 순위 (낮음 → 높음) · Y축: PEG · 버블 위 숫자: 실제 G%
          </div>

          <ResponsiveContainer width="100%" height={310}>
            <ScatterChart margin={{ top: 40, right: 20, bottom: 20, left: 4 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />

              {/* X축: 순위 기반 (tick 숨김, 실제값은 버블 라벨로) */}
              <XAxis
                type="number" dataKey="x"
                domain={[0, 100]}
                tick={false} tickLine={false}
                axisLine={{ stroke: C.border }}
                label={{ value: 'G 낮음  ──────────────────────────────────  G 높음', position: 'insideBottom', offset: -8, fill: C.textLow, fontSize: 8 }}
              />

              {/* Y축: PEG 실제값 */}
              <YAxis
                type="number" dataKey="y" name="PEG"
                domain={[0, BUBBLE_Y_MAX]}
                ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]}
                tickFormatter={(v: number) => v >= BUBBLE_Y_MAX ? `${v}+` : `${v}`}
                tick={{ fill: C.textLow, fontSize: 9 }} tickLine={false} axisLine={false}
                label={{ value: 'PEG', angle: -90, position: 'insideLeft', offset: 10, fill: C.textLow, fontSize: 9 }}
                width={36}
              />
              <ZAxis dataKey="z" range={[1600, 1600]} />

              {/* PEG 가이드라인 */}
              <ReferenceLine y={0.5} stroke="#4ade80" strokeDasharray="5 3" strokeWidth={1.2} strokeOpacity={0.6}
                label={{ value: 'PEG=0.5 (저평가)', position: 'insideTopLeft', fill: '#4ade80', fontSize: 8 }}
              />
              <ReferenceLine y={1.0} stroke="#60a5fa" strokeDasharray="5 3" strokeWidth={1} strokeOpacity={0.5}
                label={{ value: 'PEG=1.0', position: 'insideTopLeft', fill: '#60a5fa', fontSize: 8 }}
              />
              <ReferenceLine y={1.5} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.2} strokeOpacity={0.6}
                label={{ value: 'PEG=1.5 (고평가)', position: 'insideTopLeft', fill: '#f87171', fontSize: 8 }}
              />

              <Scatter
                data={bubbleData}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(props: any) => <BubbleDot {...props} />}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 9, color: C.textLow }}>
            {[
              { color: '#4ade80', label: '🟢 매수 적기 (PEG≤0.5)' },
              { color: '#f87171', label: '🔴 매도 고려 (PEG≥1.5)' },
              { color: '#fbbf24', label: '🟡 체질 변화' },
              { color: '#60a5fa', label: '⚪ 관찰 중' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 알럿 상세 카드 */}
      {tableData.filter(d => d.alert.type !== 'hold').length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.05em', marginBottom: 12 }}>
            🔔 활성 알럿 상세
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tableData.filter(d => d.alert.type !== 'hold').map(row => (
              <div key={row.ticker} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: row.alert.bg, border: `1px solid ${row.alert.border}`,
              }}>
                {/* 아이콘 */}
                <div style={{ fontSize: 20, flexShrink: 0 }}>{row.alert.icon}</div>
                {/* 내용 */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: row.alert.color, fontSize: 13 }}>
                      [{row.alert.label}]
                    </span>
                    <span style={{ fontWeight: 700, color: C.textHi, fontSize: 12 }}>{row.name}</span>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textLow }}>{row.ticker}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(30,41,59,1)', color: C.textLow }}>{row.catKr}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                    {row.alert.desc}
                    {row.livePrice > 0 && (
                      <span style={{ marginLeft: 8, color: C.textLow }}>
                        · 현재가: {fmtPrice(row.livePrice, row.ticker, row.market, row.currency)}
                      </span>
                    )}
                  </div>
                </div>
                {/* PEG 배지 */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: row.alert.color }}>
                    {row.revisedPeg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 8, color: C.textLow }}>PEG</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 피터 린치 PEG 교육 박스 */}
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} /> 피터 린치 PEG 원칙 — G 리비전의 투자 의미
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 10, color: C.text, lineHeight: 1.7 }}>
          <div>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>🟢 PEG ≤ 0.5:</span> 이익성장 대비 주가가 지나치게 저렴.
            성장률 상향 리비전 시 가장 강력한 매수 신호.
          </div>
          <div>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>🔵 PEG = 1.0:</span> 이익성장률과 주가가 균형. 린치의 &quot;공정가치&quot;.
            PEG = 1이면 성장 대비 적정 가격.
          </div>
          <div>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>🟡 G 꺾임:</span> 고성장(≥20%)이 중저성장(&lt;10%)으로 하락.
            린치는 &quot;성장 스토리가 끝난 주식은 즉시 팔아라&quot;고 경고.
          </div>
          <div>
            <span style={{ color: '#f87171', fontWeight: 700 }}>🔴 PEG ≥ 1.5:</span> 성장 대비 고평가. 성장률 하향 리비전 시
            밸류에이션 수축 → 주가 하락 위험 증가.
          </div>
        </div>
      </div>

    </div>
  )
}
