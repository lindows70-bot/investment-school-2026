'use client'
// 📋 앱 신호 성적표 — 이 앱이 낸 신호를 실제 주가로 자기 채점(📌매일 그룹).
//    ⭐ 답하는 질문은 하나: "앱 말을 믿어도 되나". 매수/매도 '판단'은 종합 매수 판정·매매 브리핑 담당.
//    2026-08-02 3차: 표 1개 유지 + 📏 시장 기준선(코스피/S&P500) + 종목 실명 노출 + 용어 '합류'→'이중 확인'.
//    ⚠️ 기준선이 핵심이다 — 적중률만 두면 "매수 29%면 나쁘네"로 읽히는데, 실측상 이 표본 구간의 코스피는
//    30일 후 상승 확률 0%(0/23)·평균 −16.6%였다. 국면을 신호 탓으로 돌리지 않으려면 기준선을 같이 보여야 한다.
import { useEffect, useState } from 'react'
import type { SignalReportResult, GroupStat, SigEvent } from '@/app/api/signal-report/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const pctColor = (r: number | null) => r == null ? TK.sub4 : r >= 0 ? TK.red400 : TK.blue400
const fmtPct = (r: number | null) => r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`

const headOf = (g: GroupStat) => ({ win: g.win30 ?? g.winNow, n: g.win30 != null ? g.n30 : g.n7 })

/** 3대 축 — 이중 확인이 궁극 기준이고 나머지 둘은 그 재료 */
const AXES = [
  { src: 'confluence', icon: '⭐', name: '이중 확인', desc: '가치 + 타이밍 둘 다 겹침', hero: true },
  { src: 'jarvis', icon: '🤖', name: '가치만', desc: '싸고 좋은 회사인가', hero: false },
  { src: 'timing', icon: '🚦', name: '타이밍만', desc: '지금 들어갈 자리인가', hero: false },
] as const

/** 종목 칩 — 학생이 "그래서 어느 종목이 맞았는데?"를 바로 볼 수 있게(허전함 해소) */
function StockChip({ e, ok }: { e: SigEvent; ok: boolean }) {
  return (
    <span title={`${e.date} 신호 · 진입 이후 ${fmtPct(e.retNow)}${e.benchNow != null ? ` · 같은 기간 시장 ${fmtPct(e.benchNow)}` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, cursor: 'help',
        background: ok ? `${TK.green400}14` : `${TK.sub2}18`, border: `1px solid ${ok ? `${TK.green400}44` : TK.border}`,
        borderRadius: 6, padding: '2px 7px',
      }}>
      <span style={{ fontSize: 9 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
      <b style={{ color: TK.slate200, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</b>
      <b style={{ color: pctColor(e.retNow) }}>{fmtPct(e.retNow)}</b>
    </span>
  )
}

/** 적중률 셀 — 큰 % + 표본 + 시장 대비 초과(%p) */
function WinCell({ g }: { g: GroupStat | undefined }) {
  if (!g || g.n === 0) return <span style={{ color: TK.sub2, fontSize: 12 }}>적립 중</span>
  const { win, n } = headOf(g)
  if (win == null) return <span style={{ color: TK.sub2, fontSize: 12 }}>채점 대기</span>
  const thin = n < 5
  // 시장 대비 초과 — 평균 수익률 − 같은 기간 시장 평균(매도는 부호를 뒤집어 "더 피한 손실"로 읽는다)
  const edge = g.avgNow != null && g.avgBenchNow != null
    ? Math.round((g.kind === 'buy' ? g.avgNow - g.avgBenchNow : g.avgBenchNow - g.avgNow) * 10) / 10
    : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
        <b style={{ fontSize: 19, fontWeight: 900, color: thin ? TK.sub4 : win >= 50 ? TK.green400 : TK.sub4 }}>{win}%</b>
        <span style={{ fontSize: 10.5, color: TK.sub2 }}>{n}건</span>
        {thin && <span title={`채점 표본 ${n}건 — 통계로 보기엔 너무 적어 우연일 수 있습니다`} style={{ fontSize: 9.5, color: TK.amber400, cursor: 'help' }}>⚠️</span>}
      </span>
      {edge != null && (
        <span title="같은 기간 시장(코스피·S&P500) 평균과의 차이 — 이게 +면 국면을 이긴 것입니다"
          style={{ fontSize: 10, color: edge >= 0 ? TK.green400 : TK.sub4, cursor: 'help' }}>
          시장 대비 <b>{edge >= 0 ? '+' : ''}{edge.toFixed(1)}%p</b>
        </span>
      )}
    </div>
  )
}

/** 접힌 상세용 — 신호 하나하나의 기록 */
function DetailCard({ g }: { g: GroupStat }) {
  const { win, n } = headOf(g)
  if (g.n === 0) return null
  return (
    <div style={{ ...CARD, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12.5, color: TK.slate200 }}>{g.title}</b>
        <span style={{ fontSize: 10.5, color: TK.sub4 }}>
          적중 {win != null ? `${win}%` : '—'} · {n}건 · 평균 <b style={{ color: pctColor(g.avgNow) }}>{fmtPct(g.avgNow)}</b>
          {g.avgBenchNow != null && <span style={{ color: TK.sub2 }}> (같은 기간 시장 {fmtPct(g.avgBenchNow)})</span>}
        </span>
      </div>
      {g.recent.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ color: TK.sub4, fontSize: 9.5 }}>
            <th style={{ textAlign: 'left', padding: '2px 5px' }}>신호일</th>
            <th style={{ textAlign: 'left', padding: '2px 5px' }}>종목</th>
            <th title="신호 낸 날부터 딱 한 달 뒤 성적(한 번 정해지면 안 바뀜)" style={{ textAlign: 'right', padding: '2px 5px', cursor: 'help' }}>30일 후</th>
            <th title="신호일부터 오늘까지 성적(매일 바뀜). 일주일 안 됐으면 D+며칠" style={{ textAlign: 'right', padding: '2px 5px', cursor: 'help' }}>현재</th>
            <th title="같은 기간 시장(코스피·S&P500) 수익률 — 신호를 이 값과 비교해야 공정합니다" style={{ textAlign: 'right', padding: '2px 5px', cursor: 'help' }}>시장</th>
          </tr></thead>
          <tbody>
            {g.recent.slice(0, 6).map((e: SigEvent, i: number) => (
              <tr key={`${e.ticker}:${e.date}:${i}`} style={{ borderTop: `1px solid ${TK.border}` }}>
                <td style={{ padding: '4px 5px', color: TK.sub4, fontFamily: 'monospace' }}>{e.date.slice(5)}</td>
                <td style={{ padding: '4px 5px', color: TK.slate200 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: pctColor(e.ret30), fontWeight: 700 }}>{fmtPct(e.ret30)}</td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: pctColor(e.retNow), fontWeight: 700 }}>{e.retNow == null ? `D+${e.ageDays}` : fmtPct(e.retNow)}</td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: TK.sub2 }}>{fmtPct(e.benchNow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 10, color: TK.sub2 }}>
        {g.kind === 'sell' ? '매도 적중 = 신호 뒤 실제 하락(“그때 팔았으면 면한 손실”)' : '매수 적중 = 신호 뒤 실제 상승'}
      </div>
    </div>
  )
}

export default function SignalReportPage() {
  const [data, setData] = useState<SignalReportResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/signal-report').then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setErr(true))
  }, [])

  const find = (src: string, kind: 'buy' | 'sell') => data?.groups.find(g => g.src === src && g.kind === kind)
  /** 그룹의 적중/빗나감 종목(최근순 3개씩) — 표 아래 칩으로 */
  const picks = (g: GroupStat | undefined, ok: boolean) => {
    if (!g) return []
    return g.recent.filter(e => e.retNow != null && (ok ? (g.kind === 'buy' ? e.retNow! > 0 : e.retNow! < 0) : (g.kind === 'buy' ? e.retNow! <= 0 : e.retNow! >= 0))).slice(0, 3)
  }
  // 시장 기준선 요약 — 가장 표본이 두꺼운 매수 그룹에서 뽑는다(학생 오독 방지의 핵심 숫자)
  const benchRef = find('jarvis', 'buy')?.avgBenchNow ?? find('timing', 'buy')?.avgBenchNow ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>📋 앱 신호 성적표</div>
        <div style={{ fontSize: 12, color: TK.sub4, marginTop: 4, lineHeight: 1.6 }}>
          이 앱이 낸 신호를 실제 주가로 <b style={{ color: TK.slate200 }}>스스로 채점</b>합니다 — 답하는 질문은 하나,
          <b style={{ color: TK.slate200 }}> &ldquo;앱 말을 믿어도 되나&rdquo;</b>.
          {data && <span style={{ color: TK.sub2 }}> · {data.jarvisSince}~ · {data.tickers}종목</span>}
        </div>
      </div>

      {err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>성적표를 불러오지 못했습니다 — 새로고침해 주세요.</div>}
      {!data && !err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>📋 신호 이력을 채점하는 중… (첫 로드는 수십 초 걸릴 수 있어요)</div>}

      {data && (
        <>
          {/* 🏆 결론 — 궁극의 기준 하나 */}
          <div style={{ background: `${TK.amber400}12`, border: `1.5px solid ${TK.amber400}66`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: TK.amber400 }}>🏆 궁극의 기준은 하나 — ⭐ 이중 확인</div>
            <div style={{ fontSize: 12.5, color: TK.sub11, marginTop: 6, lineHeight: 1.7 }}>
              <b style={{ color: TK.slate200 }}>가치</b>(싸고 좋은 회사인가)와 <b style={{ color: TK.slate200 }}>타이밍</b>(지금 들어갈 자리인가) —
              성격이 다른 두 엔진이 <b style={{ color: TK.amber400 }}>같은 방향으로 겹칠 때만</b> 움직이세요.
              겹치는 순간만 잡히니 <b>드물게(귀하게)</b> 나옵니다.
            </div>
          </div>

          {/* 📊 표 1개 + 종목 칩 */}
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TK.slate200 }}>신호별 적중률</div>
            <div style={{ fontSize: 11, color: TK.sub4, margin: '3px 0 10px' }}>
              매수는 <b style={{ color: TK.green400 }}>오르면</b> 적중 · 매도는 <b style={{ color: TK.red400 }}>떨어지면</b> 적중(그때 팔았으면 면한 손실) ·
              <b style={{ color: TK.slate200 }}> 시장 대비</b>가 +면 국면을 이긴 것
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 10.5, color: TK.sub4 }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px' }}>기준</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px' }}>매수 적중률</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px' }}>매도 적중률</th>
                </tr>
              </thead>
              <tbody>
                {AXES.map(a => {
                  const gb = find(a.src, 'buy'), gs = find(a.src, 'sell')
                  const hitB = picks(gb, true), missB = picks(gb, false), hitS = picks(gs, true)
                  return (
                    <tr key={a.src} style={{ borderTop: `1px solid ${TK.border}`, ...(a.hero ? { background: `${TK.amber400}0d` } : {}) }}>
                      <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: a.hero ? TK.amber400 : TK.slate200 }}>{a.icon} {a.name}</div>
                        <div style={{ fontSize: 10.5, color: TK.sub4, marginTop: 1 }}>{a.desc}</div>
                        {/* 🎯 종목 실명 — "그래서 뭐가 맞았는데?"에 바로 답한다 */}
                        {(hitB.length > 0 || hitS.length > 0 || missB.length > 0) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7 }}>
                            {hitB.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 9.5, color: TK.green400, minWidth: 52 }}>매수 적중</span>
                                {hitB.map((e, i) => <StockChip key={i} e={e} ok />)}
                              </div>
                            )}
                            {missB.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 9.5, color: TK.sub4, minWidth: 52 }}>매수 빗나감</span>
                                {missB.map((e, i) => <StockChip key={i} e={e} ok={false} />)}
                              </div>
                            )}
                            {hitS.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 9.5, color: TK.red400, minWidth: 52 }}>매도 적중</span>
                                {hitS.map((e, i) => <StockChip key={i} e={e} ok />)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}><WinCell g={gb} /></td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}><WinCell g={gs} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* ⚠️ 이 표가 실제로 말하는 것 — 배너 주장과 표가 어긋나면 문구가 숫자에 반박당한다 */}
            <div style={{ fontSize: 11, color: TK.sub4, marginTop: 10, lineHeight: 1.7, borderTop: `1px solid ${TK.border}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>
                📌 <b style={{ color: TK.slate200 }}>지금 이 표가 말하는 것</b> — <b>이중 확인은 표본이 적어 아직 증명 전</b>이고,
                <b> 매도는 &lsquo;가치&rsquo;가 가장 두꺼운 근거</b>이며, <b>매수는 세 축 모두 30%대</b>입니다.
              </div>
              <div>
                📌 <b style={{ color: TK.amber400 }}>그런데도 이중 확인을 우선하는 근거</b>는 이 표가 아니라 <b>별도 백테스트</b>예요 —
                12,594봉 검증에서 <b>눌림목 단독은 이상치 제거 후 우위 없음(−0.45%p)</b>인데
                <b style={{ color: TK.amber400 }}> 추세 구조와 겹친 것은 +1.8%p</b>로 살아남았습니다.
                <b> 우위의 실체는 신호 하나가 아니라 &lsquo;겹침&rsquo;</b>이었습니다.
              </div>
            </div>
          </div>

          {/* 🧯 매수 30%의 진짜 이유 — 학생 신뢰 문제에 데이터로 답한다.
              ⚠️ 초안엔 "매수 29%는 나쁜 게 아니라 바닥 기준선 위"라 썼는데 실측이 반박했다(시장 대비 −2.3%p).
                 화면이 스스로를 반박하지 않도록, 절반만 장 탓이고 절반은 아직 증명 못 한 것이라고 정직하게 쓴다. */}
          <div style={{ ...CARD, borderColor: `${TK.blue400}44`, background: `${TK.blue400}0a` }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: TK.blue400 }}>🧯 매수 적중률 30%대 — 신호가 나빠서일까?</div>
            <div style={{ fontSize: 12, color: TK.sub11, marginTop: 7, lineHeight: 1.75 }}>
              <b style={{ color: TK.slate200 }}>절반은 장 때문이고, 절반은 아직 증명하지 못한 겁니다.</b> 솔직히 말할게요.
            </div>
            <div style={{ fontSize: 12, color: TK.sub11, marginTop: 8, lineHeight: 1.75 }}>
              ① <b>장 탓인 부분</b> — 신호가 쌓인 2026년 6~7월,
              <b style={{ color: TK.blue400 }}> 코스피는 어느 날 사도 30일 뒤 오를 확률이 0%</b>였습니다(23개 구간 전부 하락 · 평균 −16.6% · 기간 −25.1%).
              {benchRef != null && <> 우리 매수 신호 종목들의 <b>같은 기간 시장 평균도 {fmtPct(benchRef)}</b>였고요.</>} 적중률 30%는 이 바닥 기준선 위에서 나온 숫자입니다.
            </div>
            <div style={{ fontSize: 12, color: TK.sub11, marginTop: 8, lineHeight: 1.75 }}>
              ② <b style={{ color: TK.amber400 }}>그래도 정직하게 — 매수는 시장을 이기지 못했습니다.</b> 표의 &lsquo;시장 대비&rsquo;를 보세요.
              매수는 세 축 모두 <b>소폭 열위(−2~4%p)</b>입니다. 반면 <b style={{ color: TK.green400 }}>매도는 시장 대비 +5~10%p로 확실히 이겼습니다</b> —
              내려갈 종목을 골라내는 일은 실제로 해내고 있다는 뜻입니다.
            </div>
            <div style={{ fontSize: 12, color: TK.sub11, marginTop: 8, lineHeight: 1.75 }}>
              ③ <b>왜 매수만 어려울까</b> — 가치 신호는 &ldquo;싸고 좋은 회사&rdquo;를 고르는 일이라 결과가 <b>몇 달~몇 년</b>에 걸쳐 나오는데,
              지금은 <b>30일이라는 짧은 자</b>로 재고 있습니다. 게다가 하락장에선 <b>싼 게 더 싸집니다</b>.
              <b style={{ color: TK.amber400 }}> 그래서 타이밍을 겹쳐 보는 &lsquo;이중 확인&rsquo;이 필요한 것</b>이고, 그 효과는 별도 백테스트(+1.8%p)가 뒷받침합니다.
            </div>
            <div style={{ fontSize: 11, color: TK.sub4, marginTop: 9, lineHeight: 1.7, borderTop: `1px solid ${TK.border}`, paddingTop: 8 }}>
              ⚖️ 반대 방향도 짚어둡니다 — <b>매도 적중률 81%도 실력만은 아닙니다</b>. 다 떨어지는 장에선 뭘 팔아도 맞으니까요.
              그래서 &lsquo;시장 대비&rsquo;(+8.2%p)가 진짜 성적입니다. <b>이 표는 하락장 한 국면의 기록</b>이라, 상승장이 오면 숫자가 뒤집힐 수 있습니다.
              앱이 자기 약점을 숨기지 않는 것 — 그게 이 화면의 목적입니다.
            </div>
          </div>

          {/* 🎯 행동 동선 */}
          <div style={{ fontSize: 12, color: TK.sub4, lineHeight: 1.7, padding: '0 2px' }}>
            🎯 여기는 <b>성적 기록</b>이지 매매 화면이 아니에요. 오늘 뭘 할지는
            <a href="/briefing" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}> 🎯 매매 브리핑</a>,
            종목 하나를 따져볼 땐
            <a href="/research" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}> 🔎 종합 매수 판정</a>에서 보세요.
          </div>

          {/* 🔬 상세 — 기본 접힘 */}
          <details style={{ ...CARD, padding: '12px 16px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: TK.sub11 }}>
              🔬 신호 하나하나 보기 <span style={{ fontWeight: 400, color: TK.sub4 }}>· 최근 기록·평균·시장 비교</span>
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10, marginTop: 12 }}>
              {data.groups.map(g => <DetailCard key={`${g.src}:${g.kind}`} g={g} />)}
            </div>
          </details>

          {/* ⚠️ 정직 캐비엇 */}
          <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
            ⚠️ <b>표본이 적으면(10건 미만) 통계가 아니라 일화입니다.</b> 기준선은 KR=코스피·US=S&amp;P500 지수이며 종목별 베타는 보정하지 않았습니다(단순 비교).
            대상은 학생 보유 종목뿐이라 <b>선택 편향</b>이 있고, 진입가는 신호일 이하 최근 종가(±1일)·배당 미반영입니다.
            반복 판정은 <b>연속 구간 첫날 1건</b>으로 압축해 자기상관을 제거했습니다.
            {!!data.unscored && <> 채점 불가 <b>{data.unscored}종목</b>(상장폐지·거래정지 가능)은 제외돼 위 적중률이 <b>그만큼 낙관 편향</b>일 수 있습니다.</>}
            {' '}과거 성과는 미래를 보장하지 않으며, 이 화면은 교육용 자기 검증 지표입니다.
          </div>
        </>
      )}
    </div>
  )
}
