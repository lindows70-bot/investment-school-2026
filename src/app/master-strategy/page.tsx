'use client'

/**
 * /master-strategy — 발키리 전략 브리핑 시스템
 *
 * 슬라이드: Title → Asset Philosophy → Capital Structure → Sector Allocation → Roadmap
 * Admin   : 전략 업데이트 모달 (PDF 업로드 + 수치 입력 → strategy_configs upsert)
 * Student : 슬라이드 시청 + 최신 리포트 다운로드
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList, CartesianGrid,
} from 'recharts'

// ─── Design System ────────────────────────────────────────────────────────────
const C = {
  bg:     '#020617',   // Deep Dark
  bg2:    '#050e1f',   // Card BG
  bg3:    '#091428',   // Inner Card
  border: '#0f2347',   // Border
  neon:   '#deff9a',   // Neon Green (Primary)
  blue:   '#38bdf8',   // Sky Blue
  indigo: '#818cf8',   // Indigo
  gold:   '#fbbf24',   // Gold
  red:    '#f87171',   // Red
  muted:  '#1e3a5f',   // Muted
  text:   '#e2e8f0',   // Body text
  sub:    '#475569',   // Subtitle
  dim:    '#1e293b',   // Dim
} as const

// ─── Default Strategy Data ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  core_pct:      48,
  satellite_pct: 52,
  sector_data: [
    { name: '반도체',    value: 32 },
    { name: '전략·전력', value: 20 },
    { name: 'K방산',     value:  4 },
    { name: 'AI·바이오', value:  4 },
    { name: '대체(BTC)', value:  6 },
    { name: '현금·CMA',  value:  5 },
  ] as { name: string; value: number }[],
  pdf_url: null as string | null,
}

const SECTOR_COLORS = [C.blue, C.neon, '#fb923c', C.indigo, C.gold, C.sub]
// const CORE_SAT_COLORS = ['#3b82f6', C.neon]   // reserved

// ─── Roadmap ──────────────────────────────────────────────────────────────────
const ROADMAP = [
  { q:'Q1 2026', title:'포트폴리오 구축',   items:['Core ETF 편입 완료','반도체 32% 달성','분산 구조 확립'],       done:true  },
  { q:'Q2 2026', title:'Satellite 강화',    items:['AI·바이오 4% 편입','K방산 확대','나스닥100 15% 조정'],       done:true  },
  { q:'Q3 2026', title:'리밸런싱',          items:['섹터 수익률 점검','비중 ±5% 조정','신규 테마 스크리닝'],     done:false },
  { q:'Q4 2026', title:'연간 결산',         items:['벤치마크 대비 성과','2027 전략 초안','세금 최적화 검토'],    done:false },
]

// ─── Constants ────────────────────────────────────────────────────────────────
const STRATEGY_TOTAL     = '₩1억'
const STRATEGY_STOCKS    = 18
const TOTAL_SLIDES       = 5

// ─── Slide animation variants ────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
}
const slideTransition = { type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.42 }

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DarkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.neon}33`, borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <span style={{ color: C.neon, fontWeight: 700 }}>{payload[0].name}</span>
      <span style={{ color: C.text, marginLeft: 8 }}>{payload[0].value}%</span>
    </div>
  )
}

// ─── Slide Components ─────────────────────────────────────────────────────────

/** Slide 01 — Title */
function S1_Title() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:40, textAlign:'center', padding:'0 40px' }}>
      {/* Label row */}
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        {['2026 투자학교', 'Q2 STRATEGY BRIEF', 'Get Rich Slowly'].map(t => (
          <span key={t} style={{ fontSize:11, fontWeight:700, color:C.neon, border:`1px solid ${C.neon}44`, borderRadius:20, padding:'4px 14px', letterSpacing:'0.1em' }}>{t}</span>
        ))}
      </div>

      {/* Headline */}
      <div>
        <p style={{ fontSize:12, color:C.blue, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', margin:'0 0 18px' }}>
          VALKYRIE MASTER STRATEGY
        </p>
        <h1 style={{ fontSize:'clamp(32px, 5vw, 62px)', fontWeight:900, color:'#f8fafc', margin:'0 0 14px', letterSpacing:'-1.5px', lineHeight:1.05 }}>
          발키리<br/>
          <span style={{ color:C.neon }}>포트폴리오 전략</span>
        </h1>
        <p style={{ fontSize:15, color:C.sub, margin:0, fontWeight:500 }}>
          Core-Satellite 자산배분 모델 · 2026 Q2
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
        {[
          { label:'전략 포트폴리오', value:STRATEGY_TOTAL,        color:C.neon   },
          { label:'전략 종목',       value:`${STRATEGY_STOCKS}개`, color:C.blue   },
          { label:'슬라이드',        value:'5 Decks',              color:C.indigo },
        ].map(k => (
          <div key={k.label} style={{ background:C.bg3, border:`1px solid ${k.color}25`, borderRadius:14, padding:'18px 30px', minWidth:140, textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.sub, fontWeight:700, letterSpacing:'0.12em', marginBottom:8 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize:24, fontWeight:900, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize:12, color:C.muted, marginTop:-8 }}>← / → 키 또는 하단 버튼으로 이동</p>
    </div>
  )
}

/** Slide 02 — Asset Philosophy */
function S2_Philosophy() {
  const sides = [
    { key:'Core', pct:48, color:'#3b82f6', desc:'안정 · 지수 · 대형주', items:['S&P500 / 나스닥100 ETF','삼성전자 · SK하이닉스','반도체 섹터 ETF','채권·현금 헤지'] },
    { key:'Satellite', pct:52, color:C.neon, desc:'성장 · 테마 · 알파', items:['AI전력 · 방산 ETF','한화에어로 · 이수페타시스','GEV · PLTR 미국 성장주','BTC 디지털 자산'] },
  ]
  const principles = [
    { icon:'⚖️', title:'리스크 균형', desc:'Core로 하방을 방어하고\nSatellite로 알파를 추구' },
    { icon:'🔄', title:'분기 리밸런싱', desc:'비중 이탈 ±5% 이상 시\n즉각 조정 실행' },
    { icon:'📈', title:'장기 복리', desc:'"Get Rich Slowly"\n꾸준한 복리 누적 원칙' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24, height:'100%', overflow:'auto' }}>
      <SlideHeader idx={2} title="Core-Satellite" accent="자산배분 철학" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, flex:1 }}>
        {sides.map(s => (
          <div key={s.key} style={{ background:C.bg3, border:`1px solid ${s.color}25`, borderRadius:16, padding:22 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:s.color }} />
              <span style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.key} {s.pct}%</span>
            </div>
            <p style={{ fontSize:12, color:C.sub, marginBottom:12 }}>{s.desc}</p>
            {s.items.map(i => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:7 }}>
                <span style={{ color:s.color, fontSize:10, marginTop:2 }}>▸</span>
                <span style={{ fontSize:12, color:C.text }}>{i}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {principles.map(p => (
          <div key={p.title} style={{ background:`${C.neon}08`, border:`1px solid ${C.neon}20`, borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{p.icon}</div>
            <div style={{ fontSize:12, fontWeight:700, color:C.neon, marginBottom:4 }}>{p.title}</div>
            <div style={{ fontSize:11, color:C.sub, whiteSpace:'pre-line', lineHeight:1.6 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Slide 03 — Capital Structure */
function S3_Capital({ corePct, satPct }: { corePct:number; satPct:number }) {
  const donutA = [
    { name:'Core',      value:corePct, color:'#3b82f6' },
    { name:'Satellite', value:satPct,  color:C.neon    },
  ]
  const fundData = [
    { name:'국내 ETF',   value:31, color:C.blue    },
    { name:'해외 ETF',   value:28, color:C.neon    },
    { name:'국내 개별주', value:24, color:C.indigo  },
    { name:'해외 개별주', value:11, color:C.gold    },
    { name:'코인·대체',  value: 6, color:'#fb923c' },
  ]
  const RADIAN = Math.PI / 180
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPctLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
    if (value < 6) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>{value}%</text>
  }
  const DonutLegend = ({ data }: { data: typeof donutA }) => (
    <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginTop:6 }}>
      {data.map(d => (
        <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:d.color }} />
          <span style={{ fontSize:11, color:d.color, fontWeight:700 }}>{d.name} {d.value}%</span>
        </div>
      ))}
    </div>
  )
  const stats = [
    { label:'ETF 비중', value:'59%', color:C.neon    },
    { label:'개별주',   value:'35%', color:C.blue    },
    { label:'대체자산', value:'6%',  color:C.gold    },
    { label:'전략 종목', value:`${STRATEGY_STOCKS}개`, color:C.indigo },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, height:'100%' }}>
      <SlideHeader idx={3} title="Capital" accent="자금 구조 분석" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, flex:1, minHeight:0 }}>
        {[{ title:'CORE vs SATELLITE', data:donutA }, { title:'자산군 비중', data:fundData }].map((chart, ci) => (
          <div key={chart.title} style={{ background:C.bg3, border:`1px solid ${ci===0?'#3b82f6':'#deff9a'}18`, borderRadius:16, padding:18, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ fontSize:11, color:C.sub, fontWeight:700, marginBottom:8 }}>{chart.title}</div>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={chart.data} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" labelLine={false} label={renderPctLabel}>
                  {chart.data.map((d,i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <DonutLegend data={chart.data} />
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:`${s.color}0c`, border:`1px solid ${s.color}28`, borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.sub, fontWeight:700, marginBottom:4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Slide 04 — Sector Allocation */
function S4_Sector({ sectorData }: { sectorData: { name:string; value:number }[] }) {
  const barData = sectorData.map((d, i) => ({ ...d, fill: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
  const details = [
    { label:'반도체 32%',    icon:'💾', color:C.blue,   desc:'직접+간접. SK하이닉스·삼성전자·KODEX반도체', badge:'CORE' },
    { label:'전략·전력 20%', icon:'⚡', color:C.neon,   desc:'원자력·AI전력·GEV·Eaton 에너지 패러다임', badge:'SAT'  },
    { label:'K방산 4%',      icon:'🛡️', color:'#fb923c', desc:'PLUS K방산 ETF. 지정학 리스크 헤지',        badge:'SAT'  },
    { label:'AI·바이오 4%',  icon:'🧬', color:C.indigo, desc:'헬스케어 다각화. IBB·XBI·TEM 신규 편입',    badge:'SAT'  },
    { label:'대체(BTC) 6%',  icon:'₿', color:C.gold,   desc:'디지털 자산 분산. 인플레이션 헤지',          badge:'ALT'  },
    { label:'현금·CMA 5%',   icon:'💵', color:C.sub,    desc:'파킹 유동성. 기회비용 최소화',               badge:'HEDGE'},
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, height:'100%' }}>
      <SlideHeader idx={4} title="Sector" accent="섹터 비중 배분" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, flex:1, minHeight:0 }}>
        {/* Bar chart */}
        <div style={{ background:C.bg3, border:`1px solid ${C.neon}18`, borderRadius:16, padding:'18px 12px 18px 18px' }}>
          <div style={{ fontSize:11, color:C.sub, fontWeight:700, marginBottom:10 }}>섹터별 비중 (%)</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={barData} layout="vertical" margin={{ left:4, right:36, top:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" horizontal={false} />
              <XAxis type="number" domain={[0,36]} tick={{ fill:C.sub, fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:C.text, fontSize:11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {barData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                <LabelList dataKey="value" position="right" style={{ fill:C.sub, fontSize:11 }} formatter={(v:unknown) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Detail cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:7, overflowY:'auto' }}>
          {details.map(d => (
            <div key={d.label} style={{ background:C.bg3, border:`1px solid ${d.color}18`, borderRadius:10, padding:'9px 12px', display:'flex', gap:9, alignItems:'flex-start' }}>
              <span style={{ fontSize:14, marginTop:1 }}>{d.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:d.color }}>{d.label}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:d.color, border:`1px solid ${d.color}44`, borderRadius:3, padding:'1px 5px' }}>{d.badge}</span>
                </div>
                <div style={{ fontSize:10, color:C.sub, lineHeight:1.4 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Slide 05 — Roadmap */
function S5_Roadmap() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, height:'100%' }}>
      <SlideHeader idx={5} title="Implementation" accent="이행 로드맵" />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:0, position:'relative', padding:'0 0 0 36px', overflow:'auto' }}>
        {/* 세로선 */}
        <div style={{ position:'absolute', left:14, top:14, bottom:14, width:2, background:`linear-gradient(to bottom, ${C.neon}, ${C.neon}18)` }} />
        {ROADMAP.map((step, idx) => (
          <div key={step.q} style={{ position:'relative', marginBottom:16 }}>
            {/* 타임라인 점 */}
            <div style={{ position:'absolute', left:-28, top:14, width:14, height:14, borderRadius:'50%', background:step.done?C.neon:C.bg3, border:`2px solid ${step.done?C.neon:C.muted}`, boxShadow:step.done?`0 0 12px ${C.neon}88`:'none' }} />
            <div style={{ background:step.done?`${C.neon}08`:C.bg3, border:`1px solid ${step.done?C.neon+'28':C.border}`, borderRadius:14, padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:700, color:step.done?C.neon:C.sub, border:`1px solid ${step.done?C.neon+'44':C.border}`, borderRadius:6, padding:'2px 10px' }}>{step.q}</span>
                <span style={{ fontSize:14, fontWeight:800, color:step.done?C.text:C.sub }}>{step.title}</span>
                {step.done && <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:C.neon, background:`${C.neon}14`, borderRadius:4, padding:'2px 8px' }}>✓ 완료</span>}
                {!step.done && idx===2 && <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:C.gold, background:`${C.gold}14`, borderRadius:4, padding:'2px 8px' }}>진행 예정</span>}
              </div>
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {step.items.map(item => (
                  <div key={item} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:step.done?C.text:C.sub }}>
                    <span style={{ color:step.done?C.neon:C.muted, fontSize:9 }}>◆</span>{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Quote */}
      <div style={{ background:`${C.neon}07`, border:`1px solid ${C.neon}1e`, borderRadius:12, padding:'14px 20px', textAlign:'center' }}>
        <p style={{ fontSize:14, fontWeight:700, color:C.neon, fontStyle:'italic', margin:'0 0 6px' }}>
          &ldquo;좋은 투자는 항상 근거가 명확하다. 숫자로 설명할 수 없는 투자는 하지 않는다.&rdquo;
        </p>
        <p style={{ fontSize:11, color:C.sub, margin:0 }}>— 2026 투자학교 교장</p>
      </div>
    </div>
  )
}

// ─── Shared Slide Header ──────────────────────────────────────────────────────
function SlideHeader({ idx, title, accent }: { idx:number; title:string; accent:string }) {
  return (
    <div style={{ textAlign:'center', paddingBottom:4 }}>
      <div style={{ fontSize:10, color:C.neon, fontWeight:700, letterSpacing:'0.18em', marginBottom:8 }}>
        SLIDE {String(idx).padStart(2,'0')} / {String(TOTAL_SLIDES).padStart(2,'0')}
      </div>
      <h2 style={{ fontSize:'clamp(18px, 2.8vw, 30px)', fontWeight:900, color:'#f8fafc', margin:0 }}>
        {title} <span style={{ color:C.neon }}>{accent}</span>
      </h2>
    </div>
  )
}

// ─── Admin Modal ──────────────────────────────────────────────────────────────
interface StrategyConfig { core_pct:number; satellite_pct:number; sector_data:{name:string;value:number}[]; pdf_url:string|null }

function AdminModal({ config, onClose, onSaved }: { config:StrategyConfig; onClose:()=>void; onSaved:(c:StrategyConfig)=>void }) {
  const [corePct,    setCorePct]    = useState(String(config.core_pct))
  const [satPct,     setSatPct]     = useState(String(config.satellite_pct))
  const [sectorJson, setSectorJson] = useState(JSON.stringify(config.sector_data, null, 2))
  const [pdfFile,    setPdfFile]    = useState<File|null>(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setErr(null); setSaving(true)
    try {
      let parsedSectors: {name:string;value:number}[]
      try { parsedSectors = JSON.parse(sectorJson) }
      catch { setErr('섹터 데이터 JSON 형식이 잘못됐습니다'); setSaving(false); return }

      const sb = createClient()
      let pdfUrl = config.pdf_url

      // PDF 업로드
      if (pdfFile) {
        const fname = `strategy_${new Date().toISOString().slice(0,10)}.pdf`
        const { error: upErr } = await sb.storage.from('strategy-pdf').upload(fname, pdfFile, { upsert:true })
        if (upErr) throw upErr
        const { data: pub } = sb.storage.from('strategy-pdf').getPublicUrl(fname)
        pdfUrl = pub.publicUrl
      }

      // strategy_configs upsert (항상 id='singleton' 1행 유지)
      const { error: dbErr } = await sb.from('strategy_configs').upsert({
        id:            'singleton',
        core_pct:      parseInt(corePct) || 48,
        satellite_pct: parseInt(satPct)  || 52,
        sector_data:   parsedSectors,
        pdf_url:       pdfUrl,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'id' })
      if (dbErr) throw dbErr

      onSaved({ core_pct:parseInt(corePct)||48, satellite_pct:parseInt(satPct)||52, sector_data:parsedSectors, pdf_url:pdfUrl })
      onClose()
    } catch (e) { setErr((e as Error).message) }
    finally { setSaving(false) }
  }

  const inp = (label:string, value:string, onChange:(v:string)=>void, type='text') => (
    <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:'0.08em' }}>{label.toUpperCase()}</span>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' as const }} />
    </label>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000, padding:20 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95, y:16 }}
        transition={{ duration:0.25, ease:'easeOut' }}
        style={{ background:C.bg2, border:`1px solid ${C.neon}30`, borderRadius:20, padding:32, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
          <div>
            <p style={{ fontSize:11, color:C.neon, fontWeight:700, letterSpacing:'0.15em', margin:'0 0 4px' }}>ADMIN · STRATEGY UPDATE</p>
            <h3 style={{ fontSize:20, fontWeight:900, color:'#f8fafc', margin:0 }}>전략 데이터 업데이트</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.sub, fontSize:18, cursor:'pointer', padding:'4px 10px', lineHeight:1 }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {inp('Core 비중 (%)',      corePct, setCorePct, 'number')}
            {inp('Satellite 비중 (%)', satPct,  setSatPct,  'number')}
          </div>

          {/* Sector JSON */}
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:'0.08em' }}>SECTOR DATA (JSON)</span>
            <textarea value={sectorJson} onChange={e=>setSectorJson(e.target.value)} rows={6}
              style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:12, outline:'none', resize:'vertical', fontFamily:'monospace', width:'100%', boxSizing:'border-box' as const }} />
            <span style={{ fontSize:10, color:C.sub }}>[{'{'}name, value{'}'}] 형태 배열</span>
          </label>

          {/* PDF */}
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:'0.08em', display:'block', marginBottom:8 }}>PDF 파일 (선택)</span>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>setPdfFile(e.target.files?.[0]??null)} />
            <button onClick={()=>fileRef.current?.click()} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 16px', color:pdfFile?C.neon:C.sub, fontSize:12, cursor:'pointer', width:'100%', textAlign:'left' as const }}>
              {pdfFile ? `📄 ${pdfFile.name}` : '📂 PDF 파일 선택…'}
            </button>
            {config.pdf_url && !pdfFile && <span style={{ fontSize:10, color:C.sub, marginTop:4, display:'block' }}>현재: {config.pdf_url.split('/').pop()}</span>}
          </div>

          {err && <div style={{ background:'#7f1d1d22', border:'1px solid #f8717133', borderRadius:8, padding:'10px 14px', fontSize:12, color:C.red }}>{err}</div>}

          {/* Actions */}
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:10, background:'transparent', border:`1px solid ${C.border}`, color:C.sub, fontSize:13, fontWeight:700, cursor:'pointer' }}>취소</button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, padding:'12px', borderRadius:10, background:saving?`${C.neon}20`:`${C.neon}25`, border:`1px solid ${C.neon}50`, color:saving?C.sub:C.neon, fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
              {saving ? '⏳ 저장 중…' : '✅ 저장 & 배포'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MasterStrategyPage() {
  const [[slide, dir], setSlide] = useState([0, 0])
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [config,   setConfig]   = useState<StrategyConfig>(DEFAULT_CONFIG)
  const [modal,    setModal]    = useState(false)
  const [toast,    setToast]    = useState<string|null>(null)

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null), 3500) }

  // ── DB 초기화 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const sb = createClient()
      const { data:{ user } } = await sb.auth.getUser()
      if (!user) return

      const { data:profile } = await sb.from('profiles').select('role').eq('id',user.id).single()
      setIsAdmin(profile?.role === 'teacher')

      const { data:row } = await sb.from('strategy_configs').select('*').eq('id','singleton').single()
      if (row) setConfig(row as StrategyConfig)
    }
    init()
  }, [])

  // ── 키보드 네비 ────────────────────────────────────────────────────────────
  const goTo = useCallback((next:number) => {
    const d = next > slide ? 1 : -1
    setSlide([Math.max(0, Math.min(TOTAL_SLIDES-1, next)), d])
  }, [slide])

  useEffect(() => {
    const h = (e:KeyboardEvent) => {
      if (e.key==='ArrowRight'||e.key==='ArrowDown') goTo(slide+1)
      if (e.key==='ArrowLeft' ||e.key==='ArrowUp')   goTo(slide-1)
    }
    window.addEventListener('keydown',h)
    return ()=>window.removeEventListener('keydown',h)
  }, [slide, goTo])

  // ── 슬라이드 탭 정의 ────────────────────────────────────────────────────────
  const TABS = ['🏹 Title','⚖️ Philosophy','🍩 Structure','📊 Sectors','🗺️ Roadmap']

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const renderSlide = (s:number) => {
    switch(s) {
      case 0: return <S1_Title />
      case 1: return <S2_Philosophy />
      case 2: return <S3_Capital corePct={config.core_pct} satPct={config.satellite_pct} />
      case 3: return <S4_Sector sectorData={config.sector_data} />
      case 4: return <S5_Roadmap />
      default: return null
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color:C.text, display:'flex', flexDirection:'column', padding:'18px 20px', boxSizing:'border-box' }}>

      {/* ── 상단 툴바 ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, fontWeight:700, color:C.neon, letterSpacing:'0.15em' }}>🏹 MASTER STRATEGY</span>
          <span style={{ width:1, height:12, background:C.muted, display:'inline-block' }} />
          <span style={{ fontSize:11, color:C.sub }}>2026 Q2 · 발키리 포트폴리오</span>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isAdmin ? (
            <button onClick={()=>setModal(true)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px', borderRadius:8, background:`${C.neon}18`, border:`1px solid ${C.neon}40`, color:C.neon, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              ⚙️ 전략 업데이트
            </button>
          ) : (
            config.pdf_url && (
              <a href={config.pdf_url} download target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px', borderRadius:8, background:`${C.blue}18`, border:`1px solid ${C.blue}40`, color:C.blue, fontSize:12, fontWeight:700, textDecoration:'none' }}>
                📥 최신 리포트 다운로드
              </a>
            )
          )}
        </div>
      </div>

      {/* ── 슬라이드 탭 ── */}
      <div style={{ display:'flex', gap:2, marginBottom:12, overflowX:'auto', paddingBottom:2 }}>
        {TABS.map((t,i) => (
          <button key={i} onClick={()=>goTo(i)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:i===slide?`${C.neon}18`:'transparent', color:i===slide?C.neon:C.sub, fontSize:12, fontWeight:i===slide?700:500, cursor:'pointer', whiteSpace:'nowrap', borderBottom:i===slide?`2px solid ${C.neon}`:'2px solid transparent', transition:'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── 슬라이드 카드 ── */}
      <div style={{ flex:1, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden', position:'relative', minHeight:460, boxShadow:`0 0 80px ${C.neon}06` }}>
        {/* 배경 데코 */}
        <div style={{ position:'absolute', top:-80, right:-80, width:260, height:260, borderRadius:'50%', background:`${C.neon}04`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:180, height:180, borderRadius:'50%', background:`${C.blue}04`, pointerEvents:'none' }} />

        <AnimatePresence initial={false} custom={dir} mode="wait">
          <motion.div key={slide} custom={dir}
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={slideTransition}
            style={{ position:'absolute', inset:0, padding:'28px 32px', overflowY:'auto' }}>
            {renderSlide(slide)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 하단 컨트롤 ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, flexWrap:'wrap', gap:10 }}>
        <NavBtn label="← 이전" onClick={()=>goTo(slide-1)} disabled={slide===0} />

        {/* 인디케이터 */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:7 }}>
            {Array.from({length:TOTAL_SLIDES}).map((_,i)=>(
              <button key={i} onClick={()=>goTo(i)} style={{ width:i===slide?26:8, height:8, borderRadius:4, border:'none', background:i===slide?C.neon:`${C.muted}88`, cursor:'pointer', padding:0, transition:'all 0.35s ease', boxShadow:i===slide?`0 0 10px ${C.neon}aa`:'none' }} />
            ))}
          </div>
          <span style={{ fontSize:11, color:C.sub, fontWeight:600 }}>Page {slide+1} / {TOTAL_SLIDES}</span>
        </div>

        <NavBtn label="다음 →" onClick={()=>goTo(slide+1)} disabled={slide===TOTAL_SLIDES-1} />
      </div>

      {/* ── Admin Modal ── */}
      <AnimatePresence>
        {modal && <AdminModal config={config} onClose={()=>setModal(false)} onSaved={c=>{ setConfig(c); showToast('✅ 전략 데이터가 업데이트됐습니다!') }} />}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }}
            style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:C.bg2, border:`1px solid ${C.neon}44`, borderRadius:10, padding:'11px 22px', color:C.neon, fontSize:13, fontWeight:600, boxShadow:`0 8px 32px ${C.neon}20`, zIndex:9999, whiteSpace:'nowrap' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Nav Button ───────────────────────────────────────────────────────────────
function NavBtn({ label, onClick, disabled }: { label:string; onClick:()=>void; disabled:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', borderRadius:10, background:disabled?'transparent':`${C.neon}14`, border:`1px solid ${disabled?C.border:C.neon+'44'}`, color:disabled?C.sub:C.neon, fontSize:13, fontWeight:700, cursor:disabled?'not-allowed':'pointer', transition:'all 0.2s' }}>
      {label}
    </button>
  )
}
