'use client'

/**
 * /master-strategy — 발키리 전략 브리핑 시스템 v3
 *
 * 5-Slide Deck  |  framer-motion 좌우 전환
 * Admin  : 전략 업데이트 모달 (PDF + Core/Sat % + 비주얼 섹터 행 관리)
 * Student: 실시간 차트 + PDF 다운로드
 * DB     : strategy_configs (singleton row upsert)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Minus, X, Upload, Download, Settings,
  ChevronLeft, ChevronRight, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════
const D = {
  bg:      '#020617',
  surface: '#06101f',
  card:    '#0a1929',
  cardHi:  '#0d2137',
  border:  '#0f2a45',
  borderHi:'#1a3a5c',
  neon:    '#deff9a',
  neonDim: '#deff9a33',
  neonGlow:'#deff9a18',
  blue:    '#38bdf8',
  blueDim: '#38bdf822',
  indigo:  '#818cf8',
  gold:    '#fbbf24',
  red:     '#f87171',
  green:   '#4ade80',
  muted:   '#1e3a5c',
  text:    '#e2e8f0',
  textSub: '#64748b',
  textDim: '#334155',
} as const

// ═══════════════════════════════════════════════════════════════
//  TYPES & DEFAULTS
// ═══════════════════════════════════════════════════════════════
interface SectorRow  { name: string; value: number }
interface StrategyConfig {
  id?:              string
  core_pct:         number
  satellite_pct:    number
  sector_data:      SectorRow[]
  core_stocks:      string[]     // 추천 Core 종목 리스트
  satellite_stocks: string[]     // 추천 Satellite 종목 리스트
  pdf_url:          string | null
  pdf_display_name: string | null  // 원본 파일명 (한글 포함) — Storage key와 별도 관리
  updated_at?:      string
}

const DEFAULT_CONFIG: StrategyConfig = {
  core_pct:          48,
  satellite_pct:     52,
  pdf_display_name:  null,
  sector_data: [
    { name: '반도체',    value: 32 },
    { name: '전략·전력', value: 20 },
    { name: 'K방산',     value:  4 },
    { name: 'AI·바이오', value:  4 },
    { name: '대체(BTC)', value:  6 },
    { name: '현금·CMA',  value:  5 },
  ],
  core_stocks:      [],
  satellite_stocks: [],
  pdf_url:          null,
}

const SECTOR_PALETTE = [
  D.blue, D.neon, '#fb923c', D.indigo, D.gold, D.textSub,
  '#f472b6', '#34d399', '#a78bfa', '#60a5fa',
]

const TOTAL_SLIDES  = 5
const STRATEGY_AMT  = '₩1억'
const STRATEGY_STOCKS = 18

const ROADMAP = [
  { q:'Q1 2026', title:'포트폴리오 구축',   items:['Core ETF 편입 완료','반도체 32% 달성','분산 구조 확립'], done:true  },
  { q:'Q2 2026', title:'Satellite 강화',    items:['AI·바이오 4% 편입','K방산 확대','나스닥100 조정'],    done:true  },
  { q:'Q3 2026', title:'분기 리밸런싱',      items:['섹터 수익률 점검','비중 ±5% 조정','신규 테마 스크리닝'], done:false },
  { q:'Q4 2026', title:'연간 결산',          items:['벤치마크 성과 비교','2027 전략 초안','세금 최적화'],  done:false },
]

// ═══════════════════════════════════════════════════════════════
//  FRAMER VARIANTS
// ═══════════════════════════════════════════════════════════════
const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0, scale: 0.97 }),
}
const slideTrans = { type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.44 }

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }

// ═══════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 7px', letterSpacing: '0.08em' }}>
      {children}
    </span>
  )
}

function SlideHeader({ num, label, title }: { num: string; label: string; title: string }) {
  return (
    <motion.div variants={fadeUp} style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: D.neon, letterSpacing: '0.2em', fontVariantNumeric: 'tabular-nums' }}>
          {num} / {String(TOTAL_SLIDES).padStart(2,'0')}
        </span>
        <span style={{ fontSize: 10, color: D.textSub, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>{label}</span>
      </div>
      <h2 style={{ fontSize: 'clamp(20px,2.6vw,30px)', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
        {title}
      </h2>
      <div style={{ width: 36, height: 2, background: D.neon, borderRadius: 2, marginTop: 10, boxShadow: `0 0 8px ${D.neon}` }} />
    </motion.div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: D.card, border: `1px solid ${D.neon}33`, borderRadius: 8,
      padding: '7px 12px', fontSize: 12, boxShadow: `0 4px 20px #00000088` }}>
      <span style={{ color: D.neon, fontWeight: 700 }}>{payload[0].name}</span>
      <span style={{ color: D.text, marginLeft: 8 }}>{payload[0].value}%</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SLIDE 1 — TITLE
// ═══════════════════════════════════════════════════════════════
function Slide1_Title() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100%', gap:36, textAlign:'center', padding:'0 32px' }}>
      {/* Tags */}
      <motion.div variants={fadeUp} style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {['2026 투자학교','Q2 STRATEGY BRIEF','Get Rich Slowly'].map(t => (
          <span key={t} style={{ fontSize:11, fontWeight:700, color:D.neon,
            border:`1px solid ${D.neon}44`, borderRadius:20, padding:'4px 14px', letterSpacing:'0.09em' }}>{t}</span>
        ))}
      </motion.div>
      {/* Headline */}
      <motion.div variants={fadeUp}>
        <p style={{ fontSize:11, color:D.blue, fontWeight:700, letterSpacing:'0.22em',
          textTransform:'uppercase', margin:'0 0 16px' }}>VALKYRIE MASTER STRATEGY</p>
        <h1 style={{ fontSize:'clamp(34px,5.5vw,64px)', fontWeight:900, color:'#f8fafc',
          margin:'0 0 14px', letterSpacing:'-2px', lineHeight:1.03 }}>
          발키리<br/><span style={{ color:D.neon }}>포트폴리오 전략</span>
        </h1>
        <p style={{ fontSize:14, color:D.textSub, margin:0, fontWeight:500 }}>
          Core-Satellite 자산배분 모델 · 2026 Q2
        </p>
      </motion.div>
      {/* KPI */}
      <motion.div variants={fadeUp} style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
        {[
          { label:'전략 포트폴리오', v:STRATEGY_AMT,            c:D.neon   },
          { label:'전략 종목',       v:`${STRATEGY_STOCKS}개`,  c:D.blue   },
          { label:'슬라이드',        v:'5 Decks',               c:D.indigo },
        ].map(k => (
          <div key={k.label} style={{ background:D.cardHi, border:`1px solid ${k.c}22`,
            borderRadius:14, padding:'16px 28px', minWidth:138, textAlign:'center' }}>
            <div style={{ fontSize:10, color:D.textSub, fontWeight:700, letterSpacing:'0.12em', marginBottom:8 }}>
              {k.label.toUpperCase()}
            </div>
            <div style={{ fontSize:24, fontWeight:900, color:k.c }}>{k.v}</div>
          </div>
        ))}
      </motion.div>
      <motion.p variants={fadeUp} style={{ fontSize:12, color:D.textDim }}>
        ← / → 키 또는 하단 버튼으로 이동
      </motion.p>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SLIDE 2 — ASSET PHILOSOPHY
// ═══════════════════════════════════════════════════════════════
function Slide2_Philosophy({
  corePct, satPct, coreStocks, satelliteStocks,
}: {
  corePct: number; satPct: number
  coreStocks: string[]; satelliteStocks: string[]
}) {
  const EMPTY_MSG = '전략 리포트를 참조하세요'

  const cols = [
    {
      key: 'Core', pct: corePct, color: '#3b82f6',
      items: coreStocks.filter(s => s.trim()),
    },
    {
      key: 'Satellite', pct: satPct, color: D.neon,
      items: satelliteStocks.filter(s => s.trim()),
    },
  ]
  const principles = [
    { icon:'⚖️', title:'리스크 균형',   desc:'Core로 하방을 방어\nSatellite로 알파 추구' },
    { icon:'🔄', title:'분기 리밸런싱', desc:'비중 이탈 ±5% 이상\n즉각 조정 실행' },
    { icon:'📈', title:'장기 복리',     desc:'"Get Rich Slowly"\n꾸준한 복리 누적' },
  ]
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      style={{ display:'flex', flexDirection:'column', gap:20, height:'100%', overflow:'auto' }}>
      <SlideHeader num="02" label="Asset Allocation" title="Core-Satellite 자산배분 철학" />
      <motion.div variants={fadeUp} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, flex:1 }}>
        {cols.map(c => (
          <div key={c.key} style={{ background:D.cardHi, border:`1px solid ${c.color}22`,
            borderRadius:16, padding:22 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:c.color, boxShadow:`0 0 8px ${c.color}88` }} />
              <span style={{ fontSize:17, fontWeight:900, color:c.color }}>{c.key}</span>
              <span style={{ fontSize:22, fontWeight:900, color:c.color, marginLeft:'auto' }}>{c.pct}%</span>
            </div>
            {c.items.length > 0 ? (
              c.items.map(i => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'flex-start' }}>
                  <span style={{ color:c.color, fontSize:10, marginTop:3, flexShrink:0 }}>▸</span>
                  <span style={{ fontSize:12, color:D.text, lineHeight:1.5 }}>{i}</span>
                </div>
              ))
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8,
                padding:'10px 12px', borderRadius:8, background:`${c.color}08`,
                border:`1px dashed ${c.color}33` }}>
                <FileText size={13} style={{ color:c.color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:D.textSub, fontStyle:'italic' }}>{EMPTY_MSG}</span>
              </div>
            )}
          </div>
        ))}
      </motion.div>
      <motion.div variants={fadeUp} style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {principles.map(p => (
          <div key={p.title} style={{ background:D.neonGlow, border:`1px solid ${D.neon}20`,
            borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{p.icon}</div>
            <div style={{ fontSize:12, fontWeight:700, color:D.neon, marginBottom:4 }}>{p.title}</div>
            <div style={{ fontSize:11, color:D.textSub, whiteSpace:'pre-line', lineHeight:1.6 }}>{p.desc}</div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SLIDE 3 — CAPITAL STRUCTURE
// ═══════════════════════════════════════════════════════════════
function Slide3_Capital({ corePct, satPct }: { corePct:number; satPct:number }) {
  const donutA = [
    { name:'Core',      value:corePct, color:'#3b82f6' },
    { name:'Satellite', value:satPct,  color:D.neon    },
  ]
  const donutB = [
    { name:'국내 ETF',   value:31, color:D.blue    },
    { name:'해외 ETF',   value:28, color:D.neon    },
    { name:'국내 개별주', value:24, color:D.indigo  },
    { name:'해외 개별주', value:11, color:D.gold    },
    { name:'코인·대체',  value: 6, color:'#fb923c' },
  ]
  const RADIAN = Math.PI / 180
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PctLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,value }:any) => {
    if (value < 7) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    return (
      <text x={cx + r*Math.cos(-midAngle*RADIAN)} y={cy + r*Math.sin(-midAngle*RADIAN)}
        fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>{value}%</text>
    )
  }
  const stat = [
    { l:'ETF 비중',  v:'59%', c:D.neon    },
    { l:'개별주',    v:'35%', c:D.blue    },
    { l:'대체자산',  v:'6%',  c:D.gold    },
    { l:'전략 종목', v:`${STRATEGY_STOCKS}개`, c:D.indigo },
  ]
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      style={{ display:'flex', flexDirection:'column', gap:18, height:'100%' }}>
      <SlideHeader num="03" label="Capital Structure" title="자산 구조 분석" />
      <motion.div variants={fadeUp}
        style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, flex:1, minHeight:0 }}>
        {[
          { title:'CORE vs SATELLITE', data:donutA, border:'#3b82f6' },
          { title:'자산군 비중',        data:donutB, border:D.neon     },
        ].map(chart => (
          <div key={chart.title} style={{ background:D.cardHi, border:`1px solid ${chart.border}18`,
            borderRadius:16, padding:18, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <p style={{ fontSize:11, color:D.textSub, fontWeight:700, margin:'0 0 6px' }}>{chart.title}</p>
            <ResponsiveContainer width="100%" height={185}>
              <PieChart>
                <Pie data={chart.data} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value" labelLine={false} label={<PctLabel />}>
                  {chart.data.map((d,i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<DarkTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginTop:4 }}>
              {chart.data.map(d => (
                <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:d.color }} />
                  <span style={{ fontSize:10, color:D.text }}>{d.name}</span>
                  <span style={{ fontSize:10, color:d.color, fontWeight:700 }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
      <motion.div variants={fadeUp}
        style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {stat.map(s => (
          <div key={s.l} style={{ background:`${s.c}0b`, border:`1px solid ${s.c}25`,
            borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:D.textSub, fontWeight:700, marginBottom:4 }}>{s.l.toUpperCase()}</div>
            <div style={{ fontSize:20, fontWeight:900, color:s.c }}>{s.v}</div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SLIDE 4 — SECTOR ALLOCATION
// ═══════════════════════════════════════════════════════════════
function Slide4_Sector({ sectorData }: { sectorData: SectorRow[] }) {
  const barData = sectorData.map((d,i) => ({ ...d, fill: SECTOR_PALETTE[i % SECTOR_PALETTE.length] }))
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      style={{ display:'flex', flexDirection:'column', gap:18, height:'100%' }}>
      <SlideHeader num="04" label="Sector Allocation" title="섹터 비중 배분" />
      <motion.div variants={fadeUp}
        style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:16, flex:1, minHeight:0 }}>
        {/* Bar chart */}
        <div style={{ background:D.cardHi, border:`1px solid ${D.neon}18`, borderRadius:16, padding:'18px 10px 18px 16px' }}>
          <p style={{ fontSize:11, color:D.textSub, fontWeight:700, margin:'0 0 10px' }}>섹터별 비중 (%)</p>
          <ResponsiveContainer width="100%" height={Math.max(200, sectorData.length * 36)}>
            <BarChart data={barData} layout="vertical" margin={{ left:2, right:38, top:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
              <XAxis type="number" domain={[0,Math.ceil((Math.max(...sectorData.map(d=>d.value))+5)/5)*5]}
                tick={{ fill:D.textSub, fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:D.text, fontSize:11 }}
                axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<DarkTip />} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {barData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                <LabelList dataKey="value" position="right"
                  style={{ fill:D.textSub, fontSize:11 }} formatter={(v:unknown) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Sector cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:7, overflowY:'auto' }}>
          {sectorData.map((d,i) => {
            const col = SECTOR_PALETTE[i % SECTOR_PALETTE.length]
            return (
              <div key={d.name} style={{ background:D.cardHi, border:`1px solid ${col}18`,
                borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:`${col}18`,
                  border:`1px solid ${col}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:14, fontWeight:900, color:col }}>{d.value}</span>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:col }}>{d.name}</div>
                  <div style={{ fontSize:10, color:D.textSub }}>포트폴리오 비중 {d.value}%</div>
                </div>
                <div style={{ marginLeft:'auto' }}>
                  <div style={{ width: `${Math.round(d.value * 1.8)}px`, height:4, borderRadius:2, background:col, minWidth:4, maxWidth:60 }} />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SLIDE 5 — ROADMAP
// ═══════════════════════════════════════════════════════════════
function Slide5_Roadmap() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      style={{ display:'flex', flexDirection:'column', gap:18, height:'100%' }}>
      <SlideHeader num="05" label="Roadmap" title="전략 이행 로드맵" />
      <motion.div variants={fadeUp}
        style={{ flex:1, position:'relative', padding:'0 0 0 34px', overflowY:'auto' }}>
        {/* 세로선 */}
        <div style={{ position:'absolute', left:14, top:10, bottom:10, width:2,
          background:`linear-gradient(to bottom, ${D.neon}, ${D.neon}15)` }} />
        {ROADMAP.map((step,idx) => (
          <div key={step.q} style={{ position:'relative', marginBottom:16 }}>
            {/* 점 */}
            <div style={{ position:'absolute', left:-26, top:14, width:14, height:14, borderRadius:'50%',
              background: step.done ? D.neon : D.card,
              border:`2px solid ${step.done ? D.neon : D.muted}`,
              boxShadow: step.done ? `0 0 12px ${D.neon}99` : 'none',
              transition:'all 0.3s' }} />
            <div style={{ background: step.done ? D.neonGlow : D.cardHi,
              border:`1px solid ${step.done ? D.neon+'28' : D.border}`,
              borderRadius:14, padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:700,
                  color: step.done ? D.neon : D.textSub,
                  border:`1px solid ${step.done ? D.neon+'44' : D.border}`,
                  borderRadius:6, padding:'2px 10px' }}>{step.q}</span>
                <span style={{ fontSize:13, fontWeight:800,
                  color: step.done ? D.text : D.textSub }}>{step.title}</span>
                {step.done && <Badge color={D.neon}>✓ 완료</Badge>}
                {!step.done && idx===2 && <Badge color={D.gold}>진행 예정</Badge>}
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {step.items.map(item => (
                  <div key={item} style={{ display:'flex', alignItems:'center', gap:5,
                    fontSize:12, color: step.done ? D.text : D.textSub }}>
                    <span style={{ fontSize:8, color: step.done ? D.neon : D.muted }}>◆</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </motion.div>
      {/* Quote */}
      <motion.div variants={fadeUp} style={{ background:D.neonGlow, border:`1px solid ${D.neon}1e`,
        borderRadius:12, padding:'14px 20px', textAlign:'center' }}>
        <p style={{ fontSize:14, fontWeight:700, color:D.neon, fontStyle:'italic', margin:'0 0 5px' }}>
          &ldquo;좋은 투자는 항상 근거가 명확하다. 숫자로 설명할 수 없는 투자는 하지 않는다.&rdquo;
        </p>
        <p style={{ fontSize:11, color:D.textSub, margin:0 }}>— 2026 투자학교 교장</p>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN UPDATE MODAL
// ═══════════════════════════════════════════════════════════════
function AdminModal({
  config, onClose, onSaved, onSavedWithMsg,
}: {
  config: StrategyConfig
  onClose: () => void
  onSaved: (c: StrategyConfig) => void
  onSavedWithMsg?: (msg: string) => void
}) {
  const [corePct,       setCorePct]       = useState(String(config.core_pct))
  const [satPct,        setSatPct]        = useState(String(config.satellite_pct))
  const [sectors,       setSectors]       = useState<SectorRow[]>(
    config.sector_data.length ? config.sector_data : [{ name:'', value:0 }]
  )
  // 추천 종목 — 빈 행 1개 보장
  const [coreStocks,    setCoreStocks]    = useState<string[]>(
    config.core_stocks?.length ? config.core_stocks : ['']
  )
  const [satStocks,     setSatStocks]     = useState<string[]>(
    config.satellite_stocks?.length ? config.satellite_stocks : ['']
  )
  const [pdfFile,    setPdfFile]    = useState<File | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [err,        setErr]        = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pdfStatus,  setPdfStatus]  = useState<'idle'|'uploading'|'ok'|'error'>('idle')
  // 현재 DB에 저장된 pdf_url을 로컬 상태로 관리 (삭제 시 즉시 반영)
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(config.pdf_url)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalPct = sectors.reduce((s, r) => s + (Number(r.value) || 0), 0)

  /* ── 섹터 행 조작 ── */
  const addRow    = () => setSectors(prev => [...prev, { name:'', value:0 }])
  const removeRow = (i: number) => setSectors(prev => prev.filter((_,idx) => idx !== i))
  const updateRow = (i: number, field: keyof SectorRow, val: string) =>
    setSectors(prev => prev.map((r,idx) => idx===i ? { ...r, [field]: field==='value' ? (parseFloat(val)||0) : val } : r))

  /* ── 표시용 파일명 추출 헬퍼
   *  1순위: DB의 pdf_display_name (원본 한글명)
   *  2순위: URL에서 추출 (타임스탬프 기반 storage key)
   * ── */
  const extractFileName = (url: string): string => {
    if (config.pdf_display_name) return config.pdf_display_name
    try {
      const raw = url.split('/').pop() ?? ''
      return decodeURIComponent(raw)
    } catch { return url.split('/').pop() ?? '' }
  }

  /* ── 현재 PDF 삭제 ── */
  const handleDeletePdf = async () => {
    if (!currentPdfUrl) return
    const fname = currentPdfUrl.split('/').pop() ?? ''
    const displayName = (() => { try { return decodeURIComponent(fname) } catch { return fname } })()

    if (!window.confirm(`"${displayName}" 파일을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return

    setDeleting(true); setErr(null); setSuccessMsg(null)
    try {
      const sb = createClient()

      // ① Storage에서 물리적 삭제
      const { error: storageErr } = await sb.storage
        .from('strategy-pdf')
        .remove([fname])

      // Storage 에러는 경고만 (파일이 이미 없어도 DB는 정리)
      if (storageErr) {
        console.warn('[Strategy] Storage delete warning:', storageErr.message)
      }

      // ② DB pdf_url → null
      const { error: dbErr } = await sb.from('strategy_configs')
        .update({ pdf_url: null, updated_at: new Date().toISOString() })
        .eq('id', 'singleton')

      if (dbErr) throw new Error(`DB 업데이트 실패: ${dbErr.message}`)

      // ③ 로컬 상태 초기화
      setCurrentPdfUrl(null)
      setPdfFile(null)
      setPdfStatus('idle')
      onSaved({ ...config, pdf_url: null })
      setSuccessMsg(`"${displayName}" 파일이 삭제되었습니다.`)

    } catch (e) {
      setErr(`삭제 실패: ${(e as Error).message}`)
      console.error('[Strategy] delete error:', e)
    } finally {
      setDeleting(false)
    }
  }

  /* ── PDF 에러 → 한국어 메시지 변환 ── */
  const translateStorageError = (msg: string): string => {
    const m = msg.toLowerCase()
    if (m.includes('bucket not found') || m.includes('bucketnotfound'))
      return 'Storage 버킷이 없습니다. 아래 "버킷 생성 안내"를 참고해 주세요.'
    if (m.includes('row-level security') || m.includes('42501') || m.includes('not authorized'))
      return 'Storage 업로드 권한이 없습니다. Supabase Storage → Policies에서 INSERT 정책을 추가하세요.'
    if (m.includes('payload too large') || m.includes('file size') || m.includes('maxfilesize'))
      return '파일이 너무 큽니다. 50MB 이하의 PDF만 업로드 가능합니다.'
    if (m.includes('invalid mime') || m.includes('content-type'))
      return '올바른 PDF 파일이 아닙니다. .pdf 파일만 업로드 가능합니다.'
    if (m.includes('duplicate') || m.includes('already exists'))
      return '같은 이름의 파일이 이미 존재합니다. (upsert:true 옵션으로 자동 덮어씌워야 정상)'
    if (m.includes('invalid key') || m.includes('invalid path'))
      return '파일명에 허용되지 않는 문자가 포함되어 있습니다. 공백이나 특수문자를 제거 후 다시 시도해주세요.'
    return `업로드 실패: ${msg}`
  }

  /* ── 저장 ── */
  const handleSave = async () => {
    setErr(null); setPdfStatus('idle')
    const validSectors = sectors.filter(r => r.name.trim() && r.value > 0)
    if (!validSectors.length) { setErr('최소 1개 이상의 유효한 섹터를 입력하세요'); return }
    setSaving(true)

    try {
      const sb = createClient()

      // ── ① 선생님 세션 확인 ────────────────────────────────────
      const { data:{ user } } = await sb.auth.getUser()
      if (!user) {
        setErr('로그인 세션이 만료됐습니다. 페이지를 새로고침 후 다시 시도해주세요.')
        setSaving(false); return
      }

      // ── ② PDF 업로드 ──────────────────────────────────────────
      let pdfUrl = currentPdfUrl   // 현재 로컬 상태 기준
      if (pdfFile) {
        // 사전 유효성 검사
        if (pdfFile.size > 50 * 1024 * 1024) {
          setErr('파일이 너무 큽니다. 50MB 이하의 PDF만 업로드 가능합니다.')
          setSaving(false); return
        }
        if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
          setErr('.pdf 파일만 업로드 가능합니다.')
          setSaving(false); return
        }

        // ── Storage 저장 키: 공백 → 언더스코어 (S3 규칙상 공백 불가)
        //    한글·특수문자는 그대로 유지 (Supabase가 내부 인코딩 처리)
        // ── Storage key: ASCII 타임스탬프 기반 (한글·공백 포함 파일명은 SDK가 거부)
        //    원본 파일명은 pdf_display_name 컬럼에 별도 저장하여 UI에 표시
        const newFname = `strategy_${Date.now()}.pdf`
        setPdfStatus('uploading')
        setSuccessMsg(null)

        // ── 기존 파일이 있고 이름이 다를 경우 → 자동 삭제
        if (currentPdfUrl) {
          const oldFname = currentPdfUrl.split('/').pop() ?? ''
          if (oldFname && oldFname !== encodeURIComponent(newFname) && oldFname !== newFname) {
            console.log('[Strategy] Deleting old file:', oldFname)
            await sb.storage.from('strategy-pdf').remove([oldFname])
            // 삭제 실패는 무시 (신규 업로드 계속 진행)
          }
        }

        // ── 1차 업로드 시도 (upsert:false → 중복 감지)
        const { error: checkErr } = await sb.storage
          .from('strategy-pdf')
          .upload(newFname, pdfFile, {
            upsert:      false,
            contentType: 'application/pdf',
            cacheControl:'3600',
          })

        if (checkErr) {
          const isDuplicate =
            checkErr.message.toLowerCase().includes('already exists') ||
            checkErr.message.toLowerCase().includes('duplicate') ||
            checkErr.message.includes('23505') ||
            checkErr.message.includes('409')

          if (isDuplicate) {
            // 동일 파일명 → 덮어쓰기 확인
            const oldDisplayName = (() => {
              try { return decodeURIComponent(newFname) } catch { return newFname }
            })()
            const ok = window.confirm(
              `"${oldDisplayName}" 파일이 이미 존재합니다.\n기존 파일을 덮어쓰시겠습니까?`
            )
            if (!ok) { setPdfStatus('idle'); setSaving(false); return }

            const { error: overwriteErr } = await sb.storage
              .from('strategy-pdf')
              .upload(newFname, pdfFile, {
                upsert:      true,
                contentType: 'application/pdf',
                cacheControl:'3600',
              })
            if (overwriteErr) {
              setPdfStatus('error')
              setErr(translateStorageError(overwriteErr.message))
              console.error('[Strategy] overwrite error:', overwriteErr)
              setSaving(false); return
            }
          } else {
            setPdfStatus('error')
            setErr(translateStorageError(checkErr.message))
            console.error('[Strategy] upload error:', checkErr)
            setSaving(false); return
          }
        }

        // ── Public URL 생성 (한글 포함 시 SDK가 인코딩 처리)
        const { data: pubData } = sb.storage
          .from('strategy-pdf')
          .getPublicUrl(newFname)
        pdfUrl = pubData.publicUrl
        setCurrentPdfUrl(pdfUrl)
        setPdfStatus('ok')
        console.log('[Strategy] PDF uploaded OK:', pdfUrl)
      }

      const validCoreStocks = coreStocks.map(s => s.trim()).filter(Boolean)
      const validSatStocks  = satStocks.map(s => s.trim()).filter(Boolean)

      // ── ③ DB upsert — core_stocks/satellite_stocks + pdf_display_name 포함 ──
      const pdfDisplayName = pdfFile ? pdfFile.name : currentPdfUrl
        ? (config.pdf_display_name ?? extractFileName(currentPdfUrl))
        : null

      const fullPayload = {
        id:               'singleton',
        core_pct:         parseInt(corePct)  || 48,
        satellite_pct:    parseInt(satPct)   || 52,
        sector_data:      validSectors,
        core_stocks:      validCoreStocks,
        satellite_stocks: validSatStocks,
        pdf_url:          pdfUrl,
        pdf_display_name: pdfDisplayName,    // 원본 파일명 (한글 포함 가능)
        updated_at:       new Date().toISOString(),
      }

      let { error: dbErr } = await sb.from('strategy_configs')
        .upsert(fullPayload, { onConflict: 'id' })

      // PGRST204: 컬럼 없음 → 컬럼 제외 fallback 저장
      if (dbErr?.code === 'PGRST204') {
        console.warn('[Strategy] Missing columns — fallback save without stocks')
        const res = await sb.from('strategy_configs').upsert({
          id:            'singleton',
          core_pct:      parseInt(corePct)  || 48,
          satellite_pct: parseInt(satPct)   || 52,
          sector_data:   validSectors,
          pdf_url:       pdfUrl,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'id' })
        dbErr = res.error
        if (!dbErr) {
          setErr('⚠️ 기본 데이터는 저장됐습니다. 추천 종목 저장을 위해 Supabase SQL Editor에서 아래를 실행하세요:\n\nALTER TABLE strategy_configs ADD COLUMN IF NOT EXISTS core_stocks jsonb DEFAULT \'[]\', ADD COLUMN IF NOT EXISTS satellite_stocks jsonb DEFAULT \'[]\';')
          onSaved({ core_pct:parseInt(corePct)||48, satellite_pct:parseInt(satPct)||52, sector_data:validSectors, core_stocks:[], satellite_stocks:[], pdf_url:pdfUrl, pdf_display_name:pdfDisplayName })
          setSaving(false); return
        }
      }

      // 42501: RLS 권한 없음
      if (dbErr?.code === '42501') {
        console.error('[Strategy] RLS error:', dbErr)
        setErr('DB 권한 오류 (42501): 선생님 계정으로 로그인됐는지 확인하세요.')
        setSaving(false); return
      }

      if (dbErr) {
        console.error('[Strategy] DB error:', dbErr)
        throw new Error(`DB 저장 실패 [${dbErr.code}]: ${dbErr.message}`)
      }

      // ── ④ 성공 ───────────────────────────────────────────────
      const savedFileName = pdfFile ? pdfFile.name : null  // 원본 파일명(공백 포함)
      onSaved({ core_pct:parseInt(corePct)||48, satellite_pct:parseInt(satPct)||52, sector_data:validSectors, core_stocks:validCoreStocks, satellite_stocks:validSatStocks, pdf_url:pdfUrl, pdf_display_name:pdfDisplayName })
      // 파일 업로드가 있었으면 성공 메시지를 페이지에 전달
      if (savedFileName) {
        onSavedWithMsg?.(`✅ "${savedFileName}" 파일이 성공적으로 배포되었습니다.`)
      }
      onClose()

    } catch (e) {
      console.error('[Strategy] handleSave fatal:', e)
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /* ── input 공용 스타일 ── */
  const iStyle: React.CSSProperties = {
    background:D.card, border:`1px solid ${D.border}`, borderRadius:8,
    padding:'9px 12px', color:D.text, fontSize:13, outline:'none',
    width:'100%', boxSizing:'border-box',
    transition:'border-color 0.2s',
  }
  const Label = ({ t }: { t:string }) => (
    <span style={{ fontSize:10, fontWeight:700, color:D.textSub, letterSpacing:'0.1em',
      display:'block', marginBottom:6 }}>{t.toUpperCase()}</span>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:9000, padding:20, backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity:0, scale:0.94, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.94, y:20 }} transition={{ duration:0.28, ease:'easeOut' }}
        style={{ background:D.surface, border:`1px solid ${D.neon}28`, borderRadius:22,
          padding:32, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto',
          boxShadow:`0 24px 80px rgba(0,0,0,0.8), 0 0 60px ${D.neon}08` }}>

        {/* ── 헤더 ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
          <div>
            <p style={{ fontSize:10, color:D.neon, fontWeight:700, letterSpacing:'0.16em', margin:'0 0 4px' }}>
              ADMIN · STRATEGY UPDATE
            </p>
            <h3 style={{ fontSize:20, fontWeight:900, color:'#f8fafc', margin:0 }}>전략 데이터 업데이트</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${D.border}`,
            borderRadius:8, color:D.textSub, cursor:'pointer', padding:'6px 8px', lineHeight:1,
            display:'flex', alignItems:'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

          {/* ── Core / Satellite ── */}
          <div>
            <Label t="자산 배분 비율 (%)" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'Core', val:corePct, set:setCorePct, color:'#3b82f6' },
                { label:'Satellite', val:satPct, set:setSatPct, color:D.neon },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize:11, color:f.color, fontWeight:700, marginBottom:5 }}>{f.label}</div>
                  <div style={{ position:'relative' }}>
                    <input type="number" value={f.val} onChange={e=>f.set(e.target.value)}
                      min={0} max={100} style={{ ...iStyle, paddingRight:28 }} />
                    <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      fontSize:13, color:f.color, fontWeight:700, pointerEvents:'none' }}>%</span>
                  </div>
                </div>
              ))}
            </div>
            {(parseInt(corePct)||0)+(parseInt(satPct)||0) !== 100 && (
              <p style={{ fontSize:11, color:D.gold, marginTop:6 }}>
                ⚠️ Core + Satellite = {(parseInt(corePct)||0)+(parseInt(satPct)||0)}% (권장: 100%)
              </p>
            )}
          </div>

          {/* ── 섹터 비주얼 행 관리 ── */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <Label t="섹터 비중 관리" />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color: totalPct===100 ? D.neon : D.gold, fontWeight:700 }}>
                  합계 {totalPct}%
                </span>
                <button onClick={addRow}
                  style={{ display:'flex', alignItems:'center', gap:4, background:D.neonGlow,
                    border:`1px solid ${D.neon}44`, borderRadius:7, color:D.neon,
                    fontSize:11, fontWeight:700, cursor:'pointer', padding:'5px 10px' }}>
                  <Plus size={12} /> 섹터 추가
                </button>
              </div>
            </div>
            {/* 컬럼 헤더 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 36px', gap:8, marginBottom:8 }}>
              {['섹터명','비중(%)',''].map((h,i) => (
                <span key={i} style={{ fontSize:10, color:D.textSub, fontWeight:700, letterSpacing:'0.08em' }}>
                  {h.toUpperCase()}
                </span>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:240, overflowY:'auto' }}>
              {sectors.map((row, i) => {
                const col = SECTOR_PALETTE[i % SECTOR_PALETTE.length]
                return (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 90px 36px', gap:8, alignItems:'center' }}>
                    {/* 섹터명 */}
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                        width:7, height:7, borderRadius:'50%', background:col, flexShrink:0 }} />
                      <input value={row.name} onChange={e=>updateRow(i,'name',e.target.value)}
                        placeholder="섹터명 입력" style={{ ...iStyle, paddingLeft:24 }} />
                    </div>
                    {/* 비중 */}
                    <div style={{ position:'relative' }}>
                      <input type="number" value={row.value || ''} onChange={e=>updateRow(i,'value',e.target.value)}
                        min={0} max={100} placeholder="0" style={{ ...iStyle, paddingRight:24, textAlign:'right' as const }} />
                      <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                        fontSize:11, color:col, fontWeight:700, pointerEvents:'none' }}>%</span>
                    </div>
                    {/* 삭제 */}
                    <button onClick={()=>removeRow(i)} disabled={sectors.length<=1}
                      style={{ width:34, height:34, borderRadius:8, border:`1px solid ${D.border}`,
                        background:'none', color: sectors.length<=1 ? D.textDim : D.red,
                        cursor: sectors.length<=1 ? 'not-allowed' : 'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                      <Minus size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 추천 종목 입력 ── */}
          {[
            { label:'추천 코어(Core) 종목',      stocks:coreStocks,  setStocks:setCoreStocks,  color:'#3b82f6' },
            { label:'추천 새틀라이트(Sat.) 종목', stocks:satStocks,   setStocks:setSatStocks,   color:D.neon    },
          ].map(({ label, stocks, setStocks, color }) => (
            <div key={label}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <Label t={label} />
                <button
                  onClick={() => setStocks(prev => [...prev, ''])}
                  style={{ display:'flex', alignItems:'center', gap:4, background:`${color}15`,
                    border:`1px solid ${color}44`, borderRadius:7, color, fontSize:11,
                    fontWeight:700, cursor:'pointer', padding:'4px 9px' }}>
                  <Plus size={11} /> 종목 추가
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:180, overflowY:'auto' }}>
                {stocks.map((stock, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 36px', gap:8, alignItems:'center' }}>
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                        width:6, height:6, borderRadius:'50%', background:color }} />
                      <input
                        value={stock}
                        onChange={e => setStocks(prev => prev.map((s,idx) => idx===i ? e.target.value : s))}
                        placeholder={`예) 삼성전자, TIGER 200 ETF`}
                        style={{ ...iStyle, paddingLeft:24 }} />
                    </div>
                    <button
                      onClick={() => setStocks(prev => prev.length > 1 ? prev.filter((_,idx) => idx!==i) : [''])}
                      style={{ width:34, height:34, borderRadius:8, border:`1px solid ${D.border}`,
                        background:'none', color: stocks.length <= 1 ? D.textDim : D.red,
                        cursor: stocks.length <= 1 ? 'not-allowed' : 'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                      <Minus size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:10, color:D.textSub, margin:'5px 0 0' }}>
                미입력 시 슬라이드에 &ldquo;전략 리포트를 참조하세요&rdquo; 문구가 표시됩니다.
              </p>
            </div>
          ))}

          {/* ── PDF 파일 관리 ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Label t="전략 리포트 PDF" />
              {currentPdfUrl && (
                <span style={{ fontSize:10, color:D.green, fontWeight:600 }}>● 파일 등록됨</span>
              )}
            </div>

            {/* 현재 등록된 파일 표시 + 삭제 버튼 */}
            {currentPdfUrl && (
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                background:`${D.blue}0c`, border:`1px solid ${D.blue}28`,
                borderRadius:10, padding:'10px 14px',
              }}>
                <FileText size={16} style={{ color:D.blue, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:D.text,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                    {extractFileName(currentPdfUrl)}
                  </div>
                  <div style={{ fontSize:10, color:D.textSub, marginTop:2 }}>
                    현재 학생들에게 배포 중인 파일
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {/* 미리보기 */}
                  <a href={currentPdfUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px',
                      borderRadius:6, background:`${D.indigo}15`, border:`1px solid ${D.indigo}33`,
                      color:D.indigo, fontSize:11, fontWeight:600, textDecoration:'none' }}>
                    <Download size={11}/> 확인
                  </a>
                  {/* 삭제 */}
                  <button onClick={handleDeletePdf} disabled={deleting}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px',
                      borderRadius:6, background:'rgba(248,113,113,0.08)',
                      border:'1px solid rgba(248,113,113,0.3)',
                      color:D.red, fontSize:11, fontWeight:600,
                      cursor:deleting?'not-allowed':'pointer' }}>
                    <X size={11}/> {deleting ? '삭제 중…' : '삭제'}
                  </button>
                </div>
              </div>
            )}

            {/* 새 파일 선택 */}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }}
              onChange={e => { setPdfFile(e.target.files?.[0] ?? null); setPdfStatus('idle'); setErr(null); setSuccessMsg(null) }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ display:'flex', alignItems:'center', gap:8, background:D.card,
                border:`1px solid ${
                  pdfStatus==='ok'    ? D.neon+'66' :
                  pdfStatus==='error' ? D.red+'66'  :
                  pdfFile             ? D.neon+'44' : D.border
                }`,
                borderRadius:8, padding:'10px 16px',
                color: pdfStatus==='error' ? D.red : pdfFile ? D.neon : D.textSub,
                fontSize:12, cursor:'pointer', width:'100%', textAlign:'left' as const }}>
              <Upload size={14} />
              {pdfFile
                ? `📄 ${pdfFile.name} (${(pdfFile.size/1024/1024).toFixed(1)}MB)`
                : currentPdfUrl ? '🔄 다른 파일로 교체…' : '📂 PDF 파일 선택… (최대 50MB)'}
            </button>

            {/* 선택된 신규 파일 안내 */}
            {pdfFile && (
              <div style={{ fontSize:10, color:D.textSub, lineHeight:1.6,
                background:`${D.neon}08`, border:`1px solid ${D.neon}18`,
                borderRadius:6, padding:'7px 10px' }}>
                <span style={{ color:D.neon, fontWeight:700 }}>&ldquo;{pdfFile.name}&rdquo;</span>을 원본 파일명 그대로 저장합니다.
                {currentPdfUrl && extractFileName(currentPdfUrl) !== pdfFile.name && (
                  <span style={{ color:D.gold }}> 기존 파일은 자동으로 삭제됩니다.</span>
                )}
              </div>
            )}
          </div>

          {/* ── 성공 메시지 ── */}
          {successMsg && (
            <div style={{ background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.3)',
              borderRadius:8, padding:'10px 14px', fontSize:12, color:D.green }}>
              {successMsg}
            </div>
          )}

          {/* ── 에러 ── */}
          {err && (
            <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.3)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:D.red,
              whiteSpace:'pre-wrap' as const, lineHeight:1.6 }}>
              {err.includes('버킷') && (
                <div style={{ marginBottom:10, paddingBottom:10, borderBottom:'1px solid rgba(248,113,113,0.2)' }}>
                  <strong>📋 버킷 생성 방법:</strong><br/>
                  1. Supabase Dashboard → Storage → New bucket<br/>
                  2. Bucket name: <code style={{ background:'rgba(255,255,255,0.1)', padding:'1px 5px', borderRadius:3 }}>strategy-pdf</code><br/>
                  3. Public bucket: ✅ 체크 후 Save<br/>
                  4. SQL Editor에서 Storage 정책 추가
                </div>
              )}
              {err}
            </div>
          )}

          {/* ── 버튼 ── */}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:10,
              background:'transparent', border:`1px solid ${D.border}`,
              color:D.textSub, fontSize:13, fontWeight:700, cursor:'pointer' }}>취소</button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, padding:'12px', borderRadius:10, display:'flex',
                alignItems:'center', justifyContent:'center', gap:8,
                background: saving ? D.neonGlow : `${D.neon}22`,
                border:`1px solid ${saving ? D.neon+'33' : D.neon+'55'}`,
                color: saving ? D.textSub : D.neon,
                fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ 저장 중…' : <><FileText size={14}/> 저장 & 배포</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MasterStrategyPage() {
  const [[slide, dir], setSlideDir] = useState([0, 0])
  const [config,  setConfig]  = useState<StrategyConfig>(DEFAULT_CONFIG)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3500)
  }

  /* ── DB 초기화 ── */
  useEffect(() => {
    ;(async () => {
      const sb = createClient()
      const { data:{ user } } = await sb.auth.getUser()
      if (!user) return
      const { data:prof } = await sb.from('profiles').select('role').eq('id',user.id).single()
      setIsAdmin(prof?.role === 'teacher')
      const { data:row } = await sb.from('strategy_configs').select('*').eq('id','singleton').single()
      if (row) setConfig(row as StrategyConfig)
    })()
  }, [])

  /* ── 키보드 네비 ── */
  const goTo = useCallback((next: number) => {
    const n = Math.max(0, Math.min(TOTAL_SLIDES-1, next))
    if (n === slide) return
    setSlideDir([n, n > slide ? 1 : -1])
  }, [slide])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key==='ArrowRight'||e.key==='ArrowDown') goTo(slide+1)
      if (e.key==='ArrowLeft' ||e.key==='ArrowUp')   goTo(slide-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [slide, goTo])

  const TABS = ['🏹 Title','⚖️ Philosophy','🍩 Structure','📊 Sectors','🗺️ Roadmap']

  const renderSlide = (s: number) => {
    switch (s) {
      case 0: return <Slide1_Title />
      case 1: return <Slide2_Philosophy
                  corePct={config.core_pct} satPct={config.satellite_pct}
                  coreStocks={config.core_stocks ?? []} satelliteStocks={config.satellite_stocks ?? []} />
      case 2: return <Slide3_Capital    corePct={config.core_pct} satPct={config.satellite_pct} />
      case 3: return <Slide4_Sector     sectorData={config.sector_data} />
      case 4: return <Slide5_Roadmap />
      default: return null
    }
  }

  const updatedAt = config.updated_at
    ? new Date(config.updated_at).toLocaleDateString('ko-KR',{ year:'2-digit', month:'2-digit', day:'2-digit' })
    : null

  // ── 원본 파일명으로 강제 다운로드 ──────────────────────────────────────────
  // cross-origin URL은 download 속성이 무시되므로 Blob fetch 방식 사용
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (!config.pdf_url || downloading) return
    const fname = config.pdf_display_name ?? '전략리포트.pdf'
    setDownloading(true)
    try {
      const res = await fetch(config.pdf_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fname
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      console.error('[Strategy] download error:', e)
      // fallback: 새 탭 열기
      window.open(config.pdf_url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:D.bg, color:D.text,
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      display:'flex', flexDirection:'column', padding:'16px 20px 18px', boxSizing:'border-box' }}>

      {/* ── 툴바 ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:13, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, fontWeight:700, color:D.neon, letterSpacing:'0.16em' }}>🏹 MASTER STRATEGY</span>
          <span style={{ width:1, height:12, background:D.muted }} />
          <span style={{ fontSize:11, color:D.textSub }}>2026 Q2 · 발키리</span>
          {updatedAt && <span style={{ fontSize:10, color:D.textDim }}>업데이트 {updatedAt}</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isAdmin && (
            <button onClick={()=>setModal(true)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 15px', borderRadius:8,
                background:D.neonGlow, border:`1px solid ${D.neon}40`, color:D.neon,
                fontSize:12, fontWeight:700, cursor:'pointer' }}>
              <Settings size={13}/> 전략 업데이트
            </button>
          )}
        </div>
      </div>

      {/* ── 탭 ── */}
      <div style={{ display:'flex', gap:2, marginBottom:11, overflowX:'auto', paddingBottom:1 }}>
        {TABS.map((t,i) => (
          <button key={i} onClick={()=>goTo(i)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 13px', borderRadius:7,
              border:'none', background: i===slide ? D.neonGlow : 'transparent',
              color: i===slide ? D.neon : D.textSub,
              fontSize:11, fontWeight: i===slide ? 700 : 500, cursor:'pointer',
              whiteSpace:'nowrap' as const,
              borderBottom: i===slide ? `2px solid ${D.neon}` : '2px solid transparent',
              transition:'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── 슬라이드 카드 ── */}
      <div style={{ flex:1, background:D.surface, border:`1px solid ${D.border}`,
        borderRadius:22, overflow:'hidden', position:'relative', minHeight:460,
        boxShadow:`0 0 100px ${D.neon}05, 0 24px 60px rgba(0,0,0,0.5)` }}>

        {/* 배경 글로우 */}
        <div style={{ position:'absolute', top:-100, right:-100, width:320, height:320, borderRadius:'50%',
          background:`${D.neon}03`, pointerEvents:'none', filter:'blur(40px)' }} />
        <div style={{ position:'absolute', bottom:-80, left:-80, width:240, height:240, borderRadius:'50%',
          background:`${D.blue}03`, pointerEvents:'none', filter:'blur(40px)' }} />

        <AnimatePresence initial={false} custom={dir} mode="wait">
          <motion.div key={slide} custom={dir}
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={slideTrans}
            style={{ position:'absolute', inset:0, padding:'28px 30px', overflowY:'auto' }}>
            {renderSlide(slide)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 하단 네비 ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginTop:13, flexWrap:'wrap', gap:10 }}>
        {/* 이전 */}
        <NavButton icon={<ChevronLeft size={16}/>} label="이전" onClick={()=>goTo(slide-1)} disabled={slide===0} />

        {/* 인디케이터 */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:7 }}>
            {Array.from({length:TOTAL_SLIDES}).map((_,i) => (
              <button key={i} onClick={()=>goTo(i)}
                style={{ width:i===slide?28:8, height:8, borderRadius:4, border:'none', padding:0,
                  background: i===slide ? D.neon : `${D.muted}99`,
                  cursor:'pointer', transition:'all 0.35s ease',
                  boxShadow: i===slide ? `0 0 10px ${D.neon}cc` : 'none' }} />
            ))}
          </div>
          <span style={{ fontSize:11, color:D.textSub, fontWeight:600 }}>
            {String(slide+1).padStart(2,'0')} / {String(TOTAL_SLIDES).padStart(2,'0')}
          </span>
        </div>

        {/* 다음 */}
        <NavButton icon={<ChevronRight size={16}/>} label="다음" right onClick={()=>goTo(slide+1)} disabled={slide===TOTAL_SLIDES-1} />
      </div>

      {/* ── PDF 리포트 바 (항상 표시) ── */}
      <div style={{
        marginTop:10,
        background: D.surface,
        border:`1px solid ${config.pdf_url ? D.blue+'33' : D.border}`,
        borderRadius:14,
        padding:'14px 20px',
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        gap:14,
        flexWrap:'wrap',
      }}>
        {/* 왼쪽: 상태 표시 */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:8, height:8, borderRadius:'50%', flexShrink:0,
            background: config.pdf_url ? D.green : D.textDim,
            boxShadow: config.pdf_url ? `0 0 8px ${D.green}88` : 'none',
          }}/>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color: config.pdf_url ? D.text : D.textSub }}>
              {config.pdf_url
                ? `📄 ${config.pdf_display_name ?? decodeURIComponent(config.pdf_url.split('/').pop() ?? '전략 리포트')}`
                : '📋 리포트 준비 중입니다'}
            </div>
            <div style={{ fontSize:10, color:D.textSub, marginTop:2 }}>
              {config.pdf_url
                ? `최종 업데이트${updatedAt ? ` · ${updatedAt}` : ''}`
                : '교장 선생님이 전략 리포트를 업로드하면 자동으로 활성화됩니다'}
            </div>
          </div>
        </div>

        {/* 오른쪽: 버튼 그룹 */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* 학생: 다운로드 버튼 */}
          {!isAdmin && (
            config.pdf_url ? (
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 20px', borderRadius:10,
                  background: downloading ? D.card : `${D.blue}20`,
                  border:`1px solid ${D.blue}55`,
                  color: downloading ? D.textSub : D.blue,
                  fontSize:13, fontWeight:700,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  boxShadow:`0 0 16px ${D.blue}15`,
                  transition:'all 0.2s',
                }}>
                <Download size={15}/>
                {downloading ? '다운로드 중…' : '최신 전략 리포트 다운로드'}
              </button>
            ) : (
              <div style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'10px 20px', borderRadius:10,
                background:D.card,
                border:`1px solid ${D.border}`,
                color:D.textDim,
                fontSize:13, fontWeight:600,
                cursor:'not-allowed',
              }}>
                <Download size={15}/>
                리포트 준비 중…
              </div>
            )
          )}

          {/* 어드민: 업로드 버튼 + 확인 버튼 */}
          {isAdmin && (
            <>
              {config.pdf_url && (
                <>
                  {/* 미리보기 (새 탭) */}
                  <a
                    href={config.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display:'flex', alignItems:'center', gap:7,
                      padding:'9px 16px', borderRadius:9,
                      background:`${D.indigo}15`,
                      border:`1px solid ${D.indigo}44`,
                      color:D.indigo,
                      fontSize:12, fontWeight:700,
                      textDecoration:'none',
                    }}>
                    <FileText size={13}/>
                    파일 확인
                  </a>
                  {/* 다운로드 테스트 — Blob 방식으로 원본 파일명 */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{
                      display:'flex', alignItems:'center', gap:7,
                      padding:'9px 16px', borderRadius:9,
                      background:`${D.blue}15`,
                      border:`1px solid ${D.blue}44`,
                      color: downloading ? D.textSub : D.blue,
                      fontSize:12, fontWeight:700,
                      cursor: downloading ? 'not-allowed' : 'pointer',
                    }}>
                    <Download size={13}/>
                    {downloading ? '다운로드 중…' : '다운로드 테스트'}
                  </button>
                </>
              )}
              {/* 업데이트 버튼 */}
              <button
                onClick={()=>setModal(true)}
                style={{
                  display:'flex', alignItems:'center', gap:7,
                  padding:'9px 16px', borderRadius:9,
                  background:D.neonGlow,
                  border:`1px solid ${D.neon}44`,
                  color:D.neon,
                  fontSize:12, fontWeight:700,
                  cursor:'pointer',
                }}>
                <Upload size={13}/>
                {config.pdf_url ? '리포트 교체' : '리포트 업로드'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Admin Modal ── */}
      <AnimatePresence>
        {modal && (
          <AdminModal config={config} onClose={()=>setModal(false)}
            onSaved={c=>{ setConfig(c); showToast('✅ 전략 데이터가 업데이트됐습니다!') }}
            onSavedWithMsg={msg=>{ showToast(msg) }} />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast"
            initial={{ opacity:0, y:10, x:'-50%' }} animate={{ opacity:1, y:0, x:'-50%' }}
            exit={{ opacity:0, y:10, x:'-50%' }}
            style={{ position:'fixed', bottom:28, left:'50%',
              background:D.surface, border:`1px solid ${D.neon}44`,
              borderRadius:10, padding:'11px 22px', color:D.neon, fontSize:13,
              fontWeight:600, zIndex:9999, whiteSpace:'nowrap' as const,
              boxShadow:`0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${D.neon}22` }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
function NavButton({
  icon, label, right, onClick, disabled,
}: { icon: React.ReactNode; label: string; right?: boolean; onClick: ()=>void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10,
        background: disabled ? 'transparent' : D.neonGlow,
        border:`1px solid ${disabled ? D.border : D.neon+'44'}`,
        color: disabled ? D.textDim : D.neon,
        fontSize:13, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer',
        flexDirection: right ? 'row-reverse' : 'row',
        transition:'all 0.2s' }}>
      {icon}{label}
    </button>
  )
}
