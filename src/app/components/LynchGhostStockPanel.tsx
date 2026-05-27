'use client'

/**
 * LynchGhostStockPanel — 월가의 유령 종목 추적기
 *
 * 피터 린치 원칙:
 *  "기관 애널리스트들이 소외하고, 내부자(임원·대주주)가 직접 사는 종목이 진짜 대박주다."
 *
 * ◆ 데이터 구조
 *   GHOST_MOCK: 내부 가상 데이터 (추후 백엔드 일일 캐시로 교체 가능)
 *   portfolioStocks: 부모에서 주입 → 포트폴리오 보유 여부 오버레이
 */

import { useState, useMemo } from 'react'
import {
  Ghost, TrendingUp, TrendingDown, Minus,
  Users, Building2, UserCheck,
  ChevronDown, ChevronUp,
  Sparkles, ShieldCheck, Info,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
type GhostGrade = 'diamond' | 'pearl' | 'radar' | 'hotspot' | 'crowded'
type InsiderDir = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'

interface GhostRecord {
  ticker:                string
  name:                  string
  lynchType:             string
  market:                'US' | 'KR'
  // 기관 커버리지
  analystCount:          number
  analystChange:         number   // 전분기 대비 증감
  instOwnership:         number   // 기관 보유 비중 (%)
  // 내부자 거래 (최근 3개월)
  insiderBuys:           number
  insiderSells:          number
  insiderBuyAmt:         string
  insiderSellAmt:        string
  lastActivity:          string
  lastActivityDays:      number
  // 등급 & 코멘트
  ghostGrade:            GhostGrade
  lynchVerdict:          string
  analystComment:        string
  insiderComment:        string
}

// ────────────────────────────────────────────────────────────
// 가상 데이터셋 (추후 백엔드 /api/ghost-stocks 로 교체)
// ────────────────────────────────────────────────────────────
const GHOST_MOCK: Record<string, GhostRecord> = {
  ETN: {
    ticker:'ETN', name:'Eaton Corporation PLC', lynchType:'대형우량주', market:'US',
    analystCount:35, analystChange:+3, instOwnership:82,
    insiderBuys:0, insiderSells:3, insiderBuyAmt:'$0', insiderSellAmt:'$12.4M',
    lastActivity:'CFO Craig Arnold 스톡옵션 행사 후 매도',
    lastActivityDays:12,
    ghostGrade:'hotspot',
    lynchVerdict:'"이미 소문난 잔치집입니다. 35명의 월가 애널리스트가 들여다보고, 내부자도 차익실현 중이니 린치 기준 매력이 줄었습니다. 우량한 기업이지만 숨겨진 진주는 아닙니다."',
    analystComment:'35명 커버리지 — 대형주 정밀 추적 중. 기관 보유 비중 82%로 유동물량이 제한적입니다.',
    insiderComment:'최근 3개월 임원 3명 스톡옵션 행사 및 장내 매도 확인. 순매도 기조.',
  },
  GOOGL: {
    ticker:'GOOGL', name:'Alphabet Inc.', lynchType:'대형우량주', market:'US',
    analystCount:52, analystChange:+1, instOwnership:71,
    insiderBuys:1, insiderSells:8, insiderBuyAmt:'$2.1M', insiderSellAmt:'$89.3M',
    lastActivity:'Sundar Pichai 보상 스톡 정기 매도',
    lastActivityDays:5,
    ghostGrade:'crowded',
    lynchVerdict:'"월가의 총아입니다. 52명의 애널리스트에 CEO까지 팔고 있군요. 탁월한 기업이지만, 린치가 찾는 유령 종목과는 정반대입니다. 이미 모두가 아는 회사입니다."',
    analystComment:'52명 초대형 커버리지. 기관이 71% 보유. 신규 기관 자금 유입 여지가 제한적입니다.',
    insiderComment:'최근 3개월 내부자 매도 8건($89.3M) vs 매수 1건($2.1M). 순매도 압도적 우세.',
  },
  PLTR: {
    ticker:'PLTR', name:'Palantir Technologies', lynchType:'고성장주', market:'US',
    analystCount:22, analystChange:+4, instOwnership:44,
    insiderBuys:0, insiderSells:12, insiderBuyAmt:'$0', insiderSellAmt:'$178M',
    lastActivity:'CEO Alex Karp 10b5-1 계획 매도 진행',
    lastActivityDays:7,
    ghostGrade:'radar',
    lynchVerdict:'"22명이 보는 중견 커버리지이지만, CEO가 계획적으로 지속 매도 중입니다. AI 사업은 탁월하지만, 내부자 신호가 찜찜합니다. 사업 스토리와 경영진 행동이 따로 놉니다."',
    analystComment:'22명 커버리지 — 성장주로 적정 수준. 기관 비중 44%로 추가 유입 여지 존재.',
    insiderComment:'CEO Alex Karp의 사전 매도 계획(10b5-1) 지속 실행 중. 최근 3개월 $178M 규모 매도.',
  },
  GEV: {
    ticker:'GEV', name:'GE Vernova Inc.', lynchType:'턴어라운드주', market:'US',
    analystCount:8, analystChange:+5, instOwnership:38,
    insiderBuys:4, insiderSells:1, insiderBuyAmt:'$6.8M', insiderSellAmt:'$0.9M',
    lastActivity:'CEO Scott Strazik 2만주 장내 매수',
    lastActivityDays:18,
    ghostGrade:'pearl',
    lynchVerdict:'"이제 막 주목받기 시작한 분사 기업! 아직 8명만 커버하고 CEO가 자기 돈으로 사고 있습니다. 린치라면 이런 초기 발굴 신호를 절대 놓치지 않습니다. 소문이 퍼지기 전에 선점하세요."',
    analystComment:'GE 분사 1년차 — 커버리지 빠르게 증가 중(+5/분기). 초기 발굴 단계.',
    insiderComment:'최근 3개월 CEO 포함 임원 4명 장내 매수 $6.8M. 단 $0.9M 소규모 매도. 강한 순매수 신호.',
  },
  TEM: {
    ticker:'TEM', name:'Tempus AI Inc.', lynchType:'고성장주', market:'US',
    analystCount:3, analystChange:+2, instOwnership:22,
    insiderBuys:6, insiderSells:0, insiderBuyAmt:'$15.2M', insiderSellAmt:'$0',
    lastActivity:'이사회 멤버 3인 연속 장내 매수 (8일 전)',
    lastActivityDays:8,
    ghostGrade:'diamond',
    lynchVerdict:'"바로 이겁니다! 고작 3명의 애널리스트가 보는 월가의 사각지대인데, 임원들은 자기 돈으로 쓸어 담고 있습니다. 심봤습니다! 린치가 인생에서 찾는 종목이 바로 이것입니다. 묻어두고 기다리세요!"',
    analystComment:'3명 초소형 커버리지. 기관 비중 22%로 대규모 기관 자금 유입 시 폭발적 상승 여지 충분.',
    insiderComment:'최근 3개월 내부자 순매수 6건 총 $15.2M. 매도 ZERO. 경영진 전원 강력 매수 신호.',
  },
  // 국내 소형주 예시
  '189300': {
    ticker:'189300', name:'인텔리안테크', lynchType:'고성장주', market:'KR',
    analystCount:4, analystChange:-1, instOwnership:31,
    insiderBuys:2, insiderSells:1, insiderBuyAmt:'₩2.1억', insiderSellAmt:'₩0.8억',
    lastActivity:'대표이사 5,000주 장내 매수',
    lastActivityDays:22,
    ghostGrade:'pearl',
    lynchVerdict:'"국내 위성 안테나 독점 기업인데 고작 4명이 분석 중입니다. 대표이사가 장내에서 직접 사고 있군요. 린치식 소외 성장주의 교과서 사례입니다. 인내심을 갖고 보세요."',
    analystComment:'4명 소형 커버리지 — 국내 기관 레이더 밖의 종목. 기관 비중 31%로 저변 확대 여지.',
    insiderComment:'최근 3개월 대표이사 장내 매수 2건 ₩2.1억. 소규모 매도 1건 ₩0.8억.',
  },
}

// ────────────────────────────────────────────────────────────
// 등급 메타데이터
// ────────────────────────────────────────────────────────────
const GRADE_META: Record<GhostGrade, { icon:string; label:string; color:string; bg:string; border:string; desc:string }> = {
  diamond: { icon:'💎', label:'특급 유령 종목', color:'#fbbf24', bg:'rgba(251,191,36,0.12)', border:'rgba(251,191,36,0.35)', desc:'월가 사각지대 + 내부자 강력 매수' },
  pearl:   { icon:'🌱', label:'잠재 진주 종목', color:'#4ade80', bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.30)',  desc:'소형 커버리지 + 내부자 매수 우세' },
  radar:   { icon:'🔭', label:'주목 구간',      color:'#60a5fa', bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.28)', desc:'중형 커버리지 — 내부자 주의 신호' },
  hotspot: { icon:'📢', label:'월가 핫플',      color:'#fb923c', bg:'rgba(251,146,60,0.10)', border:'rgba(251,146,60,0.30)', desc:'고커버리지 — 이미 알려진 종목' },
  crowded: { icon:'🔒', label:'월가 총공세',    color:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.28)',  desc:'초과열 커버리지 + 내부자 차익실현' },
}

// 컬러 팔레트
const C = {
  bg:'#020617', surface:'#0f172a', card:'#1e293b', cardHi:'#263348',
  border:'#334155', textHi:'#f1f5f9', textMid:'#94a3b8', textLow:'#64748b',
  green:'#4ade80', red:'#f87171', amber:'#fbbf24', blue:'#60a5fa', purple:'#c084fc',
}

// ────────────────────────────────────────────────────────────
// 린치 유령 스코어 계산 (0~100)
// ────────────────────────────────────────────────────────────
function calcGhostScore(r: GhostRecord): number {
  // 기관 커버리지 (40점)
  const coverScore =
    r.analystCount <= 3  ? 40 :
    r.analystCount <= 7  ? 35 :
    r.analystCount <= 15 ? 22 :
    r.analystCount <= 25 ? 12 : 4

  // 내부자 순매수 (40점)
  const netBuy = r.insiderBuys - r.insiderSells
  const insiderScore =
    netBuy >= 4 ? 40 :
    netBuy >= 2 ? 30 :
    netBuy >= 1 ? 20 :
    netBuy === 0 ? 10 : 0

  // 기관 보유 비중 (20점) — 낮을수록 유입 여지 큼
  const instScore =
    r.instOwnership < 25 ? 20 :
    r.instOwnership < 50 ? 14 :
    r.instOwnership < 75 ? 7  : 2

  return Math.min(100, coverScore + insiderScore + instScore)
}

// ────────────────────────────────────────────────────────────
// 내부자 방향성
// ────────────────────────────────────────────────────────────
function insiderDir(r: GhostRecord): InsiderDir {
  const net = r.insiderBuys - r.insiderSells
  if (net >= 3)  return 'strong_buy'
  if (net >= 1)  return 'buy'
  if (net === 0) return 'neutral'
  if (net >= -2) return 'sell'
  return 'strong_sell'
}

const DIR_META = {
  strong_buy:  { color:C.green,  icon:'↑↑', label:'강한 매수', bg:'rgba(34,197,94,0.1)' },
  buy:         { color:'#86efac', icon:'↑',  label:'매수 우세', bg:'rgba(34,197,94,0.07)' },
  neutral:     { color:C.textLow,icon:'—',  label:'중립',      bg:'rgba(100,116,139,0.1)' },
  sell:        { color:'#fca5a5', icon:'↓',  label:'매도 우세', bg:'rgba(239,68,68,0.07)' },
  strong_sell: { color:C.red,    icon:'↓↓', label:'강한 매도', bg:'rgba(239,68,68,0.1)' },
}

// ────────────────────────────────────────────────────────────
// 애널리스트 커버리지 게이지
// ────────────────────────────────────────────────────────────
function AnalystGauge({ count, change }: { count: number; change: number }) {
  const MAX = 55
  const pct = Math.min(98, (count / MAX) * 100)
  const color =
    count <= 5  ? C.green  :
    count <= 15 ? '#86efac':
    count <= 25 ? C.amber  :
    count <= 35 ? '#fb923c': C.red
  const zoneLabel =
    count <= 5  ? '소외 구간 (유령)' :
    count <= 10 ? '소형 커버' :
    count <= 20 ? '중형 커버' :
    count <= 35 ? '과열 커버' : '초과열 (총공세)'

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
      {/* 트랙 */}
      <div style={{
        position:'relative', height:7, borderRadius:4,
        background:'rgba(51,65,85,0.6)',
        overflow:'hidden',
      }}>
        {/* 구간 색상 배경 */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to right, rgba(34,197,94,0.45) 0%, rgba(134,239,172,0.35) 10%, rgba(251,191,36,0.40) 30%, rgba(251,146,60,0.45) 64%, rgba(239,68,68,0.55) 100%)',
          borderRadius:4,
        }} />
        {/* 현재 위치 마커 */}
        <div style={{
          position:'absolute', top:-1,
          left:`clamp(2px, calc(${pct}% - 5px), calc(100% - 10px))`,
          width:10, height:9, borderRadius:2,
          background: color,
          boxShadow:`0 0 6px ${color}`,
          zIndex:2,
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
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
        <UserCheck size={12} color={meta.color} />
        <span style={{ fontSize:11, fontWeight:800, color:meta.color }}>{meta.label}</span>
        <span style={{
          fontSize:9, padding:'1px 6px', borderRadius:20,
          background:meta.bg, color:meta.color, border:`1px solid ${meta.color}30`,
          fontWeight:800,
        }}>
          {meta.icon} {dir.includes('buy') ? `매수 ${record.insiderBuys}건` : dir === 'neutral' ? '변동없음' : `매도 ${record.insiderSells}건`}
        </span>
      </div>

      {/* Buy/Sell 밸런스 바 */}
      <div style={{
        height:7, borderRadius:4, overflow:'hidden',
        background:'rgba(239,68,68,0.25)',
        display:'flex',
      }}>
        <div style={{
          width:`${buyPct}%`, height:'100%',
          background: buyPct > 50 ? 'rgba(34,197,94,0.7)' : 'rgba(34,197,94,0.3)',
          borderRadius:'4px 0 0 4px',
          transition:'width 0.5s ease',
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
// 린치 유령 스코어 링
// ────────────────────────────────────────────────────────────
function GhostScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? C.amber :
    score >= 55 ? C.green :
    score >= 35 ? C.blue  : C.textLow
  const size = 44
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(51,65,85,0.6)" strokeWidth={4} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
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
function GhostCard({ record, inPortfolio }: { record: GhostRecord; inPortfolio: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const grade = GRADE_META[record.ghostGrade]
  const score = calcGhostScore(record)
  const dir   = insiderDir(record)
  const dirMeta = DIR_META[dir]

  return (
    <div style={{
      borderRadius:12, overflow:'hidden',
      background:C.card, border:`1px solid ${grade.border}`,
      transition:'border-color 0.2s',
    }}>
      {/* ── 카드 메인 영역 ── */}
      <div
        style={{ padding:'14px 16px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>

          {/* ── 좌: 유령 스코어 링 ── */}
          <GhostScoreRing score={score} />

          {/* ── 종목 정보 + 등급 배지 ── */}
          <div style={{ flexShrink:0, width:200, minWidth:180 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{
                fontSize:9, padding:'1px 6px', borderRadius:3,
                background:'rgba(96,165,250,0.15)', color:C.blue,
                fontFamily:'monospace', fontWeight:900,
              }}>
                {record.ticker}
              </span>
              {inPortfolio && (
                <span style={{
                  fontSize:8, padding:'1px 5px', borderRadius:3,
                  background:'rgba(192,132,252,0.12)', color:C.purple, fontWeight:700,
                }}>
                  보유중
                </span>
              )}
            </div>
            <div style={{ fontSize:12, fontWeight:800, color:C.textHi, marginBottom:4, lineHeight:1.3 }}>
              {record.name}
            </div>
            {/* 등급 배지 */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 9px', borderRadius:20,
              background:grade.bg, border:`1px solid ${grade.border}`,
            }}>
              <span style={{ fontSize:11 }}>{grade.icon}</span>
              <span style={{ fontSize:9, fontWeight:800, color:grade.color, whiteSpace:'nowrap' }}>{grade.label}</span>
            </div>
          </div>

          {/* ── 기관 커버리지 ── */}
          <div style={{
            flex:1, minWidth:0, padding:'0 12px',
            borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:9, color:C.textLow, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
              <Building2 size={10} /> 기관 커버리지
            </div>
            <AnalystGauge count={record.analystCount} change={record.analystChange} />
          </div>

          {/* ── 내부자 거래 ── */}
          <div style={{ flex:1, minWidth:0, padding:'0 12px', borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.textLow, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
              <UserCheck size={10} /> 내부자 거래 (3개월)
            </div>
            <InsiderIndicator record={record} />
          </div>

          {/* ── 우: 방향 + 펼치기 ── */}
          <div style={{ flexShrink:0, width:70, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            {/* 방향 아이콘 */}
            <div style={{
              width:36, height:36, borderRadius:'50%',
              background:dirMeta.bg, border:`1px solid ${dirMeta.color}30`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {dir === 'strong_buy' || dir === 'buy'
                ? <TrendingUp size={18} color={dirMeta.color} />
                : dir === 'strong_sell' || dir === 'sell'
                ? <TrendingDown size={18} color={dirMeta.color} />
                : <Minus size={18} color={dirMeta.color} />
              }
            </div>
            <span style={{ fontSize:8, color:dirMeta.color, fontWeight:700, textAlign:'center' }}>
              {dirMeta.label}
            </span>
            {expanded
              ? <ChevronUp size={12} color={C.textLow} />
              : <ChevronDown size={12} color={C.textLow} />
            }
          </div>

        </div>
      </div>

      {/* ── 확장 패널: 코멘트 + 린치 한마디 ── */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 16px', background:C.surface }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            {/* 기관 코멘트 */}
            <div style={{ padding:'10px 12px', borderRadius:9, background:C.card, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, color:C.blue, fontWeight:800, marginBottom:5, display:'flex', alignItems:'center', gap:4 }}>
                <Building2 size={10} /> 기관 분석 해석
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>{record.analystComment}</div>
            </div>
            {/* 내부자 코멘트 */}
            <div style={{ padding:'10px 12px', borderRadius:9, background:C.card, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, color:C.green, fontWeight:800, marginBottom:5, display:'flex', alignItems:'center', gap:4 }}>
                <UserCheck size={10} /> 내부자 거래 해석
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7 }}>{record.insiderComment}</div>
              <div style={{ marginTop:6, fontSize:10, color:C.textLow }}>
                최근 동향: <span style={{ color:C.textMid }}>{record.lastActivity}</span>
                <span style={{ color:C.textLow }}> ({record.lastActivityDays}일 전)</span>
              </div>
            </div>
          </div>

          {/* 린치의 한마디 */}
          <div style={{
            padding:'12px 14px', borderRadius:10,
            background: `${grade.bg}`,
            border:`1px solid ${grade.border}`,
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <div style={{
              flexShrink:0, width:32, height:32, borderRadius:8,
              background:grade.bg, border:`1px solid ${grade.border}`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            }}>
              {grade.icon}
            </div>
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
export default function LynchGhostStockPanel(props: any) {

  // 포트폴리오 보유 종목 티커 셋
  const portfolioTickers = useMemo(() => {
    const src = props.portfolioStocks ?? props.stocks ?? props.portfolio ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Set(Array.isArray(src) ? src.map((s: any) => (s.ticker || '').toUpperCase()) : [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.portfolioStocks, props.stocks, props.portfolio])

  const [filterGrade, setFilterGrade] = useState<GhostGrade | 'all'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'analyst' | 'insider'>('score')

  // 전체 레코드 + 정렬 + 필터
  const records = useMemo(() => {
    let list = Object.values(GHOST_MOCK)
    if (filterGrade !== 'all') list = list.filter(r => r.ghostGrade === filterGrade)
    if (sortBy === 'score')   list = [...list].sort((a,b) => calcGhostScore(b) - calcGhostScore(a))
    if (sortBy === 'analyst') list = [...list].sort((a,b) => a.analystCount - b.analystCount)
    if (sortBy === 'insider') list = [...list].sort((a,b) => (b.insiderBuys - b.insiderSells) - (a.insiderBuys - a.insiderSells))
    return list
  }, [filterGrade, sortBy])

  // 집계
  const diamondCount  = Object.values(GHOST_MOCK).filter(r => r.ghostGrade === 'diamond').length
  const pearlCount    = Object.values(GHOST_MOCK).filter(r => r.ghostGrade === 'pearl').length
  const hotCount      = Object.values(GHOST_MOCK).filter(r => r.ghostGrade === 'hotspot' || r.ghostGrade === 'crowded').length
  const topGhost      = Object.values(GHOST_MOCK).sort((a,b) => calcGhostScore(b) - calcGhostScore(a))[0]

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
          <div style={{ fontSize:15, fontWeight:900, color:C.textHi }}>
            월가의 유령 종목 추적기
          </div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            기관 소외 × 내부자 매수 = 린치형 대박 후보 · 카드 클릭 시 상세 분석 열람
          </div>
        </div>
        {/* 최고 유령 종목 뱃지 */}
        {topGhost && (
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
              fontSize:11, fontWeight:900, color:C.amber,
              fontFamily:'monospace', padding:'2px 8px', borderRadius:6,
              background:'rgba(251,191,36,0.12)',
            }}>
              {calcGhostScore(topGhost)}점
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── 요약 KPI 바 ──────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[
            { label:'특급 유령 💎', count:diamondCount, color:C.amber, bg:'rgba(251,191,36,0.10)', border:'rgba(251,191,36,0.25)', desc:'사각지대+내부자 매수' },
            { label:'잠재 진주 🌱', count:pearlCount,   color:C.green, bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.25)',  desc:'소형커버+매수 우세' },
            { label:'과열 종목 🔒', count:hotCount,     color:C.red,   bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.25)',  desc:'고커버리지 경계' },
            { label:'분석 종목',    count:Object.keys(GHOST_MOCK).length, color:C.blue, bg:'rgba(59,130,246,0.10)', border:'rgba(59,130,246,0.25)', desc:'전체 추적 중' },
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

        {/* ── 린치 원칙 안내 배너 ─────────────────────── */}
        <div style={{
          padding:'10px 14px', borderRadius:10,
          background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)',
          display:'flex', gap:10, alignItems:'flex-start',
        }}>
          <Info size={14} color={C.amber} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:11, color:C.textLow, lineHeight:1.7 }}>
            <strong style={{ color:C.amber }}>피터 린치의 핵심 원칙:</strong>{' '}
            &quot;월가의 애널리스트 10명이 팔로우하지 않고, 회사 임원이 자기 돈으로 주식을 사는 종목이 내가 찾는 10루타 후보입니다.
            기관이 발견하기 전에 먼저 들어가는 것이 개인 투자자의 유일한 이점입니다.&quot;
            <span style={{ color:C.textLow }}> — 유령 스코어(GHOST Score): 기관 소외 40pt + 내부자 매수 40pt + 기관 보유 낮음 20pt = 최대 100점</span>
          </div>
        </div>

        {/* ── 필터 & 정렬 ─────────────────────────────── */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:C.textLow, fontWeight:700, flexShrink:0 }}>등급 필터:</span>
          {(['all', 'diamond', 'pearl', 'radar', 'hotspot', 'crowded'] as const).map(g => {
            const meta = g === 'all' ? null : GRADE_META[g]
            const active = filterGrade === g
            return (
              <button key={g} onClick={() => setFilterGrade(g)} style={{
                padding:'4px 11px', borderRadius:20, fontSize:10, fontWeight:700,
                cursor:'pointer', border:'none',
                background: active ? (meta ? meta.bg : 'rgba(96,165,250,0.15)') : C.card,
                color:      active ? (meta ? meta.color : C.blue) : C.textLow,
                outline: active ? `1px solid ${meta ? meta.border : 'rgba(96,165,250,0.3)'}` : '1px solid transparent',
              }}>
                {g === 'all' ? '전체' : `${meta!.icon} ${meta!.label}`}
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
                {s === 'score' ? '유령 스코어' : s === 'analyst' ? '애널리스트↑' : '내부자 매수↑'}
              </button>
            ))}
          </div>
        </div>

        {/* ── 카드 리스트 ─────────────────────────────── */}
        {records.length === 0 ? (
          <div style={{
            padding:'40px 24px', textAlign:'center',
            background:C.card, border:`1px dashed ${C.border}`, borderRadius:12,
            color:C.textLow, fontSize:12,
          }}>
            <Ghost size={28} style={{ margin:'0 auto 10px', opacity:0.3 }} />
            <div>선택한 등급에 해당하는 종목이 없습니다.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {records.map(r => (
              <GhostCard
                key={r.ticker}
                record={r}
                inPortfolio={portfolioTickers.has(r.ticker.toUpperCase())}
              />
            ))}
          </div>
        )}

        {/* ── 데이터 업데이트 안내 ─────────────────────── */}
        <div style={{
          padding:'9px 14px', borderRadius:9,
          background:'rgba(100,116,139,0.08)', border:`1px solid ${C.border}`,
          display:'flex', gap:8, alignItems:'center',
        }}>
          <ShieldCheck size={13} color={C.textLow} />
          <div style={{ fontSize:10, color:C.textLow, lineHeight:1.5 }}>
            <strong style={{ color:C.textMid }}>데이터 구조:</strong>{' '}
            현재 화면은 교육용 가상 데이터(Mock Data)로 구성됩니다.
            실서비스 연동 시 <code style={{ background:C.cardHi, padding:'1px 4px', borderRadius:3, fontSize:9 }}>/api/ghost-stocks</code> 엔드포인트에서
            SEC Edgar(내부자 거래) + Bloomberg(애널리스트 수)를 일 1회 캐싱하여 교체 가능합니다.
          </div>
        </div>

      </div>
    </div>
  )
}
