'use client'
// 📋 앱 신호 성적표 — Jarvis 처방전·타점 워처 신호를 실제 주가로 자기 채점한 대시보드(📌매일 그룹).
//    "이 앱의 신호를 얼마나 믿어야 하나"를 데이터로 — 표본수 상시 병기·가짜 승률 금지·과거 성과≠미래(정직 원칙).
import { useEffect, useState } from 'react'
import type { SignalReportResult, GroupStat, SigEvent } from '@/app/api/signal-report/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const pctColor = (r: number | null) => r == null ? TK.sub4 : r >= 0 ? TK.red400 : TK.blue400
const fmtPct = (r: number | null) => r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`

// 학생용 쉬운 말 툴팁 — 처음 보는 용어 위에 마우스 올리면 뜸
const TAG_HINT: Record<string, string> = {
  '최대 방어': '"팔아볼까(매도검토)"라고 한 것 중, 신호 뒤 가장 많이 떨어진 종목 — 그때 팔았다면 가장 크게 손실을 피한 셈(신호가 제일 잘 맞은 예).',
  '역주행': '"팔아볼까"라고 했는데 오히려 가장 많이 오른 종목 — 신호와 반대로 갔다는 뜻(가장 빗나간 매도 신호).',
  '최고 적중': '"사볼까(매수기회)"라고 한 것 중, 신호 뒤 가장 많이 오른 종목(신호가 제일 잘 맞은 예). % = 신호 낸 날부터 지금까지 오른 정도.',
  '최대 빗나감': '"사볼까"라고 했는데 가장 많이 떨어진 종목(가장 빗나간 매수 신호).',
}
function EventChip({ e, tag }: { e: SigEvent; tag: string }) {
  return (
    <span title={TAG_HINT[tag] ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg2, border: `1px solid ${TK.border}`, borderRadius: 7, padding: '3px 9px', fontSize: 11, cursor: 'help' }}>
      <span style={{ color: TK.sub4, fontSize: 9.5, borderBottom: `1px dotted ${TK.sub4}` }}>{tag}</span>
      <b style={{ color: TK.slate200 }}>{e.name}</b>
      <span style={{ color: pctColor(e.retNow), fontWeight: 800 }}>{fmtPct(e.retNow)}</span>
      <span style={{ color: TK.sub2, fontSize: 9.5 }}>{e.date.slice(5)} 신호</span>
    </span>
  )
}

function GroupCard({ g }: { g: GroupStat }) {
  const isSell = g.kind === 'sell'
  const isConf = g.src === 'confluence'   // ⭐ 고신뢰 합류 — 금색 강조
  const accent = isSell ? TK.red400 : TK.green400
  const empty = g.n === 0
  const headWin = g.win30 ?? g.winNow
  const headLabel = g.win30 != null ? '30일 적중률' : '현재까지 적중률'
  const headN = g.win30 != null ? g.n30 : g.n7   // 헤드라인 승률을 뒷받침하는 실제 표본수
  const thinSample = headWin != null && headN < 5 // 소표본 가드 — 데이터 스누핑/일화 오인 방지(퀀트 원칙)
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10,
      ...(isConf ? { border: `1.5px solid ${TK.amber400}88`, background: `${TK.amber400}0a`, boxShadow: `0 0 0 1px ${TK.amber400}22` } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span title={isConf ? '가치(Jarvis)와 타이밍(타점) 두 신호가 같은 종목·같은 방향으로 겹친 것만 모은 그룹 — 두 독립 엔진의 합의라 가장 신뢰도가 높습니다.' : ''}
          style={{ fontSize: 13.5, fontWeight: 800, color: isConf ? TK.amber400 : TK.slate200, cursor: isConf ? 'help' : 'default' }}>{g.title}</span>
        <span style={{ fontSize: 10.5, color: TK.sub4 }}>이벤트 {g.n}건 {g.n7 < g.n ? `· 채점 대상 ${g.n7}건(7일+)` : ''}</span>
      </div>
      {isConf && (
        <div style={{ fontSize: 10.5, color: TK.sub5, lineHeight: 1.55, marginTop: -2 }}>
          🤖 <b>가치(Jarvis)</b>가 &ldquo;싸고 좋다/비싸다&rdquo;고 한 종목에 🚦 <b>타이밍(타점)</b>까지 같은 방향으로 겹친 것만 — <b style={{ color: TK.amber400 }}>두 엔진이 합의한 고신뢰 신호</b>. 하나만 뜬 것보다 이걸 우선하세요.
        </div>
      )}
      {empty ? (
        <div style={{ fontSize: 12, color: TK.sub4, padding: '10px 0' }}>
          📥 {isConf ? '합류 신호 적립 중 — 가치+타이밍이 겹치는 순간만 잡히므로 드물게(귀하게) 쌓입니다.' : '신호 적립 중 — 전환 이벤트가 발생하면 자동으로 채점이 시작됩니다(타점 워처는 2026-07-18부터 적립).'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10.5, color: TK.sub4 }}>{headLabel}{isSell ? ' (하락 적중)' : ' (상승 적중)'}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: thinSample ? TK.sub4 : (headWin != null && headWin >= 50 ? accent : TK.sub4) }}>
                  {headWin != null ? `${headWin}%` : '—'}
                </div>
                {thinSample && (
                  <span title={`채점 표본 ${headN}건 — 통계로 보기엔 너무 적어 우연일 수 있습니다`}
                    style={{ fontSize: 9.5, fontWeight: 800, color: TK.amber400, background: `${TK.amber400}1a`, border: `1px solid ${TK.amber400}55`, borderRadius: 6, padding: '2px 6px' }}>
                    ⚠️ 표본 {headN}건 · 참고만
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: TK.sub4, paddingBottom: 4 }}>
              <span>30일 평균 <b style={{ color: pctColor(g.avg30) }}>{fmtPct(g.avg30)}</b>{g.n30 > 0 && <span style={{ color: TK.sub2 }}> (n={g.n30})</span>}</span>
              <span>현재까지 평균 <b style={{ color: pctColor(g.avgNow) }}>{fmtPct(g.avgNow)}</b></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* ⚠️ 칩은 라벨 뜻이 성립할 때만 — 표본이 전부 한쪽이면 best=worst가 되어 '최대 방어 −10.4%'와
                '역주행 −10.4%'가 나란히 뜬다(TEMPUS 사건: 하락=매도 적중인데 역주행 칩에 등장). 방향 가드 필수. */}
            {g.best && (isSell ? (g.best.retNow ?? 0) < 0 : (g.best.retNow ?? 0) > 0) && <EventChip e={g.best} tag={isSell ? '최대 방어' : '최고 적중'} />}
            {g.worst && g.worst !== g.best && (isSell ? (g.worst.retNow ?? 0) > 0 : (g.worst.retNow ?? 0) < 0) && <EventChip e={g.worst} tag={isSell ? '역주행' : '최대 빗나감'} />}
          </div>
          {g.recent.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead><tr style={{ color: TK.sub4, fontSize: 10 }}>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>신호일</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>종목</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>신호</th>
                <th title="신호 낸 날부터 딱 한 달(약 30일) 뒤의 성적 — 한 번 정해지면 안 바뀜. 아직 한 달이 안 지났으면 '—'." style={{ textAlign: 'right', padding: '3px 6px', cursor: 'help', borderBottom: `1px dotted ${TK.sub4}` }}>30일 후</th>
                <th title="신호 낸 날부터 오늘까지의 성적 — 주가가 움직이면 매일 바뀜. 아직 일주일이 안 지났으면 'D+며칠'로 표시." style={{ textAlign: 'right', padding: '3px 6px', cursor: 'help', borderBottom: `1px dotted ${TK.sub4}` }}>현재까지</th>
              </tr></thead>
              <tbody>
                {g.recent.slice(0, 8).map((e, i) => (
                  <tr key={`${e.ticker}:${e.date}:${i}`} style={{ borderTop: `1px solid ${TK.border}` }}>
                    <td style={{ padding: '5px 6px', color: TK.sub4, fontFamily: 'monospace' }}>{e.date.slice(5)}</td>
                    <td style={{ padding: '5px 6px', color: TK.slate200, fontWeight: 700 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</td>
                    <td style={{ padding: '5px 6px', color: TK.sub4, fontSize: 10.5 }}>{e.label}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: pctColor(e.ret30), fontWeight: 700 }}>{fmtPct(e.ret30)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: pctColor(e.retNow), fontWeight: 700 }}>{e.retNow == null ? `D+${e.ageDays}` : fmtPct(e.retNow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default function SignalReportPage() {
  const [data, setData] = useState<SignalReportResult | null>(null)
  const [err, setErr] = useState(false)
  const [helpOpen, setHelpOpen] = useState(true)   // 처음 보는 학생 기본 펼침

  useEffect(() => {
    fetch('/api/signal-report').then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>📋 앱 신호 성적표</div>
        <div style={{ fontSize: 12, color: TK.sub4, marginTop: 4 }}>
          이 앱이 낸 신호를 실제 주가로 <b style={{ color: TK.slate200 }}>스스로 채점</b>합니다 —
          볼 것은 <b style={{ color: TK.amber400 }}>⭐ 합류 하나</b>, 나머지는 그 재료입니다.
          {data?.jarvisSince && <span> · 이력 {data.jarvisSince}~</span>}
          {data && <span> · 대상 {data.tickers}종목</span>}
        </div>
        {!!data?.unscored && (
          <div style={{ marginTop: 6, fontSize: 11, color: TK.amber400, background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '6px 10px', lineHeight: 1.55 }}>
            🧟 <b>생존편향 방어</b> — {data.unscored}종목은 캔들 로드 실패(상장폐지·거래정지 가능)로 <b>채점에서 제외</b>됐습니다.
            이런 최악 사례가 조용히 빠지면 승률이 실제보다 좋아 보이므로, 위 적중률은 <b>{data.unscored}건만큼 낙관 편향</b>일 수 있습니다.
          </div>
        )}
      </div>

      {/* 📖 처음 보는 학생용 쉬운 설명 — 기본 펼침, 접을 수 있음 */}
      <div style={{ ...CARD, background: TK.bg2, padding: '12px 16px' }}>
        <button onClick={() => setHelpOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: TK.slate100 }}>📖 처음이신가요? — 쉽게 읽는 법</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: TK.sub4 }}>{helpOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {helpOpen && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: TK.sub11, lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>① 앱이 낸 <b style={{ color: TK.green400 }}>&ldquo;사볼까&rdquo;</b>·<b style={{ color: TK.red400 }}>&ldquo;팔아볼까&rdquo;</b> 신호가 나중에 실제로 맞았는지 채점한 성적표예요 — <b style={{ color: TK.green400 }}>매수는 오르면</b>, <b style={{ color: TK.red400 }}>매도는 떨어지면</b> 적중.</div>
            <div style={{ background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}55`, borderRadius: 8, padding: '8px 10px' }}>
              ② 볼 것은 하나 — <b style={{ color: TK.amber400 }}>⭐ 합류</b>. <b>가치(싸고 좋은 회사인가)</b>와 <b>타이밍(들어갈 자리인가)</b>, 서로 다른 두 엔진이 <b>같은 방향으로 합의한 순간만</b> 잡은 궁극의 신호예요. 그래서 드물게(귀하게) 나와요. 하나만 뜬 신호는 반쪽이라 아래 &lsquo;엔진별 세부&rsquo;에 접어 두었어요.
            </div>
            <div style={{ fontSize: 11.5 }}>③ <b>주의</b> — 표본이 적으면(⚠️배지) 통계가 아니라 일화예요. 지금 표본은 6~7월 하락장에 몰려 있어 <b>30일이라는 짧은 자</b>로는 매수 성적이 나쁘게, 매도 성적이 좋게 보여요. <b>30일 후</b>=한 달 뒤 고정 성적 · <b>현재까지</b>=오늘까지 실시간.</div>
          </div>
        )}
      </div>

      {err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>성적표를 불러오지 못했습니다 — 새로고침해 주세요.</div>}
      {!data && !err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>📋 신호 이력을 채점하는 중… (첫 로드는 수십 초 걸릴 수 있어요)</div>}

      {data && (() => {
        // 🏆 궁극 기준 = ⭐ 합류 하나만 주인공 — Jarvis·타점 단독 4카드를 같은 등급으로 나열하면
        //    "3가지 기준 중 뭘 믿으라는 거야"가 된다(사용자 피드백). 반쪽 엔진 성적은 접힌 세부로 강등
        //    (삭제하지 않는 이유: 이 화면의 존재 이유가 정직한 자기 채점 — 재료 성적을 숨기면 안 됨).
        const conf = data.groups.filter(g => g.src === 'confluence')
        const rest = data.groups.filter(g => g.src !== 'confluence')
        return (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: TK.amber400 }}>🏆 궁극의 매수/매도 신호 — ⭐ 합류</span>
                <span style={{ fontSize: 11.5, color: TK.sub4 }}>가치와 타이밍, 두 엔진이 합의할 때만 나옵니다</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
                {conf.map(g => <GroupCard key={`${g.src}:${g.kind}`} g={g} />)}
              </div>
              <div style={{ fontSize: 11.5, color: TK.sub4, lineHeight: 1.6 }}>
                💡 합류 신호가 뜬 종목은 <a href="/briefing" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}>🎯 매매 브리핑</a>과
                <a href="/research" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}> 종합 매수 판정</a>에서 확인하고 판단하세요 — 여기는 성적 기록이지 매매 화면이 아니에요.
              </div>
            </div>

            <details style={{ ...CARD, padding: '12px 16px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 800, color: TK.sub11, listStyle: 'none' }}>
                🔬 엔진별 세부 성적 — 합류의 재료(펼쳐 보기) <span style={{ fontSize: 10.5, fontWeight: 400, color: TK.sub4 }}>· 가치(Jarvis)·타이밍(타점) 각각의 성적</span>
              </summary>
              <div style={{ fontSize: 11.5, color: TK.sub4, lineHeight: 1.65, margin: '10px 0' }}>
                합류는 아래 두 엔진이 같은 방향으로 겹칠 때만 나옵니다. 각각은 <b>반쪽 신호</b>(가치만 보거나, 타이밍만 보거나)라 성적도 반쪽이에요 —
                이게 &ldquo;하나만 뜬 신호를 따라가지 말라&rdquo;는 근거입니다. 반쪽 성적이 나쁜 건 고장이 아니라 <b>합류만 보라는 이유</b>예요.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
                {rest.map(g => <GroupCard key={`${g.src}:${g.kind}`} g={g} />)}
              </div>
            </details>
          </>
        )
      })()}

      <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
        ⚠️ <b>표본이 적으면(특히 10건 미만) 통계가 아니라 일화입니다</b> — 표본수를 항상 함께 보세요.
        SELL/매도 신호의 &lsquo;적중&rsquo;은 <b>신호 후 실제 하락 여부</b>로 채점합니다(공매도 수익이 아니라 &ldquo;피했으면 면한 손실&rdquo;의 의미).
        대상은 학생 보유 종목뿐이라 <b>선택 편향</b>이 있고(WorldQuant식으로 말하면 유니버스가 생존자 쪽으로 기움), 채점 불가 종목(상폐·거래정지)은 위 배너에 별도 집계해 <b>생존편향</b>을 드러냈습니다. 진입가는 신호일 이하 최근 종가(±1일 오차)·배당 미반영.
        Jarvis 신호는 연속 반복 판정을 <b>연속 구간의 첫날 1건</b>으로 압축해 자기상관을 제거했습니다.
        과거 성과는 미래를 보장하지 않으며, 이 화면은 교육용 자기 검증 지표입니다.
      </div>
    </div>
  )
}
