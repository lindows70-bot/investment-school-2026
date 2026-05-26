'use client'

/**
 * AIPortfolioDashboard — AI 멘토 원페이지 마스터 시스템
 *
 * 학생들이 직접 종목을 추가/삭제하며 실습하는 교육용 인터랙티브 대시보드.
 * 실제 포트폴리오(Supabase)와 독립된 모의 연습 공간.
 *
 * ◆ 구성
 *  ① 종목 등록/삭제 폼  ② AI 건강 점수  ③ 공격성 게이지
 *  ④ 피터린치 6대 매트릭스  ⑤ DNA 레이더 차트
 *  ⑥ PEG 산점도  ⑦ 동적 행동 강령 카드
 */

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis,
  ZAxis, Cell, ReferenceLine, LabelList,
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
  indigo: '#818cf8',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
  purple: '#c084fc',
}

// ── 피터린치 6대 분류 마스터 ─────────────────────────────────
const LYNCH_CATS = [
  { id:'고성장주',    label:'고성장주',    icon:'🚀', accent:'#f87171', bg:'rgba(239,68,68,0.1)',   border:'rgba(239,68,68,0.25)',   desc:'연 20~25% 이상 성장' },
  { id:'대형우량주',  label:'대형우량주',  icon:'🛡️', accent:'#60a5fa', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.25)',  desc:'안정적인 성장의 대기업' },
  { id:'저성장주',    label:'저성장주',    icon:'🐢', accent:'#4ade80', bg:'rgba(34,197,94,0.1)',   border:'rgba(34,197,94,0.25)',   desc:'느리나 배당 중심' },
  { id:'경기순환주',  label:'경기순환주',  icon:'🔄', accent:'#c084fc', bg:'rgba(168,85,247,0.1)',  border:'rgba(168,85,247,0.25)',  desc:'경기 흐름에 민감' },
  { id:'자산주',      label:'자산주',      icon:'💎', accent:'#fbbf24', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)',  desc:'풍부한 자산 보유' },
  { id:'턴어라운드주',label:'턴어라운드주',icon:'🔥', accent:'#fb923c', bg:'rgba(251,146,60,0.1)',  border:'rgba(251,146,60,0.25)',  desc:'회생 가능성 높은 위기주' },
]

// ── 기본 연습 데이터 ─────────────────────────────────────────
const DEFAULT_STOCKS = [
  { name:'엔비디아',  ticker:'NVDA',   lynchType:'고성장주',  per:32.5, growthRate:35.0, peg:0.93 },
  { name:'팔란티어',  ticker:'PLTR',   lynchType:'고성장주',  per:45.0, growthRate:50.0, peg:0.90 },
  { name:'삼성전자',  ticker:'005930', lynchType:'대형우량주', per:14.5, growthRate:12.0, peg:1.21 },
  { name:'현대차',    ticker:'005380', lynchType:'경기순환주', per:6.5,  growthRate:8.0,  peg:0.81 },
]

interface Stock { name:string; ticker:string; lynchType:string; per:number; growthRate:number; peg:number }

// ── 카드 래퍼 ────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, ...style }}>
      {children}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function AIPortfolioDashboard() {
  const [stocks, setStocks] = useState<Stock[]>(DEFAULT_STOCKS)
  const [form, setForm] = useState({ name:'', ticker:'', lynchType:'고성장주', per:'', growthRate:'' })

  // 종목 추가
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.ticker || !form.per || !form.growthRate) return
    const per = parseFloat(form.per), gr = parseFloat(form.growthRate)
    setStocks(prev => [...prev, { name:form.name, ticker:form.ticker, lynchType:form.lynchType, per, growthRate:gr, peg:parseFloat((per/gr).toFixed(2)) }])
    setForm({ name:'', ticker:'', lynchType:'고성장주', per:'', growthRate:'' })
  }

  // 종목 삭제
  const handleDelete = (ticker: string) => setStocks(prev => prev.filter(s => s.ticker !== ticker))

  // ── 동적 계산 ────────────────────────────────────────────────

  // 건강 점수 + 공격 성향
  const metrics = useMemo(() => {
    if (!stocks.length) return { score:0, aggressive:0, status:'Empty' }
    const healthy    = stocks.filter(s => s.peg <= 1.0).length
    const aggressive = stocks.filter(s => s.lynchType === '고성장주' || s.lynchType === '턴어라운드주').length
    const score      = Math.min(100, 60 + Math.round((healthy / stocks.length) * 40))
    return {
      score,
      aggressive: Math.round((aggressive / stocks.length) * 100),
      status: score >= 85 ? 'Excellent' : score >= 70 ? 'Stable' : 'Review',
    }
  }, [stocks])

  // 레이더 데이터
  const radarData = useMemo(() =>
    LYNCH_CATS.map(c => ({
      subject: c.label.replace('주','').slice(0,4),
      A: stocks.length ? Math.round((stocks.filter(s => s.lynchType === c.id).length / stocks.length) * 100) : 0,
      fullMark: 100,
    }))
  , [stocks])

  // 행동 강령
  const insights = useMemo(() => {
    if (!stocks.length) return null
    const sorted = [...stocks].sort((a,b) => a.peg - b.peg)
    return { best:sorted[0], worst:sorted[sorted.length-1] }
  }, [stocks])

  const inputStyle: React.CSSProperties = {
    padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`,
    background:C.surface, color:C.textHi, fontSize:12, outline:'none', width:'100%',
    boxSizing:'border-box',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 웰컴 배너 ─────────────────────────────────────────── */}
      <div style={{
        padding:'24px 28px', borderRadius:18, position:'relative', overflow:'hidden',
        background:'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e293b 100%)',
        border:'1px solid rgba(99,102,241,0.35)',
      }}>
        <div style={{ position:'absolute', top:-10, right:-10, fontSize:130, opacity:0.04, pointerEvents:'none', lineHeight:1 }}>📊</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginBottom:10, padding:'3px 11px', borderRadius:20, fontSize:9, fontWeight:700, background:'rgba(99,102,241,0.25)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.3)', letterSpacing:'0.1em' }}>
          🏆 2026 투자학교 AI 원페이지 마스터 시스템
        </div>
        <div style={{ fontSize:18, fontWeight:900, color:C.textHi, marginBottom:8, lineHeight:1.3, letterSpacing:'-0.3px' }}>
          부사장님의 투자 원칙,{' '}<br />이제 하나의 판 위에서 완벽히 작동합니다.
        </div>
        <div style={{ fontSize:12, color:'rgba(199,210,254,0.80)', lineHeight:1.75, maxWidth:480 }}>
          종목을 추가하거나 삭제하는 즉시 AI 레이더 차트·건강 점수·행동 강령이 실시간으로 동기화됩니다.
        </div>
      </div>

      {/* ── SECTION 1: 폼 + 건강점수 + 성향 게이지 ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>

        {/* 종목 등록/삭제 폼 */}
        <Card>
          <div style={{ padding:'14px 16px 8px' }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi, marginBottom:2 }}>➕ 실습 종목 등록</div>
            <div style={{ fontSize:10, color:C.textLow }}>직접 입력 시 차트가 실시간 업데이트됩니다</div>
          </div>
          <div style={{ padding:'8px 16px 14px' }}>
            <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <input style={inputStyle} placeholder="종목명" value={form.name} onChange={e => setForm({...form, name:e.target.value})} />
                <input style={inputStyle} placeholder="티커/코드" value={form.ticker} onChange={e => setForm({...form, ticker:e.target.value})} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <input style={inputStyle} type="number" step="0.1" placeholder="PER" value={form.per} onChange={e => setForm({...form, per:e.target.value})} />
                <input style={inputStyle} type="number" step="0.1" placeholder="성장률(%)" value={form.growthRate} onChange={e => setForm({...form, growthRate:e.target.value})} />
              </div>
              <select style={{ ...inputStyle }} value={form.lynchType} onChange={e => setForm({...form, lynchType:e.target.value})}>
                {LYNCH_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button type="submit" style={{
                padding:'9px', borderRadius:8, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#4f46e5,#6366f1)', color:'#fff',
                fontSize:12, fontWeight:700,
              }}>
                포트폴리오에 반영하기
              </button>
            </form>
            {/* 등록 목록 */}
            <div style={{ marginTop:10, maxHeight:100, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
              {stocks.map(s => (
                <div key={s.ticker} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', borderRadius:6, background:C.surface, border:`1px solid ${C.border}`, fontSize:11 }}>
                  <span style={{ color:C.textHi, fontWeight:600 }}>{s.name}</span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ color:C.textLow, fontFamily:'monospace', fontSize:10 }}>PEG {s.peg}</span>
                    <button onClick={() => handleDelete(s.ticker)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textLow, fontSize:14, padding:0, lineHeight:1 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* AI 건강 점수 */}
        <Card>
          <div style={{ padding:'14px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>📊 AI 건강 스코어</div>
            <div style={{ fontSize:24, fontWeight:900, color:C.indigo, fontVariantNumeric:'tabular-nums' }}>
              {metrics.score}<span style={{ fontSize:11, fontWeight:400, color:C.textLow }}>/100</span>
            </div>
          </div>
          <div style={{ padding:'10px 16px 14px', display:'flex', flexDirection:'column', gap:10 }}>
            {/* 게이지 바 */}
            <div style={{ height:10, borderRadius:5, background:C.surface, overflow:'hidden' }}>
              <div style={{ width:`${metrics.score}%`, height:'100%', borderRadius:5, background:'linear-gradient(90deg,#4f46e5,#818cf8)', transition:'width 0.5s ease' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ padding:'10px', borderRadius:10, background:C.surface, border:`1px solid ${C.border}`, textAlign:'center' }}>
                <div style={{ fontSize:9, color:C.textLow, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>Risk Status</div>
                <div style={{ fontSize:14, fontWeight:900, color:C.green }}>{metrics.status}</div>
              </div>
              <div style={{ padding:'10px', borderRadius:10, background:C.surface, border:`1px solid ${C.border}`, textAlign:'center' }}>
                <div style={{ fontSize:9, color:C.textLow, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>보유 종목</div>
                <div style={{ fontSize:14, fontWeight:900, color:C.indigo }}>{stocks.length}개</div>
              </div>
            </div>
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', fontSize:11, color:C.textMid, lineHeight:1.65 }}>
              {stocks.length > 0
                ? `저평가 우량 자산 위주로 수비진이 구축되어 있습니다. AI 점수 ${metrics.score}점으로 양호합니다.`
                : '종목을 등록하시면 AI 실시간 종합 진단이 도출됩니다.'}
            </div>
          </div>
        </Card>

        {/* 공격 성향 게이지 */}
        <Card>
          <div style={{ padding:'14px 16px 8px' }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>🧬 투자 성향 진단</div>
          </div>
          <div style={{ padding:'8px 16px 14px', display:'flex', alignItems:'center', justifyContent:'space-around' }}>
            {/* SVG 원형 게이지 */}
            <div style={{ position:'relative', width:90, height:90, flexShrink:0 }}>
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="37" fill="none" stroke={C.surface} strokeWidth={9} />
                <circle cx="45" cy="45" r="37" fill="none" stroke="#4f46e5" strokeWidth={9}
                  strokeDasharray="232.5"
                  strokeDashoffset={232.5 * (1 - metrics.aggressive / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 45 45)"
                  style={{ transition:'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:900, color:C.textHi, lineHeight:1 }}>
                  {metrics.aggressive}<span style={{ fontSize:10, opacity:0.5 }}>%</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxWidth:130 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#4f46e5', flexShrink:0 }} />
                <span style={{ fontSize:11, color:C.textMid }}>공격형 (성장·회생)</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:C.green, flexShrink:0 }} />
                <span style={{ fontSize:11, color:C.textMid }}>수비형 (우량·안정)</span>
              </div>
              <div style={{ fontSize:10, color:C.textLow, lineHeight:1.6, marginTop:2 }}>
                {metrics.aggressive >= 60
                  ? '강력한 공격형. 상승기 탄력 기대. 하락기 변동성 관리 필요.'
                  : '안정성 중시 균형형. 꾸준한 우상향 적합.'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── SECTION 2: 6대 매트릭스 + DNA 레이더 ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>

        {/* 피터린치 6대 매트릭스 */}
        <Card>
          <div style={{ padding:'14px 18px 8px' }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>📋 피터린치 6대 카테고리 보유 현황</div>
          </div>
          <div style={{ padding:'8px 18px 14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {LYNCH_CATS.map(cat => {
                const catStocks = stocks.filter(s => s.lynchType === cat.id)
                return (
                  <div key={cat.id} style={{ padding:'10px 11px', borderRadius:10, background:cat.bg, border:`1px solid ${cat.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:800, color:cat.accent }}>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, background:`${cat.accent}20`, color:cat.accent }}>{catStocks.length}개</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {catStocks.length > 0
                        ? catStocks.map(s => (
                          <div key={s.ticker} style={{ display:'flex', justifyContent:'space-between', padding:'4px 7px', borderRadius:6, background:C.surface, fontSize:10 }}>
                            <span style={{ fontWeight:700, color:C.textHi }}>{s.name}</span>
                            <span style={{ color:C.textLow, fontFamily:'monospace' }}>PEG {s.peg}</span>
                          </div>
                        ))
                        : <div style={{ fontSize:10, color:C.textLow, textAlign:'center', padding:'4px 0', fontStyle:'italic' }}>비어 있음</div>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* DNA 레이더 차트 */}
        <Card style={{ display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div style={{ padding:'14px 16px 4px', textAlign:'center' }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:2 }}>Portfolio DNA Balance</div>
            <div style={{ fontSize:10, color:C.textLow }}>자산 분류별 분산 균형도 (%)</div>
          </div>
          <div style={{ height:220 }}>
            {stocks.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize:9, fill:C.textLow, fontWeight:600 }} />
                  <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize:7, fill:C.textLow }} />
                  <Radar name="포트폴리오" dataKey="A" stroke="#818cf8" fill="#4f46e5" fillOpacity={0.5} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:C.textLow, fontSize:11, fontStyle:'italic' }}>
                종목 등록 시 레이더가 그려집니다
              </div>
            )}
          </div>
          <div style={{ padding:'4px 14px 12px', textAlign:'center', fontSize:9, color:C.textLow }}>
            * 육각형에 가까울수록 전 부문에 고르게 분산된 상태
          </div>
        </Card>
      </div>

      {/* ── SECTION 3: PEG 산점도 + 행동 강령 ─────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>

        {/* PEG 산점도 */}
        <Card>
          <div style={{ padding:'14px 18px 4px' }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>📈 포트폴리오 가치 진단 (성장률 vs PER)</div>
            <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>등록 종목의 PEG 매력 구간을 실시간 추적합니다</div>
          </div>
          <div style={{ height:230, padding:'8px 8px 4px 4px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:15, right:15, bottom:20, left:10 }}>
                <XAxis type="number" dataKey="growthRate" name="이익성장률" unit="%" domain={[0,60]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'EPS 성장률(%)', position:'insideBottom', offset:-8, fill:C.textLow, fontSize:9 }} />
                <YAxis type="number" dataKey="per" name="PER" unit="배" domain={[0,55]}
                  tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                  label={{ value:'PER', angle:-90, position:'insideLeft', offset:12, fill:C.textLow, fontSize:9 }} />
                <ZAxis type="number" dataKey="peg" range={[55,55]} />
                <ReferenceLine segment={[{x:0,y:0},{x:55,y:55}]} stroke={C.border} strokeDasharray="3 3" />
                <Scatter data={stocks} isAnimationActive={false}>
                  {stocks.map((s, i) => (
                    <Cell key={i} fill={s.peg <= 1.0 ? C.green : C.red} opacity={0.85} />
                  ))}
                  <LabelList dataKey="name" position="top" offset={7} style={{ fontSize:9, fill:C.textMid, fontWeight:700 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 동적 행동 강령 */}
        <Card style={{ display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div style={{ padding:'14px 16px 8px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>🎯 AI 실시간 행동 강령</div>
            <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>실제 보유 종목 PEG 기반 동적 계산</div>
          </div>
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10, flex:1 }}>
            {insights ? (
              <>
                {/* 매수 우위 */}
                <div style={{ display:'flex', gap:10, padding:'12px 13px', borderRadius:11, background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)' }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'rgba(74,222,128,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>📈</div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:800, color:C.textHi }}>{insights.best.name}</span>
                      <span style={{ fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'rgba(74,222,128,0.2)', color:C.green }}>TOP VALUE</span>
                      <span style={{ fontSize:9, color:C.textLow, marginLeft:'auto' }}>PEG {insights.best.peg}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.textMid, lineHeight:1.6 }}>
                      보유 종목 중 PEG 최저. 이익 성장 대비 저평가 구간이므로{' '}
                      <span style={{ color:C.green, fontWeight:700 }}>리밸런싱 시 비중 확대</span> 우선 고려.
                    </div>
                  </div>
                </div>
                {/* 경계 종목 */}
                <div style={{ display:'flex', gap:10, padding:'12px 13px', borderRadius:11, background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)' }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'rgba(248,113,113,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>⚠️</div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:800, color:C.textHi }}>{insights.worst.name}</span>
                      <span style={{ fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'rgba(248,113,113,0.2)', color:C.red }}>CAUTION</span>
                      <span style={{ fontSize:9, color:C.textLow, marginLeft:'auto' }}>PEG {insights.worst.peg}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.textMid, lineHeight:1.6 }}>
                      보유 종목 중 PEG 최고. 단기 고평가 상태이므로{' '}
                      <span style={{ color:C.red, fontWeight:700 }}>추격 매수 신중</span> 접근 요망.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.textLow, fontSize:11, fontStyle:'italic' }}>
                종목 등록 시 강령이 산출됩니다
              </div>
            )}
          </div>
          {/* 명언 */}
          <div style={{ padding:'8px 16px 14px', textAlign:'center', borderTop:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontStyle:'italic', color:C.textLow }}>
              &ldquo;시장의 소음이 아닌, 이익 성장세와 가격의 저울질에 집중하라.&rdquo; — Peter Lynch
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
