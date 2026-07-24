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
  const accent = isSell ? TK.red400 : TK.green400
  const empty = g.n === 0
  const headWin = g.win30 ?? g.winNow
  const headLabel = g.win30 != null ? '30일 적중률' : '현재까지 적중률'
  const headN = g.win30 != null ? g.n30 : g.n7   // 헤드라인 승률을 뒷받침하는 실제 표본수
  const thinSample = headWin != null && headN < 5 // 소표본 가드 — 데이터 스누핑/일화 오인 방지(퀀트 원칙)
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: TK.slate200 }}>{g.title}</span>
        <span style={{ fontSize: 10.5, color: TK.sub4 }}>이벤트 {g.n}건 {g.n7 < g.n ? `· 채점 대상 ${g.n7}건(7일+)` : ''}</span>
      </div>
      {empty ? (
        <div style={{ fontSize: 12, color: TK.sub4, padding: '10px 0' }}>
          📥 신호 적립 중 — 전환 이벤트가 발생하면 자동으로 채점이 시작됩니다(타점 워처는 2026-07-18부터 적립).
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
            {g.best && <EventChip e={g.best} tag={isSell ? '최대 방어' : '최고 적중'} />}
            {g.worst && g.worst !== g.best && <EventChip e={g.worst} tag={isSell ? '역주행' : '최대 빗나감'} />}
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
          이 앱이 낸 신호(Jarvis 처방전·타점 전환)를 실제 주가로 <b style={{ color: TK.slate200 }}>스스로 채점</b>합니다 —
          어떤 신호를 얼마나 신뢰할지 데이터로 판단하는 훈련.
          {data?.jarvisSince && <span> · Jarvis 이력 {data.jarvisSince}~</span>}
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
            <div>① 이 표는 앱이 <b style={{ color: TK.green400 }}>&ldquo;사볼까(매수기회)&rdquo;</b>·<b style={{ color: TK.red400 }}>&ldquo;팔아볼까(매도검토)&rdquo;</b>라고 낸 신호가 <b style={{ color: TK.slate200 }}>나중에 실제로 맞았는지</b> 채점한 성적표예요.</div>
            <div>② <b style={{ color: TK.slate200 }}>적중률</b> = 신호대로 움직인 비율이에요. <b style={{ color: TK.green400 }}>매수는 오르면</b> 적중, <b style={{ color: TK.red400 }}>매도는 떨어지면</b> 적중(&ldquo;그때 팔았으면 손실을 피함&rdquo;).</div>
            <div style={{ background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '8px 10px' }}>
              ③ <b style={{ color: TK.amber400 }}>매수 적중률이 낮아도 신호가 틀린 게 아니에요.</b> 이 신호는 <b>&ldquo;싸고 좋은 회사인가(가치)&rdquo;</b>를 보는 거라 결과가 <b>몇 달~몇 년</b>에 걸쳐 나와요. 그런데 지금 표는 <b>30일</b>이라는 짧은 자로 재고, 표본도 6~7월 <b>조정장(하락장)</b>에 몰려 있어요. 하락장에선 좋은 회사도 같이 떨어지니 짧은 성적은 나쁠 수밖에 없죠. 반대로 <b>매도 적중률이 높은 것</b>도 실력만이 아니라 &ldquo;떨어지는 장이라 뭘 팔아도 맞은&rdquo; 효과가 섞여 있어요.
            </div>
            <div>④ 그래서 이 표는 <b>&ldquo;무엇이 싸고 좋은가&rdquo;</b>(WHAT)의 채점이지 <b>&ldquo;언제 살까&rdquo;</b>(타이밍)가 아니에요. 실제 매매는 <b style={{ color: TK.blue400 }}>🚦 신호등(타이밍)</b>과 <b>함께</b> 보고, 표본이 충분히 쌓인 뒤에 믿으세요.</div>
            <div style={{ fontSize: 11, color: TK.sub4 }}>💡 <b>30일 후</b> = 신호 한 달 뒤 고정 성적 · <b>현재까지</b> = 오늘까지 실시간 성적. 표 안의 <span style={{ borderBottom: `1px dotted ${TK.sub4}` }}>점선 밑줄</span> 글자에 마우스를 올리면 뜻이 나와요.</div>
          </div>
        )}
      </div>

      {err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>성적표를 불러오지 못했습니다 — 새로고침해 주세요.</div>}
      {!data && !err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>📋 신호 이력을 채점하는 중… (첫 로드는 수십 초 걸릴 수 있어요)</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
          {data.groups.map(g => <GroupCard key={`${g.src}:${g.kind}`} g={g} />)}
        </div>
      )}

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
