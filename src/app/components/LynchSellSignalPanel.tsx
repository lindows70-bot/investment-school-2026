'use client'

/**
 * LynchSellSignalPanel — 피터 린치 유형별 매도 시그널 & 리밸런싱 알람
 *
 * ◆ 신호 등급
 *   🔴 경고 (danger)  — 매도 / 비중 축소 적극 검토
 *   🟡 유의 (caution) — 모니터링 강화 / 부분 익절 고민
 *   🟢 안정 (safe)    — 현재 포지션 보유 유지
 *
 * ◆ 데이터 소스
 *   portfolioStocks prop — 부모 대시보드에서 주입
 *   { name, ticker, currency, lynchType, per, growthRate, peg?,
 *     purchasePrice?, currentPrice?, dividendYield? }
 */

import { useMemo, useState } from 'react'
import {
  AlertTriangle, TrendingDown, CheckCircle2,
  ShieldAlert, Info, SlidersHorizontal, Inbox,
  ChevronRight, Zap,
} from 'lucide-react'
// SSOT: 자산 분류는 assetClassifier에서만 (컴포넌트 내 인라인 감지 금지)
import { getAssetClassification, type AssetType } from '@/lib/assetClassifier'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

type SignalStatus = 'danger' | 'caution' | 'safe' | 'unclassified'
type FilterTab    = 'all' | 'danger' | 'caution' | 'safe'

interface Metric {
  label:      string
  value:      string
  highlight?: 'red' | 'yellow' | 'green' | 'gray'
}

interface StockSignal {
  name:         string
  ticker:       string
  currency:     string
  lynchType:    string
  catIcon:      string
  status:       SignalStatus
  headline:     string          // 상태 한줄 요약
  lynchAdvice:  string          // 피터 린치 스타일 조언
  triggers:     string[]        // 트리거된 조건 목록
  metrics:      Metric[]        // 표시할 지표들
  returnPct?:   number          // 매입 대비 수익률
  gaugePos:     number          // 게이지 포인터 위치 (0~100)
  gaugeText:    string          // 게이지 하단 서브 텍스트
}

// ────────────────────────────────────────────────────────────
// 컬러 & 카테고리 메타데이터
// ────────────────────────────────────────────────────────────
const C = {
  bg:      '#020617',
  surface: '#0f172a',
  card:    '#1e293b',
  cardHi:  '#263348',
  border:  '#7a8fa3',
  textHi:  '#f1f5f9',
  textMid: '#94a3b8',
  textLow: '#7f93a8',
  red:     '#f87171',
  yellow:  '#fbbf24',
  green:   '#4ade80',
  blue:    '#60a5fa',
}

const STATUS_META = {
  danger:        { label:'매도 검토',   color:'#f87171', bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.30)'   },
  caution:       { label:'비중 축소 고민', color:'#fbbf24', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.30)' },
  safe:          { label:'보유 유지',   color:'#4ade80', bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.30)'  },
  unclassified:  { label:'데이터 부족', color:'#7f93a8', bg:'rgba(100,116,139,0.10)', border:'rgba(100,116,139,0.25)' },
}

const CAT_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  '고성장주':    { icon:'🚀', label:'고성장주',    color:'#f87171', bg:'rgba(239,68,68,0.10)',   border:'rgba(239,68,68,0.25)'   },
  '대형우량주':  { icon:'🛡️', label:'대형우량주',  color:'#60a5fa', bg:'rgba(59,130,246,0.10)',  border:'rgba(59,130,246,0.25)'  },
  '저성장주':    { icon:'🐢', label:'저성장주',    color:'#4ade80', bg:'rgba(34,197,94,0.10)',   border:'rgba(34,197,94,0.25)'   },
  '경기순환주':  { icon:'🔄', label:'경기순환주',  color:'#c084fc', bg:'rgba(168,85,247,0.10)',  border:'rgba(168,85,247,0.25)'  },
  '자산주':      { icon:'💎', label:'자산주',      color:'#fbbf24', bg:'rgba(245,158,11,0.10)',  border:'rgba(245,158,11,0.25)'  },
  '턴어라운드주':{ icon:'🔥', label:'턴어라운드주',color:'#fb923c', bg:'rgba(251,146,60,0.10)',  border:'rgba(251,146,60,0.25)'  },
}

// DB 영어 키 → 한국어
const ENGLISH_MAP: Record<string, string> = {
  fast_grower: '고성장주',
  stalwart:    '대형우량주',
  slow_grower: '저성장주',
  cyclical:    '경기순환주',
  asset_play:  '자산주',
  turnaround:  '턴어라운드주',
}

// ────────────────────────────────────────────────────────────
// 유형별 매도 시그널 계산 함수
// ────────────────────────────────────────────────────────────
function computeSignal(raw: AnyRecord): StockSignal {
  const name        = raw.name       || raw.stockName || '미확인 종목'
  const ticker      = raw.ticker     || raw.code      || ''
  const currency    = raw.currency   || 'USD'
  const rawKey      = (raw.lynchType || raw.lynch_category || raw.category || '').toString().trim()
  const lynchType   = ENGLISH_MAP[rawKey] ?? rawKey
  const cat         = CAT_META[lynchType]

  const per         = Number(raw.per)        || 0
  const growthRate  = Number(raw.growthRate) || 0
  const peg         = raw.peg !== undefined
    ? Number(raw.peg)
    : (per > 0 && growthRate > 0 ? parseFloat((per / growthRate).toFixed(2)) : 0)
  const divYield    = Number(raw.dividendYield) || 0
  const purchasePrice = Number(raw.purchasePrice ?? raw.purchase_price) || 0
  const currentPrice  = Number(raw.currentPrice ?? raw.current_price)   || 0
  const returnPct   = (purchasePrice > 0 && currentPrice > 0)
    ? parseFloat(((currentPrice - purchasePrice) / purchasePrice * 100).toFixed(1))
    : undefined

  // 공통 지표 구성
  const baseMetrics: Metric[] = [
    ...(per > 0        ? [{ label:'PER',      value:`${per.toFixed(1)}배`,       highlight: per > 30 ? 'red' : per > 22 ? 'yellow' : 'green' }] : []) as Metric[],
    ...(peg > 0        ? [{ label:'PEG',      value:peg.toFixed(2),              highlight: peg > 1.5 ? 'red' : peg > 1.0 ? 'yellow' : 'green' }] : []) as Metric[],
    ...(growthRate > 0 ? [{ label:'성장률',   value:`${growthRate.toFixed(1)}%`,  highlight: growthRate > 25 ? 'green' : growthRate < 5 ? 'yellow' : 'gray' }] : []) as Metric[],
    ...(divYield > 0   ? [{ label:'배당수익률',value:`${(divYield * 100).toFixed(2)}%`, highlight: 'gray' }] : []) as Metric[],
    ...(returnPct !== undefined ? [{ label:'수익률', value:`${returnPct > 0 ? '+' : ''}${returnPct}%`, highlight: returnPct > 50 ? 'red' : returnPct > 20 ? 'yellow' : returnPct > 0 ? 'green' : 'red' }] : []) as Metric[],
  ]

  // ── 데이터 없음 ────────────────────────────────────────────
  if (!lynchType || !CAT_META[lynchType]) {
    return {
      name, ticker, currency, lynchType: lynchType || '미분류', catIcon: '❓',
      status: 'unclassified',
      headline: '린치 유형 미분류',
      lynchAdvice: '종목 유형이 분류되지 않아 매도 시그널을 계산할 수 없습니다. 피터 린치 자동 분류를 먼저 실행해주세요.',
      triggers: [],
      metrics: baseMetrics,
      returnPct,
      gaugePos:  50,
      gaugeText: '린치 유형 미분류 — 게이지 계산 불가',
    }
  }

  const triggers: string[] = []
  let status: SignalStatus  = 'safe'
  let headline              = '현재 보유 유지 적합'
  let lynchAdvice           = ''

  // ╔═══════════════════════════════════════════════════╗
  // ║  1. 고성장주 — PEG 기반 + 성장률 둔화           ║
  // ╚═══════════════════════════════════════════════════╝
  if (lynchType === '고성장주') {
    if (peg > 1.5 && peg > 0) {
      status    = 'danger'
      headline  = `PEG ${peg.toFixed(2)} — 성장 프리미엄 과도`
      triggers.push(`PEG ${peg.toFixed(2)} > 1.5 (위험 임계치 초과)`)
      lynchAdvice = `"성장 스토리에 균열이 가기 시작했습니다. PEG가 1.5를 넘어서며 멀티플이 과도합니다. 성장이 멈추는 날 주가는 빠르게 무너집니다." — 린치는 고성장주를 PEG 1.0 이하에서만 보유하길 권고했습니다.`
    } else if (peg > 1.2 && peg > 0) {
      status    = 'caution'
      headline  = `PEG ${peg.toFixed(2)} — 밸류에이션 부담 시작`
      triggers.push(`PEG ${peg.toFixed(2)} > 1.2 (경계 구간 진입)`)
      lynchAdvice = `"좋은 회사도 비쌀 수 있습니다. PEG 1.2 이상은 시장이 성장을 과도하게 선반영하기 시작한 신호입니다. 신규 매수를 중단하고 분할 익절을 검토하세요."`
    } else if (growthRate > 0 && growthRate < 15) {
      status    = 'caution'
      headline  = `성장률 ${growthRate.toFixed(1)}% — 고성장 유지 의문`
      triggers.push(`이익성장률 ${growthRate.toFixed(1)}% < 15% (고성장주 기준 하회)`)
      lynchAdvice = `"고성장주의 성장이 둔화되기 시작하면 주가는 멀티플 압축으로 더 빠르게 떨어집니다. 스토리가 여전히 살아있는지 재확인이 필요합니다."`
    } else if (peg > 0 && peg <= 1.0) {
      headline   = `PEG ${peg.toFixed(2)} — 저평가 고성장 유지`
      lynchAdvice = `"10루타를 치려면 인내가 필요합니다. PEG 1.0 이하의 고성장주는 린치가 가장 사랑하는 구간입니다. 스토리가 변하기 전까지 보유를 유지하세요."`
    } else {
      lynchAdvice = `"고성장주는 스토리가 살아있는 한 보유하세요. PEG와 분기별 성장률을 지속 모니터링하세요."`
    }
  }

  // ╔═══════════════════════════════════════════════════╗
  // ║  2. 대형우량주 — PER 과부담 + 수익률 과도       ║
  // ╚═══════════════════════════════════════════════════╝
  else if (lynchType === '대형우량주') {
    const stalwartAvgPer = 22  // 대형우량주 역사적 평균 PER 기준
    const perPremium = per > 0 ? ((per - stalwartAvgPer) / stalwartAvgPer * 100) : 0

    if (per > stalwartAvgPer * 1.3) {
      status    = 'danger'
      headline  = `PER ${per.toFixed(1)}배 — 역사적 평균 대비 ${perPremium.toFixed(0)}% 프리미엄`
      triggers.push(`PER ${per.toFixed(1)} > 기준 PER의 130% (${(stalwartAvgPer * 1.3).toFixed(0)}배)`)
      if (returnPct !== undefined && returnPct > 50) {
        triggers.push(`수익률 +${returnPct}% — 이익선 대비 과도한 오버슈팅`)
      }
      lynchAdvice = `"대형우량주가 가치 대비 비싸졌습니다. 리밸런싱을 통해 현금을 확보하거나 더 저렴한 고성장주로 교체할 타이밍입니다. 30% 이상 오른 우량주는 매도의 영역입니다."`
    } else if (per > stalwartAvgPer * 1.15 || (returnPct !== undefined && returnPct > 50)) {
      status    = 'caution'
      headline  = per > stalwartAvgPer * 1.15
        ? `PER ${per.toFixed(1)}배 — 벨류에이션 경계 진입`
        : `+${returnPct}% 수익 — 부분 익절 검토 구간`
      if (per > stalwartAvgPer * 1.15) triggers.push(`PER ${per.toFixed(1)} > 평균 대비 15% 고평가`)
      if (returnPct !== undefined && returnPct > 50) triggers.push(`단기 수익률 +${returnPct}% 과열`)
      lynchAdvice = `"대형우량주에서 50% 수익을 봤다면 비중의 20~30%를 줄이는 것이 린치의 방식입니다. 전부 팔지 말고 조금씩 팔아 다음 기회를 노리세요."`
    } else {
      lynchAdvice = `"우량주는 시간이 편이입니다. 적정 PER 구간에서는 배당을 받으며 보유하는 것이 최선입니다. 매도할 이유가 없습니다."`
    }
  }

  // ╔═══════════════════════════════════════════════════╗
  // ║  3. 경기순환주 — 사이클 타이밍 경고             ║
  // ╚═══════════════════════════════════════════════════╝
  else if (lynchType === '경기순환주') {
    // 사이클주 역설: 낮은 PER이 오히려 고점 신호
    if (per > 0 && per < 8) {
      status    = 'danger'
      headline  = `PER ${per.toFixed(1)}배 — 사이클 고점 착시 경고`
      triggers.push(`사이클주 PER ${per.toFixed(1)} < 8 (역설적 고점 신호)`)
      lynchAdvice = `"사이클주에서 PER이 낮아 보일 때가 오히려 팔아야 할 때입니다. 업황 최고점에서 EPS가 극대화되어 PER이 낮아 보이는 착시입니다. 재고가 쌓이기 시작하면 이미 늦습니다."`
    } else if (per > 0 && per < 12) {
      status    = 'caution'
      headline  = `PER ${per.toFixed(1)}배 — 사이클 위치 점검 필요`
      triggers.push(`사이클주 PER ${per.toFixed(1)} 구간 — 고점 여부 판단 필요`)
      lynchAdvice = `"경기순환주는 공급·수요 지표를 주시해야 합니다. 재고 증가율이 매출 증가율을 앞지르기 시작하면 업황 하강의 신호입니다. PER 하락이 좋은 신호가 아닐 수 있습니다."`
    } else if (per > 20) {
      status    = 'caution'
      headline  = `PER ${per.toFixed(1)}배 — 사이클 저점 근접 가능`
      triggers.push(`사이클주 PER ${per.toFixed(1)} > 20 (업황 저점 근접 신호)`)
      lynchAdvice = `"사이클주에서 PER이 높아 보일 때는 오히려 업황이 바닥에 가까워진 신호일 수 있습니다. 업황 회복 조짐을 확인하며 포지션을 점검하세요."`
    } else {
      lynchAdvice = `"경기순환주는 업황 방향성이 핵심입니다. 업황이 상승 중이고 재고가 감소하는 한 보유를 유지하되, 사이클 고점 신호에 항상 주의하세요."`
    }
  }

  // ╔═══════════════════════════════════════════════════╗
  // ║  4. 저성장주 — 배당 신뢰성 & PER 과부담         ║
  // ╚═══════════════════════════════════════════════════╝
  else if (lynchType === '저성장주') {
    if (per > 25) {
      status    = 'danger'
      headline  = `PER ${per.toFixed(1)}배 — 저성장주치고 과도한 프리미엄`
      triggers.push(`저성장주 PER ${per.toFixed(1)} > 25 (성장 대비 과부담)`)
      lynchAdvice = `"저성장주에서 기대할 것은 배당뿐입니다. PER 25 이상은 배당 수익률로 정당화할 수 없는 가격입니다. 더 매력적인 배당주로 교체를 검토하세요."`
    } else if (per > 18) {
      status    = 'caution'
      headline  = `PER ${per.toFixed(1)}배 — 배당 매력 약화 구간`
      triggers.push(`저성장주 PER ${per.toFixed(1)} > 18 (배당 수익률 희석)`)
      lynchAdvice = `"저성장주의 투자 매력은 배당수익률입니다. 주가가 오르면 배당수익률이 희석됩니다. 배당 외 다른 성장 동력이 없다면 비중 축소를 고려하세요."`
    } else if (growthRate < 0) {
      status    = 'caution'
      headline  = `이익 역성장 — 배당 지속 가능성 검토`
      triggers.push('이익성장률 음수 — 배당 삭감 위험 모니터링 필요')
      lynchAdvice = `"이익이 줄어드는데도 배당을 유지하는 기업은 결국 배당을 삭감합니다. 배당성향과 현금흐름을 확인하세요."`
    } else {
      lynchAdvice = `"저성장주는 안정적인 배당이 전부입니다. 적정 PER 구간에서 꾸준히 배당을 수령하는 것이 린치의 저성장주 전략입니다."`
    }
  }

  // ╔═══════════════════════════════════════════════════╗
  // ║  5. 자산주 — 자산 가치 대비 주가 도달 여부       ║
  // ╚═══════════════════════════════════════════════════╝
  else if (lynchType === '자산주') {
    if (returnPct !== undefined && returnPct > 80) {
      status    = 'danger'
      headline  = `+${returnPct}% 수익 — 자산 가치 도달 검토`
      triggers.push(`수익률 +${returnPct}% — 숨겨진 자산이 시장에 노출된 수준`)
      lynchAdvice = `"자산주는 숨겨진 가치가 시장에 알려질 때 팔아야 합니다. +80% 이상 올랐다면 자산 가치가 주가에 상당 부분 반영된 것입니다. 목표 가치에 도달했는지 재검토하세요."`
    } else if (per > 30) {
      status    = 'danger'
      headline  = `PER ${per.toFixed(1)}배 — 자산주 적정가 초과`
      triggers.push(`자산주 PER ${per.toFixed(1)} > 30 (순자산 대비 과도한 프리미엄)`)
      lynchAdvice = `"자산주가 PER 30을 넘었다면 이미 시장이 자산을 충분히 인식한 것입니다. 숨겨진 가치가 더 이상 숨겨지지 않았을 때가 매도 타이밍입니다."`
    } else if (per > 20) {
      status    = 'caution'
      headline  = `PER ${per.toFixed(1)}배 — 자산 프리미엄 형성 중`
      triggers.push(`자산주 PER ${per.toFixed(1)} > 20 (자산 가치 반영 시작)`)
      lynchAdvice = `"주가가 순자산 가치에 가까워지고 있습니다. 아직 충분히 반영되지 않은 자산이 남아있는지 확인하고 부분 익절을 검토하세요."`
    } else {
      lynchAdvice = `"자산주는 시장이 그 가치를 발견할 때까지 기다리는 게 전략입니다. 아직 자산 가치가 충분히 반영되지 않은 상태로 보입니다."`
    }
  }

  // ╔═══════════════════════════════════════════════════╗
  // ║  6. 턴어라운드주 — 회생 실패 또는 회생 완성     ║
  // ╚═══════════════════════════════════════════════════╝
  else if (lynchType === '턴어라운드주') {
    if (per < 0 || growthRate < 0) {
      status    = 'danger'
      headline  = '회생 스토리 흔들림 — 재검토 긴급'
      triggers.push(per < 0 ? 'PER 음수 (여전히 적자 또는 EPS 전환 미완)' : `이익성장률 ${growthRate.toFixed(1)}% (역성장 — 회생 지연)`)
      lynchAdvice = `"턴어라운드 투자의 핵심 전제가 흔들리고 있습니다. 흑자 전환이 지연되거나 역전되면 과감히 손절하는 것이 린치의 원칙입니다. 희망에 투자하지 마세요."`
    } else if (peg > 2.0 && peg > 0) {
      status    = 'caution'
      headline  = `PEG ${peg.toFixed(2)} — 회생 기대가 이미 선반영`
      triggers.push(`PEG ${peg.toFixed(2)} > 2.0 (회생 스토리 과도 반영)`)
      lynchAdvice = `"회생주의 흑자 전환이 시장에 이미 반영되었습니다. PEG 2.0 이상은 회생 이후의 성장까지 선반영한 것으로, 더 이상 '싼 회생주'가 아닙니다."`
    } else if (growthRate > 20 && per > 0 && per < 20) {
      lynchAdvice = `"회생이 순탄하게 진행 중입니다. 흑자 전환 + 이익 가속화 구간은 린치가 '두 번째 기회'라고 부른 최고의 보유 시점입니다. 스토리가 완성될 때까지 인내하세요."`
    } else {
      lynchAdvice = `"턴어라운드주는 분기별 실적 발표가 모든 것입니다. 흑자 전환 추세가 지속되는지 매 실적 발표 때 검증하세요."`
    }
  }

  // 수익률 50% 이상은 유형 무관 caution 추가 (현재 safe인 경우)
  if (status === 'safe' && returnPct !== undefined && returnPct > 50) {
    status   = 'caution'
    headline = `+${returnPct}% 수익 — 부분 익절 검토`
    triggers.push(`매입 대비 수익률 +${returnPct}% 돌파`)
    if (!lynchAdvice) {
      lynchAdvice = `"50% 이상 올랐다면 기쁜 일이지만 린치는 항상 '왜 이 주식을 보유하는가'를 재검토하라고 했습니다. 스토리가 변하지 않았다면 보유, 변했다면 매도."`
    }
  }

  // safe 상태에서 default 메시지 없는 경우
  if (!lynchAdvice) {
    lynchAdvice = `"현재 모든 지표가 안정 범위에 있습니다. 린치는 '좋은 주식을 너무 일찍 팔지 말라'고 경고했습니다. 스토리를 지속 확인하며 보유를 유지하세요."`
  }

  // ── 게이지 포인터 위치 계산 (0~100) ─────────────────────────
  let gaugePos  = 50
  let gaugeText = ''

  if (lynchType === '고성장주' && peg > 0) {
    // PEG 0→안전, 1.0→중간, 1.5→위험, 2.0+→최대
    gaugePos  = Math.min(95, Math.max(3, (peg / 2.0) * 100))
    gaugeText = `현재 PEG ${peg.toFixed(2)} · 임계치: 안전 <1.0 / 경계 1.0~1.5 / 과열 >1.5`
    if (peg > 1.5) gaugeText = `현재 PEG ${peg.toFixed(2)} (임계치 1.5 초과 과열 — 린치 매도 구간)`
    else if (peg > 1.0) gaugeText = `현재 PEG ${peg.toFixed(2)} (PEG 1.0 돌파 — 멀티플 부담 시작)`
    else gaugeText = `현재 PEG ${peg.toFixed(2)} (PEG 1.0 이하 — 린치 선호 구간)`

  } else if (lynchType === '대형우량주' && per > 0) {
    // 기준 PER 22배 대비 비율: 50%→좌측, 100%→중간, 130%+→우측
    const stalwartBase = 22
    const ratio = per / stalwartBase
    gaugePos = Math.min(95, Math.max(3, ((ratio - 0.5) / 1.1) * 100))
    const overshoot = ((ratio - 1) * 100).toFixed(0)
    gaugeText = ratio > 1
      ? `PER ${per.toFixed(1)}배 (역사적 평균 22배 대비 +${overshoot}% 오버슈팅)`
      : `PER ${per.toFixed(1)}배 (역사적 평균 22배 대비 ${overshoot}% 할인)`

  } else if (lynchType === '경기순환주' && per > 0) {
    // 사이클주 역설: PER 낮을수록 고점(위험) — 역방향 매핑
    if      (per < 8)  gaugePos = 88
    else if (per < 12) gaugePos = 68
    else if (per < 16) gaugePos = 48
    else if (per < 22) gaugePos = 30
    else               gaugePos = 15
    gaugeText = `현재 PER ${per.toFixed(1)}배 · 사이클주: PER 낮을수록 고점 신호 (역설적 위험 구간)`

  } else if (lynchType === '저성장주' && per > 0) {
    // PER 10→안전, 18→경계, 25+→위험
    gaugePos  = Math.min(95, Math.max(3, ((per - 10) / 18) * 100))
    gaugeText = `현재 PER ${per.toFixed(1)}배 · 저성장주 배당 기준 적정 구간: 15~18배`

  } else if (lynchType === '자산주') {
    if (returnPct !== undefined && returnPct > 0) {
      gaugePos  = Math.min(95, Math.max(3, (returnPct / 110) * 100))
      gaugeText = `매입 대비 수익 +${returnPct}% · 숨겨진 자산의 시장 반영도 추정`
    } else {
      gaugePos  = status === 'danger' ? 85 : status === 'caution' ? 55 : 22
      gaugeText = per > 0
        ? `현재 PER ${per.toFixed(1)}배 · 순자산 대비 프리미엄 측정`
        : '자산가치 비교 데이터 수집 중'
    }

  } else if (lynchType === '턴어라운드주') {
    if (per <= 0 || growthRate < 0) {
      gaugePos = 88
      gaugeText = growthRate < 0
        ? `이익성장률 ${growthRate.toFixed(1)}% (역성장 — 회생 지연)`
        : 'EPS 여전히 적자 상태 — 회생 전제 흔들림'
    } else if (peg > 0) {
      gaugePos  = Math.min(90, Math.max(5, (peg / 2.5) * 100))
      gaugeText = `PEG ${peg.toFixed(2)} / 성장률 ${growthRate.toFixed(1)}% · 회생 선반영 정도`
    } else {
      gaugePos  = status === 'danger' ? 85 : status === 'caution' ? 55 : 22
      gaugeText = `성장률 ${growthRate.toFixed(1)}% · 흑자전환 모멘텀 모니터링`
    }

  } else {
    // 기타 — 상태 등급에 따른 고정 비율
    gaugePos  = status === 'danger' ? 85 : status === 'caution' ? 55 : 22
    gaugeText = per > 0
      ? `PER ${per.toFixed(1)}배 / 성장률 ${growthRate > 0 ? growthRate.toFixed(1) + '%' : '미확인'} · 종합 리스크 포지션`
      : '재무 데이터 수집 중 — 다음 새로고침에 반영'
  }

  return {
    name, ticker, currency,
    lynchType,
    catIcon: cat?.icon ?? '📊',
    status,
    headline,
    lynchAdvice,
    triggers,
    metrics: baseMetrics,
    returnPct,
    gaugePos,
    gaugeText,
  }
}

// ────────────────────────────────────────────────────────────
// 상태 아이콘 컴포넌트
// ────────────────────────────────────────────────────────────
function StatusIcon({ status, size = 16 }: { status: SignalStatus; size?: number }) {
  if (status === 'danger')       return <AlertTriangle size={size} color={C.red}    />
  if (status === 'caution')      return <ShieldAlert   size={size} color={C.yellow} />
  if (status === 'safe')         return <CheckCircle2  size={size} color={C.green}  />
  return                                <Info          size={size} color={C.textLow} />
}

// ────────────────────────────────────────────────────────────
// 시각적 게이지 바 컴포넌트 (Value Slider)
// 안전(초록) ─── 유의(노랑) ─── 위험(빨강) 그라디언트 트랙 + 핀 마커
// ────────────────────────────────────────────────────────────
function ValueGaugeBar({ signal }: { signal: StockSignal }) {
  const pos = Math.max(2, Math.min(98, signal.gaugePos))   // 2~98% clamp
  const noData = signal.status === 'unclassified' || signal.gaugePos === 50 && !signal.gaugeText

  // 포인터 색상 — 위치에 따라 부드럽게 결정
  const pinColor =
    pos < 30 ? 'rgba(74,222,128,0.95)'  :   // 초록 (안전)
    pos < 55 ? 'rgba(251,191,36,0.95)'  :   // 노랑 (유의)
               'rgba(248,113,113,0.95)'      // 빨강 (위험)

  const pinGlow =
    pos < 30 ? '0 0 8px rgba(74,222,128,0.6)'  :
    pos < 55 ? '0 0 8px rgba(251,191,36,0.6)'  :
               '0 0 8px rgba(248,113,113,0.6)'

  return (
    <div style={{ flex: 1, padding: '0 10px', minWidth: 160 }}>

      {/* ── 구간 라벨 ── */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:9, color:'rgba(74,222,128,0.55)', fontWeight:700, letterSpacing:'0.03em' }}>안전 ←</span>
        <span style={{ fontSize:9, color:'rgba(251,191,36,0.55)',  fontWeight:700 }}>유의</span>
        <span style={{ fontSize:9, color:'rgba(248,113,113,0.55)', fontWeight:700, letterSpacing:'0.03em' }}>→ 위험</span>
      </div>

      {/* ── 트랙 + 포인터 래퍼 ── */}
      <div style={{ position:'relative', height:26 }}>

        {noData ? (
          // 데이터 없음 — 비활성 트랙
          <div style={{
            position:'absolute', top:9, left:0, right:0, height:8, borderRadius:4,
            background:'rgba(100,116,139,0.18)', border:'1px solid rgba(100,116,139,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <span style={{ fontSize:9, color:C.textLow }}>데이터 없음</span>
          </div>
        ) : (
          <>
            {/* 삼각형 포인터 (트랙 위) */}
            <div style={{
              position: 'absolute',
              left: `clamp(3px, calc(${pos}% - 5px), calc(100% - 13px))`,
              top: 0,
              width: 0, height: 0,
              borderLeft:  '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop:   `7px solid ${pinColor}`,
              filter: `drop-shadow(0 0 3px ${pinColor.replace('0.95', '0.7')})`,
              transition: 'left 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)',
              zIndex: 2,
            }} />

            {/* 그라디언트 트랙 */}
            <div style={{
              position: 'absolute',
              top: 9, left: 0, right: 0, height: 8,
              borderRadius: 4,
              background:
                'linear-gradient(to right, ' +
                'rgba(34,197,94,0.50) 0%, ' +
                'rgba(34,197,94,0.28) 25%, ' +
                'rgba(245,158,11,0.45) 47%, ' +
                'rgba(239,68,68,0.30) 70%, ' +
                'rgba(239,68,68,0.55) 100%)',
              overflow: 'hidden',
            }}>
              {/* 구간 경계선 (30%, 65%) */}
              {[30, 65].map(p => (
                <div key={p} style={{
                  position:'absolute', left:`${p}%`, top:0, width:1, height:'100%',
                  background:'rgba(255,255,255,0.07)',
                }} />
              ))}
            </div>

            {/* 트랙 위 발광 원 마커 */}
            <div style={{
              position: 'absolute',
              left: `clamp(1px, calc(${pos}% - 5px), calc(100% - 11px))`,
              top: 7, width: 10, height: 10,
              borderRadius: '50%',
              background: pinColor,
              boxShadow: pinGlow,
              border: '1.5px solid rgba(255,255,255,0.25)',
              transition: 'left 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)',
              zIndex: 3,
            }} />
          </>
        )}
      </div>

      {/* ── 서브 텍스트 ── */}
      <div style={{
        marginTop: 5, fontSize: 10, color: C.textLow,
        lineHeight: 1.35, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFeatureSettings: '"tnum"',
      }}>
        {signal.gaugeText || '—'}
      </div>

    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 개별 신호 카드
// ────────────────────────────────────────────────────────────
function SignalCard({ signal, idx }: { signal: StockSignal; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const sm  = STATUS_META[signal.status]
  const cat = CAT_META[signal.lynchType] ?? null

  return (
    <div
      key={idx}
      onClick={() => setExpanded(v => !v)}
      style={{
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: 12,
        background: C.card,
        border: `1px solid ${signal.status !== 'safe' ? sm.border : C.border}`,
        transition: 'border-color 0.2s',
        userSelect: 'none',
      }}
    >
      {/* ══ 카드 본문: 3단 Flex 레이아웃 ══════════════════════════ */}
      {/* [좌: 아이콘+종목정보] [중앙: 게이지바] [우: 상태배지+펼치기] */}
      <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>

        {/* ── 좌측: 상태 아이콘 + 종목 정보 (너비 확대: 220 → 300, 긴 종목명 잘림 방지) ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, width:300, minWidth:260 }}>
          {/* 상태 아이콘 원 */}
          <div style={{
            flexShrink:0, width:38, height:38, borderRadius:9,
            background:sm.bg, border:`1px solid ${sm.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <StatusIcon status={signal.status} size={19} />
          </div>

          {/* 종목명·태그·헤드라인 */}
          <div style={{ minWidth:0, flex:1 }}>
            {/* 티커 + 종목명 */}
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3, overflow:'hidden' }}>
              <span style={{
                fontSize:9, padding:'1px 6px', borderRadius:3,
                background:'rgba(96,165,250,0.15)', color:C.blue,
                fontFamily:'monospace', fontWeight:900, flexShrink:0,
              }}>
                {signal.ticker}
              </span>
              <span style={{ fontSize:12, fontWeight:800, color:C.textHi, whiteSpace:'nowrap' }}>
                {signal.name}
              </span>
            </div>
            {/* 린치 유형 태그 */}
            {cat && (
              <div style={{ marginBottom:3 }}>
                <span style={{
                  fontSize:9, padding:'1px 7px', borderRadius:20,
                  background:cat.bg, color:cat.color, border:`1px solid ${cat.border}`,
                  fontWeight:700,
                }}>
                  {cat.icon} {cat.label}
                </span>
              </div>
            )}
            {/* 헤드라인 */}
            <div style={{ fontSize:10, color:sm.color, fontWeight:700, lineHeight:1.3, whiteSpace:'nowrap' }}>
              {signal.headline}
            </div>
          </div>
        </div>

        {/* ── 중앙: 시각적 게이지 바 ─────────────────────────── */}
        <ValueGaugeBar signal={signal} />

        {/* ── 우측: 상태 배지 + 펼치기 ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0, width:90 }}>
          <div style={{
            fontSize:9, padding:'3px 8px', borderRadius:20, textAlign:'center',
            background:sm.bg, color:sm.color, border:`1px solid ${sm.border}`,
            fontWeight:800, whiteSpace:'nowrap', lineHeight:1.4,
          }}>
            {sm.label}
          </div>
          {/* 지표 배지 (1~2개만) */}
          {signal.metrics.slice(0,2).map((m, i) => {
            const mColor =
              m.highlight === 'red'    ? C.red    :
              m.highlight === 'yellow' ? C.yellow :
              m.highlight === 'green'  ? C.green  : C.textLow
            return (
              <div key={i} style={{
                fontSize:9, padding:'2px 7px', borderRadius:5, textAlign:'right',
                background:C.surface, border:`1px solid ${C.border}`,
                display:'flex', gap:3, alignItems:'center',
              }}>
                <span style={{ color:C.textLow }}>{m.label}</span>
                <span style={{ color:mColor, fontWeight:700, fontFamily:'monospace' }}>{m.value}</span>
              </div>
            )
          })}
          <ChevronRight
            size={13}
            color={C.textLow}
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}
          />
        </div>

      </div>

      {/* ── 확장 패널 ── */}
      {expanded && (
        <div style={{
          marginTop:14,
          paddingTop:14,
          borderTop:`1px solid ${C.border}`,
        }}>
          {/* 트리거 조건 */}
          {signal.triggers.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.textLow, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                <AlertTriangle size={10} /> 트리거된 조건
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {signal.triggers.map((t, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:9, marginTop:2, flexShrink:0, color:sm.color }}>▶</span>
                    <span style={{ fontSize:11, color:C.textMid, lineHeight:1.6 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 린치의 한마디 */}
          <div style={{
            padding:'12px 14px', borderRadius:9,
            background:C.surface, border:`1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:10, color:C.yellow, fontWeight:800, marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
              <Zap size={10} /> 피터 린치의 한마디
            </div>
            <div style={{ fontSize:11, color:C.textMid, lineHeight:1.8, fontStyle:'italic' }}>
              {signal.lynchAdvice}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 비주식 자산 플레이스홀더 카드 (매도 시그널 패널용)
// ────────────────────────────────────────────────────────────
function NonEquitySignalCard({ raw }: { raw: AnyRecord }) {
  const ticker = raw.ticker || raw.code || ''
  const name   = raw.name   || raw.stockName || '미확인 종목'
  const market = raw.market || 'US'
  // SSOT: 컴포넌트 내 직접 파싱 금지 — getAssetClassification 사용
  const clf    = getAssetClassification(ticker, name, market)

  const typeColor  =
    clf.assetType === 'CRYPTO'    ? '#c084fc' :
    clf.assetType === 'COMMODITY' ? '#fbbf24' : '#60a5fa'
  const typeBg     =
    clf.assetType === 'CRYPTO'    ? 'rgba(192,132,252,0.08)' :
    clf.assetType === 'COMMODITY' ? 'rgba(251,191,36,0.08)'  : 'rgba(59,130,246,0.08)'
  const typeBorder =
    clf.assetType === 'CRYPTO'    ? 'rgba(192,132,252,0.22)' :
    clf.assetType === 'COMMODITY' ? 'rgba(251,191,36,0.22)'  : 'rgba(59,130,246,0.22)'

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, opacity: 0.72,
      background: `linear-gradient(135deg, #1e293b, ${typeBg})`,
      border: `1px dashed ${typeBorder}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* 아이콘 */}
      <div style={{
        flexShrink: 0, width: 40, height: 40, borderRadius: 9,
        background: typeBg, border: `1px dashed ${typeBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {clf.badgeIcon}
      </div>

      {/* 종목 정보 */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
            fontFamily: 'monospace', fontWeight: 900,
          }}>{ticker}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{name}</span>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 20,
            background: typeBg, color: typeColor, border: `1px solid ${typeBorder}`,
            fontWeight: 800,
          }}>{clf.badgeIcon} {clf.badgeLabel}</span>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.65 }}>
          {clf.lynchGuidance}
        </div>
      </div>

      {/* 분석 불가 배지 */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: 9, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap',
          background: 'rgba(100,116,139,0.12)', color: '#7f93a8',
          border: '1px dashed rgba(100,116,139,0.3)', fontWeight: 700,
        }}>
          🚫 시그널 분석 제외
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 빈 상태 컴포넌트
// ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:14, padding:'52px 24px',
      background:C.card, border:`1px dashed ${C.border}`, borderRadius:14,
      textAlign:'center',
    }}>
      <div style={{
        width:56, height:56, borderRadius:'50%',
        background:'rgba(74,222,128,0.12)', border:'2px solid rgba(74,222,128,0.3)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <CheckCircle2 size={28} color={C.green} />
      </div>
      <div style={{ fontSize:15, fontWeight:800, color:C.textHi }}>
        현재 매도 시그널이 감지된 종목이 없습니다.
      </div>
      <div style={{ fontSize:12, color:C.textLow, lineHeight:1.9, maxWidth:380 }}>
        포트폴리오가 건강한 상태입니다.{' '}
        피터 린치는 <strong style={{ color:C.textMid }}>&quot;좋은 주식을 너무 일찍 팔지 마라&quot;</strong>고 했습니다.
        <br />
        모든 종목의 스토리가 유효한 동안은 보유를 유지하세요.
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LynchSellSignalPanel(props: any) {

  // Props 탐색
  const rawPortfolio: AnyRecord[] = useMemo(() => {
    const src =
      props.portfolioStocks ??
      props.stocks          ??
      props.portfolio       ??
      props.items           ??
      props.data            ??
      []
    return Array.isArray(src) ? src : []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.portfolioStocks, props.stocks, props.portfolio, props.items, props.data])

  // ── 비주식 분리: 부모가 주입한 assetType 우선, 없으면 SSOT 폴백 ──
  // 컴포넌트 내 인라인 파싱 금지 — SSOT getAssetClassification만 허용
  const isStock = (raw: AnyRecord): boolean => {
    // 부모(dashboard)가 assetType을 주입했으면 그대로 사용
    if (raw.assetType) return (raw.assetType as AssetType) === 'STOCK'
    // 주입 안 된 경우(레거시 경로) — SSOT 폴백
    const ticker = (raw.ticker || raw.code || '').toString()
    const name   = (raw.name   || raw.stockName || '').toString()
    const market = (raw.market || 'US').toString()
    return getAssetClassification(ticker, name, market).isAnalyzable
  }

  const nonEquityItems = useMemo(
    () => rawPortfolio.filter(raw => !isStock(raw)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPortfolio],
  )

  const signals = useMemo(
    () => rawPortfolio.filter(isStock).map(computeSignal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPortfolio],
  )

  // 필터 탭 상태
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

  // 집계
  const dangerCount      = signals.filter(s => s.status === 'danger').length
  const cautionCount     = signals.filter(s => s.status === 'caution').length
  const safeCount        = signals.filter(s => s.status === 'safe').length
  const unclassifiedCount = signals.filter(s => s.status === 'unclassified').length

  // 필터링 + 정렬 (danger → caution → safe → unclassified)
  const ORDER: Record<SignalStatus, number> = { danger:0, caution:1, safe:2, unclassified:3 }
  const filtered = useMemo(() =>
    signals
      .filter(s => filterTab === 'all' ? true : s.status === filterTab)
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [signals, filterTab])

  // 포트폴리오 비어있음
  if (rawPortfolio.length === 0) {
    return (
      <div style={{ padding:'16px 0', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        <EmptyState />
      </div>
    )
  }

  return (
    <div style={{
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      display:'flex', flexDirection:'column', gap:0,
    }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{
        padding:'16px 20px 12px',
        borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{
          width:36, height:36, borderRadius:9,
          background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <TrendingDown size={18} color={C.red} />
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:900, color:C.textHi }}>
            피터 린치 매도 시그널 패널
          </div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            유형별 보유 원칙 기반 실시간 경고등 · 카드를 클릭하면 상세 분석이 펼쳐집니다
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── 요약 바 ──────────────────────────────────────── */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10,
        }}>
          {[
            { label:'위험 종목',   count:dangerCount,       color:C.red,    bg:'rgba(239,68,68,0.10)',   border:'rgba(239,68,68,0.25)',   icon:<AlertTriangle size={16} color={C.red}    /> },
            { label:'유의 종목',   count:cautionCount,      color:C.yellow, bg:'rgba(245,158,11,0.10)',  border:'rgba(245,158,11,0.25)',  icon:<ShieldAlert   size={16} color={C.yellow} /> },
            { label:'안정 종목',   count:safeCount,         color:C.green,  bg:'rgba(34,197,94,0.10)',   border:'rgba(34,197,94,0.25)',   icon:<CheckCircle2  size={16} color={C.green}  /> },
            { label:'데이터 부족', count:unclassifiedCount, color:C.textLow,bg:'rgba(100,116,139,0.08)', border:'rgba(100,116,139,0.2)',   icon:<Info          size={16} color={C.textLow}/> },
          ].map(item => (
            <div key={item.label} style={{
              padding:'12px 14px', borderRadius:10, textAlign:'center',
              background:item.bg, border:`1px solid ${item.border}`,
            }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>{item.icon}</div>
              <div style={{ fontSize:24, fontWeight:900, color:item.color, fontFamily:'monospace' }}>
                {item.count}
              </div>
              <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── 위험/유의 종목 핵심 배너 ─────────────────────── */}
        {(dangerCount > 0 || cautionCount > 0) && (
          <div style={{
            padding:'12px 16px', borderRadius:10,
            background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.25)',
            display:'flex', gap:10, alignItems:'center',
          }}>
            <AlertTriangle size={16} color={C.red} style={{ flexShrink:0 }} />
            <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
              {dangerCount > 0 && (
                <span style={{ color:C.red, fontWeight:700 }}>⚠️ {dangerCount}개 종목에서 매도 시그널</span>
              )}
              {dangerCount > 0 && cautionCount > 0 && ' / '}
              {cautionCount > 0 && (
                <span style={{ color:C.yellow, fontWeight:700 }}>🔔 {cautionCount}개 종목 유의 경보</span>
              )}
              {' '}가 감지되었습니다. 각 카드를 클릭해 피터 린치의 상세 진단을 확인하세요.
            </div>
          </div>
        )}

        {/* ── 필터 탭 ─────────────────────────────────────── */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <SlidersHorizontal size={14} color={C.textLow} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {([
              { key:'all',          label:`전체 (${signals.length})`,      color:C.textMid },
              { key:'danger',       label:`경고 (${dangerCount})`,         color:C.red     },
              { key:'caution',      label:`유의 (${cautionCount})`,        color:C.yellow  },
              { key:'safe',         label:`안정 (${safeCount})`,           color:C.green   },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                style={{
                  padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700,
                  cursor:'pointer', border:'none',
                  background: filterTab === tab.key ? `${tab.color}22` : C.card,
                  color:      filterTab === tab.key ? tab.color : C.textLow,
                  outline: filterTab === tab.key ? `1px solid ${tab.color}60` : '1px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 신호 카드 피드 ───────────────────────────────── */}
        {filtered.length === 0 ? (
          filterTab === 'all'
            ? <EmptyState />
            : (
              <div style={{
                padding:'32px 24px', textAlign:'center',
                background:C.card, border:`1px dashed ${C.border}`, borderRadius:12,
                color:C.textLow, fontSize:12,
              }}>
                <Inbox size={28} style={{ margin:'0 auto 12px', opacity:0.4 }} />
                <div>해당 상태의 종목이 없습니다.</div>
              </div>
            )
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map((sig, i) => (
              <SignalCard key={`${sig.ticker}-${i}`} signal={sig} idx={i} />
            ))}
          </div>
        )}

        {/* ── 린치 분석 제외 자산 (ETF·CRYPTO·COMMODITY) ──────── */}
        {nonEquityItems.length > 0 && (
          <div>
            <div style={{
              display:'flex', alignItems:'center', gap:8, marginBottom:8,
              paddingBottom:8, borderBottom:`1px solid ${C.border}`,
            }}>
              <span style={{ fontSize:11, color:C.textLow, fontWeight:700 }}>
                🚫 린치 시그널 분석 제외 자산 ({nonEquityItems.length}개)
              </span>
              <span style={{ fontSize:10, color:C.textLow }}>
                — ETF·암호화폐·원자재는 발행 기업이 없어 매도 시그널 계산 불가
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {nonEquityItems.map((raw, i) => (
                <NonEquitySignalCard key={(raw.ticker || i).toString()} raw={raw} />
              ))}
            </div>
          </div>
        )}

        {/* ── 면책 안내 ────────────────────────────────────── */}
        <div style={{
          padding:'10px 14px', borderRadius:9,
          background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)',
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <Info size={13} color={C.yellow} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:10, color:C.textLow, lineHeight:1.7 }}>
            <strong style={{ color:C.yellow }}>투자 교육 목적 시그널</strong>{' '}·
            본 패널은 피터 린치의 투자 원칙을 기반으로 한 교육용 분석 도구입니다.
            실제 투자 의사결정은 반드시 개인의 판단과 책임 하에 이루어져야 합니다.
            PEG·PER 데이터는 외부 API 기준으로 지연·오류가 발생할 수 있습니다.
          </div>
        </div>

      </div>
    </div>
  )
}
