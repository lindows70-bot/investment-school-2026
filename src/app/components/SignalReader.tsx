'use client'
// 🧭 신호 판독기 — 교과서 모멘텀 신호(MACD·RSI·스토캐스틱·CCI)를 펀더멘탈 SSOT(stock-info PEG·FCF·영업이익률)와
// 교차검증해 '가짜 반등/신호 정합/조기 청산 주의/떨어지는 칼날'을 결정론적으로 판정(AI 미사용·환각 0).
// 기술신호는 이 화면 전용 — 통합추천·리밸런싱 점수에는 절대 미반영(앱의 펀더멘탈 우선 원칙).
import { useState, useEffect, useMemo } from 'react'
import { readSignals } from '@/lib/techSignals'
import type { TechCandle } from '@/app/api/tech-chart/route'

const BORDER = '#1e293b'

interface Fund { peg: number | null; fcf: number | null; opMargin: number | null; growth: number | null }

const toNum = (v: unknown): number | null => typeof v === 'number' && isFinite(v) ? v : null

export default function SignalReader({ ticker, market, candles, tf }: {
  ticker: string; market: 'KR' | 'US'; candles: TechCandle[]; tf: 'D' | 'W' | 'M'
}) {
  const [fund, setFund] = useState<Fund | null | 'loading'>('loading')
  const [eduOpen, setEduOpen] = useState(false)
  const [journeyOpen, setJourneyOpen] = useState(false)

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
    icon: '🔪', title: '떨어지는 칼날 — 과매도 ≠ 저평가', col: '#f87171', bg: '#7f1d1d22',
    body: `RSI ${sig.rsi}로 과매도지만 영업적자(영업이익률 ${f && f.opMargin != null ? (f.opMargin * 100).toFixed(0) : '?'}%) 기업입니다. 펀더멘탈이 무너진 종목의 과매도는 '싸다'가 아니라 '이유가 있다'는 뜻 — 영구손실 위험. 기술 반등 신호가 떠도 추격 금지.`,
  })
  if (buyEvts.length && fundBad && !(sig.rsiZone === 'oversold' && opLoss)) verdicts.push({
    icon: '🚨', title: '가짜 반등 경보 (Technical Trap)', col: '#fb923c', bg: '#7c2d1222',
    body: `${buyEvts[0]} — 교과서적 매수 신호이나, ${opLoss ? '영업적자' : pegHigh ? `PEG ${f?.peg?.toFixed(2)}로 고평가` : `PEG ${f?.peg?.toFixed(2)}는 기저효과(이익 저점 회복·성장 ${f && f.growth != null ? (f.growth * 100).toFixed(0) : ''}%)라 진짜 싼 게 아님`} 상태입니다. 펀더멘탈 근거 없는 기술 반등은 단기 되돌림일 확률이 높음 — 추격 매수 자제.`,
  })
  if (buyEvts.length && fundGood) verdicts.push({
    icon: '🟢', title: '신호 정합 (Value + Momentum)', col: '#4ade80', bg: '#14532d22',
    body: `싼 가격(PEG ${f?.peg?.toFixed(2)}) + 건전한 펀더멘탈 위에 ${buyEvts[0]}가 확인됐습니다. 가치와 모멘텀이 같은 방향 — 분할 매수 검토 구간(단, 수급·계절 화면도 함께 확인)${fcfNote}.${volNote}`,
  })
  if (sig.rsiZone === 'overbought' && fundGood) verdicts.push({
    icon: '⏳', title: '조기 청산 주의 — 텐배거는 과매수에서 놉니다', col: '#eab308', bg: '#42200622',
    body: `RSI ${sig.rsi} 과매수지만 PEG ${f?.peg?.toFixed(2)}로 여전히 쌉니다. 위대한 성장주는 상승 초입부터 수개월간 과매수에 머뭅니다(피터 린치) — 과매수만 보고 파는 건 최고의 주식을 초기에 놓치는 실수${fcfNote}.`,
  })
  if (sellEvts.length && !fundGood && !verdicts.length) verdicts.push({
    icon: '⚠️', title: '교과서 매도 신호 — 모멘텀 반전', col: '#fbbf24', bg: '#42200622',
    body: `${sellEvts[0]}. 보유 중이면 분할 익절·비중 점검 검토 구간. 매도 판단은 이 앱의 가치판단(고평가 여부)·수급(돈 이탈)과 함께.`,
  })
  if (!verdicts.length) verdicts.push(
    f == null && fund !== 'loading'
      ? { icon: 'ℹ️', title: '펀더멘탈 데이터 없음 — 기술신호만 참고', col: '#8599ae', bg: 'transparent', body: 'ETF·신생 종목은 PEG·FCF 크로스체크가 불가합니다. 아래 교과서 신호는 참고만 하고, 지수·테마 ETF는 섹터 로테이션 화면의 자금 흐름과 함께 판단하세요.' }
      : { icon: '〰️', title: '뚜렷한 모멘텀 이벤트 없음', col: '#8599ae', bg: 'transparent', body: `최근 5봉 내 교과서적 매수/매도 크로스가 없습니다.${adxRange ? ` ADX ${sig.adx}로 추세가 죽은 박스권이 정량 확인됨 — 이 구간에서 오실레이터 신호를 억지로 따라가면 수수료로 자산이 녹는 휩쏘(Whipsaw)에 빠집니다.` : ' 횡보 구간에서 오실레이터 신호를 억지로 따라가면 수수료로 자산이 녹는 휩쏘(Whipsaw)에 빠집니다.'} 신호가 명확해질 때까지 기다리는 것도 전략.` }
  )
  const v = verdicts[0]
  // ADX 추세장 보강: 이벤트 있는 판정에 추세 강도 근거 병기
  if (adxTrend && (buyEvts.length || sellEvts.length) && v.icon !== '〰️' && v.icon !== 'ℹ️')
    v.body += ` 📐 ADX ${sig.adx} — 박스권이 아닌 진짜 추세장이라 신호 신뢰도가 뒷받침됩니다.`

  // 🛡️ ATR 변동성 손절 참고선(제미나이 추천 채택) — 종목 고유 변동폭 기반 수학적 손절선(일률 % 아님)
  const price = candles[candles.length - 1]?.close
  const atrStop = sig.atr != null && price != null ? price - 2 * sig.atr : null
  const fmtP = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  const chip = (label: string, val: string, col: string) => (
    <span style={{ fontSize: 10.5, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 8px' }}>
      <span style={{ color: '#7f93a8' }}>{label} </span><b style={{ color: col, fontFamily: 'monospace' }}>{val}</b>
    </span>
  )

  return (
    <div style={{ background: 'linear-gradient(135deg,#131624,#0d1017)', border: `1px solid #7c3aed44`, borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#c4b5fd' }}>🧭 신호 판독기 — 교과서 신호 vs 펀더멘탈 교차검증</span>
        <span style={{ fontSize: 10, color: '#7f93a8' }}>{tf === 'D' ? '일봉' : tf === 'W' ? '주봉' : '월봉'} 기준 · 결정론적 판정(AI 미사용)</span>
      </div>

      {/* 현재 지표 스냅샷 칩 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chip('MACD', sig.macdAbove == null ? '-' : sig.macdAbove ? '시그널 위▲' : '시그널 아래▼', sig.macdAbove ? '#4ade80' : '#f87171')}
        {chip('RSI', sig.rsi == null ? '-' : String(sig.rsi), sig.rsiZone === 'overbought' ? '#f87171' : sig.rsiZone === 'oversold' ? '#38bdf8' : '#e2e8f0')}
        {chip('CCI', sig.cci == null ? '-' : String(sig.cci), (sig.cci ?? 0) > 100 ? '#4ade80' : (sig.cci ?? 0) < -100 ? '#f87171' : '#e2e8f0')}
        {sig.mfi != null && chip('MFI 수급', String(sig.mfi), sig.mfi > 80 ? '#f87171' : sig.mfi < 20 ? '#38bdf8' : sig.mfi >= 55 ? '#4ade80' : '#e2e8f0')}
        {sig.adx != null && chip('ADX 추세', `${sig.adx} ${adxTrend ? '추세장' : adxRange ? '박스권' : '중간'}`, adxTrend ? '#4ade80' : adxRange ? '#94a3b8' : '#e2e8f0')}
        {f?.peg != null && chip('PEG', f.peg.toFixed(2), f.peg <= 1 ? '#4ade80' : f.peg > 2.2 ? '#f87171' : '#e2e8f0')}
        {f && chip('FCF', f.fcf == null ? '-' : f.fcf >= 0 ? '흑자' : '적자', (f.fcf ?? 0) >= 0 ? '#4ade80' : '#f87171')}
        {fund === 'loading' && <span style={{ fontSize: 10.5, color: '#7f93a8' }}>펀더멘탈 확인 중…</span>}
      </div>

      {/* 판정 카드 */}
      <div style={{ background: v.bg, border: `1.5px solid ${v.col}55`, borderRadius: 10, padding: '10px 13px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: v.col }}>{v.icon} {v.title}</div>
        <div style={{ fontSize: 11.5, color: '#cbd5e1', marginTop: 4, lineHeight: 1.65 }}>{v.body}</div>
        {(buyEvts.length + sellEvts.length) > 1 && (
          <div style={{ fontSize: 10, color: '#7f93a8', marginTop: 6 }}>
            기타 신호: {[...buyEvts, ...sellEvts].slice(1).join(' · ')}
          </div>
        )}
      </div>

      {/* 🛡️ ATR 변동성 손절 참고선 */}
      {atrStop != null && atrStop > 0 && (
        <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
          <span style={{ fontWeight: 800, color: '#c4b5fd' }}>🛡️ ATR 변동성 손절 참고선</span>
          <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 800 }}>{fmtP(atrStop)}</span>
          <span style={{ color: '#7f93a8' }}>= 현재가 − 2×ATR({sig.atr}) · 종목 고유 변동폭 반영 — 일률적 −N% 손절 대신, 정상 등락에 털리지 않는 수학적 하한</span>
        </div>
      )}

      {/* 3대 함정 교육 */}
      <div>
        <button onClick={() => setEduOpen(o => !o)} style={{ background: 'transparent', border: 'none', color: '#8599ae', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          🎓 모멘텀 지표의 3대 함정 {eduOpen ? '▲' : '▼'}
        </button>
        {eduOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8, marginTop: 8, fontSize: 10.5, color: '#8599ae', lineHeight: 1.6 }}>
            <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: '#e2e8f0' }}>① 횡보장 휩쏘(Whipsaw)</b><br />
              추세 없는 박스권에서 스토캐스틱·CCI는 매수·매도 신호를 남발합니다. 신호마다 따라가면 수수료·슬리피지로 자산이 야금야금 녹는 음의 복리.
            </div>
            <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: '#e2e8f0' }}>② 떨어지는 칼날 오판 (RSI&lt;30)</b><br />
              펀더멘탈 붕괴 기업은 RSI 15~20에 몇 달씩 머뭅니다. 과매도만 보고 사면 영구 자본 손실 — 그래서 이 판독기가 FCF·영업이익을 먼저 봅니다.
            </div>
            <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <b style={{ color: '#e2e8f0' }}>③ 조기 청산 (RSI&gt;70)</b><br />
              텐배거는 상승 초입부터 과매수에서 몇 달을 놉니다. 성장이 유효한데 과매수만 보고 팔면 인생 주식을 초기에 놓칩니다(피터 린치).
            </div>
          </div>
        )}
      </div>
      {/* 🗺️ 추세의 여정 × 신호등 — SNS 'Journey of a Trend' 6단계를 우리 신호등 언어로 번역 */}
      <div>
        <button onClick={() => setJourneyOpen(o => !o)} style={{ background: 'transparent', border: 'none', color: '#8599ae', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          🗺️ 추세의 여정 — 혼돈에서 추세까지, 신호등은 지금 어디를 보고 있나 {journeyOpen ? '▲' : '▼'}
        </button>
        {journeyOpen && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: '#8599ae', lineHeight: 1.65 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8 }}>
              <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                <b style={{ color: '#eab308' }}>①② 혼돈·매물대 축적 = 🟡 매물대 소화 중</b><br />
                방향 없는 등락과 박스권 — 가격이 <b>구름 속</b>에 있는 구간. 이때 모멘텀 신호는 휩쏘 남발(위 함정①). 신호등이 🟡인 이유: 아직 이야기가 시작되지 않았기 때문.
              </div>
              <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                <b style={{ color: '#4ade80' }}>③④ 속임수 하락 → 구조 돌파 = 🟢 전환</b><br />
                박스 하단을 살짝 깨서 개미를 털어낸 뒤(속임수) 강한 돌파가 나옵니다. <b>구름 상단 돌파 + 정배열</b>이 확인될 때 신호등이 🟢으로 — 돌파를 &lsquo;확인 후&rsquo; 타는 이유(속임수 차단).
              </div>
              <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                <b style={{ color: '#60a5fa' }}>⑤⑥ 추세 진행 = 🟢 유지, 붕괴 = 🔴</b><br />
                고점·저점을 높이며 달리는 구간 — 정배열+구름 위가 유지되는 동안 추세를 존중. <b>역배열+구름 아래</b>로 무너지면 🔴 최후 방어선 붕괴(리밸런싱 매도 근거와 동일 신호).
              </div>
            </div>
            <div style={{ marginTop: 6, color: '#7f93a8' }}>
              💡 핵심: 시장을 예측할 필요 없이 <b style={{ color: '#cbd5e1' }}>지금 어느 단계인지</b>만 읽으면 됩니다 — 그게 신호등이 하는 일. 단, &lsquo;유동성 스윕&rsquo; 같은 세부 해석은 분석가마다 달라 이 앱은 객관 판정(EMA·구름)만 씁니다. WHAT(종목 선정)은 여전히 펀더멘탈.
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#8a9aaa' }}>
        ⚠️ 기술신호는 이 화면 전용 보조 지표 — 앱의 추천·리밸런싱 점수에는 반영되지 않습니다. 판정 기준: PEG SSOT(stock-info)·영업적자 −10%·PEG 2.2(Jarvis 매도 기준과 동일). 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}
