'use client'

/**
 * MacroDashboard v2 — 거시경제(Fed Watch) 오케스트레이터
 *
 * ◆ 아키텍처
 *  - 데이터 페칭: MacroDashboard가 일괄 담당 (lift state up)
 *  - 자식 컴포넌트(InflationChart, BalanceSheetChart)는 props 수신 후 렌더링만
 *  - 포지션 가이드: 실제 FRED 데이터 기반 조건부 렌더링
 *
 * ◆ 포지션 판단 로직
 *  1. 공격 포지션: EFFR vs Core PCE 스프레드
 *  2. 방어 포지션: QT 진행 여부 (WALCL 최근 추세)
 *  3. 사이클 모니터: SEP 금리 중간값 경로 방향
 */

import { useState, useEffect } from 'react'
import {
  fetchInflationAndRate,
  fetchBalanceSheet,
  type InflationPoint,
  type BalanceSheetPoint,
} from '@/lib/fredApi'
import {
  INFLATION_DATA  as MOCK_INFLATION,
  BALANCE_SHEET_DATA as MOCK_BS,
  LATEST_SEP,
} from './macro/macroData'

import InflationChart                               from './macro/InflationChart'
import DotPlotPanel                                 from './macro/DotPlotPanel'
import BalanceSheetChart, { isQtOngoing }           from './macro/BalanceSheetChart'

// ── FOMC 다음 일정 (수동 갱신)
const NEXT_FOMC = { date: '집계 중…', dDay: 0 }   // 로딩 폴백 — 실제 값은 /api/macro-regime(FedWatch 일정)에서

// ── 통화정책 스탠스 계산 (인플레이션 데이터 기반)
function getPolicyStance(data: InflationPoint[]): {
  label: string; desc: string; color: string; bg: string; border: string
} {
  const latest = data[data.length - 1]
  if (!latest) return { label: '로딩 중', desc: '—', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' }
  const spread = latest.fedRate - latest.corePCE
  if (spread > 1.0) return {
    label: 'RESTRICTIVE', desc: '제약적 통화정책',
    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)',
  }
  if (spread > 0) return {
    label: 'MILDLY TIGHT', desc: '완만한 긴축',
    color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)',
  }
  return {
    label: 'NEUTRAL / EASY', desc: '중립 또는 완화',
    color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)',
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 포지션 가이드 카드 판단 로직
// ────────────────────────────────────────────────────────────────────────────
interface GuideCard {
  icon:    string
  title:   string
  body:    string
  color:   string
  bg:      string
  border:  string
}

function buildGuideCards(
  inflData: InflationPoint[],
  bsData:   BalanceSheetPoint[],
  rateDir?: 'cut' | 'hold' | 'hike',   // 매크로 SSOT(/api/macro-regime) — FedWatch 방향
): GuideCard[] {
  const latest = inflData[inflData.length - 1]
  const effr   = latest?.fedRate   ?? 0
  const core   = latest?.corePCE   ?? 0
  const qtActive = isQtOngoing(bsData)

  // SEP 점도표(연준 장기 전망) — 참고용. '현재 금리 방향'은 FedWatch SSOT(rateDir)가 결정
  const rateMedians = LATEST_SEP.dotPlot
    .filter(d => d.year !== 'Longer-run')
    .map(d => d.median)

  // ── 카드 1: 공격 포지션 — 실질금리(스프레드) × 금리방향(SSOT) 결합 ──
  //    '완화 중 → 적극 공격'은 실제 인하(rateDir==='cut')일 때만. 동결/인상이면 선별적(모순 방지)
  const spread = effr - core
  const isRestrictive = spread > 0.5
  const card1: GuideCard = isRestrictive
    ? {
        icon:   '🔴',
        title:  '공격 포지션 주의',
        body:   `기준금리(${effr.toFixed(2)}%)가 Core PCE(${core.toFixed(2)}%)를 +${spread.toFixed(2)}%p 상회하는 제약적 환경입니다. ` +
                '고밸류에이션 성장주 비중을 조절하고 리스크 관리에 집중하세요.',
        color:  '#f87171',
        bg:     'rgba(248,113,113,0.07)',
        border: 'rgba(248,113,113,0.25)',
      }
    : rateDir === 'cut'
    ? {
        icon:   '🟢',
        title:  '공격 포지션 유효',
        body:   `실질금리 스프레드 축소(${effr.toFixed(2)}% vs ${core.toFixed(2)}%) + 금리 인하 진행 — 제약적 통화정책이 실제로 완화되는 구간입니다. ` +
                '우량 성장주 중심의 적극적인 포트폴리오 운용이 유리합니다.',
        color:  '#4ade80',
        bg:     'rgba(74,222,128,0.07)',
        border: 'rgba(74,222,128,0.25)',
      }
    : {
        icon:   '🟡',
        title:  '선별적 접근 (중립)',
        body:   `실질금리 스프레드(${effr.toFixed(2)}% vs ${core.toFixed(2)}%, +${spread.toFixed(2)}%p)는 제약 강도가 완화됐으나, 금리는 당분간 ` +
                `${rateDir === 'hike' ? '동결~소폭 인상' : '동결'} 기조입니다. 적극적 공격보다 우량주 선별 접근이 유리한 구간입니다.`,
        color:  '#fbbf24',
        bg:     'rgba(251,191,36,0.07)',
        border: 'rgba(251,191,36,0.25)',
      }

  // ── 카드 2: 방어 포지션 ──────────────────────────────────
  const card2: GuideCard = qtActive
    ? {
        icon:   '🟡',
        title:  '방어 포지션 유지',
        body:   '양적긴축(QT)이 지속되어 시중 달러 유동성이 흡수되는 단계입니다. ' +
                '일정 수준의 현금 및 단기채 비중 유지를 권고합니다.',
        color:  '#fbbf24',
        bg:     'rgba(251,191,36,0.07)',
        border: 'rgba(251,191,36,0.25)',
      }
    : {
        icon:   '🟢',
        title:  '방어 비중 점진 축소',
        body:   'QT 속도가 둔화되는 신호가 감지됩니다. 유동성 압박이 완화되면서 ' +
                '위험자산 비중을 점진적으로 확대하는 전략이 유효합니다.',
        color:  '#4ade80',
        bg:     'rgba(74,222,128,0.07)',
        border: 'rgba(74,222,128,0.25)',
      }

  // ── 카드 3: 금리 사이클 모니터 — FedWatch SSOT(rateDir) 기준 (SEP는 참고용) ──
  const card3: GuideCard = rateDir === 'cut'
    ? {
        icon:   '🟢',
        title:  '금리 인하 사이클 가동 중',
        body:   `FF선물이 인하 경로를 반영 중입니다(SEP 점도표 ${rateMedians[0]?.toFixed(2)}%→${rateMedians[rateMedians.length - 1]?.toFixed(2)}% 우하향과 일치). ` +
                '유동성 리레이팅 수혜 핵심 주도주 분할 매수 타이밍으로 활용하세요.',
        color:  '#4ade80',
        bg:     'rgba(74,222,128,0.07)',
        border: 'rgba(74,222,128,0.25)',
      }
    : rateDir === 'hike'
    ? {
        icon:   '🔴',
        title:  '동결~소폭 인상 기대',
        body:   'FF선물이 당분간 동결 또는 소폭 인상 가능성을 반영하고 있습니다. ' +
                '추격 매수를 자제하고 이자수익 우량주·현금 비중을 유지하세요. (연준 점도표상 장기 인하 경로는 참고용)',
        color:  '#f87171',
        bg:     'rgba(248,113,113,0.07)',
        border: 'rgba(248,113,113,0.25)',
      }
    : {
        icon:   '🟡',
        title:  '금리 고점·동결 국면',
        body:   '시장(FF선물)은 당분간 금리 동결을 기대하고 있습니다. ' +
                '연준 점도표상 장기 인하 경로는 참고용이며, 단기 추격보다 이자수익 금융주·FCF 우량주 중심이 유리합니다.',
        color:  '#fbbf24',
        bg:     'rgba(251,191,36,0.07)',
        border: 'rgba(251,191,36,0.25)',
      }

  return [card1, card2, card3]
}

// 3축(실질금리·유동성·금리방향) 합산 → 한 줄 종합 스탠스 (카드들을 묶는 결론)
function buildSynthesis(
  inflData: InflationPoint[], bsData: BalanceSheetPoint[], rateDir?: 'cut' | 'hold' | 'hike',
): { label: string; body: string; color: string; bg: string; border: string } {
  const latest = inflData[inflData.length - 1]
  const spread = (latest?.fedRate ?? 0) - (latest?.corePCE ?? 0)
  const qtActive = isQtOngoing(bsData)
  // 공격(+) / 방어(-)
  const realRate = spread > 0.5 ? -1 : rateDir === 'cut' ? 1 : 0
  const liquidity = qtActive ? -1 : 1
  const direction = rateDir === 'cut' ? 1 : rateDir === 'hike' ? -1 : 0
  const net = realRate + liquidity + direction
  if (net >= 2)
    return { label: '종합: 공격 우호', body: '실질금리 완화·유동성·금리 인하가 위험자산에 우호적 — 우량 성장주 중심 적극 운용이 유리합니다.', color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)' }
  if (net <= -3)
    return { label: '종합: 방어 우선', body: '제약적 금리·유동성 흡수·금리 동결/인상이 겹치는 방어적 환경 — 현금·단기채·이자수익 우량주 비중을 높이세요.', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' }
  return { label: '종합: 중립~방어 — 우량주 선별', body: '실질금리 제약은 완화됐으나 유동성(QT)·금리 방향(동결/인상)이 아직 보수적입니다. 적극 추격보다 우량주를 선별 매수하는 구간입니다.', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)' }
}

// ────────────────────────────────────────────────────────────────────────────
export default function MacroDashboard() {
  // ── 섹션 1: 인플레이션 & 금리
  const [inflData,    setInflData]    = useState<InflationPoint[]>([])
  const [inflLoading, setInflLoading] = useState(true)
  const [inflError,   setInflError]   = useState<string | null>(null)
  const [inflMock,    setInflMock]    = useState(false)
  const [inflUpdated, setInflUpdated] = useState<string | null>(null)

  // ── 섹션 3: 대차대조표
  const [bsData,    setBsData]    = useState<BalanceSheetPoint[]>([])
  const [bsLoading, setBsLoading] = useState(true)
  const [bsError,   setBsError]   = useState<string | null>(null)
  const [bsMock,    setBsMock]    = useState(false)
  const [bsUpdated, setBsUpdated] = useState<string | null>(null)

  // 매크로 국면 SSOT (FedWatch 방향 + 다음 FOMC) — 포지션 가이드·FOMC 표기 일치용
  const [rateDir, setRateDir] = useState<'cut' | 'hold' | 'hike' | undefined>(undefined)
  const [nextFomc, setNextFomc] = useState<{ date: string; dDay: number }>(NEXT_FOMC)

  useEffect(() => {
    let cancelled = false
    const now = new Date().toLocaleString('ko-KR')

    // 매크로 국면 SSOT
    fetch('/api/macro-regime', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j?.rateDir === 'cut' || j?.rateDir === 'hold' || j?.rateDir === 'hike') setRateDir(j.rateDir)
        if (j?.nextFomc?.date) setNextFomc(j.nextFomc)
      })
      .catch(() => {})

    // 인플레이션 데이터
    fetchInflationAndRate(36)
      .then(result => {
        if (cancelled) return
        if (!result.length) throw new Error('인플레이션 데이터 없음')
        setInflData(result)
        setInflMock(false)
        setInflUpdated(now)
      })
      .catch(err => {
        if (cancelled) return
        const msg = (err as Error).message
        setInflError(msg.includes('503') ? 'FRED_API_KEY 미설정 — Mock 데이터' : `FRED 오류: ${msg}`)
        setInflData(MOCK_INFLATION)
        setInflMock(true)
      })
      .finally(() => { if (!cancelled) setInflLoading(false) })

    // 대차대조표 데이터
    fetchBalanceSheet(48)
      .then(result => {
        if (cancelled) return
        if (!result.length) throw new Error('대차대조표 데이터 없음')
        setBsData(result)
        setBsMock(false)
        setBsUpdated(now)
      })
      .catch(err => {
        if (cancelled) return
        const msg = (err as Error).message
        setBsError(msg.includes('503') ? 'FRED_API_KEY 미설정 — Mock 데이터' : `FRED 오류: ${msg}`)
        setBsData(MOCK_BS)
        setBsMock(true)
      })
      .finally(() => { if (!cancelled) setBsLoading(false) })

    return () => { cancelled = true }
  }, [])

  // ── 파생 상태 (데이터 로딩 후 계산)
  const latestInfl  = inflData[inflData.length - 1]
  const policyStance = getPolicyStance(inflData)
  const synthesis    = (!inflLoading && !bsLoading) ? buildSynthesis(inflData, bsData, rateDir) : null
  const guideCards   = (!inflLoading && !bsLoading)
    ? buildGuideCards(inflData, bsData, rateDir)
    : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* ── 컨텍스트 배너 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        padding: '14px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,35,60,0.9) 100%)',
        border: '1px solid rgba(42,45,58,1)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🏛️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9' }}>Fed Watch — 거시경제 모니터</div>
            <div style={{ fontSize: 11, color: '#8599ae', marginTop: 2 }}>연준 통화정책 · 인플레이션 · 유동성 지표 실시간 추적</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 통화정책 스탠스 (실시간) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            background: policyStance.bg, border: `1px solid ${policyStance.border}`,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: policyStance.color }} />
            <span style={{ fontSize: 11, color: policyStance.color, fontWeight: 700 }}>{policyStance.label}</span>
            <span style={{ fontSize: 10, color: '#8599ae' }}>{policyStance.desc}</span>
          </div>

          {/* 현재 기준금리 (실시간) */}
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#8599ae' }}>기준금리</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#60a5fa', fontFamily: 'monospace' }}>
              {latestInfl ? `${latestInfl.fedRate.toFixed(2)}%` : '…'}
            </span>
          </div>

          {/* Core PCE (실시간) */}
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#8599ae' }}>Core PCE</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#FFC107', fontFamily: 'monospace' }}>
              {latestInfl ? `${latestInfl.corePCE.toFixed(2)}%` : '…'}
            </span>
          </div>

          {/* 다음 FOMC */}
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#8599ae' }}>다음 FOMC</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>{nextFomc.date}</span>
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 800 }}>
              D-{nextFomc.dDay}
            </span>
          </div>

          {/* 데이터 소스 */}
          <div style={{
            padding: '5px 10px', borderRadius: 6,
            background: inflMock ? 'rgba(251,191,36,0.06)' : 'rgba(52,211,153,0.06)',
            border: `1px solid ${inflMock ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)'}`,
            fontSize: 10, color: inflMock ? '#fbbf24' : '#34d399',
          }}>
            {inflMock ? '⚠️ Mock Data' : '📡 FRED API Live'}
          </div>
        </div>
      </div>

      {/* ── Section 1: 인플레이션 & 금리 */}
      <InflationChart
        data={inflData}
        loading={inflLoading}
        error={inflError}
        isMock={inflMock}
        lastUpdated={inflUpdated}
      />

      {/* ── Section 2: CME FedWatch 실시간 버블 차트 */}
      <DotPlotPanel currentRate={latestInfl?.fedRate ?? 3.375} />

      {/* ── Section 3: 대차대조표 QT */}
      <BalanceSheetChart
        data={bsData}
        loading={bsLoading}
        error={bsError}
        isMock={bsMock}
        lastUpdated={bsUpdated}
      />

      {/* ── 매크로 환경 기반 포지션 가이드 (실시간 연동) */}
      <div style={{
        padding: '16px 20px', borderRadius: 12,
        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(42,45,58,1)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>
          💡 현재 매크로 환경 기반 포지션 가이드
          {(!inflLoading && !bsLoading && !inflMock && !bsMock) && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#34d399', fontWeight: 600 }}>
              🟢 실시간 FRED 데이터 반영
            </span>
          )}
          {(inflMock || bsMock) && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>
              ⚠️ Mock 데이터 기반 (FRED_API_KEY 설정 후 실시간 반영)
            </span>
          )}
        </div>

        {/* 로딩 중 스켈레톤 */}
        {(inflLoading || bsLoading) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 80, background: '#1e2535', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        )}

        {/* 종합 스탠스 한 줄 — 3축을 묶는 결론 */}
        {synthesis && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, background: synthesis.bg, border: `1px solid ${synthesis.border}`, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: synthesis.color, whiteSpace: 'nowrap' }}>{synthesis.label}</span>
            <span style={{ fontSize: 11.5, color: '#aab6c4', lineHeight: 1.5 }}>{synthesis.body}</span>
          </div>
        )}

        {/* 실시간 포지션 카드 */}
        {guideCards && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {guideCards.map((card, i) => (
              <div key={i} style={{
                padding: '12px 14px', borderRadius: 10,
                background: card.bg, border: `1px solid ${card.border}`,
              }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  {card.icon}{' '}
                  <span style={{ color: card.color, fontWeight: 700, fontSize: 12 }}>{card.title}</span>
                </div>
                <div style={{ fontSize: 11, color: '#7f93a8', lineHeight: 1.65 }}>{card.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
