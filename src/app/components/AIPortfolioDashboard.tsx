'use client'

/**
 * AIPortfolioDashboard (PeterLynchCleanDashboard v3)
 *
 * ◆ 핵심 개선
 *  - 띄어쓰기·명칭 편차 정규화 ('빠른 성장주' → '고성장주' 등)
 *  - PER/성장률 = 0인 ETF·지수·가상자산 → chartData에서 자동 제외 (0,0 뭉침 원천 차단)
 *  - '해당없음' 슬롯: 미분류 자산 별도 요약 바로 표시
 *  - 커스텀 툴팁으로 차트 라벨 겹침 없음
 *  - 방어막 3중 구조 유지 (props 다변수명 · 데이터 정제 · 자동 표준화)
 */

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  ZAxis, Cell, ReferenceLine, Tooltip,
} from 'recharts'

// ── 다크모드 컬러 시스템 ─────────────────────────────────────
const C = {
  bg:     '#020617',
  surface:'#0f172a',
  card:   '#1e293b',
  cardHi: '#263348',
  border: '#334155',
  textHi: '#f1f5f9',
  textMid:'#94a3b8',
  textLow:'#64748b',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
  indigo: '#818cf8',
}

// ── 피터린치 6대 분류 마스터 ─────────────────────────────────
const LYNCH_CATS = [
  { id:'고성장주',    icon:'🚀', accent:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.22)',  desc:'연 20~25% 고성장 (빠른 성장주)' },
  { id:'대형우량주',  icon:'🛡️', accent:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.22)', desc:'안정적 성장의 대기업' },
  { id:'저성장주',    icon:'🐢', accent:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.22)',  desc:'성장은 느리나 높은 배당' },
  { id:'경기순환주',  icon:'🔄', accent:'#c084fc', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.22)', desc:'경기 흐름을 타는 업종' },
  { id:'자산주',      icon:'💎', accent:'#fbbf24', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.22)', desc:'숨겨진 자산 가치 기업' },
  { id:'턴어라운드주',icon:'🔥', accent:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.22)', desc:'회생 가능성이 높은 기업' },
]

// ── 커스텀 툴팁 ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background:'#0f172a', border:'1px solid #334155', borderRadius:10,
      padding:'10px 14px', fontSize:12, minWidth:180, zIndex:50,
    }}>
      <div style={{ fontWeight:800, color:'#fbbf24', marginBottom:6 }}>
        {d.name}{' '}
        <span style={{ fontWeight:400, color:C.textLow, fontSize:10 }}>({d.ticker})</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, color:C.textMid }}>
        <span>구분: <b style={{ color:C.textHi }}>{d.lynchType}</b></span>
        <span>이익성장률: <b style={{ color:C.textHi, fontFamily:'monospace' }}>{d.growthRate}%</b></span>
        <span>PER: <b style={{ color:C.textHi, fontFamily:'monospace' }}>{d.per}배</b></span>
        <div style={{ borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:4, display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:C.textLow }}>피터린치 PEG:</span>
          <b style={{ fontFamily:'monospace', color: d.peg <= 1.0 ? C.green : C.red }}>{d.peg}</b>
        </div>
      </div>
    </div>
  )
}

// ── 카드 래퍼 ────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', ...style }}>
      {children}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AIPortfolioDashboard(props: any) {

  // 방어막 1: 여러 prop 후보군 순서 탐색
  const rawStocks = props.portfolioStocks ?? props.stocks ?? props.portfolio ?? props.items ?? []

  // 방어막 2+3: 데이터 정제 + 명칭 편차 정규화
  const stocks = useMemo(() => {
    if (!Array.isArray(rawStocks)) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawStocks.map((s: any) => {
      const name       = s.name       || s.stockName || s.title  || '미확인 종목'
      const ticker     = s.ticker     || s.code      || s.symbol || ''
      const per        = Number(s.per) || 0
      const growthRate = Number(s.growthRate) || Number(s.growth) || 0

      // 띄어쓰기 제거 후 포함 문자열로 유연하게 매칭
      const raw = (s.lynchType || s.category || s.type || '').toString().replace(/\s+/g, '')
      let lynchType = '해당없음'
      if      (raw.includes('고성장') || raw.includes('빠른성장')) lynchType = '고성장주'
      else if (raw.includes('대형우량'))                           lynchType = '대형우량주'
      else if (raw.includes('저성장'))                             lynchType = '저성장주'
      else if (raw.includes('경기순환'))                           lynchType = '경기순환주'
      else if (raw.includes('자산'))                               lynchType = '자산주'
      else if (raw.includes('턴어라운드'))                         lynchType = '턴어라운드주'

      const peg = s.peg !== undefined
        ? Number(s.peg)
        : growthRate > 0 ? parseFloat((per / growthRate).toFixed(2)) : 0

      return { name, ticker, lynchType, per, growthRate, peg }
    })
  }, [rawStocks])

  // ★ PER/성장률 = 0 인 자산(ETF·지수·가상자산) 차트에서 자동 제외 → (0,0) 뭉침 원천 차단
  const chartData = useMemo(
    () => stocks.filter(s => s.per > 0 && s.growthRate > 0),
    [stocks]
  )

  // AI 인사이트
  const aiInsights = useMemo(() => {
    if (!chartData.length) return null
    const sorted = [...chartData].sort((a, b) => a.peg - b.peg)
    return { best:sorted[0], worst:sorted[sorted.length-1] }
  }, [chartData])

  // 차트 축 범위 동적 계산
  const chartMax = useMemo(() => {
    if (!chartData.length) return { x:50, y:50 }
    const mx = Math.max(...chartData.map(s => s.growthRate), 40)
    const my = Math.max(...chartData.map(s => s.per), 40)
    return {
      x: Math.ceil(mx / 10) * 10 + 10,
      y: Math.ceil(my / 10) * 10 + 10,
    }
  }, [chartData])

  // 미분류(해당없음) 자산 목록
  const unclassified = stocks.filter(s => s.lynchType === '해당없음')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── SECTION 1: 6대 카테고리 3×2 그리드 ─────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {LYNCH_CATS.map(cat => {
          const matches = stocks.filter(s => s.lynchType === cat.id)
          return (
            <div key={cat.id} style={{
              padding:'12px 14px', borderRadius:10, minHeight:100,
              background:cat.bg, border:`1px solid ${cat.border}`,
              display:'flex', flexDirection:'column', justifyContent:'space-between',
            }}>
              {/* 헤더 행 */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16 }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:800, color:cat.accent }}>{cat.id}</div>
                    <div style={{ fontSize:9, color:C.textLow, marginTop:1 }}>{cat.desc}</div>
                  </div>
                </div>
                <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:4, background:`${cat.accent}20`, color:cat.accent, flexShrink:0 }}>
                  {matches.length}개
                </span>
              </div>

              {/* 종목 태그 — 자연스러운 줄바꿈 */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:10 }}>
                {matches.length > 0
                  ? matches.map(m => (
                    <span key={m.ticker || m.name} style={{
                      fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5,
                      background:C.surface, color:C.textMid, border:`1px solid ${C.border}`,
                    }}>
                      {m.name}
                    </span>
                  ))
                  : <span style={{ fontSize:10, color:C.textLow, fontStyle:'italic' }}>보유 종목 없음</span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 미분류 자산 요약 바 (ETF·지수·가상자산 등) ────────── */}
      {unclassified.length > 0 && (
        <div style={{
          padding:'10px 14px', borderRadius:10,
          background:C.surface, border:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap',
        }}>
          <span style={{ fontSize:11, fontWeight:600, color:C.textMid, flexShrink:0 }}>
            💡 가치 계측 제외 자산 (ETF · 지수 · 가상자산 등)
          </span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {unclassified.map(s => (
              <span key={s.ticker || s.name} style={{
                fontSize:10, padding:'2px 8px', borderRadius:5,
                background:C.cardHi, color:C.textMid, border:`1px solid ${C.border}`,
              }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 2: PEG 산점도 ────────────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 8px', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.textHi }}>📈 성장률 vs 주가 가치 계측</div>
          <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>
            사선(PEG=1.0) 아래 영역이 저평가 우량 구간 · ETF/가상자산은 자동 제외 · 마우스 오버 시 상세
          </div>
        </div>
        <div style={{ height:300, padding:'8px 8px 4px 4px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:15, right:20, bottom:22, left:10 }}>
                <XAxis type="number" dataKey="growthRate" name="이익성장률" unit="%" domain={[0, chartMax.x]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'EPS 이익성장률(%)', position:'insideBottom', offset:-10, fill:C.textLow, fontSize:9 }} />
                <YAxis type="number" dataKey="per" name="PER" unit="배" domain={[0, chartMax.y]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'PER(배)', angle:-90, position:'insideLeft', offset:12, fill:C.textLow, fontSize:9 }} />
                <ZAxis type="number" range={[80,80]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray:'3 3', stroke:C.border }} />
                <ReferenceLine
                  segment={[{x:0,y:0},{x:Math.min(chartMax.x,chartMax.y),y:Math.min(chartMax.x,chartMax.y)}]}
                  stroke={C.border} strokeDasharray="4 4"
                />
                <Scatter data={chartData} isAnimationActive={false}>
                  {chartData.map((s,i) => (
                    <Cell key={i}
                      fill={(s.peg ?? 0) <= 1.0 ? C.green : C.red}
                      opacity={0.85}
                      style={{ cursor:'pointer' }}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:C.textLow }}>
              <span style={{ fontSize:28 }}>📊</span>
              <div style={{ fontSize:12, fontStyle:'italic' }}>가치 분석(PER·성장률)이 가능한 개별 종목 데이터가 없습니다.</div>
            </div>
          )}
        </div>

        {/* 범례 */}
        {chartData.length > 0 && (
          <div style={{ display:'flex', justifyContent:'center', gap:24, padding:'8px 0 14px', fontSize:11, color:C.textMid }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:C.green }} />
              저평가 매력 구간 (PEG ≤ 1.0)
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:C.red }} />
              고평가 유의 구간 (PEG &gt; 1.0)
            </div>
          </div>
        )}
      </Card>

      {/* ── SECTION 3: AI 행동 강령 ──────────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 8px', background:C.surface, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14 }}>🎯</span>
          <div style={{ fontSize:12, fontWeight:800, color:C.textHi }}>실시간 포트폴리오 가치분석 결과</div>
        </div>
        <div style={{ padding:'12px 18px 16px' }}>
          {aiInsights ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)' }}>
                <div style={{ padding:'4px 8px', borderRadius:6, background:'#10b981', color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.05em', flexShrink:0, height:'fit-content' }}>
                  BUY CHANCE
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:4 }}>
                    {aiInsights.best.name}{' '}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace' }}>({aiInsights.best.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    분석 대상 중 가치 매력이 가장 높습니다.{' '}
                    <span style={{ color:C.green, fontWeight:700 }}>PEG {aiInsights.best.peg}</span>{' '}
                    — 피터 린치 모델 기준 철저한 저평가 상태입니다.
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
                <div style={{ padding:'4px 8px', borderRadius:6, background:'#f59e0b', color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.05em', flexShrink:0, height:'fit-content' }}>
                  WATCH LIST
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:4 }}>
                    {aiInsights.worst.name}{' '}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace' }}>({aiInsights.worst.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    현재 데이터 중{' '}
                    <span style={{ color:C.amber, fontWeight:700 }}>PEG {aiInsights.worst.peg}</span>{' '}
                    — 주가가 다소 무겁게 세팅되어 단기 추격 매수 조율이 필요합니다.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:C.textLow, fontStyle:'italic', border:`1px dashed ${C.border}`, borderRadius:10 }}>
              개별 종목 데이터가 매핑되면 실시간 가치 분석 리포트가 가동됩니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
