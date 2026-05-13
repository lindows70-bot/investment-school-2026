'use client'

/**
 * /master-strategy — 발키리 전략 포트폴리오 프레젠테이션
 * 슬라이드 기반 5-Deck 구성 + PDF 관리 (선생님/학생 권한 분리)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BG       = '#020617'          // 배경 (딥 네이비)
const BG2      = '#0a1628'          // 카드 배경
const BG3      = '#0f2040'          // 카드 내부
const NEON     = '#deff9a'          // 네온 그린 포인트
// const NEON2 = '#a3e635'          // 네온 서브 (reserved)
const BLUE     = '#38bdf8'          // 블루 포인트
const GOLD     = '#fbbf24'          // 골드
const RED      = '#f87171'          // 레드
const MUTED    = '#4a5568'          // 뮤트

// ─── Static Strategy Data ─────────────────────────────────────────────────────
const CORE_SAT_DATA = [
  { name: 'Core',      value: 48, color: '#3b82f6', desc: '안정 · 지수 · 대형주' },
  { name: 'Satellite', value: 52, color: NEON,      desc: '성장 · 테마 · 알파' },
]

const FUND_DATA = [
  { name: '국내 ETF',   value: 31, color: '#38bdf8' },
  { name: '해외 ETF',   value: 28, color: NEON },
  { name: '국내 개별주', value: 24, color: '#818cf8' },
  { name: '해외 개별주', value: 11, color: GOLD },
  { name: '코인 · 대체', value:  6, color: '#fb923c' },
]

const SECTOR_DATA = [
  { label: '반도체',    pct: 32, color: '#38bdf8' },
  { label: '전략·전력', pct: 20, color: NEON },
  { label: 'AI·바이오', pct:  4, color: '#818cf8' },
  { label: 'K방산',     pct:  4, color: '#fb923c' },
  { label: '대체(BTC)', pct:  6, color: GOLD },
  { label: '현금·CMA',  pct:  5, color: MUTED },
  { label: '기타',      pct: 29, color: '#374151' },
]

const ROADMAP = [
  {
    q: 'Q1 2026', title: '포트폴리오 구축',
    items: ['Core 포지션 편입 완료', '반도체 섹터 32% 달성', 'ETF 중심 분산 구조'],
    done: true,
  },
  {
    q: 'Q2 2026', title: 'Satellite 강화',
    items: ['AI-바이오 4% 편입', 'K방산 포지션 확대', '나스닥100 15% 조정'],
    done: true,
  },
  {
    q: 'Q3 2026', title: '리밸런싱',
    items: ['섹터별 수익률 점검', '비중 이탈 ±5% 조정', '신규 테마 스크리닝'],
    done: false,
  },
  {
    q: 'Q4 2026', title: '연간 결산',
    items: ['수익률 vs 벤치마크 비교', '2027 전략 초안 수립', '세금 최적화 검토'],
    done: false,
  },
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DarkTip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0a1628', border: `1px solid ${NEON}33`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#f1f5f9' }}>
      <div style={{ color: NEON, fontWeight: 700 }}>{payload[0].name}</div>
      <div>{payload[0].value}%</div>
    </div>
  )
}

// ─── Slide Components ─────────────────────────────────────────────────────────

// ── 전략 포트폴리오 고정 수치 (학교 전략 모델 기준) ──────────────────────────
const STRATEGY_TOTAL_KRW = 100_000_000   // ₩1억 (2026 투자학교 전략 포트폴리오)
const STRATEGY_STOCK_COUNT = 18          // PDF 기준 18종목

/** Slide 1: 타이틀 */
function SlideTitle({ returnPct }: { returnPct: number }) {
  const fmtKrw = (n: number) =>
    n >= 1e8 ? `₩${(n / 1e8).toFixed(1)}억`
    : n >= 1e4 ? `₩${Math.round(n / 1e4).toLocaleString('ko-KR')}만`
    : `₩${Math.round(n).toLocaleString('ko-KR')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, textAlign: 'center', padding: '0 32px' }}>
      {/* 배지 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['2026 투자학교', 'Q2 STRATEGY', 'Get Rich Slowly'].map(t => (
          <span key={t} style={{ fontSize: 11, fontWeight: 700, color: NEON, border: `1px solid ${NEON}55`, borderRadius: 20, padding: '4px 14px', letterSpacing: '0.12em' }}>{t}</span>
        ))}
      </div>

      {/* 메인 타이틀 */}
      <div>
        <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
          🏹 VALKYRIE MASTER STRATEGY
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, color: '#f1f5f9', margin: '0 0 12px', letterSpacing: '-1px', lineHeight: 1.1 }}>
          발키리<br />
          <span style={{ color: NEON }}>포트폴리오 전략</span>
        </h1>
        <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
          Core-Satellite 자산배분 모델 · 2026 Q2
        </p>
      </div>

      {/* KPI 카드 */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: '전략 포트폴리오', value: fmtKrw(STRATEGY_TOTAL_KRW), color: NEON },
          { label: '수익률', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`, color: returnPct >= 0 ? NEON : RED },
          { label: '슬라이드', value: '5 Decks', color: BLUE },
        ].map(k => (
          <div key={k.label} style={{ background: BG3, border: `1px solid ${k.color}33`, borderRadius: 12, padding: '16px 28px', minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: MUTED }}>
        ← / → 키 또는 버튼으로 슬라이드를 이동하세요
      </div>
    </div>
  )
}

/** Slide 2: Core / Satellite 철학 */
function SlidePhilosophy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '8px 8px', height: '100%', overflow: 'auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: NEON, fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>SLIDE 2 · PHILOSOPHY</div>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
          Core-Satellite <span style={{ color: NEON }}>자산배분 철학</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
        {/* Core */}
        <div style={{ background: BG3, border: '1px solid #3b82f633', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6' }} />
            <span style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6' }}>CORE 48%</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
            안정적인 시장 수익률을 추종하며 포트폴리오의 기반을 형성합니다.
          </div>
          {['S&P500 / 나스닥100 지수 ETF', '삼성전자 · SK하이닉스 대형주', '반도체 섹터 ETF (KODEX, TIGER)', '채권·현금 헤지 5%'].map(item => (
            <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ color: '#3b82f6', marginTop: 2 }}>▸</span>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Satellite */}
        <div style={{ background: BG3, border: `1px solid ${NEON}33`, borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: NEON }} />
            <span style={{ fontSize: 18, fontWeight: 900, color: NEON }}>SATELLITE 52%</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
            초과 수익(알파)을 추구하는 테마·성장 포지션으로 구성됩니다.
          </div>
          {['AI전력 · 방산 테마 ETF', '한화에어로 · 이수페타시스 개별주', 'GEV · PLTR 미국 성장주', 'BTC 디지털 자산 대체투자'].map(item => (
            <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ color: NEON, marginTop: 2 }}>▸</span>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 원칙 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { icon: '⚖️', title: '리스크 균형', desc: 'Core로 하방을 막고\nSatellite로 알파를 추구' },
          { icon: '🔄', title: '분기 리밸런싱', desc: '비중 이탈 ±5% 이상 시\n즉각 조정 실행' },
          { icon: '📈', title: '장기 복리', desc: '"Get Rich Slowly"\n꾸준한 복리 누적' },
        ].map(p => (
          <div key={p.title} style={{ background: `${NEON}08`, border: `1px solid ${NEON}22`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NEON, marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'pre-line' }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Slide 3: 자금 구조 도넛 */
function SlideFundStructure() {
  const RADIAN = Math.PI / 180
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    if (value < 5) return null
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {value}%
      </text>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: NEON, fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>SLIDE 3 · FUND STRUCTURE</div>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
          자금 <span style={{ color: NEON }}>구조 분석</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Core/Satellite 도넛 */}
        <div style={{ background: BG3, border: `1px solid ${NEON}22`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CORE vs SATELLITE</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={CORE_SAT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" labelLine={false} label={renderLabel}>
                {CORE_SAT_DATA.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip content={<DarkTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            {CORE_SAT_DATA.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.name} {d.value}%</div>
                  <div style={{ fontSize: 10, color: '#4a5568' }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 자산군 도넛 */}
        <div style={{ background: BG3, border: `1px solid ${BLUE}22`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>자산군 비중</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={FUND_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" labelLine={false} label={renderLabel}>
                {FUND_DATA.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip content={<DarkTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            {FUND_DATA.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{d.name}</span>
                <span style={{ fontSize: 11, color: d.color, fontWeight: 700, marginLeft: 'auto' }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'ETF 비중', value: '59%', color: NEON },
          { label: '개별주', value: '35%', color: BLUE },
          { label: '대체자산', value: '6%', color: GOLD },
          { label: '종목 수', value: `${STRATEGY_STOCK_COUNT}개`, color: '#818cf8' },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Slide 4: 섹터 비중 Bar Chart */
function SlideSectorWeight() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: NEON, fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>SLIDE 4 · SECTOR ALLOCATION</div>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
          섹터 <span style={{ color: NEON }}>비중 배분</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Bar Chart */}
        <div style={{ background: BG3, border: `1px solid ${NEON}22`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 12 }}>섹터별 비중 (%)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={SECTOR_DATA} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
              <XAxis type="number" domain={[0, 35]} tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<DarkTip />} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {SECTOR_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                <LabelList dataKey="pct" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} formatter={(v: unknown) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 섹터 상세 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          {[
            { label: '반도체 노출 32%', icon: '💾', color: BLUE, desc: '직접+간접 합산. SK하이닉스·삼성전자·KODEX반도체 포함', badge: 'CORE' },
            { label: '전략·전력 20%', icon: '⚡', color: NEON, desc: '원자력·AI전력·GEV·Eaton 등 에너지 패러다임 테마', badge: 'SAT' },
            { label: 'AI·바이오 4%', icon: '🧬', color: '#818cf8', desc: '헬스케어 다각화. IBB·XBI·TEM 신규 편입', badge: 'SAT' },
            { label: 'K방산 4%', icon: '🛡️', color: '#fb923c', desc: 'PLUS K방산 ETF. 지정학적 리스크 헤지', badge: 'SAT' },
            { label: '대체(BTC) 6%', icon: '₿', color: GOLD, desc: '디지털 자산 분산. 인플레이션 헤지 기능', badge: 'ALT' },
            { label: '현금·CMA 5%', icon: '💵', color: '#4a5568', desc: '파킹 유동성 확보. 기회비용 최소화', badge: 'HEDGE' },
          ].map(s => (
            <div key={s.label} style={{ background: BG3, border: `1px solid ${s.color}22`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: s.color, border: `1px solid ${s.color}55`, borderRadius: 4, padding: '1px 5px' }}>{s.badge}</span>
                </div>
                <div style={{ fontSize: 11, color: '#4a5568', lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Slide 5: 이행 로드맵 */
function SlideRoadmap() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: NEON, fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>SLIDE 5 · IMPLEMENTATION ROADMAP</div>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
          전략 <span style={{ color: NEON }}>이행 로드맵</span>
        </h2>
      </div>

      {/* 타임라인 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', padding: '0 0 0 32px' }}>
        {/* 수직 선 */}
        <div style={{ position: 'absolute', left: 12, top: 16, bottom: 16, width: 2, background: `linear-gradient(to bottom, ${NEON}, ${NEON}22)` }} />

        {ROADMAP.map((step, idx) => (
          <div key={step.q} style={{ position: 'relative', marginBottom: 20 }}>
            {/* 타임라인 점 */}
            <div style={{
              position: 'absolute', left: -26, top: 14,
              width: 14, height: 14, borderRadius: '50%',
              background: step.done ? NEON : BG3,
              border: `2px solid ${step.done ? NEON : MUTED}`,
              boxShadow: step.done ? `0 0 10px ${NEON}88` : 'none',
            }} />

            <div style={{
              background: step.done ? `${NEON}0a` : BG3,
              border: `1px solid ${step.done ? NEON + '33' : MUTED + '33'}`,
              borderRadius: 14, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: step.done ? NEON : MUTED, border: `1px solid ${step.done ? NEON + '44' : MUTED + '44'}`, borderRadius: 6, padding: '2px 10px' }}>
                  {step.q}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: step.done ? '#f1f5f9' : '#4a5568' }}>{step.title}</span>
                {step.done && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: NEON, background: `${NEON}15`, borderRadius: 4, padding: '2px 8px' }}>✓ 완료</span>
                )}
                {!step.done && idx === 2 && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: GOLD, background: `${GOLD}15`, borderRadius: 4, padding: '2px 8px' }}>진행 예정</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {step.items.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: step.done ? '#94a3b8' : '#4a5568' }}>
                    <span style={{ color: step.done ? NEON : MUTED, fontSize: 10 }}>◆</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 격언 */}
      <div style={{ background: `${NEON}08`, border: `1px solid ${NEON}22`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NEON, fontStyle: 'italic' }}>
          &ldquo;좋은 투자는 항상 근거가 명확하다. 숫자로 설명할 수 없는 투자는 하지 않는다.&rdquo;
        </div>
        <div style={{ fontSize: 12, color: '#4a5568', marginTop: 6 }}>— Peter Lynch · 2026 투자학교 교장</div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MasterStrategyPage() {
  const [slide,    setSlide]    = useState(0)
  const [fading,   setFading]   = useState(false)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [pdfName,  setPdfName]  = useState<string | null>(null)
  const [pdfUrl,   setPdfUrl]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)
  // totalKrw: 개인 포트폴리오 수치 제거 — 전략 포트폴리오는 STRATEGY_TOTAL_KRW 고정값 사용
  const [returnPct] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const TOTAL_SLIDES = 5

  const showToast = (msg: string, dur = 3500) => {
    setToast(msg); setTimeout(() => setToast(null), dur)
  }

  // ── Auth & DB 초기화 ─────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      // 역할 확인
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'teacher')

      // PDF 최신본 확인 (Supabase Storage)
      const { data: files } = await sb.storage.from('strategy-pdf').list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } })
      if (files?.length) {
        setPdfName(files[0].name)
        const { data: pub } = sb.storage.from('strategy-pdf').getPublicUrl(files[0].name)
        setPdfUrl(pub.publicUrl)
      }
    }
    init()
  }, [])

  // ── 키보드 네비게이션 ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, fading])

  const goTo = useCallback((idx: number) => {
    if (fading || idx === slide) return
    setFading(true)
    setTimeout(() => { setSlide(idx); setFading(false) }, 300)
  }, [fading, slide])

  const goNext = useCallback(() => { if (slide < TOTAL_SLIDES - 1) goTo(slide + 1) }, [slide, goTo])
  const goPrev = useCallback(() => { if (slide > 0) goTo(slide - 1) }, [slide, goTo])

  // ── PDF 업로드 (선생님) ──────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) { showToast('⚠️ PDF 파일만 업로드 가능합니다'); return }

    setUploading(true)
    try {
      const sb = createClient()
      const fileName = `strategy_${new Date().toISOString().slice(0, 10)}.pdf`
      const { error } = await sb.storage.from('strategy-pdf').upload(fileName, file, { upsert: true })
      if (error) throw error

      const { data: pub } = sb.storage.from('strategy-pdf').getPublicUrl(fileName)
      setPdfName(fileName); setPdfUrl(pub.publicUrl)
      showToast('✅ 전략 리포트가 업로드되었습니다!')
    } catch (err) {
      showToast(`❌ 업로드 실패: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── 슬라이드 목록 ────────────────────────────────────────────────────────
  const SLIDES = [
    { label: '타이틀',   icon: '🏹' },
    { label: '배분철학', icon: '⚖️' },
    { label: '자금구조', icon: '🍩' },
    { label: '섹터비중', icon: '📊' },
    { label: '로드맵',   icon: '🗺️' },
  ]

  const renderSlide = () => {
    switch (slide) {
      case 0: return <SlideTitle returnPct={returnPct} />
      case 1: return <SlidePhilosophy />
      case 2: return <SlideFundStructure />
      case 3: return <SlideSectorWeight />
      case 4: return <SlideRoadmap />
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box',
    }}>

      {/* ── 상단 툴바 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        {/* 좌: 제목 + 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NEON, letterSpacing: '0.15em' }}>🏹 MASTER STRATEGY</div>
          <div style={{ width: 1, height: 14, background: MUTED }} />
          <div style={{ fontSize: 11, color: MUTED }}>2026 Q2 · 발키리 포트폴리오</div>
        </div>

        {/* 우: PDF 버튼 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin ? (
            <>
              <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUpload} />
              <button
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 8,
                  background: uploading ? `${NEON}15` : `${NEON}20`,
                  border: `1px solid ${NEON}44`,
                  color: uploading ? MUTED : NEON,
                  fontSize: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}>
                {uploading ? '⏳ 업로드 중…' : '📤 전략 리포트 업데이트'}
              </button>
              {pdfName && <span style={{ fontSize: 11, color: MUTED }}>현재: {pdfName}</span>}
            </>
          ) : (
            pdfUrl && (
              <a
                href={pdfUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 8,
                  background: `${BLUE}20`, border: `1px solid ${BLUE}44`,
                  color: BLUE, fontSize: 12, fontWeight: 700,
                  textDecoration: 'none',
                }}>
                📥 리포트 다운로드
              </a>
            )
          )}
        </div>
      </div>

      {/* ── 슬라이드 탭 네비 ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {SLIDES.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: i === slide ? `${NEON}20` : 'transparent',
              color: i === slide ? NEON : MUTED,
              fontSize: 12, fontWeight: i === slide ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: i === slide ? `2px solid ${NEON}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── 메인 슬라이드 카드 ── */}
      <div style={{
        flex: 1,
        background: BG2,
        border: `1px solid ${NEON}18`,
        borderRadius: 20,
        padding: '28px 32px',
        minHeight: 480,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 60px ${NEON}08, 0 0 120px ${NEON}04`,
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        {/* 배경 데코 */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: `${NEON}05`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: `${BLUE}05`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          {renderSlide()}
        </div>
      </div>

      {/* ── 하단 컨트롤 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
        {/* 이전 버튼 */}
        <button
          onClick={goPrev}
          disabled={slide === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 10,
            background: slide === 0 ? 'transparent' : `${NEON}15`,
            border: `1px solid ${slide === 0 ? MUTED + '33' : NEON + '44'}`,
            color: slide === 0 ? MUTED : NEON,
            fontSize: 13, fontWeight: 700, cursor: slide === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}>
          ← 이전
        </button>

        {/* 인디케이터 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === slide ? 24 : 8, height: 8,
                  borderRadius: 4, border: 'none',
                  background: i === slide ? NEON : MUTED + '55',
                  cursor: 'pointer', padding: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: i === slide ? `0 0 8px ${NEON}88` : 'none',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
            Page {slide + 1} / {TOTAL_SLIDES}
          </div>
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={goNext}
          disabled={slide === TOTAL_SLIDES - 1}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 10,
            background: slide === TOTAL_SLIDES - 1 ? 'transparent' : `${NEON}15`,
            border: `1px solid ${slide === TOTAL_SLIDES - 1 ? MUTED + '33' : NEON + '44'}`,
            color: slide === TOTAL_SLIDES - 1 ? MUTED : NEON,
            fontSize: 13, fontWeight: 700, cursor: slide === TOTAL_SLIDES - 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}>
          다음 →
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: BG2, border: `1px solid ${NEON}44`,
          borderRadius: 10, padding: '12px 24px',
          color: NEON, fontSize: 13, fontWeight: 600,
          boxShadow: `0 8px 32px ${NEON}22`,
          zIndex: 9999, whiteSpace: 'nowrap',
          animation: 'fadeIn 0.25s ease',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}
