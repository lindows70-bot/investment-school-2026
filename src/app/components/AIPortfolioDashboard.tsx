'use client'

/**
 * AIPortfolioDashboard — 피터 린치 포트폴리오 진단 시스템 (props 주입 방식)
 *
 * 외부에서 실제 포트폴리오 데이터를 portfolioStocks props로 받아
 * 6대 분류 매트릭스 + PEG 산점도 + AI 행동 강령을 렌더링합니다.
 * 컴포넌트 내부에 특정 종목이 하드코딩되지 않습니다.
 */

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  ZAxis, Cell, ReferenceLine, LabelList,
} from 'recharts'

// ── 다크모드 컬러 시스템 ─────────────────────────────────────
const C = {
  bg:     '#020617',
  surface:'#0f172a',
  card:   '#1e293b',
  border: '#334155',
  textHi: '#f1f5f9',
  textMid:'#94a3b8',
  textLow:'#64748b',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
  indigo: '#818cf8',
}

// ── 피터린치 6대 분류 ─────────────────────────────────────────
const LYNCH_CATS = [
  { id:'고성장주',    icon:'🚀', accent:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.22)',  desc:'연 20~25% 성장' },
  { id:'대형우량주',  icon:'🛡️', accent:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.22)', desc:'안정적 성장의 대기업' },
  { id:'저성장주',    icon:'🐢', accent:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.22)',  desc:'성장은 느리나 높은 배당' },
  { id:'경기순환주',  icon:'🔄', accent:'#c084fc', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.22)', desc:'경기 흐름을 타는 업종' },
  { id:'자산주',      icon:'💎', accent:'#fbbf24', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.22)', desc:'숨겨진 자산 가치 기업' },
  { id:'턴어라운드주',icon:'🔥', accent:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.22)', desc:'회생 가능성이 높은 위기 기업' },
]

// ── Props 타입 ────────────────────────────────────────────────
export interface StockData {
  name:       string
  ticker:     string
  lynchType:  string
  per:        number
  growthRate: number
  peg?:       number
}

interface Props {
  portfolioStocks?: StockData[]
}

// ── 카드 래퍼 ────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>
      {children}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function AIPortfolioDashboard({ portfolioStocks = [] }: Props) {

  // ── 입력 데이터 전처리: PEG 계산 + 방어 코드 ────────────────
  const stocks = useMemo(() => {
    if (!Array.isArray(portfolioStocks)) return []
    return portfolioStocks.map(s => {
      const per    = Number(s.per)        || 0
      const growth = Number(s.growthRate) || 0
      const peg    = s.peg !== undefined
        ? Number(s.peg)
        : growth > 0 ? parseFloat((per / growth).toFixed(2)) : 0
      return { ...s, per, growthRate: growth, peg }
    })
  }, [portfolioStocks])

  // ── AI 동적 진단: 보유 종목 중 PEG 최저/최고 ─────────────────
  const aiInsights = useMemo(() => {
    const valid = stocks.filter(s => s.growthRate > 0)
    if (!valid.length) return null
    const sorted = [...valid].sort((a, b) => a.peg - b.peg)
    return { best:sorted[0], worst:sorted[sorted.length - 1] }
  }, [stocks])

  // ── 차트 축 범위 동적 계산 ─────────────────────────────────
  const chartMax = useMemo(() => {
    if (!stocks.length) return { x:60, y:60 }
    const mx = Math.max(...stocks.map(s => s.growthRate), 40)
    const my = Math.max(...stocks.map(s => s.per), 40)
    return {
      x: Math.ceil(mx / 10) * 10 + 10,
      y: Math.ceil(my / 10) * 10 + 10,
    }
  }, [stocks])

  const isEmpty = stocks.length === 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 타이틀 배너 ──────────────────────────────────────── */}
      <div style={{
        padding:'18px 22px', borderRadius:12,
        background:'linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%)',
        border:`1px solid ${C.border}`,
      }}>
        <div style={{ fontSize:16, fontWeight:900, color:C.indigo, marginBottom:5 }}>
          ✨ 피터 린치 포트폴리오 진단 시스템
        </div>
        <div style={{ fontSize:12, color:C.textMid, lineHeight:1.65 }}>
          보유 종목의 피터 린치 6대 분류와 PEG 매력도를 실시간으로 시각화합니다.
          사선(PEG=1.0) 아래에 위치할수록 이익 성장 대비 저평가된 구간입니다.
        </div>
      </div>

      {/* ── SECTION 1: 6대 카테고리 3×2 그리드 ─────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {LYNCH_CATS.map(cat => {
          const matches = stocks.filter(s => s.lynchType === cat.id)
          return (
            <div key={cat.id} style={{
              padding:'10px 12px', borderRadius:10,
              background:cat.bg, border:`1px solid ${cat.border}`,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>{cat.icon}</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:cat.accent }}>{cat.id}</div>
                  <div style={{ fontSize:9, color:C.textLow }}>{cat.desc}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:4, background:`${cat.accent}20`, color:cat.accent }}>
                  {matches.length}개
                </span>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, justifyContent:'flex-end', maxWidth:95 }}>
                  {matches.map(m => (
                    <span key={m.ticker} style={{ fontSize:9, background:C.surface, color:C.textMid, padding:'1px 5px', borderRadius:4, border:`1px solid ${C.border}` }}>
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SECTION 2: PEG 산점도 ────────────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 4px', display:'flex', alignItems:'baseline', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.textHi }}>📈 성장률 vs 주가 가치 계측</div>
          <div style={{ fontSize:10, color:C.textLow }}>사선(PEG=1.0) 아래 = 피터 린치의 저평가 적정 구간</div>
        </div>
        <div style={{ height:270, padding:'8px 8px 4px 4px' }}>
          {!isEmpty ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:15, right:20, bottom:22, left:10 }}>
                <XAxis type="number" dataKey="growthRate" name="이익성장률" unit="%" domain={[0, chartMax.x]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'EPS 이익성장률(%)', position:'insideBottom', offset:-10, fill:C.textLow, fontSize:9 }} />
                <YAxis type="number" dataKey="per" name="PER" unit="배" domain={[0, chartMax.y]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'PER(배)', angle:-90, position:'insideLeft', offset:12, fill:C.textLow, fontSize:9 }} />
                <ZAxis type="number" range={[60,60]} />
                <ReferenceLine
                  segment={[{x:0,y:0},{x:Math.min(chartMax.x,chartMax.y),y:Math.min(chartMax.x,chartMax.y)}]}
                  stroke={C.border} strokeDasharray="3 3"
                />
                <Scatter data={stocks} isAnimationActive={false}>
                  {stocks.map((s,i) => (
                    <Cell key={i} fill={(s.peg ?? 0) <= 1.0 && s.growthRate > 0 ? C.green : C.red} opacity={0.85} />
                  ))}
                  <LabelList dataKey="name" position="top" offset={8} style={{ fontSize:10, fontWeight:700, fill:C.textMid }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:C.textLow }}>
              <span style={{ fontSize:28 }}>📊</span>
              <div style={{ fontSize:12, fontStyle:'italic' }}>현재 포트폴리오에 등록된 종목이 없습니다.</div>
            </div>
          )}
        </div>
      </Card>

      {/* ── SECTION 3: AI 행동 강령 ──────────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 8px', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14 }}>🎯</span>
          <div style={{ fontSize:12, fontWeight:800, color:C.textHi }}>실시간 포트폴리오 스캔 결과 및 행동 지침</div>
        </div>
        <div style={{ padding:'4px 18px 16px' }}>
          {aiInsights ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {/* BUY CHANCE */}
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)' }}>
                <div style={{ padding:'4px 8px', borderRadius:6, background:'#10b981', color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.05em', flexShrink:0, height:'fit-content' }}>
                  BUY CHANCE
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:5 }}>
                    {aiInsights.best.name}{' '}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace' }}>({aiInsights.best.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    이익 성장 대비 주가가 가장 매력적인 자리입니다.{' '}
                    <span style={{ color:C.green, fontWeight:700 }}>PEG {aiInsights.best.peg}</span>{' '}
                    — 피터 린치 원칙에 부합하는 비중 확대 1순위 후보입니다.
                  </div>
                </div>
              </div>

              {/* WATCH LIST */}
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
                <div style={{ padding:'4px 8px', borderRadius:6, background:'#f59e0b', color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.05em', flexShrink:0, height:'fit-content' }}>
                  WATCH LIST
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:5 }}>
                    {aiInsights.worst.name}{' '}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace' }}>({aiInsights.worst.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    보유 종목 중 PEG가 가장 높습니다.{' '}
                    <span style={{ color:C.amber, fontWeight:700 }}>PEG {aiInsights.worst.peg}</span>{' '}
                    — 단기 고평가 구간일 수 있으니 추격 매수를 삼가십시오.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:C.textLow, fontStyle:'italic', border:`1px dashed ${C.border}`, borderRadius:10 }}>
              종목 데이터가 주입되면 실시간 린치 식 솔루션이 가동됩니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
