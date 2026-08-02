'use client'
// 📋 앱 신호 성적표 — 이 앱이 낸 신호를 실제 주가로 자기 채점(📌매일 그룹).
//    ⭐ 이 화면이 답하는 질문은 하나다: "앱 말을 믿어도 되나". 매수/매도 '판단'은 종합 매수 판정·매매 브리핑 담당.
//    2026-08-02 재설계: 카드 6개(엔진×방향) → 결론 배너 + 비교 표 1개 + 접힌 상세.
//    사용자 피드백("3가지 기준이 굳이 필요한가·궁극의 기준 하나로") — 엔진이 여럿인 건 내부 사정이고
//    학생에게 병렬로 보여주는 순간 "어느 걸 믿지?"라는 새 문제가 생긴다(내부자 레이더 v4 원칙).
import { useEffect, useState } from 'react'
import type { SignalReportResult, GroupStat, SigEvent } from '@/app/api/signal-report/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const pctColor = (r: number | null) => r == null ? TK.sub4 : r >= 0 ? TK.red400 : TK.blue400
const fmtPct = (r: number | null) => r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`

/** 헤드라인 승률과 그걸 뒷받침하는 실제 표본수 — 30일 성적이 있으면 그것, 없으면 현재까지 */
const headOf = (g: GroupStat) => ({
  win: g.win30 ?? g.winNow,
  n: g.win30 != null ? g.n30 : g.n7,
  is30: g.win30 != null,
})

/** 3대 신호 축 — 표 행 정의. 합류가 궁극 기준이고 나머지 둘은 그 재료다 */
const AXES = [
  { src: 'confluence', icon: '⭐', name: '합류', desc: '가치 + 타이밍 둘 다 겹침', hero: true },
  { src: 'jarvis', icon: '🤖', name: '가치만', desc: '싸고 좋은 회사인가(Jarvis)', hero: false },
  { src: 'timing', icon: '🚦', name: '타이밍만', desc: '들어갈 자리인가(타점)', hero: false },
] as const

function WinCell({ g }: { g: GroupStat | undefined }) {
  if (!g || g.n === 0) return <span style={{ color: TK.sub2, fontSize: 12 }}>적립 중</span>
  const { win, n } = headOf(g)
  if (win == null) return <span style={{ color: TK.sub2, fontSize: 12 }}>채점 대기</span>
  const thin = n < 5          // 소표본 가드 — 통계가 아니라 일화(WorldQuant 데이터 스누핑 원칙)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <b style={{ fontSize: 19, fontWeight: 900, color: thin ? TK.sub4 : win >= 50 ? TK.green400 : TK.sub4 }}>{win}%</b>
      <span style={{ fontSize: 10.5, color: TK.sub2 }}>{n}건</span>
      {thin && <span title={`채점 표본 ${n}건 — 통계로 보기엔 너무 적어 우연일 수 있습니다`}
        style={{ fontSize: 9.5, color: TK.amber400, cursor: 'help' }}>⚠️</span>}
    </span>
  )
}

/** 접힌 상세용 — 신호 하나하나의 기록(최근 8건) */
function DetailCard({ g }: { g: GroupStat }) {
  const isSell = g.kind === 'sell'
  const { win, n } = headOf(g)
  if (g.n === 0) return null
  return (
    <div style={{ ...CARD, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12.5, color: TK.slate200 }}>{g.title}</b>
        <span style={{ fontSize: 10.5, color: TK.sub4 }}>
          적중 {win != null ? `${win}%` : '—'} · {n}건 · 평균 <b style={{ color: pctColor(g.avgNow) }}>{fmtPct(g.avgNow)}</b>
        </span>
      </div>
      {g.recent.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ color: TK.sub4, fontSize: 9.5 }}>
            <th style={{ textAlign: 'left', padding: '2px 5px' }}>신호일</th>
            <th style={{ textAlign: 'left', padding: '2px 5px' }}>종목</th>
            <th title="신호 낸 날부터 딱 한 달 뒤 성적(한 번 정해지면 안 바뀜)" style={{ textAlign: 'right', padding: '2px 5px', cursor: 'help' }}>30일 후</th>
            <th title="신호일부터 오늘까지 성적(매일 바뀜). 일주일 전이면 D+며칠로 표시" style={{ textAlign: 'right', padding: '2px 5px', cursor: 'help' }}>현재</th>
          </tr></thead>
          <tbody>
            {g.recent.slice(0, 6).map((e: SigEvent, i: number) => (
              <tr key={`${e.ticker}:${e.date}:${i}`} style={{ borderTop: `1px solid ${TK.border}` }}>
                <td style={{ padding: '4px 5px', color: TK.sub4, fontFamily: 'monospace' }}>{e.date.slice(5)}</td>
                <td style={{ padding: '4px 5px', color: TK.slate200 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: pctColor(e.ret30), fontWeight: 700 }}>{fmtPct(e.ret30)}</td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: pctColor(e.retNow), fontWeight: 700 }}>{e.retNow == null ? `D+${e.ageDays}` : fmtPct(e.retNow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 10, color: TK.sub2 }}>
        {isSell ? '매도 적중 = 신호 뒤 실제 하락(“그때 팔았으면 면한 손실”)' : '매수 적중 = 신호 뒤 실제 상승'}
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
          {/* 🏆 결론 — 궁극의 기준 하나. 학생이 이 배너만 읽어도 되게 */}
          <div style={{ background: `${TK.amber400}12`, border: `1.5px solid ${TK.amber400}66`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: TK.amber400 }}>🏆 궁극의 기준은 하나 — ⭐ 합류</div>
            <div style={{ fontSize: 12.5, color: TK.sub11, marginTop: 6, lineHeight: 1.7 }}>
              <b style={{ color: TK.slate200 }}>가치</b>(싸고 좋은 회사인가)와 <b style={{ color: TK.slate200 }}>타이밍</b>(지금 들어갈 자리인가) —
              성격이 다른 두 엔진이 <b style={{ color: TK.amber400 }}>같은 방향으로 겹칠 때만</b> 움직이세요.
              겹치는 순간만 잡히니 <b>드물게(귀하게)</b> 나옵니다.
            </div>
          </div>

          {/* 📊 비교 표 하나 — "왜 합류인가"를 한 화면에서 증명 */}
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TK.slate200, marginBottom: 2 }}>신호별 적중률</div>
            <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 10 }}>
              매수는 <b style={{ color: TK.green400 }}>오르면</b> 적중 · 매도는 <b style={{ color: TK.red400 }}>떨어지면</b> 적중(그때 팔았으면 면한 손실)
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
                {AXES.map(a => (
                  <tr key={a.src} style={{
                    borderTop: `1px solid ${TK.border}`,
                    ...(a.hero ? { background: `${TK.amber400}0d` } : {}),
                  }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: a.hero ? TK.amber400 : TK.slate200 }}>{a.icon} {a.name}</div>
                      <div style={{ fontSize: 10.5, color: TK.sub4, marginTop: 1 }}>{a.desc}</div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}><WinCell g={find(a.src, 'buy')} /></td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}><WinCell g={find(a.src, 'sell')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* ⚠️ 이 표가 실제로 말하는 것을 그대로 — 배너 주장과 표가 어긋나면 문구가 숫자에 반박당한다.
                (매도는 '가치 단독'이 27건 81%로 이 페이지에서 가장 두꺼운 근거다. 합류가 이겼다고 쓰면 거짓말) */}
            <div style={{ fontSize: 11, color: TK.sub4, marginTop: 10, lineHeight: 1.7, borderTop: `1px solid ${TK.border}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>
                📌 <b style={{ color: TK.slate200 }}>지금 이 표가 말하는 것</b> — <b>합류는 표본이 적어 아직 증명 전</b>이고,
                <b> 매도는 &lsquo;가치&rsquo;가 가장 두꺼운 근거</b>(단 하락장이라 뭘 팔아도 맞은 효과 포함),
                <b> 매수는 세 축 모두 30%대</b>(30일이라는 자가 가치 신호엔 너무 짧습니다).
              </div>
              <div>
                📌 <b style={{ color: TK.amber400 }}>그런데도 합류를 우선하는 근거</b>는 이 표가 아니라 <b>별도 백테스트</b>예요 —
                12,594봉 검증에서 <b>눌림목 단독은 이상치 제거 후 우위 없음(−0.45%p)</b>인데
                <b style={{ color: TK.amber400 }}> 추세 구조와 겹친 것은 +1.8%p</b>로 살아남았습니다.
                <b> 우위의 실체는 신호 하나가 아니라 &lsquo;겹침&rsquo;</b>이었습니다.
              </div>
            </div>
          </div>

          {/* 🎯 행동 동선 — 여기는 성적표, 실제 판단은 저기서 */}
          <div style={{ fontSize: 12, color: TK.sub4, lineHeight: 1.7, padding: '0 2px' }}>
            🎯 여기는 <b>성적 기록</b>이지 매매 화면이 아니에요. 오늘 뭘 할지는
            <a href="/briefing" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}> 🎯 매매 브리핑</a>,
            종목 하나를 따져볼 땐
            <a href="/research" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}> 🔎 종합 매수 판정</a>에서 보세요.
          </div>

          {/* 🔬 상세 — 기본 접힘. 정직한 자기 채점이라 지우지 않되, 기본 화면에선 물러난다 */}
          <details style={{ ...CARD, padding: '12px 16px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: TK.sub11 }}>
              🔬 신호 하나하나 보기 <span style={{ fontWeight: 400, color: TK.sub4 }}>· 최근 기록·평균 수익률</span>
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginTop: 12 }}>
              {data.groups.map(g => <DetailCard key={`${g.src}:${g.kind}`} g={g} />)}
            </div>
          </details>

          {/* ⚠️ 정직 캐비엇 — 짧게, 한 덩어리로 */}
          <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
            ⚠️ <b>표본이 적으면(10건 미만) 통계가 아니라 일화입니다.</b> 지금 표본은 6~7월 하락장에 몰려 있어
            <b> 30일이라는 짧은 자</b>로는 매수 성적이 나쁘게·매도 성적이 좋게 나옵니다(가치 신호의 결과는 몇 달~몇 년에 걸쳐 나옵니다).
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
