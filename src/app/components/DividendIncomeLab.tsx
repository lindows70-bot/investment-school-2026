'use client'

// 💵 배당 인컴 랩 — 은퇴 후 배당으로 월세처럼. 포트폴리오 구성 → 월배당 대시보드 + 미래 프로젝션.
//   데이터: /api/dividend-portfolio (US+KR 배당 프로필 SSOT + 환율). 계산은 전부 클라이언트(슬라이더 즉시 반응).
//   ⚠️ DB 미기록 세션 설계 도구(퀀트빌더 '가상종목 오염 방지' 교훈).

import { useEffect, useMemo, useState, useCallback } from 'react'
import type { DividendProfile } from '@/lib/dividendProfile'
import type { DividendPortfolioData } from '@/app/api/dividend-portfolio/route'
import { DIVIDEND_UNIVERSE, BUCKET_META, DIV_TEMPLATES, type DivBucket } from '@/lib/dividendUniverse'
import { ULTRA_RISKS, ULTRA_UNIVERSE } from '@/lib/ultraDividendUniverse'
import type { UltraDividendData, UltraDividendItem } from '@/app/api/ultra-dividend/route'
import { TK } from '@/lib/theme'

const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const C = {
  bg: TK.slate950, card: TK.bg7, card2: TK.bg5, border: TK.line1,
  text: TK.slate100, sub: '#b0bec8', low: '#8a9db5',
  green: TK.green400, red: TK.red400, gold: TK.amber500, orange: TK.orange400, cyan: TK.cyan400, blue: TK.blue400,
}
const MONTH_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const fmtW = (n: number) => Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)   // 비중% — 소수면 1자리(7.5%), 정수면 그대로
const UNIV_BY_TICKER = Object.fromEntries(DIVIDEND_UNIVERSE.map(u => [u.ticker, u]))
const STYLE_LABEL: Record<string, { t: string; c: string }> = {
  high_yield: { t: '💵 고수익', c: C.orange }, growth: { t: '🌱 성장', c: C.green }, balanced: { t: '⚖️ 균형', c: C.cyan },
}
const GRADE_EMOJI: Record<string, string> = { king: '👑', aristocrat: '🏆', achiever: '🥇', challenger: '🌱' }

// ── 통화 포맷(원) ─────────────────────────────────────────────────────────────
const won = (v: number) => {
  if (!isFinite(v)) return '—'
  if (v >= 1e8) return (v / 1e8).toFixed(v >= 1e9 ? 0 : 2) + '억'
  if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만'
  return Math.round(v).toLocaleString() + '원'
}
interface Holding { ticker: string; w: number }

// ── 초고배당형 고정 배분(초고위험 유니버스) ────────────────────────────────────
//   라이브 데이터(고배당 개별·KR 커버드콜) 80% + US YieldMax 목표·변동 20% — YieldMax 의존 최소화(정직)
const ULTRA_WEIGHTS: Record<string, number> = {
  '481850': 15, MO: 8, EPD: 8, O: 9,               // 고배당 개별(라이브) 40
  '494300': 14, '491620': 13, '498410': 13,        // KR 커버드콜(라이브) 40
  CONY: 7, YMAG: 6, PLTW: 7,                        // US YieldMax(목표·변동) 20
}
function buildUltraAllocation(byTicker: Record<string, DividendProfile>): Holding[] {
  return Object.entries(ULTRA_WEIGHTS).filter(([tk]) => byTicker[tk]).map(([ticker, w]) => ({ ticker, w }))
}

// ── 템플릿 → 자동 배분 ────────────────────────────────────────────────────────
function buildAllocation(tKey: string, byTicker: Record<string, DividendProfile>): Holding[] {
  const t = DIV_TEMPLATES.find(x => x.key === tKey) ?? DIV_TEMPLATES[1]
  if (t.ultra) return buildUltraAllocation(byTicker)
  const buckets: DivBucket[] = ['income', 'growth', 'future']
  // 버킷별 종목 수
  const cnt: Record<DivBucket, number> = { income: 0, growth: 0, future: 0 }
  for (const b of buckets) cnt[b] = Math.max(1, Math.round(t.size * t.mix[b] / 100))
  const totalCnt = buckets.reduce((s, b) => s + cnt[b], 0)
  // 총 KR 목표를 largest-remainder로 버킷 분배(라벨 krWeight에 근접) — 버킷별 반올림 누적 과다 방지
  const krTarget = Math.round(totalCnt * t.krWeight / 100)
  const krAvail = (b: DivBucket) => DIVIDEND_UNIVERSE.filter(u => u.bucket === b && u.market === 'KR').length
  const frac: Record<DivBucket, number> = { income: 0, growth: 0, future: 0 }
  const krN: Record<DivBucket, number> = { income: 0, growth: 0, future: 0 }
  for (const b of buckets) { const f = cnt[b] * t.krWeight / 100; krN[b] = Math.min(Math.floor(f), cnt[b], krAvail(b)); frac[b] = f - Math.floor(f) }
  let assigned = buckets.reduce((s, b) => s + krN[b], 0)
  const order = buckets.slice().sort((a, b) => frac[b] - frac[a])
  for (let pass = 0; pass < 3 && assigned < krTarget; pass++)
    for (const b of order) { if (assigned >= krTarget) break; if (krN[b] < Math.min(cnt[b], krAvail(b))) { krN[b]++; assigned++ } }
  const picks: Holding[] = []
  for (const b of buckets) {
    const inB = DIVIDEND_UNIVERSE.filter(u => u.bucket === b)
    const metric = (tk: string) => {
      const p = byTicker[tk]; if (!p) return -1
      return b === 'income' ? (p.dividendYield ?? 0) : b === 'growth' ? (p.dividendGrowth5y ?? 0) : (p.safetyScore ?? 0)
    }
    const sortD = (arr: typeof inB) => arr.slice().sort((x, y) => metric(y.ticker) - metric(x.ticker))
    const krAll = inB.filter(u => u.market === 'KR')
    const kr = sortD(krAll).slice(0, krN[b])
    const us = sortD(inB.filter(u => u.market === 'US')).slice(0, Math.max(0, cnt[b] - kr.length))
    for (const u of [...kr, ...us]) picks.push({ ticker: u.ticker, w: t.mix[b] / Math.max(1, kr.length + us.length) })
  }
  return picks
}

export default function DividendIncomeLab() {
  const [data, setData] = useState<DividendPortfolioData | null>(null)
  const [ultraItems, setUltraItems] = useState<UltraDividendItem[]>([])
  const [err, setErr] = useState(false)
  const [investMan, setInvestMan] = useState(10000)   // 투자금(만원) 기본 1억
  const [tpl, setTpl] = useState('balanced')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [drip, setDrip] = useState(true)
  const [goalMan, setGoalMan] = useState(300)          // 목표 월배당(만원)
  const [addBucket, setAddBucket] = useState<DivBucket | 'ultra'>('income')
  const [showAdd, setShowAdd] = useState(false)

  // 안정 유니버스 + 초고배당 유니버스를 합쳐 byTicker 구성(초고배당형 템플릿용)
  const byTicker = useMemo(() => Object.fromEntries([...(data?.stocks ?? []), ...ultraItems].map(s => [s.ticker, s])), [data, ultraItems])
  const ultraByTicker = useMemo(() => Object.fromEntries(ultraItems.map(i => [i.ticker, i])), [ultraItems])

  useEffect(() => {
    fetch('/api/dividend-portfolio', { cache: 'no-store' }).then(r => r.json()).then((d: DividendPortfolioData) => {
      if (d.status === 'ok') setData(d); else setErr(true)
    }).catch(() => setErr(true))
    fetch('/api/ultra-dividend', { cache: 'no-store' }).then(r => r.json()).then((d: UltraDividendData) => {
      if (d.status === 'ok') setUltraItems(d.items)
    }).catch(() => { /* 초고배당은 보조 — 실패해도 메인 동작 */ })
  }, [])

  // 데이터 로드/템플릿 변경 시 자동 배분
  const applyTemplate = useCallback((key: string) => {
    setTpl(key); setShowAdd(false)
    if (Object.keys(byTicker).length) setHoldings(buildAllocation(key, byTicker))
  }, [byTicker])
  useEffect(() => { if (data && !holdings.length) setHoldings(buildAllocation(tpl, byTicker)) }, [data, byTicker, tpl, holdings.length])

  const usdKrw = data?.usdKrw ?? 1380
  const totalKRW = investMan * 1e4

  // ── 포트폴리오 지표 ───────────────────────────────────────────────────────────
  const port = useMemo(() => {
    const valid = holdings.filter(h => byTicker[h.ticker]?.dividendYield != null)
    const wSum = valid.reduce((s, h) => s + h.w, 0) || 1
    let annualDiv = 0, wYield = 0, wGrowth = 0, wSafety = 0, safetyN = 0, growthN = 0
    const monthly = Array(12).fill(0)
    const styleW: Record<string, number> = { high_yield: 0, growth: 0, balanced: 0 }
    const rows = valid.map(h => {
      const p = byTicker[h.ticker]
      const wNorm = h.w / wSum
      const investKRW = totalKRW * wNorm
      const y = p.dividendYield ?? 0
      const divKRW = investKRW * y                 // 배당률은 통화 무관(소수) → 환율 불필요
      annualDiv += divKRW; wYield += wNorm * y
      // ⚠️ 성장률은 '가공되지 않은' 값을 써야 한다 — 두 번 데인 자리(2026-08-01):
      //    ① null을 0으로 채우면 감소가 '변화 없음'으로 둔갑(비중 75%가 null이라 +1.0%로 표시됐다)
      //    ② yocProjRate는 YoC 프로젝션 전용이라 `Math.max(0, cagr5)`로 **음수를 0으로 잘라낸다** —
      //       CONY는 5년 CAGR −50.2%인데 0%로 들어와 성장률을 끌어올렸다.
      //    → 원본 5년 CAGR(dividendGrowth5y) → 1년 실적 → 둘 다 없으면 가중에서 제외.
      const gRaw = p.dividendGrowth5y ?? p.dividendGrowth1y
      if (gRaw != null) { wGrowth += wNorm * gRaw; growthN += wNorm }
      if (p.safetyScore != null) { wSafety += wNorm * p.safetyScore; safetyN += wNorm }
      if (p.style) styleW[p.style] += wNorm
      const months = p.paymentMonths.length ? p.paymentMonths : [12]
      for (const m of months) monthly[m - 1] += divKRW / months.length
      return { p, wNorm, investKRW, divKRW }
    })
    return {
      rows, annualDiv, monthlyAvg: annualDiv / 12,
      yield: wYield, growth: growthN > 0 ? wGrowth / growthN : 0, growthKnown: growthN,
      safety: safetyN > 0 ? Math.round(wSafety / safetyN) : null,
      monthly, styleW,
      krW: valid.reduce((s, h) => byTicker[h.ticker].market === 'KR' ? s + h.w / wSum : s, 0),
    }
  }, [holdings, byTicker, totalKRW])

  // ── 미래 프로젝션 (DRIP 스노우볼) ─────────────────────────────────────────────
  const proj = useMemo(() => {
    const isUltra = tpl === 'ultra'
    const g = Math.min(port.growth, 0.15)          // 배당 성장률(캡)
    const y0 = port.yield
    // 커버드콜 분배율은 원금(NAV) 침식이 섞여 있어 그대로 재투자 복리가 안 됨 → 초고배당형은 총수익을 보수적으로 캡(6%)
    const reinvest = isUltra ? Math.min(y0, 0.06) : y0
    const snowRate = drip ? g + reinvest : g       // DRIP=성장+재투자수익 / 미적용=성장만
    const pts: { t: number; monthly: number; value: number }[] = []
    for (let t = 0; t <= 30; t++) {
      const income = port.annualDiv * Math.pow(1 + snowRate, t)
      const value = totalKRW * Math.pow(1 + snowRate, t)
      pts.push({ t, monthly: income / 12, value })
    }
    return { pts, snowRate, g, y0, reinvest, capped: isUltra && drip && y0 > 0.06 }
  }, [port, drip, totalKRW, tpl])

  // ── 목표 역산 ────────────────────────────────────────────────────────────────
  const goal = useMemo(() => {
    const targetMonthlyKRW = goalMan * 1e4
    const reqPortfolio = port.yield > 0 ? (targetMonthlyKRW * 12) / port.yield : null   // 오늘 배당률로 필요 자산
    let years: number | null = null
    if (port.monthlyAvg > 0 && targetMonthlyKRW > port.monthlyAvg && proj.snowRate > 0) {
      years = Math.log(targetMonthlyKRW / port.monthlyAvg) / Math.log(1 + proj.snowRate)
    } else if (targetMonthlyKRW <= port.monthlyAvg) years = 0
    return { reqPortfolio, years }
  }, [goalMan, port, proj])

  // ── 편집 액션 ────────────────────────────────────────────────────────────────
  const setWeight = (ticker: string, w: number) => setHoldings(hs => hs.map(h => h.ticker === ticker ? { ...h, w } : h))
  const removeHold = (ticker: string) => setHoldings(hs => hs.filter(h => h.ticker !== ticker))
  const addHold = (ticker: string) => setHoldings(hs => hs.some(h => h.ticker === ticker) ? hs
    : [...hs, { ticker, w: hs.length ? hs.reduce((s, h) => s + h.w, 0) / hs.length : 10 }])

  if (err) return <div style={{ padding: 30, color: C.low, fontFamily: FONT }}>배당 유니버스를 불러오지 못했습니다. 잠시 후 다시 시도하세요.</div>
  if (!data) return <div style={{ padding: 30, color: C.low, fontFamily: FONT }}>💵 US·KR 배당 종목 프로필 수집 중…</div>

  const monthlyMax = Math.max(...port.monthly, 1)
  const heldSet = new Set(holdings.map(h => h.ticker))

  // ── 배당 세금 구간 (한국 세법 — 금융소득종합과세·건보료·안심구간) ──────────────
  //   경계는 확정 세법 상수: 건보료 반영 1,000만 / 금융소득종합과세 2,000만 / 안심선(월600·연7,200만, 다른 소득 적을 때 원천징수>종합세 근사·박차장 heuristic)
  const A = port.annualDiv
  const TAX_BANDS = [1000e4, 2000e4, 7200e4]
  const tax = A < TAX_BANDS[0]
    ? { c: C.green, label: '✅ 원천징수(15.4%)로 끝', desc: '연 금융소득 1,000만원 미만 — 종합과세·건보료 대상 아님. 배당소득세 15.4%만 원천징수됩니다.' }
    : A < TAX_BANDS[1]
    ? { c: C.cyan, label: '🩺 건보료 반영 구간', desc: '연 금융소득 1,000만원 초과 — 건강보험료 산정 소득에 반영(지역가입자). 아직 금융소득종합과세(2,000만원)는 아닙니다.' }
    : A < TAX_BANDS[2]
    ? { c: C.gold, label: '⚠️ 금융소득종합과세 대상', desc: '연 배당 2,000만원 초과 — 초과분이 종합소득에 합산됩니다. 단 다른 소득이 적으면 원천징수(15.4%)가 더 커서 추가 종합소득세 부담이 크지 않은 편(월 600만·연 7,200만 근처까지). 건보료는 별개입니다.' }
    : { c: C.red, label: '🔴 종합과세·건보료 본격', desc: '연 배당 7,200만원(월 600만) 초과 — 종합소득세·건보료 부담이 본격화됩니다. 절세계좌·자산 분산이 사실상 필수.' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, color: C.text }}>
      {/* ── 헤더 ── */}
      <div style={{ padding: '18px 22px', borderRadius: 16, background: `linear-gradient(135deg,${TK.bg0},${C.card})`, border: `1px solid #1e3050` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>💵</span>
          <span style={{ fontSize: 19, fontWeight: 900 }}>배당 인컴 랩</span>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${C.gold}22`, color: C.gold, fontWeight: 800 }}>은퇴 후 배당으로 월세처럼</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.low, marginTop: 6 }}>US·KR 배당주를 섞어 포트폴리오를 짜고, 지금과 미래의 <b style={{ color: C.sub }}>월배당 현금흐름</b>을 봅니다 · 배당 재투자(DRIP) 복리 · 목표 월배당 역산</div>
      </div>

      {/* ── 투자금 + 템플릿 ── */}
      <div style={{ padding: '16px 18px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, marginBottom: 10 }}>1️⃣ 투자금 · 전략 선택</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input type="number" value={investMan} min={100} step={1000}
            onChange={e => setInvestMan(Math.max(100, Number(e.target.value) || 0))}
            style={{ width: 130, padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 15, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right', outline: 'none' }} />
          <span style={{ fontSize: 13, color: C.sub }}>만원</span>
          <span style={{ fontSize: 13, color: C.gold, fontWeight: 800 }}>= {won(totalKRW)}</span>
          <div style={{ display: 'flex', gap: 5, marginLeft: 6, flexWrap: 'wrap' }}>
            {[1000, 5000, 10000, 30000, 50000, 100000].map(v => (
              <button key={v} onClick={() => setInvestMan(v)}
                style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${investMan === v ? C.gold : C.border}`, background: investMan === v ? `${C.gold}18` : 'transparent', color: investMan === v ? C.gold : C.low, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {won(v * 1e4)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DIV_TEMPLATES.map(tp => {
            const accent = tp.ultra ? C.red : C.green   // 초고배당형은 빨간 강조(위험 신호)
            const on = tpl === tp.key
            return (
              <button key={tp.key} onClick={() => applyTemplate(tp.key)}
                style={{
                  flex: '1 1 180px', textAlign: 'left', padding: '11px 14px', borderRadius: 11, cursor: 'pointer',
                  border: `1.5px solid ${on ? accent : tp.ultra ? C.red + '55' : C.border}`, background: on ? `${accent}12` : tp.ultra ? `${C.red}08` : C.card2,
                }}>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: on ? accent : tp.ultra ? C.red : C.text }}>{tp.icon} {tp.label}</div>
                <div style={{ fontSize: 10.5, color: C.low, marginTop: 3, lineHeight: 1.5 }}>{tp.desc}</div>
                <div style={{ fontSize: 9.5, color: tp.ultra ? C.orange : C.low, marginTop: 4 }}>{tp.stat ?? `고배당 ${tp.mix.income} · 성장 ${tp.mix.growth} · 유망 ${tp.mix.future} / 🇰🇷 ${tp.krWeight}%`}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 초고배당형 리스크 배너 (초고배당형 선택 시만) ── */}
      {tpl === 'ultra' && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${C.red}55`, background: `linear-gradient(180deg, ${TK.red400}14, transparent 90px)` }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.red }}>🔥 초고배당형 = 초고위험 — 담기 전에 꼭 읽으세요</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
            아래 배당률은 <b style={{ color: C.orange }}>커버드콜·옵션 ETF의 분배율</b>이 섞인 값입니다. 분배율이 높다고 <b>총수익은 아닙니다</b> —
            주가가 빠지면 원금(NAV)을 깎아 배당을 줄 수 있어 계좌 총자산은 오히려 줄 수 있어요.
            미국 YieldMax(CONY·YMAG·PLTW)는 분배율 데이터 미제공이라 <b style={{ color: C.red }}>운용사 목표·변동치</b>를 참고로 넣었습니다(실제는 매월 크게 변동).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 8, marginTop: 10 }}>
            {ULTRA_RISKS.map(r => (
              <div key={r.title} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 11px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: C.orange, marginBottom: 4 }}>{r.icon} {r.title}</div>
                <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.6 }}>{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 월배당 대시보드 ── */}
      <div style={{ padding: '18px 20px', borderRadius: 16, background: `linear-gradient(135deg,${TK.bg0},${C.card})`, border: `1px solid ${tpl === 'ultra' ? C.red + '44' : C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 14 }}>2️⃣ 내 배당 대시보드{tpl === 'ultra' && <span style={{ marginLeft: 8, fontSize: 10.5, color: C.red, fontWeight: 800 }}>🔥 초고위험</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }} className="dil-kpi">
          {[
            { k: '💰 연간 배당금', v: won(port.annualDiv), c: C.gold, sub: `세전 · 배당률 ${(port.yield * 100).toFixed(2)}%` },
            { k: '🗓️ 월평균 배당', v: won(port.monthlyAvg), c: C.green, sub: '지금 매달 받는 현금흐름' },
            { k: '🛡️ 포트 안전성', v: port.safety != null ? port.safety + '점' : '—', c: port.safety != null && port.safety >= 60 ? C.green : C.gold, sub: '배당 안전성 종합' },
            { k: '🌱 배당 성장률', v: (port.growth * 100).toFixed(1) + '%', c: port.growth < 0 ? C.red : C.cyan,
              sub: port.growth < 0 ? `연평균(가중) · 분배 축소 중` : `연평균(가중) · 실측 ${Math.round(port.growthKnown * 100)}%` },
          ].map(m => (
            <div key={m.k} style={{ padding: '13px 15px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10.5, color: C.low, marginBottom: 5 }}>{m.k}</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: m.c }}>{m.v}</div>
              <div style={{ fontSize: 9.5, color: C.low, marginTop: 3 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* 바벨 밸런스 */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10.5, color: C.low, marginBottom: 6 }}>⚖️ 고수익 ↔ 성장 바벨 · 🇰🇷 {(port.krW * 100).toFixed(0)}% : 🇺🇸 {((1 - port.krW) * 100).toFixed(0)}%</div>
          <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {(['high_yield', 'balanced', 'growth'] as const).map(s => {
              const w = port.styleW[s] * 100
              if (w < 0.5) return null
              const col = STYLE_LABEL[s].c
              return <div key={s} title={`${STYLE_LABEL[s].t} ${w.toFixed(0)}%`} style={{ width: `${w}%`, background: `${col}55`, borderRight: `1px solid ${C.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: col, fontWeight: 700 }}>{w >= 12 ? STYLE_LABEL[s].t : ''}</div>
            })}
          </div>
        </div>
      </div>

      {/* ── 12개월 현금흐름 캘린더 ── */}
      <div style={{ padding: '18px 20px', borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>3️⃣ 📅 월별 배당 현금흐름 (매달 얼마 들어오나)</div>
        <div style={{ fontSize: 10.5, color: C.low, marginBottom: 14 }}>미국 분기배당(3개 사이클)+월배당(O·ETF)이 매달을 채우고, 한국 개별주는 대부분 특정 월(연 1회)에 몰립니다 — 빈 달을 확인하고 지급월이 다른 종목으로 채우세요.</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 130 }}>
          {port.monthly.map((v, i) => {
            const h = Math.max(3, Math.round((v / monthlyMax) * 104))
            const empty = v < port.annualDiv * 0.01
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, color: empty ? C.red : C.sub, marginBottom: 3, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v >= 1e4 ? Math.round(v / 1e4) + '만' : '—'}</div>
                <div style={{ height: h, borderRadius: 4, background: empty ? `${C.red}44` : `linear-gradient(180deg,${C.green},${C.green}66)` }} />
                <div style={{ fontSize: 8.5, color: C.low, marginTop: 4 }}>{MONTH_KR[i]}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 미래 월배당 프로젝션 ── */}
      <div style={{ padding: '18px 20px', borderRadius: 16, background: `linear-gradient(135deg,${TK.bg0},${C.card})`, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 900 }}>4️⃣ 💎 미래 월배당 프로젝션 (배당 성장 + 재투자 스노우볼)</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.sub, cursor: 'pointer', marginLeft: 'auto' }}>
            <input type="checkbox" checked={drip} onChange={e => setDrip(e.target.checked)} />
            배당 재투자(DRIP) {drip ? 'ON' : 'OFF'}
          </label>
        </div>
        <div style={{ fontSize: 10.5, color: C.low, marginBottom: 14 }}>
          연 성장률 {(proj.g * 100).toFixed(1)}%{drip && ` + 재투자 수익률 ${(proj.reinvest * 100).toFixed(1)}%`} = 배당이 매년 약 <b style={{ color: proj.snowRate >= 0 ? C.green : C.red }}>{(proj.snowRate * 100).toFixed(1)}%</b>씩 {proj.snowRate >= 0 ? '불어난다고' : '변한다고'} 가정
          {proj.g < 0 && <span style={{ color: C.red }}> — 이 포트는 <b>분배를 줄이는 중</b>이라 성장률이 마이너스입니다(재투자로 상쇄해도 스노우볼이 느려집니다).</span>}
        </div>

        {/* 프로젝션 라인 */}
        <ProjChart pts={proj.pts} />

        {/* 연차별 월배당 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }} className="dil-proj">
          {[0, 10, 20, 30].map((yr, i) => {
            const p = proj.pts[yr]
            const col = [C.low, C.cyan, C.blue, C.green][i]
            return (
              <div key={yr} style={{ padding: '11px 13px', borderRadius: 11, background: C.card2, border: `1px solid ${yr === 30 ? C.green + '55' : C.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.low, marginBottom: 4 }}>{yr === 0 ? '지금' : yr + '년 후'}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: col }}>{won(p.monthly)}</div>
                <div style={{ fontSize: 8.5, color: C.low, marginTop: 2 }}>월배당 · 자산 {won(p.value)}</div>
              </div>
            )
          })}
        </div>
        {proj.capped && (
          <div style={{ fontSize: 9.5, color: C.red, marginTop: 10, lineHeight: 1.6, background: `${C.red}10`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '8px 10px' }}>
            🔥 초고배당형은 <b>커버드콜 분배율({(proj.y0 * 100).toFixed(1)}%)이 그대로 재투자되지 않습니다</b> — 분배엔 원금(NAV) 침식이 섞여 있어 실제 총수익은 훨씬 낮습니다.
            그래서 재투자 수익률을 보수적으로 <b>{(proj.reinvest * 100).toFixed(0)}%로 캡</b>했습니다(그래도 낙관적). 이 프로젝션은 목표가 아닌 극단 예시입니다.
          </div>
        )}
        <div style={{ fontSize: 9, color: C.low, marginTop: 10, lineHeight: 1.5 }}>⚠️ 성장률·수익률이 30년 지속된다는 가정의 복리 추정입니다(실제는 경기·삭감으로 변동). 성장률은 종목별 연 15% 캡. 예측 아닌 &ldquo;배당 성장의 힘&rdquo; 교육용.</div>
      </div>

      {/* ── 목표 역산 ── */}
      <div style={{ padding: '18px 20px', borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 12 }}>5️⃣ 🎯 목표 월배당 역산 — &ldquo;월세처럼 얼마 받고 싶으세요?&rdquo;</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, color: C.sub }}>목표 월배당</span>
          <input type="number" value={goalMan} min={10} step={50}
            onChange={e => setGoalMan(Math.max(10, Number(e.target.value) || 0))}
            style={{ width: 100, padding: '8px 11px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 14, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right', outline: 'none' }} />
          <span style={{ fontSize: 12.5, color: C.sub }}>만원/월</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {[100, 200, 300, 500].map(v => (
              <button key={v} onClick={() => setGoalMan(v)} style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${goalMan === v ? C.cyan : C.border}`, background: goalMan === v ? `${C.cyan}18` : 'transparent', color: goalMan === v ? C.cyan : C.low, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{v}만</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10.5, color: C.low, marginBottom: 5 }}>지금 배당률({(port.yield * 100).toFixed(2)}%)로 월 {goalMan}만원 받으려면</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: C.gold }}>{goal.reqPortfolio != null ? won(goal.reqPortfolio) : '—'}</div>
            <div style={{ fontSize: 9.5, color: C.low, marginTop: 3 }}>필요 투자 자산</div>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10.5, color: C.low, marginBottom: 5 }}>지금 {won(totalKRW)} 투자 + {drip ? 'DRIP·' : ''}배당 성장 시</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: C.green }}>
              {goal.years == null ? (proj.snowRate <= 0 ? '도달 불가' : '—') : goal.years === 0 ? '이미 달성 🎉' : `약 ${Math.ceil(goal.years)}년 후`}
            </div>
            <div style={{ fontSize: 9.5, color: goal.years == null && proj.snowRate <= 0 ? C.red : C.low, marginTop: 3 }}>
              {goal.years == null && proj.snowRate <= 0
                ? '분배 축소가 재투자 효과보다 커서 이 조합으론 늘지 않습니다'
                : `월 ${goalMan}만원 달성까지`}
            </div>
          </div>
        </div>
      </div>

      {/* ── 배당 세금 가이드 (금융소득종합과세) ── */}
      <div style={{ padding: '16px 18px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>💸 배당 세금 가이드 <span style={{ fontSize: 10.5, color: C.low, fontWeight: 600 }}>— 금융소득종합과세·건보료·절세계좌</span></div>
        <div style={{ fontSize: 10.5, color: C.low, marginTop: 3, marginBottom: 12 }}>연 배당 <b style={{ color: C.gold }}>{won(A)}</b> 기준 · 한국 세법 일반 안내(개인별 상이 — 정확한 계산은 세무 확인)</div>
        {/* 경계 게이지 (0 ~ 8,000만) */}
        {(() => {
          const MAXV = 8000e4
          const pos = Math.min(A / MAXV, 1) * 100
          const marks = [{ v: 1000e4, t: '1,000만\n건보료' }, { v: 2000e4, t: '2,000만\n종합과세' }, { v: 7200e4, t: '7,200만\n(월600·안심선)' }]
          // 마커 라벨이 좌우 끝에서 잘리거나 부제와 겹치지 않도록 위치별 정렬 전환
          const labelShift = pos < 12 ? 'translateX(0)' : pos > 88 ? 'translateX(-100%)' : 'translateX(-50%)'
          return (
            <div style={{ position: 'relative', margin: '26px 0 34px' }}>
              <div style={{ height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${C.green}55 0%, ${C.cyan}55 12.5%, ${C.gold}55 25%, ${C.red}55 90%)`, border: `1px solid ${C.border}` }} />
              {/* 현재 위치 마커 */}
              <div style={{ position: 'absolute', top: -4, left: `calc(${pos}% - 1px)`, width: 2, height: 20, background: tax.c }} />
              <div style={{ position: 'absolute', top: -19, left: `${pos}%`, transform: labelShift, fontSize: 9, fontWeight: 800, color: tax.c, whiteSpace: 'nowrap' }}>지금 {won(A)}</div>
              {/* 경계선 */}
              {marks.map(m => (
                <div key={m.v} style={{ position: 'absolute', top: 0, left: `${m.v / MAXV * 100}%` }}>
                  <div style={{ width: 1, height: 12, background: C.low, opacity: 0.6 }} />
                  <div style={{ position: 'absolute', top: 14, left: 0, transform: 'translateX(-50%)', fontSize: 8, color: C.low, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre' }}>{m.t}</div>
                </div>
              ))}
            </div>
          )
        })()}
        <div style={{ padding: '11px 13px', borderRadius: 10, background: `${tax.c}10`, border: `1px solid ${tax.c}33`, marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: tax.c, marginBottom: 4 }}>{tax.label}</div>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>{tax.desc}</div>
        </div>
        <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 11px' }}>
          💡 <b>절세계좌로 회피</b>: <b style={{ color: C.cyan }}>ISA</b>(배당 비과세 200~400만 + 초과분 9.9% 분리과세) / <b style={{ color: C.green }}>연금저축·IRP</b>(세액공제 + 55세 이후 저율 인출). 조기 파이어(예: 42세)면 ISA, 55세 이후 계획이면 연금계좌가 유리 — 배당 포트는 절세계좌 안에서 굴리면 금융소득종합과세·건보료를 크게 줄일 수 있어요.
        </div>
        <div style={{ fontSize: 9, color: C.low, marginTop: 8, lineHeight: 1.5 }}>⚠️ 배당소득세 원천징수 15.4%(소득세 14%+지방세 1.4%) · 미국주 매매차익은 별도 양도세 22%(250만 공제) · 경계·안심선은 일반 기준이며 다른 소득·부양가족 등에 따라 달라집니다 — 큰 금액은 세무사 상담 권장.</div>
      </div>

      {/* ── 보유 종목 편집 ── */}
      <div style={{ padding: '18px 20px', borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 900 }}>6️⃣ 포트폴리오 종목 ({port.rows.length})</span>
          <span style={{ fontSize: 10.5, color: C.low }}>슬라이더로 비중 조정 · 오른쪽 = <b style={{ color: C.gold }}>비중%</b> · <b style={{ color: C.text }}>투자금액</b> · <b style={{ color: C.green }}>연 배당금</b> · ✕ 제거</span>
          <button onClick={() => { const nv = !showAdd; setShowAdd(nv); if (nv && tpl === 'ultra') setAddBucket('ultra') }} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.green}55`, background: `${C.green}14`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {showAdd ? '✕ 닫기' : '＋ 종목 추가'}
          </button>
        </div>

        {/* 추가 패널 */}
        {showAdd && (() => {
          // 카테고리 메타(안정 3버킷 + 🔥 초고배당)
          const catMeta = (b: DivBucket | 'ultra') => b === 'ultra'
            ? { icon: '🔥', label: '초고배당', color: C.red, desc: '커버드콜·옵션 ETF·모기지 리츠·BDC·MLP 등 — 초고위험 초고분배(원금 손실 위험)' }
            : BUCKET_META[b]
          const cats: (DivBucket | 'ultra')[] = ['income', 'growth', 'future', 'ultra']
          const list = addBucket === 'ultra'
            ? ULTRA_UNIVERSE.map(u => ({ ticker: u.ticker, market: u.market, note: u.note }))
            : DIVIDEND_UNIVERSE.filter(u => u.bucket === addBucket).map(u => ({ ticker: u.ticker, market: u.market, note: u.note }))
          const meta = catMeta(addBucket)
          return (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: C.card2, border: `1px solid ${addBucket === 'ultra' ? C.red + '44' : C.border}` }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {cats.map(b => {
                  const cm = catMeta(b)
                  return (
                    <button key={b} onClick={() => setAddBucket(b)} style={{ padding: '5px 11px', borderRadius: 20, border: `1px solid ${addBucket === b ? cm.color : C.border}`, background: addBucket === b ? `${cm.color}18` : 'transparent', color: addBucket === b ? cm.color : C.low, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      {cm.icon} {cm.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 9.5, color: addBucket === 'ultra' ? C.orange : C.low, marginBottom: 8 }}>{meta.desc}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {list.map(u => {
                  const p = byTicker[u.ticker]; const held = heldSet.has(u.ticker); const est = ultraByTicker[u.ticker]?.yieldEstimated
                  return (
                    <button key={u.ticker} disabled={held} onClick={() => addHold(u.ticker)} title={u.note}
                      style={{ width: 148, textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: `1px solid ${held ? C.border : meta.color + '44'}`, background: held ? 'transparent' : C.card, opacity: held ? 0.4 : 1, cursor: held ? 'default' : 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{(p?.name || u.ticker).slice(0, 12)} {u.market === 'KR' ? '🇰🇷' : '🇺🇸'}</div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: addBucket === 'ultra' ? C.red : C.green }}>{p?.dividendYield != null ? (p.dividendYield * 100).toFixed(1) + '%' : '—'}
                        {est && <span style={{ color: C.red, marginLeft: 3 }}>목표</span>}
                        {p?.dividendGrade && <span style={{ marginLeft: 5 }}>{GRADE_EMOJI[p.dividendGrade]}</span>}
                        {held && <span style={{ color: C.low, marginLeft: 5 }}>담김</span>}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* 종목 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {port.rows.slice().sort((a, b) => b.wNorm - a.wNorm).map(({ p, wNorm, investKRW, divKRW }) => {
            const u = UNIV_BY_TICKER[p.ticker]
            const ul = ultraByTicker[p.ticker]     // 초고배당 유니버스 멤버(있으면 섹터·목표 표시)
            const st = p.style ? STYLE_LABEL[p.style] : null
            const hw = holdings.find(h => h.ticker === p.ticker)?.w ?? 0
            return (
              <div key={p.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 150, flex: '1 1 150px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>
                    {p.name.slice(0, 16)} {p.market === 'KR' ? '🇰🇷' : '🇺🇸'}
                    {p.dividendGrade && <span title={p.dividendGrade} style={{ marginLeft: 5 }}>{GRADE_EMOJI[p.dividendGrade]}</span>}
                    {p.isTrapWarning && <span title={p.trapReasons.join(', ')} style={{ marginLeft: 5, color: C.orange }}>⚠️</span>}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.low, fontFamily: 'monospace' }}>{p.ticker} · {ul ? <span style={{ color: C.orange }}>🔥 {ul.sector}</span> : <>{u ? BUCKET_META[u.bucket].icon : ''} {st && <span style={{ color: st.c }}>{st.t}</span>}</>}</div>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: ul?.tier === 'covered_call' ? C.red : C.green, minWidth: 52, textAlign: 'right' }}>
                  {p.dividendYield != null ? (p.dividendYield * 100).toFixed(2) + '%' : '—'}
                  {ul?.yieldEstimated && <span style={{ fontSize: 8, color: C.red, marginLeft: 2 }}>목표</span>}
                </div>
                <input type="range" min={0} max={40} step={1} value={hw}
                  onChange={e => setWeight(p.ticker, Number(e.target.value))}
                  style={{ flex: '1 1 110px', accentColor: C.green }} />
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: C.gold, minWidth: 44, textAlign: 'right' }}>{fmtW(wNorm * 100)}%</div>
                <div style={{ minWidth: 92, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: C.text }} title="투자금액">{won(investKRW)}</div>
                  <div style={{ fontSize: 9.5, fontFamily: 'monospace', color: C.green }} title="연 배당금">연 {won(divKRW)}</div>
                </div>
                <button onClick={() => removeHold(p.ticker)} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.low, fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ fontSize: 9.5, color: C.low, lineHeight: 1.7, padding: '0 4px' }}>
        💵 배당률·성장률·안전성·지급월은 Yahoo·Naver 실데이터(배당 익스플로러와 동일 엔진) · 배당률은 통화 무관이라 US·KR 혼합 계산에 환율 불필요(자산 표기 환율 {usdKrw.toLocaleString()}원) ·
        한국 개별주는 대부분 연 1회 배당이라 매달 현금흐름은 미국 분기·월배당이 채웁니다 · <b>세션 설계 도구(저장 안 함)</b> · 세전 기준(배당소득세·양도세 별도) · 교육용이며 투자 추천이 아닙니다.
      </div>
      <style>{`
        @media(max-width:640px){.dil-kpi{grid-template-columns:repeat(2,1fr)!important}.dil-proj{grid-template-columns:repeat(2,1fr)!important}}
      `}</style>
    </div>
  )
}

// ── 프로젝션 라인 차트 (SVG) ──────────────────────────────────────────────────
function ProjChart({ pts }: { pts: { t: number; monthly: number }[] }) {
  const W = 640, H = 150, pad = 8
  const maxV = Math.max(...pts.map(p => p.monthly), 1)
  const x = (t: number) => pad + (t / 30) * (W - pad * 2)
  const y = (v: number) => H - pad - (v / maxV) * (H - pad * 2 - 12)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.monthly).toFixed(1)}`).join(' ')
  const area = `${line} L${x(30).toFixed(1)},${(H - pad).toFixed(1)} L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="dilArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.green} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 10, 20, 30].map(t => (
          <g key={t}>
            <line x1={x(t)} y1={pad} x2={x(t)} y2={H - pad} stroke={C.border} strokeWidth="1" strokeDasharray="2 3" />
            <text x={x(t)} y={H - 1} fill={C.low} fontSize="9" textAnchor="middle">{t === 0 ? '지금' : t + '년'}</text>
          </g>
        ))}
        <path d={area} fill="url(#dilArea)" />
        <path d={line} fill="none" stroke={C.green} strokeWidth="2" />
        {[10, 20, 30].map(t => (
          <g key={t}>
            <circle cx={x(t)} cy={y(pts[t].monthly)} r="3.5" fill={C.green} />
            <text x={x(t)} y={y(pts[t].monthly) - 7} fill={C.green} fontSize="9.5" fontWeight="800" textAnchor="middle">{won(pts[t].monthly)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
