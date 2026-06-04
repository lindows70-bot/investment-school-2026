'use client'

/**
 * LynchValuationEngine — 피터 린치 6대 분류별 맞춤형 가치평가 엔진
 *
 * 제1원칙: 학생의 실제 포트폴리오(investments)에서 개별 주식만 추출
 *   - 종목 선택 드롭다운 → lynch_category 감지 → 분류별 전용 UI 렌더링
 *
 * 6대 분류:
 *   fast_grower  → PEG 게이지 + 이익성장률
 *   stalwart     → 린치 스코어 [(G + DY) / PER] + 등급 배지
 *   cyclical     → PBR 밴드 + 린치 경고창
 *   slow_grower  → 배당성향 게이지 + FCF 안정성
 *   turnaround   → 부채비율/이자보상배율 + 흑자전환 배지
 *   asset_play   → 순현금/현재가 기반 안전마진율
 */

import { useState, useMemo } from 'react'
import { getAssetType } from '@/lib/assetClassifier'
import { safeNumber, LYNCH_CATEGORY_KR } from '@/lib/lynchAnalysis'

// ── 타입 ─────────────────────────────────────────────────────────────────────
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

export interface LynchValuationProps {
  investments:  PortfolioInvestment[]
  dividendMap:  Record<string, DividendEntry>
  priceMap:     Record<string, { currentPrice: number; changePct?: number }>
}

// ── 가치평가 데이터 매퍼 ──────────────────────────────────────────────────────

interface ValuationMetrics {
  // 공통
  pe?:              number | null
  peg?:             number | null
  earningsGrowth?:  number | null   // % (e.g. 35 = 35%)
  dividendYield?:   number | null   // % (e.g. 1.2 = 1.2%)
  payoutRatio?:     number | null   // 0~1 (e.g. 0.35)
  // 경기순환주
  pbr?:             number | null
  pbrHistMin?:      number | null
  pbrHistMax?:      number | null
  pbrHistAvg?:      number | null
  // 회생주
  debtRatio?:       number | null   // 부채비율 % (100 = 100%)
  interestCoverage?: number | null  // 이자보상배율
  recentEps?:       number | null   // 최근 EPS (흑자전환 확인)
  prevEps?:         number | null
  // 자산주
  netCashPerShare?: number | null   // 주당 순현금
  bookValuePS?:     number | null   // 주당 순자산(BPS)
  // FCF
  fcfYield?:        number | null   // FCF 수익률 %
  // 메타
  dataSource: 'known' | 'estimated'
  note?: string
}

/**
 * 티커별 가치평가 세부 지표 매퍼
 * dividendMap API 실데이터 + 공시 기반 보완 데이터
 */
const KNOWN_VALUATION: Record<string, Partial<ValuationMetrics>> = {
  // ── 고성장주 (fast_grower)
  'NVDA': {
    earningsGrowth: 102,
    pbr: 30.2,
    fcfYield: 2.8,
    dataSource: 'known',
    note: 'AI 데이터센터 수요로 EPS 3년 연속 100%+ 성장',
  },
  'PLTR': {
    earningsGrowth: 35,
    debtRatio: 12,
    interestCoverage: 48,
    pbr: 22.5,
    dataSource: 'known',
    note: '정부·기업 AI 계약 급증, 흑자전환 완료',
  },
  'TEM': {
    earningsGrowth: 55,
    debtRatio: 85,
    interestCoverage: 3.2,
    recentEps: -0.45,
    prevEps: -1.20,
    dataSource: 'known',
    note: '매출 급성장, 적자 축소 중 → 흑자전환 임박',
  },
  'GEV': {
    earningsGrowth: 40,
    pbr: 8.5,
    fcfYield: 1.2,
    dataSource: 'known',
    note: 'GE Vernova 분사 후 에너지 전환 수혜',
  },
  'IONQ': {
    earningsGrowth: 80,
    debtRatio: 30,
    interestCoverage: -2.1,  // 영업손실
    recentEps: -0.18,
    prevEps: -0.28,
    dataSource: 'known',
    note: '양자컴퓨팅 선두주자, 적자 축소 중',
  },
  // ── 중성장 우량주 (stalwart)
  'GOOGL': {
    earningsGrowth: 15,
    pbr: 6.8,
    fcfYield: 4.1,
    dataSource: 'known',
    note: 'AI 통합 검색·클라우드 성장, 강한 FCF',
  },
  'ETN': {
    earningsGrowth: 14,
    pbr: 5.2,
    fcfYield: 5.0,
    payoutRatio: 0.31,
    dataSource: 'known',
    note: '전력 인프라 수혜 대형주, 꾸준한 FCF',
  },
  'IBB': {
    earningsGrowth: 8,
    pbr: 3.1,
    fcfYield: 3.5,
    dataSource: 'known',
    note: '바이오테크 ETF — 린치 분류 참고용',
  },
  // ── 경기순환주 (cyclical)
  '000660': {   // SK하이닉스
    earningsGrowth: 220,
    pbr: 1.85,
    pbrHistMin: 0.85,
    pbrHistMax: 3.50,
    pbrHistAvg: 1.80,
    debtRatio: 48,
    dataSource: 'known',
    note: 'HBM3E 수요 급증으로 역대급 이익 회복 사이클',
  },
  '034020': {   // 두산에너빌리티
    pbr: 0.92,
    pbrHistMin: 0.40,
    pbrHistMax: 2.80,
    pbrHistAvg: 1.20,
    debtRatio: 210,
    dataSource: 'known',
    note: '원전 수출 모멘텀, PBR 역사적 저점권',
  },
  '329180': {   // HD현대중공업
    pbr: 1.35,
    pbrHistMin: 0.55,
    pbrHistMax: 2.20,
    pbrHistAvg: 1.10,
    debtRatio: 180,
    dataSource: 'known',
    note: 'LNG선 수주 호조, 조선 사이클 업',
  },
  '012450': {   // 한화에어로스페이스
    earningsGrowth: 65,
    pbr: 3.20,
    pbrHistMin: 0.80,
    pbrHistMax: 4.50,
    pbrHistAvg: 1.80,
    debtRatio: 120,
    dataSource: 'known',
    note: 'K-방산 수출 급성장, PBR 고점 접근 주의',
  },
  '017960': {   // 한국카본
    pbr: 0.75,
    pbrHistMin: 0.40,
    pbrHistMax: 1.80,
    pbrHistAvg: 0.90,
    debtRatio: 95,
    dataSource: 'known',
    note: 'LNG탱크 소재, 조선 사이클 동반 수혜',
  },
  // ── 회생주 (turnaround)
  '189300': {   // 인텔리안테크
    debtRatio: 155,
    interestCoverage: 2.8,
    recentEps: 1250,
    prevEps: -3420,
    dataSource: 'known',
    note: '해상 위성통신 수요 회복, 흑자전환 완료',
  },
  // ── 저성장 배당주 (slow_grower)
  '0131V0': {   // KODEX 국고채
    payoutRatio: 0.95,
    dividendYield: 3.2,
    fcfYield: 3.2,
    dataSource: 'known',
    note: 'ETF 특성상 배당성향 거의 100%',
  },
  'XBI': {
    payoutRatio: 0.10,
    fcfYield: 1.2,
    dataSource: 'known',
    note: '성장형 바이오ETF, 배당보다 시세차익 중심',
  },
}

function getValuationMetrics(
  ticker: string,
  div: DividendEntry,
): ValuationMetrics {
  const key = ticker.toUpperCase()
  const known = KNOWN_VALUATION[key]

  const base: ValuationMetrics = {
    pe:              safeNumber(div.pe)             || null,
    peg:             safeNumber(div.peg)            || null,
    dividendYield:   (() => {
      const dy = safeNumber(div.dividendYield)
      return dy > 0 ? (dy < 2 ? parseFloat((dy * 100).toFixed(2)) : dy) : null
    })(),
    payoutRatio:     safeNumber(div.payoutRatio)    || null,
    earningsGrowth:  (() => {
      const eg = safeNumber(div.earningsGrowth)
      return eg > 0 ? parseFloat((eg * 100).toFixed(1)) : null
    })(),
    dataSource: 'estimated',
  }

  if (!known) return base

  return {
    ...base,
    ...known,
    // dividendMap 실데이터가 있으면 우선
    pe:             base.pe  ?? known.pe  ?? null,
    peg:            base.peg ?? known.peg ?? null,
    dividendYield:  base.dividendYield ?? known.dividendYield ?? null,
    payoutRatio:    base.payoutRatio   ?? known.payoutRatio   ?? null,
    earningsGrowth: base.earningsGrowth ?? known.earningsGrowth ?? null,
    dataSource: 'known',
  } as ValuationMetrics
}

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#0f1117',
  card:    '#1a1d27',
  card2:   '#141720',
  border:  '#2a2d3a',
  gold:    '#f59e0b',
  goldDim: 'rgba(245,158,11,0.15)',
  green:   '#4ade80',
  red:     '#f87171',
  blue:    '#60a5fa',
  text:    '#f1f5f9',
  textSub: '#94a3b8',
  textLow: '#8599ae',
}

// ── 공통 UI 조각 ─────────────────────────────────────────────────────────────

/** 수치 카드 */
function MetricCard({ label, value, sub, color = C.text }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      background: C.card2, border: `1px solid ${C.border}`,
      minWidth: 110,
    }}>
      <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' as const }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/** 수평 게이지 바 */
function GaugeBar({ pct, color, label, min = '0', max = '100' }: {
  pct: number; color: string; label?: string; min?: string; max?: string
}) {
  const clamp = Math.max(0, Math.min(100, pct))
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: C.textSub, marginBottom: 5 }}>{label}</div>}
      <div style={{ position: 'relative', height: 10, background: '#1e2330', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${clamp}%`, borderRadius: 999,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: C.textLow }}>{min}</span>
        <span style={{ fontSize: 9, color: C.textLow }}>{max}</span>
      </div>
    </div>
  )
}

/** 배지 */
function Badge({ icon, label, color, bg, border }: {
  icon: string; label: string; color: string; bg: string; border: string
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 6, fontWeight: 800, fontSize: 12,
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {icon} {label}
    </span>
  )
}

/** 린치 경고 박스 */
function LynchAdvice({ text, color = C.gold }: { text: string; color?: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: `rgba(245,158,11,0.07)`, border: `1px solid rgba(245,158,11,0.3)`,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
      <p style={{ margin: 0, fontSize: 12, color, lineHeight: 1.7 }}>{text}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 6대 분류별 렌더러
// ────────────────────────────────────────────────────────────────────────────

/**
 * PEG SSOT와 일관된 이익성장률(G) — 이상값(예: 770%) 방어 (제2원칙).
 * 린치 PEG = PER ÷ G(%) 이므로, PEG가 있으면 그 내재 성장률(PER/PEG)이 진실값.
 * 표시 G(earningsGrowth)가 PEG 내재값과 크게 괴리(2.5배↑)·비양수·100%↑면 → PEG 기준으로 보정.
 * (ETN: 표시 G 770%·PEG 4.91 → PEG 내재 G 7.7%로 보정 → 스코어 0.23, Jarvis·뉴스레이더와 일치)
 */
function effectiveGrowth(m: ValuationMetrics): number {
  const raw = m.earningsGrowth ?? 0
  const PE  = m.pe ?? 0
  const pegImplied = (PE > 0 && m.peg != null && m.peg > 0) ? PE / m.peg : null
  if (pegImplied != null && (raw <= 0 || raw > pegImplied * 2.5 || raw > 100)) {
    return parseFloat(pegImplied.toFixed(1))
  }
  return raw
}

/** ① 고성장주 — PEG 게이지 */
function FastGrowerPanel({ m, name }: { m: ValuationMetrics; name: string }) {
  const G   = effectiveGrowth(m)
  const pe  = m.pe ?? 0
  const peg = m.peg ?? (G > 0 && pe > 0 ? parseFloat((pe / G).toFixed(2)) : null)
  // 적자기업(PER 없음): G는 EPS가 아닌 매출 성장률 → 라벨·설명을 정직하게 분기
  const isLoss = pe <= 0

  const pegPct  = peg != null ? Math.min(100, (peg / 2) * 100) : 0
  const pegColor = peg == null ? C.textLow
    : peg <= 0.5 ? C.green
    : peg <= 1.0 ? '#34d399'
    : peg <= 1.5 ? C.gold
    : C.red

  const pegLabel = peg == null ? '—'
    : peg <= 0.5 ? '🟢 초저평가'
    : peg <= 1.0 ? '🟢 저평가'
    : peg <= 1.5 ? '🟡 적정가'
    : '🔴 고평가'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI 카드 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="PEG 지수" value={peg != null ? peg.toFixed(2) : '—'} sub={pegLabel} color={pegColor} />
        <MetricCard
          label={isLoss ? '매출 성장률' : '이익성장률 (G)'}
          value={G > 0 ? `${G.toFixed(0)}%` : '—'}
          sub={isLoss ? 'YoY 매출(적자기업)' : 'YoY EPS 성장률'}
          color={C.blue}
        />
        <MetricCard label="PER" value={pe > 0 ? pe.toFixed(1) : '—'} sub={isLoss ? '적자 — 산출 불가' : '주가수익비율'} color={C.textSub} />
        {m.fcfYield != null && (
          <MetricCard label="FCF 수익률" value={`${m.fcfYield.toFixed(1)}%`} sub="잉여현금 / 시가총액" color={C.green} />
        )}
      </div>

      {/* PEG 게이지 */}
      <div style={{ padding: '16px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 12 }}>
          PEG 밸류에이션 구간 (0 ← 저평가 | 고평가 → 2.0+)
        </div>
        <GaugeBar pct={pegPct} color={pegColor} min="0 (초저평가)" max="2.0 (고평가)" />

        {/* 구간 마커 */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          {[
            { range: '≤ 0.5', label: '초저평가', color: C.green },
            { range: '0.5~1.0', label: '저평가 (매수)', color: '#34d399' },
            { range: '1.0~1.5', label: '적정 (보유)', color: C.gold },
            { range: '≥ 1.5', label: '고평가 (주의)', color: C.red },
          ].map(z => (
            <div key={z.range} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: z.color }}>{z.range}</div>
              <div style={{ fontSize: 9, color: C.textLow }}>{z.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 린치 공식 설명 — 적자기업은 PEG/PER 계산 불가하므로 다르게 안내 */}
      {isLoss ? (
        <LynchAdvice text={`${name}는 아직 영업적자 단계라 PER·PEG를 계산할 수 없습니다(이익이 없으면 분모가 성립 안 됨). 위 ${G > 0 ? `${G.toFixed(0)}%는 EPS가 아닌 매출 성장률입니다. ` : ''}피터 린치라면 "성장 스토리"에 취하기 전에 ① 흑자 전환 시점 ② 현금 소진 속도(런웨이)를 먼저 확인했을 것입니다. 매출만 빠른 적자 기업은 '증명되지 않은 회생주'로 보수적으로 접근하세요.`} />
      ) : (
        <LynchAdvice text={`피터 린치의 핵심 공식: PEG = PER ÷ 이익성장률(G). ${name}의 이익성장률이 ${G}%일 때, 합리적 PER은 약 ${G}배 수준입니다. PEG 1.0 미만이면 저평가, 1.5 이상이면 성장 프리미엄 과부과 상태입니다.`} />
      )}
      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

/** ② 중성장 우량주 — 린치 스코어 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StalwartPanel({ m, name }: { m: ValuationMetrics; name: string }) {
  const G   = effectiveGrowth(m)   // PEG SSOT 일관 보정(770% 이상값 방어)
  const DY  = m.dividendYield  ?? 0
  const PE  = m.pe ?? 0
  const score = PE > 0 ? parseFloat(((G + DY) / PE).toFixed(2)) : null

  const scoreColor = score == null ? C.textLow
    : score >= 2.0 ? C.green
    : score >= 1.0 ? C.gold
    : C.red

  const scoreBadge = score == null ? null
    : score >= 2.0
      ? { icon: '🟢', label: '강력 매수 적기', color: C.green, bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)' }
      : score >= 1.5
        ? { icon: '🟡', label: '매수 고려 가능', color: C.gold, bg: C.goldDim, border: 'rgba(245,158,11,0.3)' }
        : score >= 1.0
          ? { icon: '⚪', label: '합리적 보유', color: C.textSub, bg: 'transparent', border: C.border }
          : { icon: '🔴', label: '교체 고려', color: C.red, bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="린치 우량주 스코어" value={score != null ? score.toFixed(2) : '—'} sub="(G + DY) ÷ PER" color={scoreColor} />
        <MetricCard label="이익성장률 (G)" value={G > 0 ? `${G.toFixed(0)}%` : '—'} sub="YoY EPS 성장률" color={C.blue} />
        <MetricCard label="배당수익률 (DY)" value={DY > 0 ? `${DY.toFixed(2)}%` : '—'} sub="연 배당 / 주가" color={C.gold} />
        <MetricCard label="PER" value={PE > 0 ? PE.toFixed(1) : '—'} sub="주가수익비율" color={C.textSub} />
        {m.fcfYield != null && (
          <MetricCard label="FCF 수익률" value={`${m.fcfYield.toFixed(1)}%`} sub="현금창출력" color={C.green} />
        )}
      </div>

      {scoreBadge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
          <Badge {...scoreBadge} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>
              스코어 {score?.toFixed(2)} — {scoreBadge.label}
            </div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
              린치 기준: 2.0 이상 → 강력 매수 / 1.0 미만 → 교체 고려
            </div>
          </div>
        </div>
      )}

      {/* 공식 설명 */}
      <div style={{ padding: '14px 18px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: C.gold, marginBottom: 8 }}>📐 린치 우량주 스코어 공식</div>
        <div style={{ color: C.textSub, lineHeight: 1.8 }}>
          <span style={{ color: C.text, fontFamily: 'monospace', fontWeight: 700 }}>
            스코어 = (이익성장률 {G.toFixed(0)}% + 배당수익률 {DY.toFixed(2)}%) ÷ PER {PE.toFixed(1)} = {score?.toFixed(2) ?? '—'}
          </span>
          <br />
          우량주는 성장 + 배당 합산 수익력이 지불한 PER보다 클 때 저평가입니다.
          스코어가 높을수록 현재 주가가 내재가치 대비 저렴하다는 신호입니다.
        </div>
      </div>

      <LynchAdvice text={`피터 린치는 대형 우량주를 "완만한 훌륭함(Slow Magnificent)"이라 불렀습니다. 이들은 10배 주식은 아니지만, 적정 PER에서 꾸준한 성장+배당 복리가 장기 수익의 핵심입니다.`} />
      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

/** ③ 경기순환주 — PBR 밴드 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CyclicalPanel({ m, currentPrice, name }: { m: ValuationMetrics; currentPrice: number; name: string }) {
  const pbr    = m.pbr ?? null
  const minPbr = m.pbrHistMin ?? 0.5
  const maxPbr = m.pbrHistMax ?? 3.0
  const avgPbr = m.pbrHistAvg ?? ((minPbr + maxPbr) / 2)

  // PBR 밴드에서 현재 위치 (0~100%)
  const range = maxPbr - minPbr
  const pbrPct = pbr != null && range > 0
    ? Math.max(0, Math.min(100, ((pbr - minPbr) / range) * 100))
    : null

  const pbrZone = pbr == null ? '—'
    : pbr <= minPbr * 1.1 ? '🟢 역사적 저점 (진바닥 신호)'
    : pbr <= avgPbr ? '🟡 평균 이하 (저평가 구간)'
    : pbr <= avgPbr * 1.3 ? '⚪ 평균 (중립)'
    : '🔴 고점 접근 (주의)'

  const pbrColor = pbr == null ? C.textLow
    : pbr <= minPbr * 1.1 ? C.green
    : pbr <= avgPbr ? C.gold
    : pbr <= avgPbr * 1.3 ? C.textSub
    : C.red

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="현재 PBR" value={pbr != null ? pbr.toFixed(2) : '—'} sub={pbrZone} color={pbrColor} />
        <MetricCard label="역사적 최저 PBR" value={minPbr.toFixed(2)} sub="과거 바닥 구간" color={C.green} />
        <MetricCard label="역사적 평균 PBR" value={avgPbr.toFixed(2)} sub="중기 평균" color={C.gold} />
        <MetricCard label="역사적 최고 PBR" value={maxPbr.toFixed(2)} sub="과거 고점 구간" color={C.red} />
        {m.debtRatio != null && (
          <MetricCard label="부채비율" value={`${m.debtRatio}%`} sub="경기침체 버팀력" color={m.debtRatio > 200 ? C.red : m.debtRatio > 100 ? C.gold : C.green} />
        )}
      </div>

      {/* PBR 밴드 시각화 */}
      <div style={{ padding: '16px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 12 }}>
          역사적 PBR 밴드 — 현재 위치
        </div>

        {/* 밴드 바 */}
        <div style={{ position: 'relative', height: 28, borderRadius: 8, overflow: 'visible', marginBottom: 8 }}>
          {/* 전체 밴드 배경 */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 8,
            background: 'linear-gradient(90deg, rgba(74,222,128,0.25) 0%, rgba(251,191,36,0.25) 40%, rgba(248,113,113,0.25) 100%)',
            border: `1px solid ${C.border}`,
          }} />

          {/* 평균선 */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((avgPbr - minPbr) / (maxPbr - minPbr)) * 100}%`,
            width: 2, background: C.gold, opacity: 0.7,
          }} />

          {/* 현재 PBR 포인터 */}
          {pbrPct != null && (
            <div style={{
              position: 'absolute', top: -4, bottom: -4,
              left: `calc(${pbrPct}% - 8px)`,
              width: 16, background: pbrColor,
              borderRadius: 4, border: `2px solid #fff`,
              boxShadow: `0 0 8px ${pbrColor}`,
            }} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textLow }}>
          <span>최저 {minPbr.toFixed(2)}x</span>
          <span style={{ color: C.gold }}>평균 {avgPbr.toFixed(2)}x</span>
          <span>최고 {maxPbr.toFixed(2)}x</span>
        </div>

        {pbr != null && (
          <div style={{ marginTop: 10, fontSize: 12, color: pbrColor, fontWeight: 700, textAlign: 'center' }}>
            현재 PBR {pbr.toFixed(2)}x — {pbrZone}
          </div>
        )}
      </div>

      {/* 린치 경기순환주 황금 경고 */}
      <div style={{
        padding: '14px 18px', borderRadius: 10,
        background: C.goldDim, border: `1px solid ${C.gold}55`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 6 }}>
          ⚠️ 피터 린치의 경기순환주 핵심 원칙
        </div>
        <div style={{ fontSize: 12, color: C.gold + 'cc', lineHeight: 1.8 }}>
          &ldquo;경기순환주는 <strong style={{ color: C.gold }}>PER이 높고 PBR이 역사적 바닥</strong>일 때가 진짜 저점입니다.
          이익이 바닥일 때 주가가 먼저 오르기 때문에, EPS가 급감해 PER이 치솟을 때 오히려 매수 신호일 수 있습니다.
          반대로 <strong style={{ color: C.red }}>PER이 한 자릿수로 내려오고 PBR이 고점에 있을 때</strong>는 매도 신호입니다.&rdquo;
        </div>
      </div>

      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

/** ④ 저성장 배당주 — 배당성향 게이지 + FCF */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SlowGrowerPanel({ m, name }: { m: ValuationMetrics; name: string }) {
  const payout  = m.payoutRatio ?? 0
  const payPct  = payout * 100
  const DY      = m.dividendYield ?? 0
  const fcf     = m.fcfYield ?? 0

  const payoutColor = payPct > 90 ? C.red : payPct > 70 ? C.gold : C.green
  const payoutZone  = payPct > 90 ? '🔴 위험 (배당 삭감 리스크)' : payPct > 70 ? '🟡 주의 (여유 부족)' : '🟢 안정 (지속 가능)'

  const fcfColor = fcf > 5 ? C.green : fcf > 2 ? C.gold : fcf > 0 ? C.textSub : C.red
  const fcfZone  = fcf > 5 ? '풍부' : fcf > 2 ? '보통' : fcf > 0 ? '빠듯' : '부족'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="배당수익률" value={DY > 0 ? `${DY.toFixed(2)}%` : '—'} sub="연간 배당 / 현재가" color={C.gold} />
        <MetricCard label="배당성향" value={payPct > 0 ? `${payPct.toFixed(0)}%` : '—'} sub={payoutZone} color={payoutColor} />
        <MetricCard label="FCF 수익률" value={fcf > 0 ? `${fcf.toFixed(1)}%` : '—'} sub={`잉여현금 — ${fcfZone}`} color={fcfColor} />
        {m.pe != null && (
          <MetricCard label="PER" value={m.pe.toFixed(1)} sub="주가수익비율" color={C.textSub} />
        )}
      </div>

      {/* 배당성향 게이지 */}
      <div style={{ padding: '16px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 12 }}>
          배당 지속 가능성 게이지 (배당성향 {payPct.toFixed(0)}%)
        </div>
        <GaugeBar pct={payPct} color={payoutColor} min="0% (미배당)" max="100% (전액 배당)" />

        {/* FCF 안정성 */}
        {fcf > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 8, marginTop: 14 }}>
              잉여현금흐름(FCF) 수익률 {fcf.toFixed(1)}%
            </div>
            <GaugeBar pct={Math.min(100, fcf * 10)} color={fcfColor} min="0%" max="10%+" />
          </>
        )}
      </div>

      <LynchAdvice text={`피터 린치는 저성장주를 "안정적 지루함"이라 불렀습니다. 핵심 체크포인트는 배당 지속 가능성입니다. FCF 수익률이 배당수익률보다 높아야 배당 삭감 위험이 없습니다. 배당성향 70% 초과 + FCF 빈약 → 향후 배당 삭감 경고 신호입니다.`} />
      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

/** ⑤ 회생주 — 부채/이자보상 + 흑자전환 배지 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TurnaroundPanel({ m, name }: { m: ValuationMetrics; name: string }) {
  const debt     = m.debtRatio ?? null
  const coverage = m.interestCoverage ?? null
  const recentEps = m.recentEps ?? null
  const prevEps   = m.prevEps ?? null

  const isTurned = recentEps != null && prevEps != null && recentEps > 0 && prevEps < 0
  const isImprove = recentEps != null && prevEps != null && recentEps > prevEps

  const debtColor = debt == null ? C.textLow : debt > 300 ? C.red : debt > 150 ? C.gold : C.green
  const covColor  = coverage == null ? C.textLow : coverage < 1 ? C.red : coverage < 3 ? C.gold : C.green

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 흑자전환 배지 */}
      {isTurned && (
        <div style={{
          padding: '12px 18px', borderRadius: 10,
          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.green }}>흑자전환 달성!</div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
              EPS {prevEps?.toFixed(0)} → {recentEps?.toFixed(0)} — 린치 회생주 투자 핵심 시그널
            </div>
          </div>
        </div>
      )}

      {!isTurned && isImprove && (
        <div style={{
          padding: '12px 18px', borderRadius: 10,
          background: C.goldDim, border: `1px solid ${C.gold}44`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>📈</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.gold }}>적자 축소 중 — 흑자전환 임박</div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
              EPS {prevEps?.toFixed(2)} → {recentEps?.toFixed(2)} 개선
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="부채비율" value={debt != null ? `${debt}%` : '—'} sub={debt != null ? (debt > 300 ? '위험' : debt > 150 ? '주의' : '안정') : ''} color={debtColor} />
        <MetricCard label="이자보상배율" value={coverage != null ? coverage.toFixed(1) : '—'} sub={coverage != null ? (coverage < 1 ? '이자도 못 갚음!' : coverage < 3 ? '위태로운 수준' : '이자 상환 OK') : ''} color={covColor} />
        {recentEps != null && (
          <MetricCard label="최근 EPS" value={String(recentEps.toFixed(recentEps > 100 ? 0 : 2))} sub="최신 실적" color={recentEps > 0 ? C.green : C.red} />
        )}
        {prevEps != null && (
          <MetricCard label="전기 EPS" value={String(prevEps.toFixed(prevEps > 100 || prevEps < -100 ? 0 : 2))} sub="비교 실적" color={prevEps > 0 ? C.green : C.red} />
        )}
      </div>

      {/* 부채비율 게이지 */}
      {debt != null && (
        <div style={{ padding: '16px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 12 }}>
            재무 건전성 게이지 — 부채비율 {debt}%
          </div>
          <GaugeBar pct={Math.min(100, debt / 4)} color={debtColor} min="0% (무부채)" max="400%+" />

          {coverage != null && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 8, marginTop: 14 }}>
                이자보상배율 {coverage.toFixed(1)}배 (영업이익 ÷ 이자비용)
              </div>
              <GaugeBar pct={Math.min(100, (coverage / 10) * 100)} color={covColor} min="0x (위험)" max="10x+" />
            </>
          )}
        </div>
      )}

      <LynchAdvice text={`피터 린치의 회생주 투자 핵심: "회사가 망하지 않을 것이라는 확신이 먼저다." 부채비율 200% 이하 + 이자보상배율 2배 이상이면 생존 가능성 높음. 흑자전환 시점이 가장 큰 주가 폭등 구간입니다.`} />
      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

/** ⑥ 자산주 — 순현금/BPS 안전마진 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AssetPlayPanel({ m, currentPrice, name }: { m: ValuationMetrics; currentPrice: number; name: string }) {
  const ncps = m.netCashPerShare ?? null    // 주당 순현금
  const bvps = m.bookValuePS ?? null        // 주당 순자산

  // 안전마진: (순현금/순자산 - 현재가) / 순현금 * 100
  const safetyMarginNcps = ncps != null && ncps > 0 && currentPrice > 0
    ? parseFloat(((ncps - currentPrice) / ncps * 100).toFixed(1))
    : null
  const safetyMarginBvps = bvps != null && bvps > 0 && currentPrice > 0
    ? parseFloat(((bvps - currentPrice) / bvps * 100).toFixed(1))
    : null

  const smColor = (sm: number | null) => sm == null ? C.textLow : sm > 30 ? C.green : sm > 0 ? C.gold : C.red
  const smLabel = (sm: number | null) => sm == null ? '—' : sm > 30 ? '🟢 깊은 안전마진' : sm > 0 ? '🟡 안전마진 있음' : '🔴 프리미엄 구간'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="현재가" value={currentPrice > 0 ? `₩${Math.round(currentPrice).toLocaleString('ko-KR')}` : '—'} sub="주당 시장가격" color={C.blue} />
        {ncps != null && <MetricCard label="주당 순현금" value={ncps > 0 ? `₩${Math.round(ncps).toLocaleString('ko-KR')}` : '—'} sub="현금 - 총부채" color={C.green} />}
        {bvps != null && <MetricCard label="주당 순자산(BPS)" value={bvps > 0 ? `₩${Math.round(bvps).toLocaleString('ko-KR')}` : '—'} sub="자기자본 / 주식수" color={C.gold} />}
        {safetyMarginNcps != null && (
          <MetricCard label="순현금 안전마진" value={`${safetyMarginNcps.toFixed(1)}%`} sub={smLabel(safetyMarginNcps)} color={smColor(safetyMarginNcps)} />
        )}
        {safetyMarginBvps != null && (
          <MetricCard label="BPS 안전마진" value={`${safetyMarginBvps.toFixed(1)}%`} sub={smLabel(safetyMarginBvps)} color={smColor(safetyMarginBvps)} />
        )}
      </div>

      {/* 안전마진 시각화 */}
      {(safetyMarginNcps != null || safetyMarginBvps != null) && (
        <div style={{ padding: '16px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 12 }}>
            안전마진 시각화 (양수 = 현재가 &lt; 내재가치 = 저평가)
          </div>
          {safetyMarginNcps != null && (
            <GaugeBar
              pct={Math.max(0, Math.min(100, safetyMarginNcps))}
              color={smColor(safetyMarginNcps)!}
              label={`순현금 기준: ${safetyMarginNcps > 0 ? '+' : ''}${safetyMarginNcps}%`}
              min="-50%" max="+100%"
            />
          )}
          {safetyMarginBvps != null && (
            <div style={{ marginTop: 14 }}>
              <GaugeBar
                pct={Math.max(0, Math.min(100, safetyMarginBvps))}
                color={smColor(safetyMarginBvps)!}
                label={`BPS 기준: ${safetyMarginBvps > 0 ? '+' : ''}${safetyMarginBvps}%`}
                min="-50%" max="+100%"
              />
            </div>
          )}
        </div>
      )}

      <LynchAdvice text={`피터 린치의 자산주 투자 원칙: "시장이 모르는 숨겨진 자산이 있을 때 기회가 생긴다." 주당 순현금이 현재가보다 높으면 사실상 자산을 공짜로 사는 셈입니다. 부동산·특허·계열사 지분 등 비현금 자산도 확인해야 합니다.`} />
      {m.note && <LynchAdvice text={`📌 ${m.note}`} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────────────────
export default function LynchValuationEngine({
  investments, dividendMap, priceMap,
}: LynchValuationProps) {

  // ① 개별 주식만 필터링 (SSOT)
  const stocks = useMemo(() => {
    const seen = new Map<string, PortfolioInvestment>()
    investments.forEach(inv => {
      if (getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') !== 'STOCK') return
      if (!seen.has(inv.ticker.toUpperCase())) seen.set(inv.ticker.toUpperCase(), inv)
    })
    return Array.from(seen.values())
  }, [investments])

  const [selectedTicker, setSelectedTicker] = useState<string>('')

  // 선택 종목 (기본: 첫 번째)
  const selected = useMemo(() => {
    if (stocks.length === 0) return null
    const key = selectedTicker || stocks[0]?.ticker
    return stocks.find(s => s.ticker === key) ?? stocks[0]
  }, [stocks, selectedTicker])

  // 선택 종목 데이터
  const { metrics, currentPrice } = useMemo(() => {
    if (!selected) return { metrics: null, currentPrice: 0 }
    const key = selected.ticker.toUpperCase()
    const div = dividendMap[key] ?? {}
    const raw = priceMap[key]?.currentPrice ?? 0
    return {
      metrics: getValuationMetrics(selected.ticker, div),
      currentPrice: raw > 0 ? raw : selected.purchase_price,
    }
  }, [selected, dividendMap, priceMap])

  const catKey  = selected?.lynch_category ?? 'na'
  const catLabel = LYNCH_CATEGORY_KR[catKey] ?? catKey

  // 카테고리별 색상
  const catColor: Record<string, string> = {
    fast_grower: '#34d399', stalwart: '#60a5fa', cyclical: '#fb923c',
    slow_grower: '#a8b5c2', turnaround: '#f87171', asset_play: '#c084fc', na: '#7a8fa3',
  }
  const cc = catColor[catKey] ?? C.textSub

  if (stocks.length === 0) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: '60px 24px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>분석할 개별 주식이 없습니다</div>
      <div style={{ fontSize: 13, color: C.textSub }}>
        자산관리 탭에서 개별 주식을 추가하면 가치평가 분석이 시작됩니다.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 + 종목 선택 드롭다운 */}
      <div style={{
        padding: '16px 20px', borderRadius: 14,
        background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(30,41,59,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🔬</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>
              린치 가치평가(Valuation) 엔진
            </span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${cc}22`, color: cc, fontWeight: 700 }}>
              {catLabel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.textLow }}>
            피터 린치 6대 분류별 맞춤 가치평가 프레임워크 · 보유 종목 실시간 연동
          </div>
        </div>

        {/* 종목 선택 드롭다운 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: C.textLow, whiteSpace: 'nowrap' }}>종목 선택</span>
          <select
            value={selectedTicker || (stocks[0]?.ticker ?? '')}
            onChange={e => setSelectedTicker(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#1e2330', color: C.text, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', outline: 'none', minWidth: 180,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight: 32,
            }}
          >
            {stocks.map(s => (
              <option key={s.ticker} value={s.ticker}>
                {(s.name ?? s.ticker).length > 20 ? (s.name ?? s.ticker).slice(0, 19) + '…' : (s.name ?? s.ticker)} ({s.ticker})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 선택 종목 요약 */}
      {selected && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          padding: '14px 18px', borderRadius: 12,
          background: C.card, border: `1px solid ${cc}44`,
        }}>
          {/* 종목명 */}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
              {selected.name ?? selected.ticker}
            </div>
            <div style={{ fontSize: 11, color: C.textLow, fontFamily: 'monospace', marginTop: 2 }}>
              {selected.ticker} · {selected.market}
              {metrics?.dataSource === 'estimated' && (
                <span style={{ marginLeft: 8, color: '#8599ae' }}>(추정 데이터)</span>
              )}
            </div>
          </div>

          {/* 분류 배지 */}
          <div style={{
            padding: '8px 14px', borderRadius: 8,
            background: `${cc}18`, border: `1px solid ${cc}44`,
          }}>
            <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>린치 분류</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: cc }}>{catLabel}</div>
          </div>

          {/* 현재가 */}
          <div style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
          }}>
            <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>현재가</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.blue, fontFamily: 'monospace' }}>
              {currentPrice > 0
                ? (selected.currency === 'KRW' || selected.market === 'KR' || /^\d{6}$/.test(selected.ticker))
                  ? `₩${Math.round(currentPrice).toLocaleString('ko-KR')}`
                  : `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'
              }
            </div>
          </div>

          {/* 분류 설명 */}
          <div style={{ fontSize: 11, color: C.textLow, lineHeight: 1.6, flex: 2, minWidth: 200 }}>
            {{
              fast_grower:  '연 20%+ 고성장 기업 → PEG < 1.0이면 저평가. 성장이 꺾이면 즉시 매도.',
              stalwart:     '연 10~20% 중성장 우량주 → (G+DY)/PER 스코어로 가성비 판단.',
              cyclical:     '경기 사이클 타는 업종 → PBR 바닥일 때 매수, 고점일 때 매도.',
              slow_grower:  '연 5% 미만 저성장 → 배당 지속 가능성이 핵심 지표.',
              turnaround:   '위기 기업 회생 스토리 → 흑자전환 시점이 최대 주가 폭발 구간.',
              asset_play:   '숨겨진 자산 보유 기업 → 순현금 > 시가총액이면 공짜로 사는 것.',
              na:           '분류 미정 — 자산관리 탭에서 린치 카테고리를 설정해주세요.',
            }[catKey] ?? ''}
          </div>
        </div>
      )}

      {/* ── 가치평가 패널 (switch-case 동적 렌더링) */}
      {selected && metrics && (
        <div style={{ padding: '20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: cc, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{{
              fast_grower: '① 고성장주 — PEG 가치평가 엔진',
              stalwart:    '② 중성장 우량주 — 린치 스코어 분석',
              cyclical:    '③ 경기순환주 — PBR 밴드 분석',
              slow_grower: '④ 저성장 배당주 — 배당 지속성 분석',
              turnaround:  '⑤ 회생주 — 재무 건전성 + 흑자전환 포착',
              asset_play:  '⑥ 자산주 — 안전마진율 분석',
              na:          '⚠ 분류 미설정',
            }[catKey] ?? catLabel}</span>
          </div>

          {/* switch-case */}
          {catKey === 'fast_grower' && <FastGrowerPanel  m={metrics} name={selected.name ?? selected.ticker} />}
          {catKey === 'stalwart'    && <StalwartPanel    m={metrics} name={selected.name ?? selected.ticker} />}
          {catKey === 'cyclical'    && <CyclicalPanel    m={metrics} currentPrice={currentPrice} name={selected.name ?? selected.ticker} />}
          {catKey === 'slow_grower' && <SlowGrowerPanel  m={metrics} name={selected.name ?? selected.ticker} />}
          {catKey === 'turnaround'  && <TurnaroundPanel  m={metrics} name={selected.name ?? selected.ticker} />}
          {catKey === 'asset_play'  && <AssetPlayPanel   m={metrics} currentPrice={currentPrice} name={selected.name ?? selected.ticker} />}

          {catKey === 'na' && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏷️</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>린치 분류가 설정되지 않았습니다</div>
              <div style={{ fontSize: 12, color: C.textSub }}>
                자산관리 탭 → 종목 편집 → 린치 카테고리를 설정하면<br />
                해당 분류에 맞는 가치평가 분석이 자동으로 표시됩니다.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
