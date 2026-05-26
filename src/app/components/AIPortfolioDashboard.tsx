'use client'

/**
 * AIPortfolioDashboard — 피터 린치 포트폴리오 진단 시스템
 *
 * 3개 섹션으로 구성된 교육용 인터랙티브 대시보드.
 * 실제 Supabase 포트폴리오와 독립된 모의 실습 공간.
 *
 *  ① 종목 입력 폼 + 보유 종목 리스트
 *  ② 6대 카테고리 분산 현황 + PEG 산점도
 *  ③ AI 실시간 행동 강령
 */

import { useState, useMemo } from 'react'
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
  { id:'고성장주',    label:'고성장주',    icon:'🚀', accent:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.22)',  desc:'연 20~25% 성장' },
  { id:'대형우량주',  label:'대형우량주',  icon:'🛡️', accent:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.22)', desc:'안정적 성장의 대기업' },
  { id:'저성장주',    label:'저성장주',    icon:'🐢', accent:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.22)',  desc:'성장은 느리나 높은 배당' },
  { id:'경기순환주',  label:'경기순환주',  icon:'🔄', accent:'#c084fc', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.22)', desc:'경기 흐름을 타는 업종' },
  { id:'자산주',      label:'자산주',      icon:'💎', accent:'#fbbf24', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.22)', desc:'숨겨진 자산 가치 기업' },
  { id:'턴어라운드주',label:'턴어라운드주',icon:'🔥', accent:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.22)', desc:'회생 가능성이 높은 위기 기업' },
]

const DEFAULT_STOCKS = [
  { name:'엔비디아', ticker:'NVDA', lynchType:'고성장주', per:32.5, growthRate:35.0, peg:0.93 },
  { name:'팔란티어', ticker:'PLTR', lynchType:'고성장주', per:45.0, growthRate:50.0, peg:0.90 },
]

interface Stock { name:string; ticker:string; lynchType:string; per:number; growthRate:number; peg:number }

// ── 카드 래퍼 ────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>
      {children}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function AIPortfolioDashboard() {
  const [stocks, setStocks]  = useState<Stock[]>(DEFAULT_STOCKS)
  const [form, setForm]      = useState({ name:'', ticker:'', lynchType:'고성장주', per:'', growthRate:'' })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.ticker || !form.per || !form.growthRate) return
    const per = parseFloat(form.per), gr = parseFloat(form.growthRate)
    setStocks(prev => [...prev, { name:form.name, ticker:form.ticker, lynchType:form.lynchType, per, growthRate:gr, peg:parseFloat((per/gr).toFixed(2)) }])
    setForm({ name:'', ticker:'', lynchType:'고성장주', per:'', growthRate:'' })
  }

  const handleDelete = (ticker: string) => setStocks(prev => prev.filter(s => s.ticker !== ticker))

  const aiInsights = useMemo(() => {
    if (!stocks.length) return null
    const sorted = [...stocks].sort((a,b) => a.peg - b.peg)
    return { best:sorted[0], worst:sorted[sorted.length-1] }
  }, [stocks])

  const inputStyle: React.CSSProperties = {
    padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`,
    background:C.surface, color:C.textHi, fontSize:12, outline:'none',
    width:'100%', boxSizing:'border-box',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 타이틀 배너 ──────────────────────────────────────── */}
      <div style={{
        padding:'20px 24px', borderRadius:14,
        background:'linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%)',
        border:`1px solid ${C.border}`,
      }}>
        <div style={{ fontSize:17, fontWeight:900, color:C.indigo, marginBottom:6 }}>
          ✨ 피터 린치 포트폴리오 진단 시스템
        </div>
        <div style={{ fontSize:12, color:C.textMid, lineHeight:1.6 }}>
          보유 중인 종목을 등록하면 피터 린치의 6대 분류 및 PEG 매력도를 실시간으로 시각화하여 분석합니다.
        </div>
      </div>

      {/* ── SECTION 1: 입력 폼 + 보유 종목 리스트 ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>

        {/* 입력 폼 */}
        <Card>
          <div style={{ padding:'13px 16px 6px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textHi }}>종목 등록 / 수정</div>
          </div>
          <div style={{ padding:'6px 16px 14px' }}>
            <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <input style={inputStyle} placeholder="종목명" value={form.name} onChange={e => setForm({...form,name:e.target.value})} />
                <input style={inputStyle} placeholder="티커" value={form.ticker} onChange={e => setForm({...form,ticker:e.target.value})} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <input style={inputStyle} type="number" step="0.1" placeholder="PER" value={form.per} onChange={e => setForm({...form,per:e.target.value})} />
                <input style={inputStyle} type="number" step="0.1" placeholder="성장률(%)" value={form.growthRate} onChange={e => setForm({...form,growthRate:e.target.value})} />
              </div>
              <select style={{ ...inputStyle }} value={form.lynchType} onChange={e => setForm({...form,lynchType:e.target.value})}>
                {LYNCH_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button type="submit" style={{
                padding:'9px', borderRadius:8, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#4f46e5,#6366f1)', color:'#fff',
                fontSize:12, fontWeight:700,
              }}>
                포트폴리오에 추가
              </button>
            </form>
          </div>
        </Card>

        {/* 보유 종목 리스트 */}
        <Card>
          <div style={{ padding:'13px 16px 6px', display:'flex', alignItems:'baseline', gap:6 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textHi }}>현재 내 포트폴리오</div>
            <div style={{ fontSize:10, color:C.textLow }}>{stocks.length}개 종목</div>
          </div>
          <div style={{ padding:'6px 16px 14px' }}>
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:6,
              maxHeight:130, overflowY:'auto',
            }}>
              {stocks.length > 0 ? stocks.map(s => (
                <div key={s.ticker} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 11px', borderRadius:9,
                  background:C.surface, border:`1px solid ${C.border}`,
                }}>
                  <div>
                    <span style={{ fontSize:12, fontWeight:700, color:C.textHi }}>{s.name}</span>
                    <span style={{ fontSize:10, color:C.textLow, marginLeft:6, fontFamily:'monospace' }}>{s.ticker} | {s.lynchType}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      fontSize:11, fontWeight:700, fontFamily:'monospace',
                      padding:'2px 7px', borderRadius:5,
                      background: s.peg <= 1.0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                      color: s.peg <= 1.0 ? C.green : C.red,
                    }}>
                      PEG {s.peg}
                    </span>
                    <button onClick={() => handleDelete(s.ticker)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textLow, fontSize:14, padding:0, lineHeight:1 }}>🗑</button>
                  </div>
                </div>
              )) : (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'20px 0', fontSize:12, color:C.textLow, fontStyle:'italic' }}>
                  등록된 종목이 없습니다. 좌측에서 종목을 추가해 주세요.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── SECTION 2: 6대 카테고리 + PEG 산점도 ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>

        {/* 6대 카테고리 분산 현황 */}
        <Card>
          <div style={{ padding:'13px 16px 6px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textHi }}>1. 유형별 분산 현황</div>
          </div>
          <div style={{ padding:'6px 14px 14px', display:'flex', flexDirection:'column', gap:5 }}>
            {LYNCH_CATS.map(cat => {
              const matches = stocks.filter(s => s.lynchType === cat.id)
              return (
                <div key={cat.id} style={{
                  padding:'8px 10px', borderRadius:9,
                  background:cat.bg, border:`1px solid ${cat.border}`,
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:14 }}>{cat.icon}</span>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:cat.accent }}>{cat.label}</div>
                      <div style={{ fontSize:9, color:C.textLow }}>{cat.desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:4, background:`${cat.accent}20`, color:cat.accent }}>
                      {matches.length}개
                    </span>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:90 }}>
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
        </Card>

        {/* PEG 산점도 */}
        <Card>
          <div style={{ padding:'13px 18px 4px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textHi }}>
              2. PEG 가치 평가 위치
            </div>
            <div style={{ fontSize:10, color:C.textLow, marginTop:2 }}>
              대각선(PEG=1.0) 아래에 위치할수록 이익 성장 대비 저평가된 매력적인 종목입니다
            </div>
          </div>
          <div style={{ height:270, padding:'8px 8px 4px 4px' }}>
            {stocks.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top:15, right:20, bottom:22, left:10 }}>
                  <XAxis type="number" dataKey="growthRate" name="이익성장률" unit="%" domain={[0,60]}
                    tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                    label={{ value:'EPS 이익성장률(%)', position:'insideBottom', offset:-10, fill:C.textLow, fontSize:9 }} />
                  <YAxis type="number" dataKey="per" name="PER" unit="배" domain={[0,60]}
                    tick={{ fill:C.textLow, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false}
                    label={{ value:'PER(배)', angle:-90, position:'insideLeft', offset:12, fill:C.textLow, fontSize:9 }} />
                  <ZAxis type="number" dataKey="peg" range={[55,55]} />
                  <ReferenceLine segment={[{x:0,y:0},{x:60,y:60}]} stroke={C.border} strokeDasharray="3 3" />
                  <Scatter data={stocks} isAnimationActive={false}>
                    {stocks.map((s,i) => (
                      <Cell key={i} fill={s.peg <= 1.0 ? C.green : C.red} opacity={0.85} />
                    ))}
                    <LabelList dataKey="name" position="top" offset={8} style={{ fontSize:10, fontWeight:700, fill:C.textMid }} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:C.textLow, fontSize:12, fontStyle:'italic' }}>
                종목을 등록하시면 차트가 활성화됩니다.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── SECTION 3: AI 실시간 행동 강령 ──────────────────────── */}
      <Card>
        <div style={{ padding:'13px 18px 6px', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14 }}>🎯</span>
          <div style={{ fontSize:12, fontWeight:700, color:C.textHi }}>3. 현재 포트폴리오 기반 AI 전략적 지침</div>
        </div>
        <div style={{ padding:'6px 18px 16px' }}>
          {aiInsights ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {/* 최우선 매수 */}
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)' }}>
                <div style={{ padding:'5px 9px', borderRadius:7, background:'rgba(74,222,128,0.18)', color:C.green, fontSize:10, fontWeight:700, flexShrink:0, height:'fit-content' }}>
                  최우선
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:5 }}>
                    {aiInsights.best.name} <span style={{ color:C.green, fontFamily:'monospace' }}>(PEG {aiInsights.best.peg})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    현재 입력된 종목 중 이익 성장 대비 주가가 가장 저평가되어 있습니다.
                    피터 린치 원칙상{' '}
                    <span style={{ color:C.green, fontWeight:700 }}>비중 확대를 가장 먼저 고려</span>할 만한 포지션입니다.
                  </div>
                </div>
              </div>
              {/* 관찰 종목 */}
              <div style={{ display:'flex', gap:12, padding:'13px 14px', borderRadius:10, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
                <div style={{ padding:'5px 9px', borderRadius:7, background:'rgba(251,191,36,0.18)', color:C.amber, fontSize:10, fontWeight:700, flexShrink:0, height:'fit-content' }}>
                  관찰
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:5 }}>
                    {aiInsights.worst.name} <span style={{ color:C.amber, fontFamily:'monospace' }}>(PEG {aiInsights.worst.peg})</span>
                  </div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>
                    현재 보유 종목 중 PEG가 상대적으로 가장 높습니다.
                    기업 가치는 좋으나 주가가 성장을 앞서가고 있을 수 있으니{' '}
                    <span style={{ color:C.amber, fontWeight:700 }}>추격 매수 신중</span>하게 접근하세요.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:C.textLow, fontStyle:'italic' }}>
              종목을 입력하시면 실제 보유 자산에 맞춘 지침이 여기에 도출됩니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
