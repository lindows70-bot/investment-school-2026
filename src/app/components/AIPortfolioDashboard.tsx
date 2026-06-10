'use client'

/**
 * AIPortfolioDashboard v5 — 하드코딩 완전 제거
 *
 * ◆ 원칙
 *  - FALLBACK_STOCKS 완전 삭제: 실제 포트폴리오 state 배열만 사용
 *  - 빈 포트폴리오 → Empty State UI (안내 메시지)
 *  - 6대 분류별 reduce → 종목 수 · 투자금액 · 비중 동적 집계
 *  - DB 영어 키(fast_grower 등) → 한국어 자동 변환 유지
 *  - ETF·원자재·가상자산 → 해당없음 슬롯으로 분리
 *  - PEG 산점도: per > 0 && growthRate > 0 종목만 렌더링
 */

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  ZAxis, ReferenceLine, Tooltip,
} from 'recharts'
import { BarChart2 } from 'lucide-react'

// ── 다크모드 컬러 시스템 ─────────────────────────────────────
const C = {
  bg:     '#020617',
  surface:'#0f172a',
  card:   '#1e293b',
  cardHi: '#263348',
  border: '#7a8fa3',
  textHi: '#f1f5f9',
  textMid:'#94a3b8',
  textLow:'#7f93a8',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
}

// ── 피터린치 6대 분류 마스터 ─────────────────────────────────
const LYNCH_CATS = [
  { id:'고성장주',    icon:'🚀', accent:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.22)',  desc:'연 20~25% 고성장' },
  { id:'대형우량주',  icon:'🛡️', accent:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.22)', desc:'안정적 성장의 대기업' },
  { id:'저성장주',    icon:'🐢', accent:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.22)',  desc:'성장은 느리나 높은 배당' },
  { id:'경기순환주',  icon:'🔄', accent:'#c084fc', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.22)', desc:'경기 흐름을 타는 업종' },
  { id:'자산주',      icon:'💎', accent:'#fbbf24', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.22)', desc:'숨겨진 자산 가치 기업' },
  { id:'턴어라운드주',icon:'🔥', accent:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.22)', desc:'회생 가능성이 높은 기업' },
]

// DB 영어 키 → 한국어 매핑
const ENGLISH_MAP: Record<string, string> = {
  fast_grower:  '고성장주',
  stalwart:     '대형우량주',
  slow_grower:  '저성장주',
  cyclical:     '경기순환주',
  asset_play:   '자산주',
  turnaround:   '턴어라운드주',
}

// ── 커스텀 툴팁 ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background:'#0f172a', border:'1px solid #7a8fa3', borderRadius:10,
      padding:'10px 14px', fontSize:12, minWidth:190, zIndex:50,
      boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight:800, color:'#fbbf24', marginBottom:6 }}>
        {d.name}
        <span style={{ fontWeight:400, color:C.textLow, fontSize:10, marginLeft:6 }}>({d.ticker})</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, color:C.textMid }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
          <span>분류</span>
          <b style={{ color:C.textHi }}>{d.lynchType}</b>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
          <span>이익성장률</span>
          <b style={{ color:C.textHi, fontFamily:'monospace' }}>{d.growthRate}%</b>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
          <span>PER</span>
          <b style={{ color:C.textHi, fontFamily:'monospace' }}>{d.per}배</b>
        </div>
        <div style={{
          borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:4,
          display:'flex', justifyContent:'space-between',
        }}>
          <span style={{ color:C.textLow }}>피터린치 PEG</span>
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

// ── 빈 포트폴리오 안내 ───────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:14, padding:'52px 24px',
      background:C.card, border:`1px dashed ${C.border}`, borderRadius:14,
      textAlign:'center',
    }}>
      <div style={{ fontSize:40 }}>📭</div>
      <div style={{ fontSize:14, fontWeight:800, color:C.textHi }}>
        현재 포트폴리오에 등록된 종목이 없습니다.
      </div>
      <div style={{ fontSize:12, color:C.textLow, lineHeight:1.8, maxWidth:360 }}>
        자산 관리 메뉴에서 보유 종목을 추가하면<br />
        피터 린치 6대 분류 분석이 자동으로 실행됩니다.
      </div>
      <div style={{
        marginTop:4, padding:'8px 16px', borderRadius:8,
        background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)',
        fontSize:11, color:C.amber,
      }}>
        💡 종목 추가 후 피터 린치 자동 분류까지 약 1~2분 소요됩니다.
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AIPortfolioDashboard(props: any) {

  // ── Step 1: props 완전 탐색 (6가지 prop 이름 지원) ───────────
  // ★ FALLBACK_STOCKS 완전 제거 — 빈 배열이면 그대로 빈 배열
  const rawInput: unknown[] = useMemo(() => {
    const src =
      props.portfolioStocks ??
      props.stocks          ??
      props.portfolio       ??
      props.items           ??
      props.data            ??
      props.list            ??
      []
    return Array.isArray(src) ? src : []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.portfolioStocks, props.stocks, props.portfolio, props.items, props.data, props.list])

  // ── Step 2: 데이터 표준화 ─────────────────────────────────
  const stocks = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawInput.map((s: any) => {
      const name         = s.name         || s.stockName || s.title  || '미확인 종목'
      const ticker       = s.ticker       || s.code      || s.symbol || ''
      const per          = Number(s.per)  || 0
      const growthRate   = Number(s.growthRate) || Number(s.growth) || 0
      const purchaseAmt  = (Number(s.purchase_price) || 0) * (Number(s.quantity) || 1)
      const currency     = s.currency || 'USD'

      // ── 최우선: 물리 실물자산·원자재 ETF 감지 → 해당없음 강제 ──
      const nameU   = name.toUpperCase()
      const tickerU = ticker.toUpperCase()
      const isPhysical =
        nameU.includes('PHYSICAL') || nameU.includes('SILVER') ||
        nameU.includes('GOLD')     || nameU.includes('TRUST')  ||
        nameU.includes('SPROTT')   ||
        ['PSLV','GLD','SLV','IAU','SIVR','PHYS','SGOL','PPLT'].includes(tickerU)

      const rawKey = (s.lynchType || s.lynch_category || s.category || s.type || '').toString().trim()
      const raw    = rawKey.replace(/\s+/g, '')

      let lynchType = '해당없음'
      if (isPhysical) {
        lynchType = '해당없음'
      } else if (!rawKey || rawKey === 'na' || rawKey.toLowerCase() === 'n/a') {
        lynchType = '해당없음'
      } else if (ENGLISH_MAP[rawKey]) {
        lynchType = ENGLISH_MAP[rawKey]
      } else if (['고성장주','대형우량주','저성장주','경기순환주','자산주','턴어라운드주'].includes(raw)) {
        lynchType = raw
      } else if (raw.includes('고성장') || raw.includes('빠른성장')) lynchType = '고성장주'
      else if (raw.includes('대형우량') || raw.includes('우량'))     lynchType = '대형우량주'
      else if (raw.includes('저성장'))                               lynchType = '저성장주'
      else if (raw.includes('경기순환'))                             lynchType = '경기순환주'
      else if (raw.includes('자산'))                                 lynchType = '자산주'
      else if (raw.includes('턴어라운드'))                           lynchType = '턴어라운드주'

      const peg = s.peg !== undefined
        ? Number(s.peg)
        : growthRate > 0 ? parseFloat((per / growthRate).toFixed(2)) : 0

      return { name, ticker, lynchType, per, growthRate, peg, purchaseAmt, currency }
    })
  }, [rawInput])

  // ── Step 3: 6대 분류별 집계 (reduce) ─────────────────────
  // { 분류명: { count, totalAmt, stocks[] } }
  const groupMap = useMemo(() => {
    return stocks.reduce<Record<string, { count: number; totalAmt: number; items: typeof stocks }>>((acc, s) => {
      const key = s.lynchType
      if (!acc[key]) acc[key] = { count: 0, totalAmt: 0, items: [] }
      acc[key].count++
      acc[key].totalAmt += s.purchaseAmt
      acc[key].items.push(s)
      return acc
    }, {})
  }, [stocks])

  // 전체 투자금액 (비중 계산용) — 해당없음 포함
  const totalAmt = useMemo(
    () => Object.values(groupMap).reduce((sum, g) => sum + g.totalAmt, 0),
    [groupMap]
  )

  // ── Step 4: PEG 산점도용 데이터 ───────────────────────────
  // growthRate > 0 이면 per=0(적자) 종목도 포함 — 차트 하단에 별도 표시
  const chartData = useMemo(
    () => stocks.filter(s => s.growthRate > 0),
    [stocks]
  )

  const aiInsights = useMemo(() => {
    if (!chartData.length) return null
    const sorted = [...chartData].sort((a, b) => a.peg - b.peg)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [chartData])

  const chartMax = useMemo(() => {
    if (!chartData.length) return { x: 60, y: 60 }
    const mx = Math.max(...chartData.map(s => s.growthRate), 50)
    // per=0(적자) 종목은 y 계산에서 제외, 최소 30 확보
    const my = Math.max(...chartData.filter(s => s.per > 0).map(s => s.per), 30)
    return { x: Math.ceil(mx / 10) * 10 + 10, y: Math.ceil(my / 10) * 10 + 10 }
  }, [chartData])

  const unclassified = groupMap['해당없음']?.items ?? []

  // ── 빈 포트폴리오 → 바로 빈 상태 UI ──────────────────────
  if (rawInput.length === 0) return <EmptyState />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 린치 분류 미완료 안내 (분류가 하나도 안 된 경우) */}
      {stocks.every(s => s.lynchType === '해당없음') && (
        <div style={{
          padding:'10px 14px', borderRadius:9, fontSize:11,
          background:'rgba(251,191,36,0.09)', border:'1px solid rgba(251,191,36,0.3)',
          color:'#fbbf24', display:'flex', alignItems:'center', gap:7,
        }}>
          <span>⏳</span>
          종목 분류 데이터를 불러오는 중입니다. 피터 린치 자동 분류가 완료되면 6대 유형이 표시됩니다.
        </div>
      )}

      {/* ── SECTION 1: 6대 카테고리 3×2 그리드 ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {LYNCH_CATS.map(cat => {
          const group   = groupMap[cat.id]
          const matches = group?.items ?? []
          const amt     = group?.totalAmt ?? 0
          const pct     = totalAmt > 0 ? (amt / totalAmt * 100) : 0

          return (
            <div key={cat.id} style={{
              padding:'12px 14px', borderRadius:10,
              background:cat.bg, border:`1px solid ${cat.border}`,
              display:'flex', flexDirection:'column', gap:8,
            }}>
              {/* 헤더 */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:16 }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:800, color:cat.accent }}>{cat.id}</div>
                    <div style={{ fontSize:9, color:C.textLow, marginTop:1 }}>{cat.desc}</div>
                  </div>
                </div>
                <span style={{
                  fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
                  background:`${cat.accent}20`, color:cat.accent, flexShrink:0,
                }}>
                  {matches.length}종목
                </span>
              </div>

              {/* 비중 바 */}
              {matches.length > 0 && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:9, color:C.textLow }}>포트폴리오 비중</span>
                    <span style={{ fontSize:9, fontWeight:700, color:cat.accent, fontFamily:'monospace' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height:4, borderRadius:2, background:`${C.border}`, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:2,
                      width:`${Math.min(pct, 100)}%`,
                      background:cat.accent,
                      transition:'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* 종목 태그 */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {matches.length > 0
                  ? matches.map(m => (
                    <span key={m.ticker || m.name} style={{
                      fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5,
                      background:C.surface, color:C.textMid, border:`1px solid ${C.border}`,
                    }}>
                      {m.name}
                    </span>
                  ))
                  : <span style={{ fontSize:10, color:C.textLow, fontStyle:'italic' }}>
                      보유 종목 없음
                    </span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 해당없음 자산 요약 바 ──────────────────────────── */}
      {unclassified.length > 0 && (
        <div style={{
          padding:'10px 14px', borderRadius:10,
          background:C.surface, border:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          gap:10, flexWrap:'wrap',
        }}>
          <span style={{ fontSize:11, fontWeight:600, color:C.textMid, flexShrink:0 }}>
            💡 가치 계측 제외 자산 (ETF · 지수 · 가상자산 · 원자재)
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

      {/* ── 집계 요약 카드 ─────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[
          { label:'총 등록 종목', value:`${stocks.length}개`, color:C.textHi },
          { label:'분류 완료',    value:`${stocks.filter(s => s.lynchType !== '해당없음').length}개`, color:C.green },
          { label:'분류 대기',    value:`${unclassified.length}개`, color:C.amber },
          { label:'PEG 분석 가능',value:`${chartData.length}개`,   color:'#818cf8' },
        ].map(item => (
          <div key={item.label} style={{
            padding:'10px 12px', borderRadius:10, textAlign:'center',
            background:C.card, border:`1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:9, color:C.textLow, marginBottom:3 }}>{item.label}</div>
            <div style={{ fontSize:17, fontWeight:900, color:item.color, fontFamily:'monospace' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 2: PEG 산점도 ────────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 8px', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.textHi }}>
            📈 성장률 vs 주가 가치 계측 (PEG 산점도)
          </div>
          <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>
            사선(PEG=1.0) 아래 = 저평가 우량 구간 · ETF·가상자산은 제외됨
          </div>
        </div>
        <div style={{ height:300, padding:'8px 8px 4px 4px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:15, right:20, bottom:22, left:10 }}>
                <XAxis
                  type="number" dataKey="growthRate" name="이익성장률" unit="%" domain={[0, chartMax.x]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'EPS 이익성장률(%)', position:'insideBottom', offset:-10, fill:C.textLow, fontSize:9 }}
                />
                <YAxis
                  type="number" dataKey="per" name="PER" unit="배" domain={[0, chartMax.y]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'PER(배)', angle:-90, position:'insideLeft', offset:12, fill:C.textLow, fontSize:9 }}
                />
                <ZAxis type="number" range={[80,80]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray:'3 3', stroke:C.border }} />
                <ReferenceLine
                  segment={[{x:0,y:0},{x:Math.min(chartMax.x,chartMax.y),y:Math.min(chartMax.x,chartMax.y)}]}
                  stroke={C.border} strokeDasharray="4 4"
                />
                <Scatter
                  data={chartData}
                  isAnimationActive={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  shape={(shapeProps: any) => {
                    const { cx, cy, payload } = shapeProps
                    const isLoss  = payload.per <= 0   // 적자 기업 (PE 없음)
                    const isUnder = !isLoss && (payload.peg ?? 0) <= 1.0
                    // 적자=주황 점선 / 저평가=초록 / 고평가=빨강
                    const col = isLoss ? '#fb923c' : isUnder ? C.green : C.red
                    const label = payload.name.length > 9 ? payload.name.slice(0, 8) + '…' : payload.name
                    return (
                      <g style={{ cursor:'pointer' }}>
                        <text x={cx} y={cy - 13} textAnchor="middle" fill={col} fontSize={9} fontWeight={700} style={{ pointerEvents:'none' }}>
                          {label}
                        </text>
                        {/* 적자 종목: 점선 원 + "PE—" 라벨 */}
                        {isLoss ? (
                          <>
                            <circle cx={cx} cy={cy} r={7} fill="none" stroke={col} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.85} />
                            <circle cx={cx} cy={cy} r={3} fill={col} opacity={0.5} />
                            <text x={cx} y={cy + 18} textAnchor="middle" fill={col} fontSize={8} style={{ pointerEvents:'none' }}>
                              PE—
                            </text>
                          </>
                        ) : (
                          <circle cx={cx} cy={cy} r={6} fill={col} opacity={0.88} stroke={C.surface} strokeWidth={1.5} />
                        )}
                      </g>
                    )
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:C.textLow }}>
              <BarChart2 size={28} />
              <div style={{ fontSize:12, fontStyle:'italic' }}>
                PER·이익성장률 데이터가 수집되면 차트가 표시됩니다.
              </div>
              <div style={{ fontSize:10, color:C.textLow }}>
                (주식 정보 API 로딩 중이거나 ETF·가상자산만 보유 중일 수 있습니다.)
              </div>
            </div>
          )}
        </div>
        {chartData.length > 0 && (
          <div style={{ display:'flex', justifyContent:'center', gap:20, padding:'8px 0 14px', fontSize:11, color:C.textMid, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:C.green }} /> 저평가 (PEG ≤ 1.0)
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:C.red }} /> 고평가 유의 (PEG &gt; 1.0)
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'none', border:'1.5px dashed #fb923c' }} /> 적자 기업 (PE 없음)
            </div>
          </div>
        )}
      </Card>

      {/* ── SECTION 3: AI 행동 강령 ─────────────────────── */}
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
                    {aiInsights.best.name}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace', marginLeft:6 }}>({aiInsights.best.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    분석 대상 중 가장 저평가 상태입니다.{' '}
                    <span style={{ color:C.green, fontWeight:700 }}>PEG {aiInsights.best.peg}</span>
                    {' '}— 피터 린치 모델 기준 비중 확대 1순위입니다.
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
                <div style={{ padding:'4px 8px', borderRadius:6, background:'#f59e0b', color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.05em', flexShrink:0, height:'fit-content' }}>
                  WATCH LIST
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:4 }}>
                    {aiInsights.worst.name}
                    <span style={{ fontSize:10, color:C.textLow, fontFamily:'monospace', marginLeft:6 }}>({aiInsights.worst.ticker})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    성장세 대비 주가가 무겁습니다.{' '}
                    <span style={{ color:C.amber, fontWeight:700 }}>PEG {aiInsights.worst.peg}</span>
                    {' '}— 단기 추격 매수 조율이 필요합니다.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:C.textLow, fontStyle:'italic', border:`1px dashed ${C.border}`, borderRadius:10 }}>
              PER·이익성장률 데이터가 수집되면 가치 분석 리포트가 표시됩니다.
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}
