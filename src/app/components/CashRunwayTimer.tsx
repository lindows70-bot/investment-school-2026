'use client'

/**
 * ⏳ CashRunwayTimer — 좀비 생존 타이머 (킬러 기능 8단계)
 *
 * 적자 고성장주·회생주를 담은 학생을 위한 냉정한 현실 점검.
 * 현재 현금(totalCash)과 매년 까먹는 잉여현금흐름(FCF 적자)으로
 * "현금으로 몇 개월 더 버티는가(Cash Runway)"를 타이머처럼 시각화.
 * 12개월 미만이면 유상증자(지분 희석) 경보.
 *
 * 데이터: research가 이미 받은 stock-info DCF 값(props) — 추가 fetch 0.
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

interface Props {
  ticker:   string
  name:     string
  currency?: string                // 'USD' | 'KRW'
  freeCashflow?:      number | null   // 연간 FCF (음수 = 현금 소진)
  totalCash?:         number | null   // 보유 현금
  sharesOutstanding?: number | null
  returnOnEquity?:    number | null   // 손익 흑자/적자 판별 (ROE>0=흑자)
  operatingMargins?:  number | null   // 영업이익률 (ROE 일회성 왜곡 교차검증)
}

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', orange: '#fb923c',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

function money(n: number, cur: string): string {
  const krw = cur === 'KRW'
  if (krw) return n >= 1e12 ? `₩${(n / 1e12).toFixed(1)}조` : n >= 1e8 ? `₩${(n / 1e8).toFixed(0)}억` : `₩${Math.round(n / 1e4).toLocaleString()}만`
  return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n).toLocaleString()}`
}

export default function CashRunwayTimer({ name, currency = 'USD', freeCashflow, totalCash, returnOnEquity, operatingMargins }: Props) {
  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>⏳</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>좀비 생존 타이머</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.orange}22`, color: C.orange, fontWeight: 700 }}>SECRET · 현금 런웨이</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>
      {Header}{child}
    </div>
  )

  // 데이터 부족
  if (totalCash == null || freeCashflow == null) {
    return Wrap(<div style={{ fontSize: 12.5, color: C.textLow, lineHeight: 1.6 }}>⏳ 현금흐름·현금 데이터를 확보하지 못해 생존 타이머를 계산할 수 없습니다.</div>)
  }

  // ⚠️ 핵심: FCF 음수 ≠ 적자. 손익(ROE)과 결합해 4사분면으로 판별
  //   단, 영업이익률이 크게 음수(영업적자)면 ROE 양수는 일회성 이익 왜곡(예: IonQ 워런트 평가익) → 적자로 본다
  const roeProfit = returnOnEquity == null ? null : returnOnEquity > 0
  const opLoss = operatingMargins != null && operatingMargins < -0.10   // 영업이익률 −10%↓ = 영업적자
  const profitable = opLoss ? false : roeProfit                          // 영업적자면 무조건 적자 취급
  const roePct = returnOnEquity != null ? Math.round(returnOnEquity * 100) : null
  const Banner = (emoji: string, title: string, body: React.ReactNode, color: string) => Wrap(
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: `${color}12`, border: `1px solid ${color}44` }}>
      <span style={{ fontSize: 26 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 3, lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>,
    `${color}55`
  )

  // ① 흑자 + 현금창출(FCF≥0) → 건강 (손익 미확인이어도 FCF+면 일단 양호)
  if (freeCashflow >= 0 && profitable !== false) {
    return Banner('💰', '현금을 까먹지 않는 회사예요 (FCF 흑자)',
      <>{name}은(는) 매년 <b style={{ color: C.green }}>{money(freeCashflow, currency)}</b>의 잉여현금을 벌어들입니다{roePct != null && roePct > 0 ? <> (ROE +{roePct}%)</> : null}.
        현금 소진·유상증자 희석 위협이 없어 생존 타이머는 ‘해당 없음’입니다.</>, C.green)
  }

  // ③ 손익은 적자(ROE<0)인데 FCF는 + → "FCF만 보고 안심 금지"
  if (freeCashflow >= 0 && profitable === false) {
    return Banner('⚠️', '잉여현금흐름은 +지만, 손익은 적자예요',
      <>{name}은(는) FCF는 <b style={{ color: C.gold }}>{money(freeCashflow, currency)}</b> 흑자지만 순이익은 적자(ROE {roePct}%)입니다.
        보유 현금이나 일회성 요인일 수 있어, FCF 흑자만 보고 안심하면 안 됩니다 — 흑자 전환 추세를 직접 확인하세요.</>, C.gold)
  }

  // ② 손익은 흑자(ROE>0)인데 FCF가 일시 마이너스 → 좀비 아님 (한화에어로·삼성생명류)
  if (freeCashflow < 0 && profitable === true) {
    return Banner('🟦', '흑자 기업이에요 — 현금흐름만 일시 마이너스',
      <>{name}은(는) 순이익은 <b style={{ color: C.blue }}>흑자(ROE +{roePct}%)</b>인데, 투자(설비·R&D)나 운전자본 증가로 잉여현금흐름(FCF)이 일시적으로 마이너스입니다.
        <b style={{ color: C.text }}> 적자 좀비가 아니므로</b> 생존 타이머는 적용하지 않습니다. (방산·인프라·고성장 투자기 기업에서 흔한 현상)</>, C.blue)
  }

  // ── ④ (적자 ROE<0 또는 손익 미확인) + 현금 소진(FCF<0) → 진짜 좀비 타이머 ──
  const burnAnnual  = Math.abs(freeCashflow)
  const burnMonthly = burnAnnual / 12
  const runwayMo    = Math.max(0, totalCash / burnMonthly)   // 개월
  const runwayCapped = Math.min(runwayMo, 60)                // 게이지 상한 5년

  const level =
    runwayMo >= 36 ? { c: C.green,  t: '여유 있음',  msg: '아직 시간이 충분합니다.' } :
    runwayMo >= 18 ? { c: C.gold,   t: '보통',       msg: '여유는 있지만 현금 소진 추세를 지켜보세요.' } :
    runwayMo >= 12 ? { c: C.orange, t: '주의',       msg: '1년 반 안에 자금 조달이 필요할 수 있습니다.' } :
                     { c: C.red,    t: '위험',       msg: '곧 유상증자(지분 희석)나 자금난 위험이 큽니다.' }

  const dilutionRisk = runwayMo < 12
  const lossOrUnknown = profitable === false ? `적자(ROE ${roePct}%)` : '손익 미확인이지만'
  const runwayTxt = runwayMo >= 60 ? '60개월 이상' : `약 ${Math.round(runwayMo)}개월`

  return Wrap(
    <>
      {/* 타이머 대시보드 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 12, background: `${level.c}12`, border: `1px solid ${level.c}44`, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center', minWidth: 92 }}>
          <div style={{ fontSize: 9, color: C.textLow, fontWeight: 700, marginBottom: 2 }}>예상 생존 기간</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: level.c, fontFamily: 'monospace', lineHeight: 1 }}>
            {runwayMo >= 60 ? '60+' : Math.round(runwayMo)}
          </div>
          <div style={{ fontSize: 11, color: level.c, fontWeight: 700 }}>개월 · {level.t}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          {/* 잔여 게이지 (줄어드는 모래시계) */}
          <div style={{ height: 10, background: C.card2, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${(runwayCapped / 60) * 100}%`, background: level.c, borderRadius: 999, transition: 'width 0.7s' }} />
          </div>
          <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.5 }}>{level.msg}</div>
        </div>
      </div>

      {/* 수치 카드 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
        <Metric label="보유 현금" value={money(totalCash, currency)} color={C.blue} />
        <Metric label="연간 현금 소진" value={`−${money(burnAnnual, currency)}`} color={C.red} />
        <Metric label="월 소진 속도" value={`−${money(burnMonthly, currency)}`} color={C.orange} />
      </div>

      {/* 유상증자 희석 경보 */}
      {dilutionRisk && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: `${C.red}14`, border: `1px solid ${C.red}44`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 3 }}>🚨 유상증자(지분 희석) 경보</div>
          <div style={{ fontSize: 11.5, color: '#fecaca', lineHeight: 1.55 }}>
            생존 기간이 1년 미만입니다. 금고가 비기 전에 <b>주식을 더 찍어내(유상증자) 네 지분 가치를 희석</b>할 가능성이 높습니다 — 적자 기업의 가장 무서운 적입니다.
          </div>
        </div>
      )}

      {/* 린치 코멘트 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${level.c}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75, fontStyle: 'italic' }}>
          &ldquo;{dilutionRisk
            ? `주의해! ${name}은 ${lossOrUnknown} 지금 속도라면 ${runwayTxt} 뒤 금고가 텅 비어. 곧 유상증자로 네 지분을 희석할 확률이 높아 — 회생 스토리가 그 전에 현실이 되는지가 관건이야.`
            : `${name}은 ${lossOrUnknown} 현재 현금으로 ${runwayTxt} 버틸 수 있어. 적자·현금소진 기업은 '시간과의 싸움'이야 — 흑자 전환이 이 타이머보다 먼저 오는지 분기마다 확인해.`}&rdquo;
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        ⏳ 연간 FCF(잉여현금흐름) 적자폭 기준 추정 · Yahoo/FMP 데이터 · 교육용 참고 지표 (실제 자금조달·비용절감으로 달라질 수 있음)
      </div>
    </>,
    `${level.c}55`
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '11px 13px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 9.5, color: C.textLow, fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
