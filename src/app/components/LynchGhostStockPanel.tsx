'use client'

/**
 * LynchGhostStockPanel v2 — 월가의 유령 종목 추적기 (풀스택 연동)
 *
 * ◆ 데이터 파이프라인 (Mock Data 완전 제거)
 *   1. 컴포넌트 마운트 → GET /api/lynch/ghost-stock 호출
 *   2. API: Supabase investments → ghost_stock_cache 캐시 확인
 *   3. 캐시 MISS → 외부 API (FMP/Yahoo) 호출 → 계산 → Upsert
 *   4. 결과 배열 → GhostRecord[] 매핑 → 상태 저장
 *
 * ◆ 로딩 상태
 *   - 데이터 수신 중: 스켈레톤 카드 3개 표시
 *   - 빈 포트폴리오: Empty State UI
 *   - API 오류: 에러 배너
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Ghost, TrendingUp, TrendingDown, Minus,
  Users, Building2, UserCheck,
  ChevronDown, ChevronUp,
  Sparkles, ShieldCheck, Info, RefreshCw,
  AlertTriangle, Database,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
type GhostGrade = 'diamond' | 'pearl' | 'radar' | 'hotspot' | 'crowded'
type InsiderDir = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'

/** 프론트엔드에서 사용하는 GhostRecord (camelCase) */
interface GhostRecord {
  ticker:           string
  name:             string
  lynchType:        string
  market:           'US' | 'KR'
  analystCount:     number
  analystChange:    number
  instOwnership:    number
  insiderBuys:      number
  insiderSells:     number
  insiderBuyAmt:    string
  insiderSellAmt:   string
  lastActivity:     string
  lastActivityDays: number
  ghostGrade:       GhostGrade
  ghostScore:       number
  lynchVerdict:     string
  analystComment:   string
  insiderComment:   string
}

/** API 응답 행 (snake_case — ghost_stock_cache 컬럼과 동일) */
interface ApiCacheRow {
  ticker:                string
  company_name:          string
  lynch_type:            string
  market:                string
  analyst_count:         number
  analyst_change:        number
  inst_ownership:        number
  insider_buy_count:     number
  insider_sell_count:    number
  insider_buy_amt:       string
  insider_sell_amt:      string
  last_activity:         string
  last_activity_days:    number
  ghost_score:           number
  ghost_grade:           string
  lynch_verdict:         string
  analyst_comment:       string
  insider_comment:       string
  updated_at:            string
}

interface ExcludedAsset {
  ticker:        string
  name:          string
  assetType:     'ETF' | 'COMMODITY' | 'CRYPTO'
  badgeIcon:     string
  badgeLabel:    string
  lynchGuidance: string
}

interface ApiResponse {
  records:   ApiCacheRow[]
  excluded?: ExcludedAsset[]
  source:    'cache' | 'partial' | 'empty'
  meta?: {
    totalHoldings: number
    cacheHit:      number
    cacheMiss:     number
    updatedAt:     string
  }
  error?: string
}

// ── snake_case → camelCase 변환 ──────────────────────────────
function mapApiRow(row: ApiCacheRow): GhostRecord {
  return {
    ticker:           row.ticker,
    name:             row.company_name,
    lynchType:        row.lynch_type || '미분류',
    market:           (row.market as 'US' | 'KR') ?? 'US',
    analystCount:     row.analyst_count     ?? 0,
    analystChange:    row.analyst_change    ?? 0,
    instOwnership:    Number(row.inst_ownership) ?? 0,
    insiderBuys:      row.insider_buy_count  ?? 0,
    insiderSells:     row.insider_sell_count ?? 0,
    insiderBuyAmt:    row.insider_buy_amt    ?? '$0',
    insiderSellAmt:   row.insider_sell_amt   ?? '$0',
    lastActivity:     row.last_activity      ?? '데이터 없음',
    lastActivityDays: row.last_activity_days ?? 0,
    ghostGrade:       (row.ghost_grade as GhostGrade) ?? 'radar',
    ghostScore:       row.ghost_score        ?? 0,
    lynchVerdict:     row.lynch_verdict      ?? '',
    analystComment:   row.analyst_comment    ?? '',
    insiderComment:   row.insider_comment    ?? '',
  }
}

// ────────────────────────────────────────────────────────────
// 컬러 팔레트 & 메타데이터
// ────────────────────────────────────────────────────────────
const C = {
  bg:'#020617', surface:'#0f172a', card:'#1e293b', cardHi:'#263348',
  border:'#7a8fa3', textHi:'#f1f5f9', textMid:'#94a3b8', textLow:'#7f93a8',
  green:'#4ade80', red:'#f87171', amber:'#fbbf24', blue:'#60a5fa', purple:'#c084fc',
}

const GRADE_META: Record<GhostGrade, { icon:string; label:string; color:string; bg:string; border:string; desc:string }> = {
  diamond: { icon:'💎', label:'특급 유령 종목', color:'#fbbf24', bg:'rgba(251,191,36,0.12)', border:'rgba(251,191,36,0.35)', desc:'월가 사각지대 + 내부자 강력 매수' },
  pearl:   { icon:'🌱', label:'잠재 진주 종목', color:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.30)',  desc:'소형 커버리지 + 내부자 매수 우세' },
  radar:   { icon:'🔭', label:'주목 구간',      color:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.28)', desc:'중형 커버리지 — 내부자 주의 신호' },
  hotspot: { icon:'📢', label:'월가 핫플',      color:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.30)', desc:'고커버리지 — 이미 알려진 종목' },
  crowded: { icon:'🔒', label:'월가 총공세',    color:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.28)',  desc:'초과열 커버리지 + 내부자 차익실현' },
}

const DIR_META: Record<InsiderDir, { color:string; icon:string; label:string; bg:string }> = {
  strong_buy:  { color:C.green,   icon:'↑↑', label:'강한 매수', bg:'rgba(34,197,94,0.1)' },
  buy:         { color:'#86efac', icon:'↑',  label:'매수 우세', bg:'rgba(34,197,94,0.07)' },
  neutral:     { color:C.textLow, icon:'—',  label:'중립',      bg:'rgba(100,116,139,0.1)' },
  sell:        { color:'#fca5a5', icon:'↓',  label:'매도 우세', bg:'rgba(239,68,68,0.07)' },
  strong_sell: { color:C.red,     icon:'↓↓', label:'강한 매도', bg:'rgba(239,68,68,0.1)' },
}

function insiderDir(r: GhostRecord): InsiderDir {
  const net = r.insiderBuys - r.insiderSells
  if (net >= 3)  return 'strong_buy'
  if (net >= 1)  return 'buy'
  if (net === 0) return 'neutral'
  if (net >= -2) return 'sell'
  return 'strong_sell'
}

// ────────────────────────────────────────────────────────────
// 스켈레톤 카드 (로딩 중 표시)
// ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, rgba(30,41,59,0.8) 25%, rgba(51,65,85,0.6) 50%, rgba(30,41,59,0.8) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s infinite',
    borderRadius: 6,
  }
  return (
    <div style={{ padding:'14px 16px', borderRadius:12, background:C.card, border:`1px solid ${C.border}` }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {/* 스코어 링 */}
        <div style={{ ...shimmer, width:44, height:44, borderRadius:'50%', flexShrink:0 }} />
        {/* 좌측 */}
        <div style={{ flexShrink:0, width:200 }}>
          <div style={{ ...shimmer, height:10, width:'60%', marginBottom:8 }} />
          <div style={{ ...shimmer, height:14, width:'90%', marginBottom:8 }} />
          <div style={{ ...shimmer, height:18, width:'50%', borderRadius:20 }} />
        </div>
        {/* 중앙 게이지 */}
        <div style={{ flex:1, padding:'0 12px' }}>
          <div style={{ ...shimmer, height:9, marginBottom:8 }} />
          <div style={{ ...shimmer, height:7, width:'80%', marginBottom:6 }} />
          <div style={{ ...shimmer, height:8, width:'60%' }} />
        </div>
        {/* 내부자 */}
        <div style={{ flex:1, padding:'0 12px' }}>
          <div style={{ ...shimmer, height:9, marginBottom:8 }} />
          <div style={{ ...shimmer, height:7, marginBottom:6 }} />
          <div style={{ ...shimmer, height:8, width:'70%' }} />
        </div>
        {/* 우측 */}
        <div style={{ flexShrink:0, width:70, display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
          <div style={{ ...shimmer, width:36, height:36, borderRadius:'50%' }} />
          <div style={{ ...shimmer, height:8, width:'80%' }} />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 애널리스트 커버리지 게이지
// ────────────────────────────────────────────────────────────
function AnalystGauge({ count, change }: { count: number; change: number }) {
  const MAX = 55
  const pct = Math.min(98, (count / MAX) * 100)
  const color =
    count <= 5  ? C.green   :
    count <= 15 ? '#86efac' :
    count <= 25 ? C.amber   :
    count <= 35 ? '#fb923c' : C.red
  const zoneLabel =
    count <= 5  ? '소외 구간 (유령)' :
    count <= 10 ? '소형 커버'        :
    count <= 20 ? '중형 커버'        :
    count <= 35 ? '과열 커버'        : '초과열 (총공세)'

  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Users size={12} color={color} />
          <span style={{ fontSize:11, fontWeight:800, color, fontFamily:'monospace' }}>{count}명</span>
          {change !== 0 && (
            <span style={{
              fontSize:9, padding:'1px 5px', borderRadius:4,
              background: change > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(34,197,94,0.12)',
              color: change > 0 ? C.red : C.green, fontWeight:700,
            }}>
              {change > 0 ? `+${change}` : change}
            </span>
          )}
        </div>
        <span style={{ fontSize:9, color:C.textLow }}>{zoneLabel}</span>
      </div>
      <div style={{ position:'relative', height:7, borderRadius:4, background:'rgba(51,65,85,0.6)', overflow:'hidden' }}>
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to right, rgba(34,197,94,0.45) 0%, rgba(134,239,172,0.35) 10%, rgba(251,191,36,0.40) 30%, rgba(251,146,60,0.45) 64%, rgba(239,68,68,0.55) 100%)',
          borderRadius:4,
        }} />
        <div style={{
          position:'absolute', top:-1,
          left:`clamp(2px, calc(${pct}% - 5px), calc(100% - 10px))`,
          width:10, height:9, borderRadius:2,
          background:color, boxShadow:`0 0 6px ${color}`, zIndex:2,
          transition:'left 0.5s ease',
        }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
        <span style={{ fontSize:8, color:'rgba(34,197,94,0.5)' }}>0 유령</span>
        <span style={{ fontSize:8, color:'rgba(251,191,36,0.5)' }}>15 적정</span>
        <span style={{ fontSize:8, color:'rgba(239,68,68,0.5)' }}>35+ 과열</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 내부자 거래 인디케이터
// ────────────────────────────────────────────────────────────
function InsiderIndicator({ record }: { record: GhostRecord }) {
  const dir    = insiderDir(record)
  const meta   = DIR_META[dir]
  const total  = record.insiderBuys + record.insiderSells
  const buyPct = total > 0 ? (record.insiderBuys / total) * 100 : 50

  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
        <UserCheck size={12} color={meta.color} />
        <span style={{ fontSize:11, fontWeight:800, color:meta.color }}>{meta.label}</span>
        <span style={{
          fontSize:9, padding:'1px 6px', borderRadius:20,
          background:meta.bg, color:meta.color, border:`1px solid ${meta.color}30`, fontWeight:800,
        }}>
          {meta.icon} {dir.includes('buy') ? `매수 ${record.insiderBuys}건` : dir === 'neutral' ? '변동없음' : `매도 ${record.insiderSells}건`}
        </span>
      </div>
      <div style={{ height:7, borderRadius:4, overflow:'hidden', background:'rgba(239,68,68,0.25)', display:'flex' }}>
        <div style={{
          width:`${buyPct}%`, height:'100%',
          background: buyPct > 50 ? 'rgba(34,197,94,0.7)' : 'rgba(34,197,94,0.3)',
          borderRadius:'4px 0 0 4px', transition:'width 0.5s ease',
        }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
        <span style={{ fontSize:8, color:'rgba(34,197,94,0.6)' }}>매수 {record.insiderBuys}건 ({record.insiderBuyAmt})</span>
        <span style={{ fontSize:8, color:'rgba(239,68,68,0.6)' }}>매도 {record.insiderSells}건 ({record.insiderSellAmt})</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 비주식 자산 플레이스홀더 카드 (ETF·원자재·암호화폐)
// ────────────────────────────────────────────────────────────
function NonEquityCard({ asset }: { asset: ExcludedAsset }) {
  const typeColor =
    asset.assetType === 'CRYPTO'    ? '#c084fc' :
    asset.assetType === 'COMMODITY' ? '#fbbf24' : '#60a5fa'
  const typeBg =
    asset.assetType === 'CRYPTO'    ? 'rgba(192,132,252,0.08)' :
    asset.assetType === 'COMMODITY' ? 'rgba(251,191,36,0.08)'  : 'rgba(59,130,246,0.08)'
  const typeBorder =
    asset.assetType === 'CRYPTO'    ? 'rgba(192,132,252,0.25)' :
    asset.assetType === 'COMMODITY' ? 'rgba(251,191,36,0.25)'  : 'rgba(59,130,246,0.25)'

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      background: C.card, border: `1px solid ${typeBorder}`,
      opacity: 0.75,
    }}>
      {/* 블러 오버레이 효과 */}
      <div style={{
        padding: '12px 16px',
        background: `linear-gradient(135deg, ${typeBg}, rgba(15,23,42,0.6))`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* 제외 마커 */}
        <div style={{
          flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
          background: typeBg, border: `2px dashed ${typeBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {asset.badgeIcon}
        </div>

        {/* 종목 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3,
              background: 'rgba(96,165,250,0.12)', color: C.blue,
              fontFamily: 'monospace', fontWeight: 900,
            }}>{asset.ticker}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMid }}>{asset.name}</span>
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 20,
              background: typeBg, color: typeColor, border: `1px solid ${typeBorder}`,
              fontWeight: 800,
            }}>
              {asset.badgeIcon} {asset.badgeLabel}
            </span>
          </div>
          {/* 린치 가이드 메시지 */}
          <div style={{
            fontSize: 11, color: C.textMid, lineHeight: 1.6,
            padding: '6px 10px', borderRadius: 8,
            background: 'rgba(15,23,42,0.5)', border: `1px solid ${typeBorder}`,
          }}>
            {asset.lynchGuidance}
          </div>
        </div>

        {/* 분석 불가 배지 */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontSize: 9, padding: '4px 10px', borderRadius: 20,
            background: 'rgba(100,116,139,0.15)', color: C.textLow,
            border: '1px dashed rgba(100,116,139,0.3)', fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            🚫 린치 분석 제외
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Ghost Score 링
// ────────────────────────────────────────────────────────────
function GhostScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? C.amber : score >= 55 ? C.green : score >= 35 ? C.blue : C.textLow
  const size  = 44
  const r     = 18
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(51,65,85,0.6)" strokeWidth={4} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      }}>
        <span style={{ fontSize:11, fontWeight:900, color, lineHeight:1, fontFamily:'monospace' }}>{score}</span>
        <span style={{ fontSize:7, color:C.textLow, lineHeight:1, marginTop:1 }}>GHOST</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 개별 종목 카드
// ────────────────────────────────────────────────────────────
function GhostCard({ record }: { record: GhostRecord }) {
  const [expanded, setExpanded] = useState(false)
  const grade   = GRADE_META[record.ghostGrade]
  const dir     = insiderDir(record)
  const dirMeta = DIR_META[dir]

  return (
    <div style={{ borderRadius:12, overflow:'hidden', background:C.card, border:`1px solid ${grade.border}` }}>
      <div
        style={{ padding:'14px 16px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <GhostScoreRing score={record.ghostScore} />

          {/* 종목 정보 */}
          <div style={{ flexShrink:0, width:200, minWidth:180 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{
                fontSize:9, padding:'1px 6px', borderRadius:3,
                background:'rgba(96,165,250,0.15)', color:C.blue,
                fontFamily:'monospace', fontWeight:900,
              }}>{record.ticker}</span>
              <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3,
                background:'rgba(192,132,252,0.12)', color:C.purple, fontWeight:700 }}>보유중</span>
            </div>
            <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:4, lineHeight:1.3 }}>{record.name}</div>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 9px', borderRadius:20, background:grade.bg, border:`1px solid ${grade.border}`,
            }}>
              <span style={{ fontSize:11 }}>{grade.icon}</span>
              <span style={{ fontSize:9, fontWeight:800, color:grade.color, whiteSpace:'nowrap' }}>{grade.label}</span>
            </div>
          </div>

          {/* 기관 커버리지 */}
          <div style={{
            flex:1, minWidth:0, padding:'0 12px',
            borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:9, color:C.textLow, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
              <Building2 size={10} /> 기관 커버리지
            </div>
            <AnalystGauge count={record.analystCount} change={record.analystChange} />
          </div>

          {/* 내부자 거래 */}
          <div style={{ flex:1, minWidth:0, padding:'0 12px', borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.textLow, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
              <UserCheck size={10} /> 내부자 거래 (3개월)
            </div>
            <InsiderIndicator record={record} />
          </div>

          {/* 방향 + 펼치기 */}
          <div style={{ flexShrink:0, width:70, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{
              width:36, height:36, borderRadius:'50%',
              background:dirMeta.bg, border:`1px solid ${dirMeta.color}30`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {dir === 'strong_buy' || dir === 'buy'
                ? <TrendingUp   size={18} color={dirMeta.color} />
                : dir === 'strong_sell' || dir === 'sell'
                ? <TrendingDown size={18} color={dirMeta.color} />
                : <Minus        size={18} color={dirMeta.color} />
              }
            </div>
            <span style={{ fontSize:8, color:dirMeta.color, fontWeight:700, textAlign:'center' }}>{dirMeta.label}</span>
            {expanded ? <ChevronUp size={12} color={C.textLow} /> : <ChevronDown size={12} color={C.textLow} />}
          </div>
        </div>
      </div>

      {/* 확장 상세 */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 16px', background:C.surface }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div style={{ padding:'10px 12px', borderRadius:9, background:C.card, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, color:C.blue, fontWeight:800, marginBottom:5, display:'flex', alignItems:'center', gap:4 }}>
                <Building2 size={10} /> 기관 분석 해석
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>{record.analystComment}</div>
            </div>
            <div style={{ padding:'10px 12px', borderRadius:9, background:C.card, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, color:C.green, fontWeight:800, marginBottom:5, display:'flex', alignItems:'center', gap:4 }}>
                <UserCheck size={10} /> 내부자 거래 해석
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>{record.insiderComment}</div>
              <div style={{ marginTop:6, fontSize:10, color:C.textLow }}>
                최근: <span style={{ color:C.textMid }}>{record.lastActivity}</span>
                <span style={{ color:C.textLow }}> ({record.lastActivityDays}일 전)</span>
              </div>
            </div>
          </div>
          <div style={{
            padding:'12px 14px', borderRadius:10,
            background:grade.bg, border:`1px solid ${grade.border}`,
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <div style={{
              flexShrink:0, width:32, height:32, borderRadius:8,
              background:grade.bg, border:`1px solid ${grade.border}`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            }}>{grade.icon}</div>
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:grade.color, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                <Ghost size={10} /> 피터 린치의 한마디
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.8, fontStyle:'italic' }}>
                {record.lynchVerdict}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LynchGhostStockPanel() {

  // ── 상태 ─────────────────────────────────────────────────
  const [records,    setRecords]    = useState<GhostRecord[]>([])
  const [excluded,   setExcluded]   = useState<ExcludedAsset[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [meta,       setMeta]       = useState<ApiResponse['meta'] | null>(null)
  const [filterGrade, setFilterGrade] = useState<GhostGrade | 'all'>('all')
  const [sortBy,     setSortBy]     = useState<'score' | 'analyst' | 'insider'>('score')
  const [lastFetch,  setLastFetch]  = useState<string>('')

  // ── 데이터 Fetch ─────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/lynch/ghost-stock', { cache: 'no-store' })
      const body = await res.json() as ApiResponse

      if (!res.ok) {
        setError(body.error ?? `API 오류 (${res.status})`)
        return
      }
      setRecords((body.records ?? []).map(mapApiRow))
      setExcluded(body.excluded ?? [])
      setMeta(body.meta ?? null)
      setLastFetch(new Date().toLocaleTimeString('ko-KR'))
    } catch (e) {
      setError('네트워크 오류: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── 집계 ─────────────────────────────────────────────────
  const diamondCount = records.filter(r => r.ghostGrade === 'diamond').length
  const pearlCount   = records.filter(r => r.ghostGrade === 'pearl').length
  const hotCount     = records.filter(r => r.ghostGrade === 'hotspot' || r.ghostGrade === 'crowded').length
  const topGhost     = [...records].sort((a,b) => b.ghostScore - a.ghostScore)[0] ?? null

  // ── 필터 + 정렬 ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = filterGrade === 'all' ? records : records.filter(r => r.ghostGrade === filterGrade)
    if (sortBy === 'score')   return [...list].sort((a,b) => b.ghostScore - a.ghostScore)
    if (sortBy === 'analyst') return [...list].sort((a,b) => a.analystCount - b.analystCount)
    return [...list].sort((a,b) => (b.insiderBuys - b.insiderSells) - (a.insiderBuys - a.insiderSells))
  }, [records, filterGrade, sortBy])

  // ────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{
        padding:'16px 20px 12px', borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{
          width:36, height:36, borderRadius:9,
          background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <Ghost size={18} color={C.amber} />
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:900, color:C.textHi }}>월가의 유령 종목 추적기</div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            기관 소외 × 내부자 매수 = 린치형 대박 후보 · 카드 클릭 시 상세 분석
          </div>
        </div>

        {/* No.1 유령 종목 배지 */}
        {!loading && topGhost && (
          <div style={{
            marginLeft:'auto', display:'flex', alignItems:'center', gap:8,
            padding:'6px 12px', borderRadius:10,
            background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)',
          }}>
            <Sparkles size={13} color={C.amber} />
            <div>
              <div style={{ fontSize:9, color:C.textLow }}>이번 주 No.1 유령 종목</div>
              <div style={{ fontSize:12, fontWeight:800, color:C.amber }}>{topGhost.name} ({topGhost.ticker})</div>
            </div>
            <div style={{
              fontSize:11, fontWeight:900, color:C.amber, fontFamily:'monospace',
              padding:'2px 8px', borderRadius:6, background:'rgba(251,191,36,0.12)',
            }}>
              {topGhost.ghostScore}점
            </div>
          </div>
        )}

        {/* 새로고침 버튼 */}
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`,
            background:C.card, color:C.textMid, cursor:'pointer', fontSize:11,
            marginLeft: topGhost ? 8 : 'auto',
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? '수집 중…' : `새로고침 ${lastFetch ? '(' + lastFetch + ')' : ''}`}
        </button>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── 에러 배너 ───────────────────────────────────── */}
        {error && (
          <div style={{
            padding:'12px 16px', borderRadius:10,
            background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)',
            display:'flex', gap:10, alignItems:'center',
          }}>
            <AlertTriangle size={15} color={C.red} />
            <div style={{ fontSize:11, color:C.red }}>{error}</div>
            <button onClick={fetchData} style={{ marginLeft:'auto', fontSize:10, color:C.red, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
              재시도
            </button>
          </div>
        )}

        {/* ── 요약 KPI ─────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[
            { label:'특급 유령 💎', count: loading ? '—' : diamondCount, color:C.amber,   bg:'rgba(251,191,36,0.10)', border:'rgba(251,191,36,0.25)', desc:'사각지대+내부자 매수' },
            { label:'잠재 진주 🌱', count: loading ? '—' : pearlCount,   color:C.green,   bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.25)',  desc:'소형커버+매수 우세' },
            { label:'과열 종목 🔒', count: loading ? '—' : hotCount,     color:C.red,     bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.25)',  desc:'고커버리지 경계' },
            { label:'분석 종목',   count: loading ? '—' : records.length, color:C.blue,   bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.25)', desc:'포트폴리오 연동' },
          ].map(item => (
            <div key={item.label} style={{
              padding:'11px 14px', borderRadius:10, textAlign:'center',
              background:item.bg, border:`1px solid ${item.border}`,
            }}>
              <div style={{ fontSize:13, fontWeight:900, color:item.color, fontFamily:'monospace', marginBottom:2 }}>
                {item.count}
              </div>
              <div style={{ fontSize:10, color:item.color, fontWeight:700, marginBottom:1 }}>{item.label}</div>
              <div style={{ fontSize:9, color:C.textLow }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* ── 캐시 상태 표시 ───────────────────────────────── */}
        {!loading && meta && (
          <div style={{
            padding:'8px 14px', borderRadius:8,
            background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`,
            display:'flex', gap:8, alignItems:'center',
          }}>
            <Database size={12} color={C.blue} />
            <div style={{ fontSize:10, color:C.textLow }}>
              포트폴리오 {meta.totalHoldings}종목 분석 완료 ·{' '}
              <span style={{ color:C.green }}>캐시 HIT {meta.cacheHit}개</span>
              {meta.cacheMiss > 0 && (
                <span style={{ color:C.amber }}> · 신규 수집 {meta.cacheMiss}개</span>
              )}
              <span style={{ color:C.textLow }}> · 하루 1회 갱신 전략</span>
            </div>
          </div>
        )}

        {/* ── 린치 원칙 배너 ──────────────────────────────── */}
        <div style={{
          padding:'10px 14px', borderRadius:10,
          background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)',
          display:'flex', gap:10, alignItems:'flex-start',
        }}>
          <Info size={14} color={C.amber} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:11, color:C.textLow, lineHeight:1.7 }}>
            <strong style={{ color:C.amber }}>피터 린치의 핵심 원칙:</strong>{' '}
            &quot;월가 애널리스트가 팔로우하지 않고, 임원이 자기 돈으로 사는 종목이 10루타 후보입니다.
            기관이 발견하기 전에 먼저 들어가는 것이 개인 투자자의 유일한 이점입니다.&quot;
            <span style={{ color:C.textLow }}> — Ghost Score: 기관 소외 40pt + 내부자 매수 40pt + 기관 보유 낮음 20pt</span>
          </div>
        </div>

        {/* ── 필터 & 정렬 ─────────────────────────────────── */}
        {!loading && records.length > 0 && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:C.textLow, fontWeight:700 }}>등급 필터:</span>
            {(['all', 'diamond', 'pearl', 'radar', 'hotspot', 'crowded'] as const).map(g => {
              const gradeM = g === 'all' ? null : GRADE_META[g]
              const active = filterGrade === g
              return (
                <button key={g} onClick={() => setFilterGrade(g)} style={{
                  padding:'4px 11px', borderRadius:20, fontSize:10, fontWeight:700,
                  cursor:'pointer', border:'none',
                  background: active ? (gradeM ? gradeM.bg : 'rgba(96,165,250,0.15)') : C.card,
                  color:      active ? (gradeM ? gradeM.color : C.blue) : C.textLow,
                  outline: active ? `1px solid ${gradeM ? gradeM.border : 'rgba(96,165,250,0.3)'}` : '1px solid transparent',
                }}>
                  {g === 'all' ? '전체' : `${gradeM!.icon} ${gradeM!.label}`}
                </button>
              )
            })}
            <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:10, color:C.textLow }}>정렬:</span>
              {(['score', 'analyst', 'insider'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  padding:'3px 9px', borderRadius:6, fontSize:10, cursor:'pointer', border:'none',
                  background: sortBy === s ? 'rgba(96,165,250,0.12)' : C.card,
                  color:      sortBy === s ? C.blue : C.textLow,
                  outline: sortBy === s ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                }}>
                  {s === 'score' ? 'Ghost 점수' : s === 'analyst' ? '애널 ↑' : '내부자 매수 ↑'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 카드 리스트 / 스켈레톤 / Empty ──────────────── */}
        {loading ? (
          // 스켈레톤 UI — 데이터 수집 중
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[0,1,2].map(i => <SkeletonCard key={i} />)}
            <div style={{ textAlign:'center', fontSize:11, color:C.textLow, padding:'8px 0' }}>
              <RefreshCw size={13} style={{ display:'inline-block', verticalAlign:'middle', marginRight:6, animation:'spin 1s linear infinite' }} />
              보유 종목 Ghost Score 계산 중...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          // Empty State
          <div style={{
            padding:'48px 24px', textAlign:'center',
            background:C.card, border:`1px dashed ${C.border}`, borderRadius:12,
          }}>
            <Ghost size={32} style={{ margin:'0 auto 12px', opacity:0.25 }} />
            <div style={{ fontSize:14, fontWeight:800, color:C.textHi, marginBottom:6 }}>
              {records.length === 0 ? '등록된 포트폴리오 종목이 없습니다' : '선택한 등급의 종목이 없습니다'}
            </div>
            <div style={{ fontSize:11, color:C.textLow, lineHeight:1.8, maxWidth:360, margin:'0 auto' }}>
              {records.length === 0
                ? '자산 관리 메뉴에서 종목을 추가하면 Ghost Score 분석이 시작됩니다.'
                : '다른 등급 필터를 선택해보세요.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(r => <GhostCard key={r.ticker} record={r} />)}
          </div>
        )}

        {/* ── 린치 분석 제외 자산 섹션 (ETF·CRYPTO·COMMODITY) ── */}
        {!loading && excluded.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 11, color: C.textLow, fontWeight: 700 }}>
                🚫 린치 분석 제외 자산 ({excluded.length}개)
              </span>
              <span style={{ fontSize: 10, color: C.textLow }}>
                — ETF·암호화폐·원자재는 기업 경영진이 없어 개별 분석이 불가합니다
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {excluded.map(asset => (
                <NonEquityCard key={asset.ticker} asset={asset} />
              ))}
            </div>
          </div>
        )}

        {/* ── 데이터 출처 안내 ─────────────────────────────── */}
        <div style={{
          padding:'9px 14px', borderRadius:9,
          background:'rgba(100,116,139,0.08)', border:`1px solid ${C.border}`,
          display:'flex', gap:8, alignItems:'center',
        }}>
          <ShieldCheck size={13} color={C.textLow} />
          <div style={{ fontSize:10, color:C.textLow, lineHeight:1.5 }}>
            <strong style={{ color:C.textMid }}>데이터 파이프라인:</strong>{' '}
            Supabase <code style={{ background:C.cardHi, padding:'1px 4px', borderRadius:3, fontSize:9 }}>investments</code> →{' '}
            <code style={{ background:C.cardHi, padding:'1px 4px', borderRadius:3, fontSize:9 }}>/api/lynch/ghost-stock</code> →{' '}
            <code style={{ background:C.cardHi, padding:'1px 4px', borderRadius:3, fontSize:9 }}>ghost_stock_cache</code> (일 1회 갱신) ·
            내부자 거래: FMP/SEC Edgar · 기관 커버리지: FMP/Yahoo Finance
          </div>
        </div>

      </div>
    </div>
  )
}
