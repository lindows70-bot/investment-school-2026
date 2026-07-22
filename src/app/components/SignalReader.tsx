'use client'
// 🧭 신호 판독기 — 교과서 모멘텀 신호(MACD·RSI·스토캐스틱·CCI)를 펀더멘탈 SSOT(stock-info PEG·FCF·영업이익률)와
// 교차검증해 '가짜 반등/신호 정합/조기 청산 주의/떨어지는 칼날'을 결정론적으로 판정(AI 미사용·환각 0).
// 기술신호는 이 화면 전용 — 통합추천·리밸런싱 점수에는 절대 미반영(앱의 펀더멘탈 우선 원칙).
import { useState, useEffect, useMemo } from 'react'
import { readSignals, detectLiquidity, readRaschke, computePOC, computeTTMSqueeze, computeAnchoredVWAP, readTimeCorrection, readFibRetracement, findConfluence, detectFVG } from '@/lib/techSignals'
import type { TechCandle } from '@/app/api/tech-chart/route'
import { TK } from '@/lib/theme'

const BORDER = TK.border

interface Fund { peg: number | null; fcf: number | null; opMargin: number | null; growth: number | null }

const toNum = (v: unknown): number | null => typeof v === 'number' && isFinite(v) ? v : null

/* ── 🗺️ 추세의 여정 현재 단계 판정(순수 계산 — entryTiming SSOT와 동일 공식: EMA112·224 + 일목 구름 26봉 선행)
   251봉↑ = 정식(EMA112·224 정배열) / 130~250봉 = 약식(신생 — EMA224 미확보, 구름+EMA112로 판정. 기술차트의 강등 규칙과 동일) ── */
type JStage = { card: 0 | 1 | 2; label: string; color: string; note: string; approx: boolean }
function journeyStage(D: TechCandle[]): JStage | null {
  const N = D.length
  if (N < 130) return null   // 구름(78봉)+EMA112(112봉) 최소 요건 미달 — 정직 생략
  const approx = N < 251     // EMA224 미확보 → 약식(구름 + 가격 vs EMA112)
  const c = D.map(x => x.close)
  const ema = (p: number) => { const k = 2 / (p + 1); let v = c.slice(0, p).reduce((s, x) => s + x, 0) / p; for (let i = p; i < N; i++) v = c[i] * k + v * (1 - k); return v }
  // 정식 = EMA112>224 정배열 / 약식 = 가격이 EMA112 위(장기추세 생존 프록시)
  const aligned = approx ? c[N - 1] > ema(112) : ema(112) > ema(224)
  const hl = (p: number, i: number) => { let hi = -Infinity, lo = Infinity; for (let j = i - p + 1; j <= i; j++) { if (D[j].high > hi) hi = D[j].high; if (D[j].low < lo) lo = D[j].low } return (hi + lo) / 2 }
  const cloudAt = (idx: number): 'above' | 'in' | 'below' => {
    const j = idx - 26
    const spanA = (hl(9, j) + hl(26, j)) / 2, spanB = hl(52, j)
    const top = Math.max(spanA, spanB), bot = Math.min(spanA, spanB)
    return c[idx] > top ? 'above' : c[idx] < bot ? 'below' : 'in'
  }
  const cur = cloudAt(N - 1)
  const A = approx   // 라벨에 약식 여부 반영
  if (cur === 'in') return { card: 0, label: '①② 혼돈·매물대 소화 구간', color: TK.yellow500, note: '가격이 구름 속 — 아직 방향이 정해지지 않았습니다. 돌파 확인 전 관망 구간.', approx: A }
  if (cur === 'above') {
    if (!aligned) return { card: 1, label: '③④ 전환 시도 중(구름 위·추세 미확증)', color: TK.yellow500, note: A ? '구름은 넘었지만 가격이 EMA112 아래 — 진짜 돌파(④)의 확증 대기.' : '구름은 넘었지만 장기 이평이 아직 역배열 — 진짜 돌파(④)의 확증 대기.', approx: A }
    let recent = false
    for (let k = 1; k <= 12; k++) if (cloudAt(N - 1 - k) !== 'above') { recent = true; break }
    if (recent) return { card: 1, label: '③④ 구조 돌파 직후', color: TK.green400, note: '최근 12봉 내 구름 상단 돌파 — 여정의 전환점을 막 지났습니다.', approx: A }
    return { card: 2, label: '⑤⑥ 추세 진행 중', color: TK.green400, note: A ? '구름 위 + EMA112 위 유지 — 추세를 존중하며 따라가는 구간.' : '정배열+구름 위 유지 — 추세를 존중하며 따라가는 구간.', approx: A }
  }
  if (aligned) return { card: 1, label: '④ 문 앞 — 구름 아래 눌림', color: TK.yellow500, note: A ? '가격이 EMA112 위라 추세는 살아있지만 구름 아래로 눌림 — 재돌파(④) 확인 후가 안전.' : '장기 추세(정배열)는 살아있지만 가격이 구름 아래로 눌림 — 재돌파(④) 확인 후가 안전.', approx: A }
  return { card: 2, label: '⑤⑥의 역주행 — 추세 이탈', color: TK.red400, note: A ? '구름 아래 + EMA112 아래 — 여정을 거꾸로 내려가는 중, 신규 진입 유예.' : '역배열+구름 아래 = 최후 방어선 붕괴. 여정을 거꾸로 내려가는 중 — 신규 진입 유예.', approx: A }
}

export default function SignalReader({ ticker, market, candles, tf }: {
  ticker: string; market: 'KR' | 'US'; candles: TechCandle[]; tf: 'D' | 'W' | 'M'
}) {
  const [fund, setFund] = useState<Fund | null | 'loading'>('loading')
  // 교육 섹션(3대 함정·추세의 여정)은 상시 펼침 — 아코디언 상태 제거(2026-07-10 사용자 요청)

  useEffect(() => {
    let alive = true
    setFund('loading')
    fetch(`/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${market}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!alive) return
        const f = j?.fundamentals
        if (!f || j?.error) { setFund(null); return }
        setFund({
          peg: toNum(f.peg), fcf: toNum(f.freeCashflow),
          opMargin: toNum(f.operatingMargins), growth: toNum(f.earningsGrowth),
        })
      })
      .catch(() => { if (alive) setFund(null) })
    return () => { alive = false }
  }, [ticker, market])

  const sig = useMemo(() => candles.length >= 30 ? readSignals(candles) : null, [candles])
  // 🎼 린다 라쉬케 3박자(MACD 방향×RSI 50 에너지×거래량) + 연쇄 단계 — techSignals SSOT
  const rk = useMemo(() => candles.length >= 60 ? readRaschke(candles) : null, [candles])
  // 🗺️ 추세의 여정 현재 단계 — 일봉에서만 판정(EMA112·224+구름은 일봉 기준 SSOT)
  const jStage = useMemo(() => tf === 'D' ? journeyStage(candles) : null, [candles, tf])
  // 📊 매물대 중심선(POC) — 차트 오버레이와 동일 SSOT. 판정 로직 미반영(정보만)
  const poc = useMemo(() => candles.length >= 30 ? computePOC(candles) : null, [candles])
  // 🔥 TTM Squeeze / ⚓ Anchored VWAP — 차트 오버레이와 동일 SSOT. 판정 로직 미반영(정보만)
  const squeeze = useMemo(() => candles.length >= 30 ? computeTTMSqueeze(candles) : null, [candles])
  const avwap = useMemo(() => candles.length >= 30 ? computeAnchoredVWAP(candles) : null, [candles])
  // ⏳ 기간 조정 — 눌림목의 '시간 축'(직전 상승 봉수 대비 조정 봉수). 판정 미반영(정보만)
  const timeCorr = useMemo(() => candles.length >= 30 ? readTimeCorrection(candles) : null, [candles])
  // 📐 피보나치 되돌림 — 눌림의 '가격 깊이' 축(⏳과 시간×가격 한 쌍). 판정 미반영(정보만)
  const fib = useMemo(() => candles.length >= 30 ? readFibRetracement(candles) : null, [candles])
  // 🎯 컨플루언스(겹침) 존 — 서로 다른 기법(VWAP·매물대·FVG·피보)의 지지 후보가 같은 가격대에 모이면 고확률. 판정 미반영(정보만)
  const confl = useMemo(() => {
    if (candles.length < 30) return null
    const price = candles[candles.length - 1].close
    const cands: { name: string; src: string; price: number }[] = []
    if (avwap?.vwap != null) cands.push({ name: '⚓ 기관평단', src: 'vwap', price: avwap.vwap })
    if (poc?.poc != null) cands.push({ name: '📊 매물대', src: 'poc', price: poc.poc })
    if (fib) for (const l of fib.levels) cands.push({ name: `📐 피보 ${(l.r * 100).toFixed(1)}%`, src: 'fib', price: l.price })
    for (const g of detectFVG(candles)) if (g.type === 'bull') cands.push({ name: '📦 상승 갭', src: 'fvg', price: (g.lo + g.hi) / 2 })
    return findConfluence(cands, price)
  }, [candles, avwap, poc, fib])
  // 💧 유동성 레벨(차트 오버레이와 동일 SSOT) — 스윕 표시 + ⚖️손익비 목표(전고점) 공용
  const liqLevels = useMemo(() => candles.length >= 30 ? detectLiquidity(candles) : [], [candles])
  const liqSweeps = useMemo(() => {
    const N = candles.length
    return liqLevels.filter(l => l.swept && l.endIdx != null && l.endIdx >= N - 10)
  }, [liqLevels, candles])

  if (!sig) return null

  /* ── 교과서 신호 집계(결정론) ── */
  const buyEvts: string[] = [], sellEvts: string[] = []
  if (sig.macdCross?.type === 'golden') buyEvts.push(`MACD 골든크로스(${sig.macdCross.barsAgo}봉 전)`)
  if (sig.macdCross?.type === 'dead') sellEvts.push(`MACD 데드크로스(${sig.macdCross.barsAgo}봉 전)`)
  if (sig.rsiCross30 != null) buyEvts.push(`RSI 30 상향돌파(${sig.rsiCross30}봉 전)`)
  if (sig.rsiCross70 != null) sellEvts.push(`RSI 70 하향이탈(${sig.rsiCross70}봉 전)`)
  if (sig.stochCross?.type === 'golden' && sig.stochCross.zone === 'low') buyEvts.push('스토캐스틱 과매도 골든크로스')
  if (sig.stochCross?.type === 'dead' && sig.stochCross.zone === 'high') sellEvts.push('스토캐스틱 과매수 데드크로스')
  if (sig.cciCross100?.type === 'up') buyEvts.push(`CCI +100 상향돌파(${sig.cciCross100.barsAgo}봉 전)`)
  if (sig.cciCross100?.type === 'down') sellEvts.push(`CCI +100 하향이탈(${sig.cciCross100.barsAgo}봉 전)`)

  /* ── 펀더멘탈 크로스체크(전부 stock-info SSOT) ── */
  const f = fund === 'loading' || fund == null ? null : fund
  const opLoss = f?.opMargin != null && f.opMargin < -0.10          // 영업적자(−10%↓) = 진짜 부실(강한 danger)
  const fcfNeg = f?.fcf != null && f.fcf < 0                        // FCF적자 = 흑자기업이면 capex·캡티브금융일 뿐(약한 caveat) — 좀비가드 철학
  const pegBase = f?.peg != null && f.peg < 0.3 && f?.growth != null && f.growth > 1.0   // 기저효과(isPegBaseEffect SSOT 공식) = 가짜 저PEG
  const pegHigh = f?.peg != null && f.peg > 2.2                     // Jarvis SELL 기준과 동일(제2원칙)
  const pegGood = f?.peg != null && f.peg <= 1.0 && !pegBase        // 진짜 저평가(기저효과 제외)
  // 🚨 가짜 반등 트리거 = 영업적자 / 고평가 / 기저효과 저PEG (FCF적자 단독은 제외 — 흑자기업 capex 오탐 방지)
  const fundBad = opLoss || pegHigh || pegBase
  const fundGood = pegGood && !opLoss                              // FCF적자여도 흑자면 정합 가능(caveat 병기)
  const fcfCaveat = fcfNeg && !opLoss                              // 흑자인데 FCF만 적자 = 투자/금융 구조 주석

  /* ── 고신뢰 보조축(MFI 거래량·ADX 추세강도) — 제미나이 추천 중 채택분 ── */
  // MFI(거래량 가중): 매수 이벤트가 거래량을 동반하나? <45=무늬만 반등 의심 / ≥55=돈이 실림
  const volNote = sig.mfi == null ? ''
    : sig.mfi >= 55 ? ` 💪 MFI ${sig.mfi} — 거래량(돈)이 실린 움직임이라 신뢰도가 높습니다.`
    : sig.mfi < 45 ? ` 📉 단, MFI ${sig.mfi} — 거래량이 빈약한 '무늬만 반등'일 수 있어 확인 필요.`
    : ''
  // ADX(추세 강도): <20=박스권(오실레이터 신호 남발 구간) / ≥25=진짜 추세장
  const adxTrend = sig.adx != null && sig.adx >= 25, adxRange = sig.adx != null && sig.adx < 20

  /* ── 판정(우선순위 결정론) ── */
  const fcfNote = fcfCaveat ? ' (단, FCF는 적자 — 투자 확대·캡티브 금융 구조일 수 있어 현금흐름은 별도 점검)' : ''
  type V = { icon: string; title: string; body: string; col: string; bg: string }
  const verdicts: V[] = []
  // 🔪 떨어지는 칼날 = 과매도 + '영업적자'(진짜 부실). FCF적자 단독은 흑자기업 오탐이라 제외
  if (sig.rsiZone === 'oversold' && opLoss) verdicts.push({
    icon: '🔪', title: '떨어지는 칼날 — 과매도 ≠ 저평가', col: TK.red400, bg: '#7f1d1d22',
    body: `RSI ${sig.rsi}로 과매도지만 영업적자(영업이익률 ${f && f.opMargin != null ? (f.opMargin * 100).toFixed(0) : '?'}%) 기업입니다. 펀더멘탈이 무너진 종목의 과매도는 '싸다'가 아니라 '이유가 있다'는 뜻 — 영구손실 위험. 기술 반등 신호가 떠도 추격 금지.`,
  })
  if (buyEvts.length && fundBad && !(sig.rsiZone === 'oversold' && opLoss)) verdicts.push({
    icon: '🚨', title: '가짜 반등 경보 (Technical Trap)', col: TK.orange400, bg: '#7c2d1222',
    body: `${buyEvts[0]} — 교과서적 매수 신호이나, ${opLoss ? '영업적자' : pegHigh ? `PEG ${f?.peg?.toFixed(2)}로 고평가` : `PEG ${f?.peg?.toFixed(2)}는 기저효과(이익 저점 회복·성장 ${f && f.growth != null ? (f.growth * 100).toFixed(0) : ''}%)라 진짜 싼 게 아님`} 상태입니다. 펀더멘탈 근거 없는 기술 반등은 단기 되돌림일 확률이 높음 — 추격 매수 자제.`,
  })
  if (buyEvts.length && fundGood) verdicts.push({
    icon: '🟢', title: '신호 정합 (Value + Momentum)', col: TK.green400, bg: '#14532d22',
    body: `싼 가격(PEG ${f?.peg?.toFixed(2)}) + 건전한 펀더멘탈 위에 ${buyEvts[0]}가 확인됐습니다. 가치와 모멘텀이 같은 방향 — 분할 매수 검토 구간(단, 수급·계절 화면도 함께 확인)${fcfNote}.${volNote}`,
  })
  if (sig.rsiZone === 'overbought' && fundGood) verdicts.push({
    icon: '⏳', title: '조기 청산 주의 — 텐배거는 과매수에서 놉니다', col: TK.yellow500, bg: '#42200622',
    body: `RSI ${sig.rsi} 과매수지만 PEG ${f?.peg?.toFixed(2)}로 여전히 쌉니다. 위대한 성장주는 상승 초입부터 수개월간 과매수에 머뭅니다(피터 린치) — 과매수만 보고 파는 건 최고의 주식을 초기에 놓치는 실수${fcfNote}.`,
  })
  if (sellEvts.length && !fundGood && !verdicts.length) verdicts.push({
    icon: '⚠️', title: '교과서 매도 신호 — 모멘텀 반전', col: TK.amber400, bg: '#42200622',
    body: `${sellEvts[0]}. 보유 중이면 분할 익절·비중 점검 검토 구간. 매도 판단은 이 앱의 가치판단(고평가 여부)·수급(돈 이탈)과 함께.`,
  })
  if (!verdicts.length) verdicts.push(
    f == null && fund !== 'loading'
      ? { icon: 'ℹ️', title: '펀더멘탈 데이터 없음 — 기술신호만 참고', col: TK.sub3, bg: 'transparent', body: 'ETF·신생 종목은 PEG·FCF 크로스체크가 불가합니다. 아래 교과서 신호는 참고만 하고, 지수·테마 ETF는 섹터 로테이션 화면의 자금 흐름과 함께 판단하세요.' }
      : { icon: '〰️', title: '뚜렷한 모멘텀 이벤트 없음', col: TK.sub3, bg: 'transparent', body: `최근 5봉 내 교과서적 매수/매도 크로스가 없습니다.${adxRange ? ` ADX ${sig.adx}로 추세 강도가 약한 박스권(방향 확신 낮음 — 정배열 등 구조 신호와 별개) — 이 구간에서 오실레이터 신호를 억지로 따라가면 수수료로 자산이 녹는 휩쏘(Whipsaw)에 빠집니다.` : ' 횡보 구간에서 오실레이터 신호를 억지로 따라가면 수수료로 자산이 녹는 휩쏘(Whipsaw)에 빠집니다.'} 신호가 명확해질 때까지 기다리는 것도 전략.` }
  )
  const v = verdicts[0]
  // ADX 추세장 보강: 이벤트 있는 판정에 추세 강도 근거 병기
  if (adxTrend && (buyEvts.length || sellEvts.length) && v.icon !== '〰️' && v.icon !== 'ℹ️')
    v.body += ` 📐 ADX ${sig.adx} — 박스권이 아닌 진짜 추세장이라 신호 신뢰도가 뒷받침됩니다.`

  // 🛡️ ATR 변동성 손절 참고선(제미나이 추천 채택) — 종목 고유 변동폭 기반 수학적 손절선(일률 % 아님)
  const price = candles[candles.length - 1]?.close
  const atrStop = sig.atr != null && price != null ? price - 2 * sig.atr : null
  const fmtP = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  // ⚖️ 손익비(R:R) 참고 — 목표 = 머리 위 '살아있는 전고점'(가장 가까운 저항) / 손절 = ATR 참고선.
  //    "승률이 아니라 손익비로 승부(손실은 짧게·수익은 길게)" — 신고가권(머리 위 저항 없음)은 정직 생략. 판정 미반영(정보만)
  let rr: { target: number; upPct: number; downPct: number; ratio: number } | null = null
  if (price != null && atrStop != null && atrStop > 0) {
    const overhead = liqLevels.filter(l => l.endIdx == null && l.type === 'high' && l.price > price)
    if (overhead.length) {
      const target = Math.min(...overhead.map(l => l.price))
      const up = target - price, down = price - atrStop
      if (up > 0 && down > 0) rr = {
        target,
        upPct: Math.round((up / price) * 1000) / 10,
        downPct: Math.round((down / price) * 1000) / 10,
        ratio: Math.round((up / down) * 10) / 10,
      }
    }
  }

  const chip = (label: string, val: string, col: string) => (
    <span style={{ fontSize: 10.5, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 8px' }}>
      <span style={{ color: TK.sub2 }}>{label} </span><b style={{ color: col, fontFamily: 'monospace' }}>{val}</b>
    </span>
  )

  return (
    <div style={{ background: `linear-gradient(135deg,#131624,${TK.bg1})`, border: `1px solid #7c3aed44`, borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: TK.violet300 }}>🧭 신호 판독기 — 교과서 신호 vs 펀더멘탈 교차검증</span>
        <span style={{ fontSize: 10, color: TK.sub2 }}>{tf === 'D' ? '일봉' : tf === 'W' ? '주봉' : '월봉'} 기준 · 결정론적 판정(AI 미사용)</span>
      </div>

      {/* 현재 지표 스냅샷 칩 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chip('MACD', sig.macdAbove == null ? '-' : sig.macdAbove ? '시그널 위▲' : '시그널 아래▼', sig.macdAbove ? TK.green400 : TK.red400)}
        {chip('RSI', sig.rsi == null ? '-' : String(sig.rsi), sig.rsiZone === 'overbought' ? TK.red400 : sig.rsiZone === 'oversold' ? TK.sky400 : TK.slate200)}
        {chip('CCI', sig.cci == null ? '-' : String(sig.cci), (sig.cci ?? 0) > 100 ? TK.green400 : (sig.cci ?? 0) < -100 ? TK.red400 : TK.slate200)}
        {sig.mfi != null && chip('MFI 수급', String(sig.mfi), sig.mfi > 80 ? TK.red400 : sig.mfi < 20 ? TK.sky400 : sig.mfi >= 55 ? TK.green400 : TK.slate200)}
        {sig.adx != null && chip('ADX 추세', `${sig.adx} ${adxTrend ? '추세장' : adxRange ? '박스권' : '중간'}`, adxTrend ? TK.green400 : adxRange ? TK.slate400 : TK.slate200)}
        {f?.peg != null && chip('PEG', f.peg.toFixed(2), f.peg <= 1 ? TK.green400 : f.peg > 2.2 ? TK.red400 : TK.slate200)}
        {f && chip('FCF', f.fcf == null ? '-' : f.fcf >= 0 ? '흑자' : '적자', (f.fcf ?? 0) >= 0 ? TK.green400 : TK.red400)}
        {fund === 'loading' && <span style={{ fontSize: 10.5, color: TK.sub2 }}>펀더멘탈 확인 중…</span>}
      </div>

      {/* 판정 카드 */}
      <div style={{ background: v.bg, border: `1.5px solid ${v.col}55`, borderRadius: 10, padding: '10px 13px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: v.col }}>{v.icon} {v.title}</div>
        <div style={{ fontSize: 11.5, color: TK.slate300, marginTop: 4, lineHeight: 1.65 }}>{v.body}</div>
        {(buyEvts.length + sellEvts.length) > 1 && (
          <div style={{ fontSize: 10, color: TK.sub2, marginTop: 6 }}>
            기타 신호: {[...buyEvts, ...sellEvts].slice(1).join(' · ')}
          </div>
        )}
      </div>

      {/* 🛡️ ATR 변동성 손절 참고선 */}
      {atrStop != null && atrStop > 0 && (
        <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
          <span style={{ fontWeight: 800, color: TK.violet300 }}>🛡️ ATR 변동성 손절 참고선</span>
          <span style={{ color: TK.slate200, fontFamily: 'monospace', fontWeight: 800 }}>{fmtP(atrStop)}</span>
          <span style={{ color: TK.sub2 }}>= 현재가 − 2×ATR({sig.atr}) · 종목 고유 변동폭 반영 — 일률적 −N% 손절 대신, 정상 등락에 털리지 않는 수학적 하한</span>
        </div>
      )}

      {/* 💧 유동성 스윕 이벤트(최근 10봉) — 여정 ③ '속임수 하락'의 실측. 판정에 미반영(정보만) */}
      {liqSweeps.length > 0 && (() => {
        const sw = liqSweeps[liqSweeps.length - 1]
        const ago = candles.length - 1 - (sw.endIdx as number)
        return (
          <div style={{ background: TK.bg3, border: `1px solid ${TK.teal400}44`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
            <b style={{ color: TK.teal400 }}>💧 유동성 스윕 감지({ago === 0 ? '오늘' : `${ago}봉 전`})</b>
            <span style={{ color: TK.sub5 }}> — {sw.type === 'low'
              ? <>전저점 {fmtP(sw.price)}을 꼬리로 관통했다가 종가는 위에서 회복{sw.volBoost ? ' + 거래량 급증' : ''} — 여정 ③ &lsquo;속임수 하락(개미 털기)&rsquo; 패턴. 단독 매수 신호 아님 — 구름·추세(신호등)와 함께 확인.</>
              : <>전고점 {fmtP(sw.price)}을 위꼬리로 찔렀다가 종가는 아래 마감{sw.volBoost ? ' + 거래량 급증' : ''} — 고점 돌파 유인(매수측 유동성 소진) 주의.</>}</span>
          </div>
        )
      })()}

      {/* 📊 매물대(POC) 위치 — 위=수익권 다수(지지)/아래=손실권(저항). 판정 미반영(정보만) */}
      {poc && (
        <div style={{ background: TK.bg3, border: `1px solid ${poc.above ? `${TK.green500}44` : `${TK.orange400}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.sky400 }}>📊 매물대 중심선 {fmtP(poc.poc)}</b>
          <span style={{ color: poc.above ? TK.green400 : TK.orange400, fontWeight: 800 }}> — 현재가는 매물대 {poc.above ? `위(+${poc.distPct}%)` : `아래(${poc.distPct}%)`}</span>
          <span style={{ color: TK.sub5 }}>{poc.above
            ? ' — 최근 120봉 최대 거래 가격대 위 = 그 물량을 산 대다수가 수익권(눌림 시 지지 기대). '
            : ' — 최대 거래 가격대 아래 = 대다수가 손실권(반등 시 본전 매도 저항 주의). '}
            가치영역(거래 70%) {fmtP(poc.vaLow)}~{fmtP(poc.vaHigh)}. 단독 신호 아님 — 구름·신호등과 함께.</span>
        </div>
      )}

      {/* ⚓ Anchored VWAP — 직전 스윙 저점 이후 기관 평균단가. 판정 미반영(정보만) */}
      {avwap && (
        <div style={{ background: TK.bg3, border: `1px solid ${avwap.above ? `${TK.green500}44` : `${TK.orange400}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.pink400 }}>⚓ 기관 평균단가(VWAP) {fmtP(avwap.vwap)}</b>
          <span style={{ color: avwap.above ? TK.green400 : TK.orange400, fontWeight: 800 }}> — 현재가 {avwap.above ? `위(+${avwap.distPct}%)` : `아래(${avwap.distPct}%)`}</span>
          {avwap.cross && (
            <span style={{ color: avwap.cross.dir === 'up' ? TK.green400 : TK.red400, fontWeight: 800 }}>
              {' '}· {avwap.cross.dir === 'up' ? '⤴ 상향 돌파' : '⤵ 하향 이탈'}({avwap.cross.barsAgo === 0 ? '오늘' : `${avwap.cross.barsAgo}봉 전`})
            </span>
          )}
          <span style={{ color: TK.sub5 }}>{avwap.above
            ? ' — 직전 바닥 이후 산 대다수가 수익권 = 매수자 우위(지지). '
            : ' — 직전 바닥 이후 산 대다수가 손실권 = 본전 매도 압력(저항). '}
            {avwap.cross ? '돌파/이탈은 주도권 교체 후보 — 단독 신호 아닌 맥락. ' : ''}
            VWAP가 있는 쪽 편에 서고(맞서지 말 것), 터치는 신호가 아니라 맥락 — 확인 캔들(반전 꼬리·거래량)과 신호등으로 확인 후 진입.</span>
        </div>
      )}

      {/* 🔥 TTM Squeeze — 변동성 응축→폭발. 판정 미반영(정보만) */}
      {squeeze && (squeeze.on || squeeze.fired) && (
        <div style={{ background: TK.bg3, border: `1px solid ${squeeze.on ? `${TK.amber500}44` : squeeze.fired === 'up' ? `${TK.green500}44` : `${TK.red500}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          {squeeze.on ? (<>
            <b style={{ color: TK.amber500 }}>🔥 변동성 응축(스퀴즈 ON · {squeeze.barsOn}봉째)</b>
            <span style={{ color: TK.sub5 }}> — 볼린저밴드가 켈트너 채널 안으로 압축 = 에너지 충전 중. 곧 큰 방향 분출 임박 — <b style={{ color: TK.slate300 }}>성급한 매매 대신 분출 방향 대기</b>(방향은 모멘텀·신호등으로).</span>
          </>) : (
            <><b style={{ color: squeeze.fired === 'up' ? TK.green400 : TK.red400 }}>💥 스퀴즈 {squeeze.fired === 'up' ? '상방' : '하방'} 분출</b>
            <span style={{ color: TK.sub5 }}> — 응축된 변동성이 {squeeze.fired === 'up' ? '위로' : '아래로'} 튀었습니다. {squeeze.fired === 'up' ? '추세·거래량 확인 후 분할 진입 검토.' : '지지 붕괴 위험 — 신규 진입 자제·비중 점검.'}</span></>
          )}
        </div>
      )}

      {/* ⏳ 기간 조정 — 눌림목의 '시간 축'. 가격 되돌림(%)과 별개로 '기간'을 채웠는지 관측. 판정 미반영(정보만) */}
      {timeCorr && (
        <div style={{ background: TK.bg3, border: `1px solid ${timeCorr.phase === 'filled' ? `${TK.green500}44` : timeCorr.phase === 'mid' ? `${TK.amber500}44` : `${TK.orange400}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.violet400 }}>⏳ 기간 조정 — 직전 상승 {timeCorr.rallyBars}봉 vs 조정 {timeCorr.pullbackBars}봉</b>
          <span style={{ color: timeCorr.phase === 'filled' ? TK.green400 : timeCorr.phase === 'mid' ? TK.amber500 : TK.orange400, fontWeight: 800 }}> ({timeCorr.ratioPct}% {timeCorr.phase === 'filled' ? '· 기간 충족권' : timeCorr.phase === 'mid' ? '· 중반' : '· 초기'})</span>
          <span style={{ color: TK.sub5 }}> · 고점 대비 −{timeCorr.depthPct}%
            {timeCorr.phase === 'early'
              ? ' — 눌림목은 가격만이 아니라 기간도 채우는 경향(N자형 즉시 재상승은 소수) — 성급 진입보다 기간·지지 확인.'
              : timeCorr.phase === 'mid'
                ? ' — 조정 기간이 쌓이는 중 — 상승에 걸린 시간만큼 쉬어가는 경우가 많음(매물 소화).'
                : ' — 조정 기간이 상승 기간에 근접·초과 — 여기서 자리를 지지하면 재상승 후보(지지·거래량은 신호등·매물대로 확인).'}
            {' '}기간대칭은 경향이지 법칙 아님.</span>
        </div>
      )}

      {/* 📐 피보나치 되돌림 — 눌림의 '가격 깊이'(⏳ 기간조정의 가격 축 짝). 엘리엇 절대 규칙(2파는 1파 시작점 못 깸)만 차용, 파동 카운팅 없음. 판정 미반영(정보만) */}
      {fib && (
        <div style={{ background: TK.bg3, border: `1px solid ${fib.zone === 'golden' ? `${TK.green500}44` : fib.zone === 'shallow' ? `${TK.sky400}44` : fib.zone === 'deep' ? `${TK.amber500}44` : `${TK.red500}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.amber400 }}>📐 되돌림 깊이 — 직전 상승({fmtP(fib.lo)}→{fmtP(fib.hi)})의 {fib.retrPct}% 반납</b>
          <span style={{ color: fib.zone === 'golden' ? TK.green400 : fib.zone === 'shallow' ? TK.sky400 : fib.zone === 'deep' ? TK.amber500 : TK.red400, fontWeight: 800 }}>
            {' '}({fib.zone === 'shallow' ? '얕은 눌림' : fib.zone === 'golden' ? '표준 눌림 존 38.2~61.8%' : fib.zone === 'deep' ? '깊은 되돌림 61.8~78.6%' : fib.zone === 'reversal' ? '78.6% 초과 — 전환 의심' : '시작점 하회 — 구조 무효'})</span>
          <span style={{ color: TK.sub5 }}> · {fib.zone === 'shallow'
            ? '강한 추세일수록 얕게 눌림 — 아직 매수자 우위.'
            : fib.zone === 'golden'
              ? '교과서 되돌림(2파·4파)이 가장 자주 멈추는 깊이 — 여기서 지지+확인 캔들이면 재상승 후보.'
              : fib.zone === 'deep'
                ? '지지의 마지막 관문(78.6%) 접근 — 여기서도 못 서면 되돌림이 아닐 수 있음.'
                : fib.zone === 'reversal'
                  ? '단순 눌림 범위를 벗어남 — 상승 지속 가정 재검토(신호등·최후 방어선 확인).'
                  : '엘리엇 절대 규칙 위반(되돌림이 상승 시작점을 깨면 그 상승 구조는 무효) — 새 구조가 나올 때까지 관망.'}
            {' '}레벨: {fib.levels.map(l => `${(l.r * 100).toFixed(1)}% ${fmtP(l.price)}`).join(' · ')} — 예측 아닌 위치 확인(파동 카운팅은 하지 않음 — 시나리오 수만 가지).</span>
        </div>
      )}

      {/* 🎯 컨플루언스(겹침) 존 — "서로 다른 기법이 같은 존을 가리키면 고확률"(엘리엇 영상 최종 결론). 판정 미반영(정보만) */}
      {confl && (
        <div style={{ background: TK.bg3, border: `1px solid ${TK.green500}55`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.green400 }}>🎯 지지 겹침 존(컨플루언스) {fmtP(confl.mid)} (현재가 −{confl.distPct}%)</b>
          <span style={{ color: TK.sub5 }}> — {confl.names.join(' + ')} {confl.names.length}개 독립 기법이 같은 가격대(±1.5%)를 가리킴 — 겹칠수록 신뢰도 높은 지지 후보. 이탈 시 반대로 강한 매도 신호. 단독 진입 근거 아님 — 신호등·확인 캔들과 함께.</span>
        </div>
      )}

      {/* ⚖️ 손익비(R:R) 참고 — 목표(전고점 저항) vs 손절(ATR). "승률이 아니라 손익비" 교육. 판정 미반영(정보만) */}
      {rr && (
        <div style={{ background: TK.bg3, border: `1px solid ${rr.ratio >= 2 ? `${TK.green500}44` : rr.ratio >= 1 ? `${TK.amber500}44` : `${TK.orange400}44`}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: TK.cyan400 }}>⚖️ 손익비 참고 — 목표(전고점) {fmtP(rr.target)}(+{rr.upPct}%) vs 손절(ATR) {fmtP(atrStop!)}(−{rr.downPct}%)</b>
          <span style={{ color: rr.ratio >= 2 ? TK.green400 : rr.ratio >= 1 ? TK.amber500 : TK.orange400, fontWeight: 800 }}> = 1 : {rr.ratio}</span>
          <span style={{ color: TK.sub5 }}>{rr.ratio >= 2
            ? ' — 손실 1 대비 수익 여지가 2배 이상인 자리(손익비 매력 구간). '
            : rr.ratio >= 1
              ? ' — 보통 — 머리 위 저항까지 여지가 손절 거리와 비슷한 편. '
              : ' — 타점 매력 낮음 — 저항까지 거리가 손절 거리보다 짧음(먹을 것보다 잃을 것이 큼). '}
            승률 높은 기법은 없음 — 5:5 자리라도 이기면 크게·지면 작게가 프로의 수학(손실은 짧게, 수익은 길게). 목표는 가장 가까운 살아있는 전고점 기준(돌파 시 다음 저항까지 확장)·예측 아님.</span>
        </div>
      )}

      {/* 🎯 스마트 알림 체인 — 가치 게이트(펀더) × 변동성/타이밍(기술). 판정 미반영·교육 안내(강제 아님) */}
      {squeeze?.fired === 'up' && f && (
        <div style={{ background: fundGood ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.06)', border: `1px solid ${fundGood ? `${TK.green500}55` : TK.slate600}`, borderRadius: 9, padding: '9px 12px', fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: fundGood ? TK.green400 : TK.slate400 }}>🎯 스마트 알림 체인</b>
          {fundGood ? (
            <span style={{ color: TK.slate300 }}> — <b style={{ color: TK.green400 }}>가치 게이트 통과</b>(저평가·수익성 OK) <b>+</b> <b style={{ color: TK.green400 }}>변동성 상방 분출</b>{avwap?.above ? ' + 기관 평균단가 위' : ''} → <b style={{ color: TK.slate200 }}>분할 진입 검토 타이밍</b>. 우량주의 저위험 진입 구간(추격 대신 분할·손절선 병행).</span>
          ) : (
            <span style={{ color: TK.sub5 }}> — 변동성은 상방 분출했지만 <b style={{ color: TK.orange400 }}>가치 게이트 미통과</b>(고평가·부실 소지). 기술 신호만으로 추격 매수 자제 — WHAT(선정)은 펀더멘탈이 먼저입니다.</span>
          )}
        </div>
      )}

      {/* 🎼 린다 라쉬케 3박자 판독 — MACD(방향)×RSI 50선(에너지)×거래량(연료) + 연쇄 단계 */}
      {rk && (() => {
        const check = (ok: boolean | null, on: string, off: string, na = '데이터 없음') => ok == null
          ? <span style={{ color: TK.sub2 }}>◻ {na}</span>
          : ok ? <span style={{ color: TK.green400 }}>✅ {on}</span> : <span style={{ color: TK.sub2 }}>◻ {off}</span>
        const macdOk = (rk.macdGoldenBelowZero != null || rk.macdZeroBreak != null) && (rk.histRising || rk.macdAboveZero)
        const rsiOk = rk.rsiAbove50 === true && rk.rsi50Break != null
        const stages = ['대기', 'CCI 신호탄', 'RSI 50 돌파', 'MACD 영선 돌파', '첫 눌림목(최적 타점)']
        const sellOn = rk.bearDivergence != null || rk.exitCross
        return (
          <div style={{ background: TK.bg3, border: `1px solid ${rk.buyCount >= 3 ? `${TK.green400}55` : sellOn ? `${TK.red400}55` : BORDER}`, borderRadius: 10, padding: '10px 13px', fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ color: TK.fuchsia300, fontSize: 12 }}>🎼 린다 라쉬케 3박자 — 방향×에너지×연료</b>
              <span style={{ fontSize: 10, color: TK.sub2 }}>MACD=핸들(방향) · RSI 50선=엔진(에너지) · 거래량=연료 — 셋이 동시에 맞을 때만 진짜</span>
            </div>
            {/* 매수 체크 — 눌림목(stage4)은 '추세 확립' 관점(established), 그 외는 '갓 발생한 크로스' 관점(fresh). 시간창이 달라 섞으면 0/3 모순 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 7 }}>
              {rk.stage === 4 ? (<>
                <span>{check(rk.macdAboveZero, 'MACD 방향 — 영선 위 유지(추세 확립)', 'MACD — 영선 아래(추세 약화)')}</span>
                <span>{check(rk.rsiAbove50, `RSI 에너지 — ${sig.rsi} (50 위 유지)`, 'RSI — 50 아래(에너지 소진)')}</span>
                <span>{check(rk.pullback, `눌림 — 고점 대비 ${rk.pullbackPct}% 되돌림(숨 고르기)`, '눌림 아님')}</span>
              </>) : (<>
                <span>{check(macdOk,
                  rk.macdZeroBreak != null ? `MACD 방향 — 영선 돌파(${rk.macdZeroBreak}봉 전)${rk.histRising ? '·히스토 확대' : ''}` : rk.macdGoldenBelowZero != null ? `MACD 방향 — 영선 아래 골든크로스(${rk.macdGoldenBelowZero}봉 전)` : 'MACD 방향 — 전환 신호 있음',
                  'MACD 방향 — 갓 나온 전환 신호 없음')}</span>
                <span>{check(rsiOk, `RSI 에너지 — 50선 돌파(${rk.rsi50Break}봉 전)${rk.bearDivergence ? '·단기 재점화(아래 다이버전스 경고 병존 — 소진 후 반등일 수 있음)' : '·매수세 장악'}`, rk.rsiAbove50 ? 'RSI 50 위(돌파는 10봉+ 경과)' : 'RSI 에너지 — 50 아래(매도세 우위)')}</span>
                <span>{check(rk.volBoost, '거래량 — 신호봉 1.5배+ 폭발(진짜 자금)', '거래량 — 평균 수준(확신 부족)', '거래량 데이터 없음')}</span>
              </>)}
            </div>
            {/* 연쇄 단계 진행바 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ color: TK.sub2, fontSize: 10 }}>연쇄:</span>
              {stages.slice(1).map((s, i) => {
                const n = i + 1
                const active = rk.stage === n, passed = rk.stage > n
                return (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: active ? 900 : 600, borderRadius: 6, padding: '2px 8px',
                      background: active ? TK.fuchsia300 : passed ? `${TK.fuchsia300}33` : '#161d2b',
                      color: active ? TK.bg1 : passed ? TK.fuchsia300 : TK.sub2,
                      border: `1px solid ${active || passed ? `${TK.fuchsia300}66` : BORDER}`,
                    }}>{n}. {s}{active ? ' 📍' : ''}</span>
                    {n < 4 && <span style={{ color: '#334155', fontSize: 9 }}>▶</span>}
                  </span>
                )
              })}
              {rk.stage === 0 && <span style={{ color: TK.sub2, fontSize: 10 }}>— 아직 연쇄 시작 전(관망)</span>}
            </div>
            {/* 종합 해석 */}
            <div style={{ marginTop: 7, color: TK.sub5 }}>
              {rk.stage === 4 ? (rk.parabolicRun
                ? <><b style={{ color: TK.orange400 }}>⚠️ 눌림목이나 직전 상승이 급등(수직)</b> — 영선 돌파 후 첫 되돌림(추세 확립: MACD 양수·RSI {sig.rsi})이지만, 직전 상승이 EMA20에서 25%+ 벌어진 수직 급등이었습니다. 라쉬케 눌림목(홀리그레일)은 <b>완만·건강한 추세</b>를 전제 — 수직 급등 뒤 첫 눌림목은 함정(추가 하락)일 수 있어 반등·거래량 확인 후 소액 접근. 손절은 위 ATR 참고선.</>
                : <><b style={{ color: TK.green400 }}>📍 첫 번째 눌림목</b> — 라쉬케가 꼽는 안전한 진입 자리. 추세 확립(MACD 양수·RSI {sig.rsi}) 상태에서 고점 대비 {rk.pullbackPct}% 되돌림(숨 고르기). 돌파는 이미 지났으므로 &lsquo;갓 나온 크로스&rsquo; 3박자가 아니라 <b>추세 유지 3요소</b>로 확인. 손절은 위 ATR 참고선.</>)
              : rk.buyCount >= 3 ? <><b style={{ color: TK.green400 }}>3박자 완성(3/3)</b> — 방향·에너지·연료가 동시에 맞았습니다. 단 지금이 아니라 <b>첫 눌림목을 기다리는 것</b>이 라쉬케式(추격 대신 되돌림 진입).</>
              : rk.stage >= 2 ? <>연쇄 {rk.stage}단계 진행 중(3박자 {rk.buyCount}/3) — {rk.stage === 2 ? 'RSI가 50을 넘어 에너지가 붙었고, MACD 영선 돌파(추세 확정)를 기다리는 구간.' : 'MACD가 영선을 넘어 추세가 확정 — 첫 눌림목(숨 고르기)이 오면 최적 타점.'}{rk.bearDivergence ? ' 단, 아래 하락 다이버전스 경고가 병존 — 스윙 고점의 에너지는 식는 중이라 연쇄가 소진 후 단순 반등으로 끝날 수 있음(신중).' : ''}</>
              : rk.stage === 1 ? <>CCI가 바닥권(−100)을 탈출한 선행 신호탄 단계 — 성급한 진입 대신 RSI 50 돌파로 에너지가 붙는지 확인.</>
              : <>매수 연쇄 신호 없음 — 라쉬케式으로는 관망 구간입니다.</>}
            </div>
            {/* 매도 신호 */}
            {sellOn && (
              <div style={{ marginTop: 7, padding: '7px 10px', background: '#7f1d1d22', border: `1px solid ${TK.red400}44`, borderRadius: 8 }}>
                <b style={{ color: TK.red400 }}>🔻 라쉬케 매도 신호</b>
                <span style={{ color: TK.red300 }}>
                  {rk.bearDivergence && <> — 하락 다이버전스: 주가 고점은 {fmtP(rk.bearDivergence.prevHi)}→{fmtP(rk.bearDivergence.priceHi)}로 높아졌는데 RSI 고점은 {rk.bearDivergence.rsiAtPrev}→{rk.bearDivergence.rsiAtHi}로 낮아짐(에너지 소진 — 추세 종료 경고)</>}
                  {rk.exitCross && <>{rk.bearDivergence ? ' + ' : ' — '}MACD 데드크로스 + RSI 70 하향이탈 동시 발생(교과서 익절 시점)</>}
                  . 보유 중이면 분할 익절 검토 — 단 이 앱의 가치판단(고평가 여부)과 함께.
                </span>
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 9.5, color: TK.sub2 }}>
              🎓 라쉬케式 핵심: 골든크로스 하나가 아니라 <b style={{ color: TK.slate300 }}>지표들이 연쇄로 같은 방향을 가리키는 순간</b>을 기다리고, 돌파 추격 대신 <b style={{ color: TK.slate300 }}>첫 눌림목</b>에 진입. 홀리그레일(ADX 추세 + 되돌림)은 위 ADX 칩·타점 신호등의 눌림목 판정이 같은 철학. 판정은 전부 결정론(주관 0)·점수 미반영.
            </div>
          </div>
        )
      })()}

      {/* 3대 함정 교육 — 상시 펼침(사용자 요청) */}
      <div>
        <div style={{ color: TK.slate300, fontSize: 11.5, fontWeight: 800 }}>🎓 모멘텀 지표의 3대 함정</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8, marginTop: 8, fontSize: 10.5, color: TK.sub3, lineHeight: 1.6 }}>
            <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: TK.slate200 }}>① 횡보장 휩쏘(Whipsaw)</b><br />
              추세 없는 박스권에서 스토캐스틱·CCI는 매수·매도 신호를 남발합니다. 신호마다 따라가면 수수료·슬리피지로 자산이 야금야금 녹는 음의 복리.
            </div>
            <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: TK.slate200 }}>② 떨어지는 칼날 오판 (RSI&lt;30)</b><br />
              펀더멘탈 붕괴 기업은 RSI 15~20에 몇 달씩 머뭅니다. 과매도만 보고 사면 영구 자본 손실 — 그래서 이 판독기가 FCF·영업이익을 먼저 봅니다.
            </div>
            <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: TK.slate200 }}>③ 조기 청산 (RSI&gt;70)</b><br />
              텐배거는 상승 초입부터 과매수에서 몇 달을 놉니다. 성장이 유효한데 과매수만 보고 팔면 인생 주식을 초기에 놓칩니다(피터 린치).
            </div>
          </div>
      </div>
      {/* 🗺️ 추세의 여정 × 신호등 — 상시 펼침 + 현재 종목의 단계 자동 판정(📍) */}
      <div>
        <div style={{ color: TK.slate300, fontSize: 11.5, fontWeight: 800 }}>🗺️ 추세의 여정 — 이 종목은 지금 어디인가</div>
        <div style={{ marginTop: 4, fontSize: 10, color: TK.sub }}>
          ①~⑥ = 추세가 태어나서 자라는 6단계: ①혼돈(방향 없음) → ②매물대 축적(박스권) → ③속임수 하락(개미 털기) → ④구조 돌파 → ⑤추세 진행 → ⑥추세 추종
        </div>
        <div style={{ marginTop: 8, fontSize: 10.5, color: TK.sub3, lineHeight: 1.65 }}>
            {/* 📍 현재 위치 판정 배너 — EMA112·224+구름(타점 신호등과 동일 공식) */}
            {tf !== 'D' ? (
              <div style={{ marginBottom: 8, padding: '7px 11px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, color: TK.sub }}>
                📍 현재 위치 판정은 <b style={{ color: TK.slate300 }}>일봉 기준</b>입니다 — 일봉 탭에서 확인하세요.
              </div>
            ) : jStage ? (
              <div style={{ marginBottom: 8, padding: '8px 12px', background: `${jStage.color}12`, border: `1px solid ${jStage.color}55`, borderRadius: 8 }}>
                <b style={{ color: jStage.color, fontSize: 11.5 }}>📍 이 종목의 현재 위치: {jStage.label}</b>
                <span style={{ color: TK.sub5 }}> · {jStage.note}</span>
                {jStage.approx && <span style={{ color: TK.amber400, fontSize: 10 }}> · ⚠️ 약식 판정 — 신생 종목이라 EMA224 미확보, 구름+EMA112 기준(기술차트 강등 규칙과 동일)</span>}
              </div>
            ) : (
              <div style={{ marginBottom: 8, padding: '7px 11px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, color: TK.sub }}>
                📍 위치 판정 생략 — 상장 후 데이터가 짧아(일봉 130개 미만) 구름·이평 판정이 불가합니다(신규상장 등).
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8 }}>
              {[
                { title: '①② 혼돈·매물대 축적 = 🟡 매물대 소화 중', tc: TK.yellow500, body: <>방향 없는 등락과 박스권 — 가격이 <b>구름 속</b>에 있는 구간. 이때 모멘텀 신호는 휩쏘 남발(위 함정①). 신호등이 🟡인 이유: 아직 이야기가 시작되지 않았기 때문.</> },
                { title: '③④ 속임수 하락 → 구조 돌파 = 🟢 전환', tc: TK.green400, body: <>박스 하단을 살짝 깨서 개미를 털어낸 뒤(속임수) 강한 돌파가 나옵니다. <b>구름 상단 돌파 + 정배열</b>이 확인될 때 신호등이 🟢으로 — 돌파를 &lsquo;확인 후&rsquo; 타는 이유(속임수 차단).</> },
                { title: '⑤⑥ 추세 성숙기 — 유지(🟢) 또는 붕괴(🔴)', tc: TK.blue400, body: <>둘 중 하나의 상태입니다. <b style={{ color: TK.green400 }}>🟢 진행(유지)</b> = 고점·저점을 높이며 달리고 정배열+구름 위 유지 → 추세 존중. <b style={{ color: TK.red400 }}>🔴 붕괴(역주행)</b> = 역배열+구름 아래로 무너짐 = 최후 방어선 붕괴(리밸런싱 매도 근거와 동일 신호). 지금 이 종목이 둘 중 어디인지는 위 &lsquo;지금 여기&rsquo; 배지가 알려줍니다.</> },
              ].map((cd, i) => {
                const here = tf === 'D' && jStage?.card === i
                // 이 카드가 현재 위치면, jStage.color로 유지(초록)/붕괴(빨강)/중립(노랑) 실제 상태를 명확히 해소
                const resolved = here && i === 2
                  ? (jStage!.color === TK.red400 ? { t: '🔴 지금은 붕괴(역주행) 상태', c: TK.red400 } : { t: '🟢 지금은 진행(유지) 상태', c: TK.green400 })
                  : null
                return (
                  <div key={i} style={{ background: here ? `${jStage!.color}0d` : TK.bg3, border: `1px solid ${here ? jStage!.color : BORDER}`, borderRadius: 8, padding: 10, position: 'relative' }}>
                    {here && <span style={{ position: 'absolute', top: -9, right: 10, background: jStage!.color, color: TK.bg1, fontSize: 9.5, fontWeight: 900, borderRadius: 6, padding: '1px 7px' }}>📍 지금 여기</span>}
                    <b style={{ color: cd.tc }}>{cd.title}</b><br />
                    {resolved && <div style={{ margin: '4px 0', fontSize: 11, fontWeight: 800, color: resolved.c }}>{resolved.t}</div>}
                    {cd.body}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 6, color: TK.sub2 }}>
              💡 핵심: 시장을 예측할 필요 없이 <b style={{ color: TK.slate300 }}>지금 어느 단계인지</b>만 읽으면 됩니다 — 그게 신호등이 하는 일. 단, &lsquo;유동성 스윕&rsquo; 같은 세부 해석은 분석가마다 달라 이 앱은 객관 판정(EMA·구름)만 씁니다. WHAT(종목 선정)은 여전히 펀더멘탈.
            </div>
          </div>
      </div>
      <div style={{ fontSize: 10, color: TK.sub }}>
        ⚠️ 기술신호는 이 화면 전용 보조 지표 — 앱의 추천·리밸런싱 점수에는 반영되지 않습니다. 판정 기준: PEG SSOT(stock-info)·영업적자 −10%·PEG 2.2(Jarvis 매도 기준과 동일). 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}
