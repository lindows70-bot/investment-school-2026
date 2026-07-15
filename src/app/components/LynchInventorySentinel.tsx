'use client'

/**
 * LynchInventorySentinel — 재고 vs 매출 데드크로스 센티넬
 *
 * ◆ 개별 fetch 아키텍처
 *   1) /api/financials/inventory-cross      → 분석 가능 종목 목록
 *   2) /api/financials/inventory-cross?ticker=NVDA → 단일 종목 데이터
 *
 *   종목별 독립 fetch → Alpha Vantage Rate Limit 우회
 *   한국 종목은 DART API → 즉시 로드
 *   GEV·TEM 등 데이터 부족 → 해당 카드만 N/A, 나머지 정상 표시
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  AlertTriangle, ShieldAlert, CheckCircle2,
  PackageOpen, RefreshCw, Info, Database, AlertCircle,
} from 'lucide-react'
import { TK } from '@/lib/theme'

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'

interface QuarterPoint {
  quarter:      string
  revenueYoY:   number
  inventoryYoY: number
  hasYoY:       boolean
}

interface StockResult {
  ticker:            string
  name:              string
  market:            string
  currency:          string
  unitLabel:         string
  signal:            CrossSignal
  gap:               number
  latestQuarter:     string
  revenueYoY:        number
  inventoryYoY:      number
  consecutiveDanger: number
  quarterlyHistory:  QuarterPoint[]
  lynchAlert:        string
  dataSource:        string
  errorMsg?:         string
}

interface StockMeta { ticker: string; name: string; market: string; isKR: boolean }

// 종목별 로딩 상태
type TickerState =
  | { status: 'loading' }
  | { status: 'ok';    data: StockResult }
  | { status: 'error'; msg: string; name: string }
  | { status: 'nodata'; data: StockResult }  // errorMsg 있지만 화면은 표시

// ────────────────────────────────────────────────────────────
// 컬러
// ────────────────────────────────────────────────────────────
const C = {
  bg:TK.slate950, surface:TK.slate900, card:TK.border, cardHi:'#263348',
  border:TK.sub6, textHi:TK.slate100, textMid:TK.slate400, textLow:TK.sub2,
  red:TK.red400, yellow:TK.amber400, green:TK.green400, blue:TK.blue400,
  barRev:TK.blue500, lineInv:TK.pink500,
}
const SM: Record<CrossSignal, { color:string; bg:string; border:string; label:string }> = {
  DANGER:  { color:C.red,    bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.30)',   label:'위험' },
  WARNING: { color:C.yellow, bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.30)',  label:'주의' },
  HEALTHY: { color:C.green,  bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.30)',   label:'정상' },
  UNKNOWN: { color:C.textLow,bg:'rgba(100,116,139,0.10)', border:'rgba(100,116,139,0.25)', label:'분석 중' },
}

// ────────────────────────────────────────────────────────────
// 차트 툴팁
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revRow = payload.find((p: any) => p.dataKey === 'revenueYoY')?.payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invRow = payload.find((p: any) => p.dataKey === 'inventoryYoY')?.payload
  const rev  = revRow?.revenueYoY   ?? 0
  const inv  = invRow?.inventoryYoY ?? 0
  const gap  = (inv - rev).toFixed(1)
  const isDanger = parseFloat(gap) > 0
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 14px', fontSize:11 }}>
      <div style={{ fontWeight:800, color:C.yellow, marginBottom:6 }}>📅 {label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
          <span style={{ color:C.textMid }}>매출 YoY</span>
          <span style={{ color:C.barRev, fontWeight:700, fontFamily:'monospace' }}>{rev >= 0?'+':''}{rev.toFixed(1)}%</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
          <span style={{ color:C.textMid }}>재고 YoY</span>
          <span style={{ color:C.lineInv, fontWeight:700, fontFamily:'monospace' }}>{inv >= 0?'+':''}{inv.toFixed(1)}%</span>
        </div>
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:4, display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:C.textLow }}>격차</span>
          <span style={{ fontWeight:800, fontFamily:'monospace', color:isDanger?C.red:C.green }}>
            {parseFloat(gap)>0?'+':''}{gap}%p
          </span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 차트 컴포넌트
// ────────────────────────────────────────────────────────────
function TrendChart({ history, unitLabel }: { history: QuarterPoint[]; unitLabel: string }) {
  const data = history.filter(q => q.revenueYoY !== 0 || q.inventoryYoY !== 0 || q.hasYoY)
  if (data.length === 0) return (
    <div style={{ height:130, display:'flex', alignItems:'center', justifyContent:'center', color:C.textLow, fontSize:11 }}>
      차트 데이터 없음
    </div>
  )
  return (
    <div>
      <div style={{ display:'flex', gap:14, marginBottom:5, paddingLeft:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:C.textMid }}>
          <div style={{ width:10, height:10, background:C.barRev, borderRadius:2 }} /> 매출 YoY(%)
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:C.textMid }}>
          <div style={{ width:14, height:2, background:C.lineInv }} /> 재고 YoY(%)
        </div>
        <span style={{ fontSize:9, color:C.textLow, marginLeft:'auto' }}>{unitLabel}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top:4, right:4, bottom:0, left:-10 }}>
          <CartesianGrid stroke={C.border} strokeDasharray="2 2" vertical={false} />
          <XAxis dataKey="quarter" tick={{ fill:C.textLow, fontSize:9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill:C.textLow, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
          <Tooltip content={<ChartTip />} />
          <ReferenceLine y={0} stroke={C.border} strokeWidth={1.5} />
          <Bar dataKey="revenueYoY" maxBarSize={18} radius={[2,2,0,0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.hasYoY ? C.barRev : 'rgba(59,130,246,0.2)'} />)}
          </Bar>
          <Line dataKey="inventoryYoY" stroke={C.lineInv} strokeWidth={2}
            dot={{ r:3, fill:C.lineInv, stroke:C.surface, strokeWidth:1.5 }}
            isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 스켈레톤
// ────────────────────────────────────────────────────────────
function Skeleton({ name, ticker }: { name: string; ticker: string }) {
  const sh: React.CSSProperties = {
    background:'linear-gradient(90deg,rgba(30,41,59,.8)25%,rgba(51,65,85,.6)50%,rgba(30,41,59,.8)75%)',
    backgroundSize:'200% 100%', animation:'skshin 1.5s infinite', borderRadius:5,
  }
  return (
    <div style={{ padding:'13px 16px', borderRadius:12, background:C.card, border:`1px solid ${C.border}` }}>
      <style>{`@keyframes skshin{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <div style={{ ...sh, width:38, height:38, borderRadius:9, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ ...sh, height:11, width:'50%', marginBottom:6 }} />
          <div style={{ ...sh, height:9, width:'30%' }} />
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:10, color:C.textLow, marginBottom:2 }}>{ticker}</div>
          <div style={{ ...sh, height:9, width:70 }} />
        </div>
      </div>
      <div style={{ ...sh, height:130, borderRadius:8 }} />
      <div style={{ marginTop:6, fontSize:10, color:C.textLow, display:'flex', alignItems:'center', gap:5 }}>
        <RefreshCw size={10} style={{ animation:'spin 1.2s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        {name} 데이터 수집 중...
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 종목 카드
// ────────────────────────────────────────────────────────────
function StockCard({ r, onRefresh }: { r: StockResult; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const sm = SM[r.signal]

  return (
    <div style={{ borderRadius:12, overflow:'hidden', background:C.card, border:`1px solid ${sm.border}` }}>
      {/* 헤더 */}
      <div style={{ padding:'13px 16px', cursor:'pointer', userSelect:'none' }} onClick={() => setExpanded(v=>!v)}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* 아이콘 */}
          <div style={{ flexShrink:0, width:38, height:38, borderRadius:9, background:sm.bg, border:`1px solid ${sm.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {r.signal==='DANGER'  && <AlertTriangle size={19} color={C.red} />}
            {r.signal==='WARNING' && <ShieldAlert   size={19} color={C.yellow} />}
            {r.signal==='HEALTHY' && <CheckCircle2  size={19} color={C.green} />}
            {r.signal==='UNKNOWN' && <PackageOpen   size={19} color={C.textLow} />}
          </div>
          {/* 종목 정보 */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'rgba(96,165,250,0.15)', color:C.blue, fontFamily:'monospace', fontWeight:900 }}>{r.ticker}</span>
              <span style={{ fontSize:12, fontWeight:800, color:C.textHi }}>{r.name}</span>
              {r.consecutiveDanger >= 2 && (
                <span style={{ fontSize:9, padding:'1px 6px', borderRadius:20, background:'rgba(239,68,68,0.15)', color:C.red, border:'1px solid rgba(239,68,68,0.3)', fontWeight:700 }}>
                  🔴 {r.consecutiveDanger}분기 연속
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:9, padding:'2px 8px', borderRadius:20, background:sm.bg, color:sm.color, border:`1px solid ${sm.border}`, fontWeight:800 }}>{sm.label}</span>
              {r.latestQuarter && <span style={{ fontSize:10, color:C.textLow }}>{r.latestQuarter}</span>}
              {r.errorMsg && (
                <span style={{ fontSize:9, color:C.yellow, display:'flex', alignItems:'center', gap:3 }}>
                  <AlertCircle size={9} /> 데이터 제한
                </span>
              )}
            </div>
          </div>
          {/* 수치 */}
          {r.signal !== 'UNKNOWN' && (
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ display:'flex', gap:14, marginBottom:4 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, color:C.blue, marginBottom:1 }}>매출 YoY</div>
                  <div style={{ fontSize:13, fontWeight:900, color:C.blue, fontFamily:'monospace' }}>{r.revenueYoY>=0?'+':''}{r.revenueYoY.toFixed(1)}%</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, color:r.gap>0?C.red:C.green, marginBottom:1 }}>재고 YoY</div>
                  <div style={{ fontSize:13, fontWeight:900, fontFamily:'monospace', color:r.gap>0?C.red:r.gap<-5?C.green:C.yellow }}>{r.inventoryYoY>=0?'+':''}{r.inventoryYoY.toFixed(1)}%</div>
                </div>
              </div>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontFamily:'monospace', fontWeight:700, background:r.gap>0?'rgba(239,68,68,0.12)':'rgba(34,197,94,0.12)', color:r.gap>0?C.red:C.green }}>
                격차 {r.gap>0?'+':''}{r.gap.toFixed(1)}%p
              </span>
            </div>
          )}
          <div style={{ flexShrink:0, fontSize:10, color:C.textLow, transition:'transform .2s', transform:expanded?'rotate(180deg)':'rotate(0deg)' }}>▼</div>
        </div>
      </div>

      {/* 확장 */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 16px', background:C.surface }}>
          {r.errorMsg && (
            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', fontSize:10, color:C.yellow, display:'flex', gap:7, alignItems:'flex-start' }}>
              <AlertCircle size={12} style={{ flexShrink:0, marginTop:1 }} />
              <span>{r.errorMsg}</span>
              <button onClick={e=>{e.stopPropagation();onRefresh()}} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:C.yellow, fontSize:10, textDecoration:'underline' }}>재시도</button>
            </div>
          )}
          {r.quarterlyHistory.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.textLow, fontWeight:700, marginBottom:6 }}>
                📊 분기별 매출 YoY(막대) vs 재고 YoY(선)
              </div>
              <TrendChart history={r.quarterlyHistory} unitLabel={r.unitLabel} />
            </div>
          )}
          <div style={{ padding:'10px 14px', borderRadius:9, background:SM[r.signal].bg, border:`1px solid ${SM[r.signal].border}` }}>
            <div style={{ fontSize:9, fontWeight:800, color:SM[r.signal].color, marginBottom:5 }}>📦 피터 린치의 재고 경보</div>
            <div style={{ fontSize:11, color:C.textMid, lineHeight:1.8, fontStyle:'italic' }}>{r.lynchAlert}</div>
          </div>
          <div style={{ marginTop:6, fontSize:9, color:C.textLow, textAlign:'right' }}>출처: {r.dataSource}</div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function LynchInventorySentinel() {
  const [stockList,   setStockList]   = useState<StockMeta[]>([])
  const [excluded,    setExcluded]    = useState<{ticker:string;name:string;reason:string}[]>([])
  const [tickerState, setTickerState] = useState<Record<string, TickerState>>({})
  const [listLoading, setListLoading] = useState(true)
  const [listError,   setListError]   = useState<string|null>(null)
  const [filterSig,   setFilterSig]   = useState<CrossSignal|'ALL'>('ALL')

  // ── Step 1: 종목 목록 조회 ──────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res  = await fetch('/api/financials/inventory-cross', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) { setListError(body.error ?? '목록 조회 실패'); return }
      const stocks: StockMeta[] = body.stocks ?? []
      setStockList(stocks)
      setExcluded(body.excluded ?? [])
      // 초기 상태를 'loading'으로 설정
      const init: Record<string, TickerState> = {}
      stocks.forEach(s => { init[s.ticker] = { status: 'loading' } })
      setTickerState(init)
    } catch (e) {
      setListError('목록 조회 오류: ' + (e as Error).message)
    } finally {
      setListLoading(false)
    }
  }, [])

  // ── Step 2: 단일 종목 데이터 fetch ─────────────────────
  const fetchTicker = useCallback(async (meta: StockMeta) => {
    setTickerState(prev => ({ ...prev, [meta.ticker]: { status: 'loading' } }))
    try {
      const res  = await fetch(`/api/financials/inventory-cross?ticker=${meta.ticker}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) {
        setTickerState(prev => ({ ...prev, [meta.ticker]: { status: 'error', msg: body.error ?? '오류', name: meta.name } }))
        return
      }
      // errorMsg 있어도 데이터가 있으면 표시
      if (body.errorMsg && body.quarterlyHistory?.length === 0) {
        setTickerState(prev => ({ ...prev, [meta.ticker]: { status: 'error', msg: body.errorMsg, name: meta.name } }))
      } else {
        setTickerState(prev => ({
          ...prev,
          [meta.ticker]: {
            status: body.errorMsg ? 'nodata' : 'ok',
            data: body as StockResult,
          },
        }))
      }
    } catch (e) {
      setTickerState(prev => ({
        ...prev,
        [meta.ticker]: { status: 'error', msg: (e as Error).message, name: meta.name },
      }))
    }
  }, [])

  // ── 목록이 로드되면 개별 fetch 시작 ─────────────────────
  useEffect(() => { loadList() }, [loadList])

  useEffect(() => {
    if (stockList.length === 0) return
    // 종목별로 약간의 지연을 두어 Alpha Vantage Rate Limit 우회 (200ms 간격)
    stockList.forEach((meta, idx) => {
      setTimeout(() => fetchTicker(meta), idx * 200)
    })
  }, [stockList, fetchTicker])

  // ── 집계 ─────────────────────────────────────────────────
  const allResults = Object.values(tickerState)
    .filter((s): s is { status: 'ok'|'nodata'; data: StockResult } => s.status === 'ok' || s.status === 'nodata')
    .map(s => s.data)

  const summary = {
    danger:  allResults.filter(r => r.signal==='DANGER').length,
    warning: allResults.filter(r => r.signal==='WARNING').length,
    healthy: allResults.filter(r => r.signal==='HEALTHY').length,
    unknown: allResults.filter(r => r.signal==='UNKNOWN').length,
  }
  const loadingCount = Object.values(tickerState).filter(s => s.status==='loading').length
  const errorCount   = Object.values(tickerState).filter(s => s.status==='error').length

  const ORDER: Record<CrossSignal,number> = { DANGER:0, WARNING:1, HEALTHY:2, UNKNOWN:3 }
  const filtered = [...allResults]
    .filter(r => filterSig==='ALL' || r.signal===filterSig)
    .sort((a, b) => ORDER[a.signal]-ORDER[b.signal] || b.gap-a.gap)

  // ────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop:32, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* 헤더 */}
      <div style={{ padding:'14px 20px 12px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:9, background:'rgba(248,113,113,.15)', border:'1px solid rgba(248,113,113,.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <PackageOpen size={18} color={C.red} />
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:900, color:C.textHi }}>재고 vs 매출 데드크로스 센티넬</div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            종목별 독립 수집 · 미국:AlphaVantage / 한국:DART · 카드 클릭 시 차트 열람
          </div>
        </div>
        <button onClick={loadList} disabled={listLoading}
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.textMid, cursor:'pointer', fontSize:11 }}>
          <RefreshCw size={12} style={{ animation:listLoading?'spin 1s linear infinite':'none' }} />
          새로고침
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>

      <div style={{ padding:'14px 20px', background:C.card, border:`1px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 12px 12px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* 에러 */}
        {listError && (
          <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)', fontSize:11, color:C.red }}>
            ⚠️ {listError}
          </div>
        )}

        {/* KPI 카드 */}
        {!listLoading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {([['DANGER','위험',summary.danger],['WARNING','주의',summary.warning],['HEALTHY','정상',summary.healthy],['UNKNOWN','대기',summary.unknown]] as const).map(([sig,label,cnt]) => (
              <div key={sig} style={{ padding:'10px 14px', borderRadius:10, textAlign:'center', cursor:'pointer',
                background: filterSig===sig ? SM[sig].bg : C.surface,
                border:`1px solid ${filterSig===sig ? SM[sig].border : C.border}` }}
                onClick={() => setFilterSig(filterSig===sig ? 'ALL' : sig)}>
                <div style={{ fontSize:22, fontWeight:900, color:SM[sig].color, fontFamily:'monospace' }}>{cnt}</div>
                <div style={{ fontSize:9, color:C.textLow, marginTop:2 }}>{label} 종목</div>
              </div>
            ))}
          </div>
        )}

        {/* 진행 상태 바 */}
        {(loadingCount > 0 || errorCount > 0) && (
          <div style={{ padding:'7px 12px', borderRadius:8, background:'rgba(59,130,246,.06)', border:`1px solid rgba(59,130,246,.2)`, display:'flex', gap:8, alignItems:'center' }}>
            <Database size={12} color={C.blue} />
            <div style={{ fontSize:10, color:C.textLow }}>
              {loadingCount > 0 && <span style={{ color:C.yellow }}>⏳ {loadingCount}개 수집 중 </span>}
              {errorCount  > 0 && <span style={{ color:C.red }}>· ⚠️ {errorCount}개 데이터 제한 </span>}
              <span>· 완료: {allResults.length}/{stockList.length}개</span>
            </div>
          </div>
        )}

        {/* 린치 원칙 */}
        <div style={{ padding:'9px 13px', borderRadius:9, background:'rgba(248,113,113,.05)', border:'1px solid rgba(248,113,113,.18)', display:'flex', gap:8, alignItems:'flex-start' }}>
          <Info size={13} color={C.red} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:10, color:C.textLow, lineHeight:1.7 }}>
            <strong style={{ color:C.red }}>경보 기준:</strong>{' '}
            재고YoY &gt; 매출YoY → <strong style={{ color:C.red }}>DANGER</strong> ·
            격차 5%p이내 → <strong style={{ color:C.yellow }}>WARNING</strong> ·
            매출YoY &gt; 재고YoY+5 → <strong style={{ color:C.green }}>HEALTHY</strong>
          </div>
        </div>

        {/* 필터 */}
        {!listLoading && allResults.length > 0 && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:C.textLow, fontWeight:700 }}>필터:</span>
            {(['ALL','DANGER','WARNING','HEALTHY','UNKNOWN'] as const).map(s => (
              <button key={s} onClick={() => setFilterSig(s)}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:700, cursor:'pointer', border:'none',
                  background: filterSig===s ? (s==='ALL'?'rgba(96,165,250,.15)':SM[s].bg) : C.surface,
                  color: filterSig===s ? (s==='ALL'?C.blue:SM[s].color) : C.textLow,
                  outline: filterSig===s ? `1px solid ${s==='ALL'?'rgba(96,165,250,.3)':SM[s].border}` : '1px solid transparent' }}>
                {s==='ALL' ? `전체 (${allResults.length})` : SM[s].label}
              </button>
            ))}
          </div>
        )}

        {/* 카드 목록 */}
        {listLoading ? (
          <div style={{ textAlign:'center', padding:'20px', color:C.textLow, fontSize:12 }}>
            <RefreshCw size={16} style={{ display:'inline-block', verticalAlign:'middle', marginRight:6, animation:'spin 1s linear infinite' }} />
            종목 목록 불러오는 중...
          </div>
        ) : stockList.length === 0 ? (
          <div style={{ padding:'32px 24px', textAlign:'center', background:C.surface, border:`1px dashed ${C.border}`, borderRadius:12 }}>
            <PackageOpen size={26} style={{ margin:'0 auto 10px', opacity:.25 }} />
            <div style={{ fontSize:13, fontWeight:700, color:C.textHi, marginBottom:5 }}>분석 대상 종목 없음</div>
            <div style={{ fontSize:11, color:C.textLow }}>포트폴리오에 재고가 존재하는 제조업/하드웨어 종목이 없습니다.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {/* 로딩 중인 종목 스켈레톤 */}
            {stockList
              .filter(m => tickerState[m.ticker]?.status === 'loading')
              .map(m => <Skeleton key={m.ticker} name={m.name} ticker={m.ticker} />)}

            {/* 에러 종목 */}
            {stockList
              .filter(m => tickerState[m.ticker]?.status === 'error')
              .map(m => {
                const s = tickerState[m.ticker] as { status:'error'; msg:string; name:string }
                return (
                  <div key={m.ticker} style={{ padding:'12px 16px', borderRadius:12, background:C.card, border:`1px solid rgba(251,191,36,.25)`, display:'flex', alignItems:'flex-start', gap:12 }}>
                    <AlertCircle size={18} color={C.yellow} style={{ flexShrink:0, marginTop:2 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'rgba(96,165,250,.15)', color:C.blue, fontFamily:'monospace', fontWeight:900 }}>{m.ticker}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:C.textHi }}>{m.name}</span>
                      </div>
                      <div style={{ fontSize:11, color:C.yellow, lineHeight:1.6 }}>{s.msg}</div>
                    </div>
                    <button onClick={() => fetchTicker(m)}
                      style={{ padding:'4px 10px', borderRadius:6, background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.3)', color:C.yellow, cursor:'pointer', fontSize:10 }}>
                      재시도
                    </button>
                  </div>
                )
              })}

            {/* 데이터 있는 종목 (필터 적용) */}
            {filtered.map(r => (
              <StockCard
                key={r.ticker}
                r={r}
                onRefresh={() => {
                  const meta = stockList.find(m => m.ticker === r.ticker)
                  if (meta) fetchTicker(meta)
                }}
              />
            ))}
          </div>
        )}

        {/* 비제조업 제외 종목 */}
        {!listLoading && excluded.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:11, color:C.textLow, fontWeight:700 }}>🚫 재고 분석 미적용 종목 ({excluded.length}개)</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {excluded.map(e => (
                <div key={e.ticker} style={{ padding:'8px 14px', borderRadius:9, background:C.surface, border:`1px dashed rgba(100,116,139,.3)`, display:'flex', alignItems:'center', gap:10, opacity:.7 }}>
                  <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(96,165,250,.12)', color:C.blue, fontFamily:'monospace', fontWeight:900 }}>{e.ticker}</span>
                  <span style={{ fontSize:11, color:C.textMid }}>{e.name}</span>
                  <span style={{ fontSize:10, color:C.textLow, marginLeft:'auto' }}>{e.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 메타 */}
        {!listLoading && stockList.length > 0 && (
          <div style={{ fontSize:10, color:C.textLow, textAlign:'right' }}>
            분석 완료 {allResults.length}/{stockList.length}개 · 제외 {excluded.length}개
          </div>
        )}

      </div>
    </div>
  )
}
