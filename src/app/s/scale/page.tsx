'use client'
// 학생 '오늘의 저울' — 채권·주식·부동산·금·코인 다섯 자산을 같은 세 질문(①돈을 만드나 ②지금 비싼가 ③지금 계절은)으로 잰 5줄 × 3칸
//   기획 docs/student-mode/scale-plan.md · 원천 /api/scale(lib/scale). 규칙: 숫자 칸엔 출처·날짜 이름표 · 이름표 없는 숫자는 칸을 비움 ·
//   사라·팔라 없음 · 칩은 등락색이 아니라 중립색(좋다/나쁘다가 아니라 상태) · ③ 계절은 2단계(기준월 표시) 전까지 '곧 열려요'
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { countByScaleAsset } from '@/lib/scaleHoldings'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import type { ScaleResult, ScaleCell, ScaleQ } from '@/lib/scale'
import type { ScaleScore } from '@/lib/scaleScore'

// 저울의 용어 — 가나다순이 아니라 수업 순서(현금흐름 → 할인 → 금리 → 물가 뺀 이자 → 배수·전세가율·마음 온도 → 계절 → 순풍·역풍 → 코어·위성)
const TERMS: { term: string; mean: string; href?: string; hrefText?: string }[] = [
  { term: '현금흐름', mean: '자산이 들고만 있어도 벌어다 주는 돈이에요. 이자·배당·월세가 그것이고, 금과 코인은 없어요.' },
  { term: '할인(지금 가치)', mean: '미래에 받을 돈을 오늘 값으로 바꾸는 계산이에요. 금리가 높을수록 먼 미래의 돈은 오늘 덜 쳐줘요.' },
  { term: '국채 금리', mean: '나라에 돈을 빌려주고 받는 이자예요. 떼일 걱정이 가장 적어서 다른 자산을 재는 기준 잣대가 돼요.' },
  { term: '물가 뺀 이자(실질금리)', mean: '받는 이자에서 물가가 오른 만큼을 뺀 진짜 이자예요. 이게 클수록 이자 없는 금을 들고 있기가 무거워져요.' },
  { term: '예상이익 배수(선행 PER)', mean: '주가가 앞으로 1년 예상이익의 몇 배인지예요. 높을수록 같은 이익을 더 비싸게 사는 거예요.' },
  { term: '전세가율', mean: '전세금이 집값의 몇 %인지예요. 높을수록 집이 버는 돈(쓰임새)에 비해 집값이 덜 부풀었다고 봐요.', href: '/s/realestate', hrefText: '관심 단지에서 보기' },
  { term: '공포·탐욕 지수', mean: '사람들 마음 온도를 0(공포)~100(탐욕)으로 잰 거예요. 버는 돈이 없는 코인은 이걸로 분위기를 봐요.', href: '/s/coin', hrefText: '코인 화면에서 보기' },
  { term: '계절(4계절)', mean: '경기와 물가가 오르는지 내리는지로 나눈 4칸이에요. 봄(경기↑ 물가↓)·여름(둘 다↑)·가을(경기↓ 물가↑)·겨울(둘 다↓).' },
  { term: '순풍·역풍', mean: '그 계절에 그 자산이 과거에 대체로 유리했나 불리했나예요. 투자학교 수업 원칙이고 약속이 아니에요.' },
  { term: '코어·위성', mean: '오래 들고 갈 중심 자산이 코어, 기회를 노리는 작은 몫이 위성이에요. 기록할 때 정한 역할로 내 비중을 볼 수 있어요.', href: '/s/assets', hrefText: '내 자산에서 보기' },
]

const Q_LABEL: Record<ScaleQ, string> = { cash: '① 돈을 만드나', price: '② 지금 비싼가', season: '③ 지금 계절은' }
const dot = (s: string) => s.length === 7 ? `${s.slice(0, 4)}.${Number(s.slice(5, 7))}` : `${s.slice(0, 4)}.${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`
const back = <Link href="/s/learn" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 배우기</Link>

function Cell({ c }: { c: ScaleCell }) {
  const dim = c.status === 'hold'
  return (
    <div className="sk-cell" style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.xs, minWidth: 0 }}>
        <span style={{ fontSize: FS.micro, fontWeight: 700, color: TK.sub, whiteSpace: 'nowrap' }}>{Q_LABEL[c.q]}</span>
        {c.chip && <span style={{ flexShrink: 1, minWidth: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, border: `1px solid ${TK.line1}`, background: TK.bg7, color: TK.slate200, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.chip}</span>}
      </div>
      <p style={{ margin: 0, fontSize: FS.tiny, lineHeight: 1.6, color: dim ? TK.sub : TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{c.sentence}</p>
      {c.source && c.date && <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{c.source} · {dot(c.date)}</span>}
      {c.detail && (
        <details>
          <summary style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.micro, color: TK.sky400, cursor: 'pointer' }}>자세히</summary>
          <span style={{ fontSize: FS.micro, lineHeight: 1.6, color: TK.slate300, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{c.detail}</span>
        </details>
      )}
      {c.href && <Link href={c.href} style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.micro, color: TK.sky400, textDecoration: 'none' }}>더 보기 ›</Link>}
    </div>
  )
}

// 저울 성적표 — ③ 수업 원칙이 맞았나(docs/scale/scoring-plan.md). 서로 다른 달 10개 전엔 숫자 없이 적립 현황만
const signPp = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)}%p`
const ymKo = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`
function ScoreCard({ s, loading }: { s: ScaleScore | null; loading: boolean }) {
  return (
    <section aria-label="저울 성적표" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>저울 성적표</h2>
      <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>③ 칸의 순풍 자산이 역풍 자산보다 3개월 뒤 정말 나았나 — 오늘부터 앞으로만 적어서 채점해요(지난 일에 맞춰 고치지 않아요).</span>
      {loading && <span style={noteStyle()}>성적표를 불러오는 중…</span>}
      {!loading && !s && <span style={noteStyle(TK.amber400)}>성적표를 못 불러왔어요.</span>}
      {s && !s.gateOpen && (
        <span style={{ fontSize: FS.body, color: TK.slate200, wordBreak: 'keep-all' }}>
          {s.days > 0 ? `적립 ${s.days}일 · 채점된 달 ${s.comparable}/10` : '적립 시작 전 — ③ 칸이 다 판정된 날부터 하루 한 장씩 적어요'}{s.firstResultMonth ? ` · 첫 성적은 ${ymKo(s.firstResultMonth)}쯤` : ''}. 서로 다른 달이 10개 모이기 전엔 통계가 아니라 일화라서 숫자를 보여주지 않아요.
        </span>
      )}
      {s && s.gateOpen && s.stats && (
        <>
          <span style={{ fontSize: FS.body, color: TK.slate200, wordBreak: 'keep-all' }}>
            순풍 자산이 역풍 자산보다 3개월 뒤 평균 <b>{signPp(s.stats.meanSpread)}</b>(중간값 {signPp(s.stats.medianSpread)}) · 맞은 달 {s.stats.hits}/{s.stats.n} · 다섯 자산 평균보다 {signPp(s.stats.meanVsBase)}
          </span>
          <span style={noteStyle()}>
            {s.stats.trimmedMeanSpread != null ? `가장 큰 달을 빼면 ${signPp(s.stats.trimmedMeanSpread)} · ` : ''}
            {s.stats.topAsset ? `차이의 ${Math.round(s.stats.topAsset.share * 100)}%를 ${s.stats.topAsset.name}이 만들었어요 · ` : ''}
            {s.stats.seasons.length === 1 ? '한 계절에서만 검증됐어요 · ' : ''}서로 다른 달 {s.stats.n}개 · 대표 가격 IEF·SPY(분배금 포함)·금 선물·비트코인·KB 아파트 지수, 자산마다 자기 통화
          </span>
        </>
      )}
    </section>
  )
}

export default function StudentScale() {
  const r = useJson<ScaleResult>('/api/scale')
  const sc = useJson<ScaleScore>('/api/scale-score')
  // 내가 가진 줄 — 보유를 저울 다섯 줄로 나눠 센다(브라우저에서만 · 서버로 보내지 않는다). 못 불러오면 표시만 빠진다
  const pf = useMyPortfolio()
  const mine = pf.state === 'ready' || (pf.state === 'failed' && pf.failReason === 'fx') ? countByScaleAsset(pf.holdings) : null
  const ok = r.state === 'ok' && Array.isArray(r.data?.rows) && r.data!.rows.length > 0
  // ③ 계절이 다섯 줄 모두 준비 중이면 같은 문장을 다섯 번 쓰지 않고 한 줄 안내로 합친다(폰에서 화면만 길어진다 — 2026-09-29 실측 3,063px)
  const seasonSoon = ok && r.data!.rows.every(row => row.cells[2]?.status === 'hold')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 960 }}>
      {/* 폰·태블릿은 칸을 세로로, 769px↑ 는 한 줄에 세 칸 — 기본값 + min-width 하나(정확한 여집합) */}
      <style>{`
        .sk-cells { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.sm}px }
        @media (min-width: 769px) { .sk-cells { grid-template-columns: repeat(3, minmax(0, 1fr)) } .sk-cells.sk-two { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
        details > summary { list-style: none } details > summary::-webkit-details-marker { display: none }
      `}</style>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>오늘의 저울</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>채권·주식·부동산·금·코인을 같은 세 질문으로 재요. 사라·팔라는 말은 하지 않아요 — 지금 상태만.</p>
      </header>

      <section aria-label="저울의 공식" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all' }}>미래에 벌 돈(①) ÷ 금리의 무게(②) — 그 둘을 움직이는 계절(③)</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>앱 서명 “미래에 벌어들일 현금흐름을 할인한다”를 세 칸으로 나눈 거예요. 채권이 맨 위인 건 채권 이자가 나머지를 재는 잣대라서예요.</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>③ 칸의 순풍·보통·역풍은 투자학교 수업 원칙이에요 — 과거에 그랬던 경향이지 약속이 아니에요.</span>
      </section>

      {seasonSoon && <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>③ 지금 계절은 — {r.data!.rows[0].cells[2].sentence}</span>}

      {ok && (r.data!.changes?.length ?? 0) > 0 && (
        <section aria-label="바뀐 칸" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>{r.data!.changedSince ? `${dot(r.data!.changedSince)}보다 ` : ''}바뀐 칸 {r.data!.changes!.length}개</span>
          {r.data!.changes!.map(c => <span key={`${c.asset}${c.q}`} style={{ fontSize: FS.tiny, color: TK.slate200, wordBreak: 'keep-all' }}>{c.name} {Q_LABEL[c.q]} — {c.from} → {c.to}</span>)}
        </section>
      )}

      {(r.state === 'idle' || r.state === 'loading') && <div style={card}><span style={noteStyle()}>다섯 자산을 재는 중…</span></div>}
      {(r.state === 'failed' || r.state === 'unauth' || (r.state === 'ok' && !ok)) && <div style={card}><FailRow text="저울을 못 불러왔어요." onRetry={r.reload} retryLabel="저울 다시 불러오기" /></div>}

      {ok && r.data!.rows.map(row => (
        <section key={row.asset} aria-label={row.name} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>{row.name}</h2>
            {mine && (mine[row.asset] ?? 0) > 0 && <span style={{ padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: `${TK.sky400}24`, color: TK.sky400, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>내 자산 {mine[row.asset]}종</span>}
          </div>
          <div className={seasonSoon ? 'sk-cells sk-two' : 'sk-cells'}>{row.cells.filter(c => !(seasonSoon && c.q === 'season')).map(c => <Cell key={c.q} c={c} />)}</div>
          {/* 줄 끝 꼬리표(코어·위성) — 다른 설명 줄과 같은 크기·색. 뜻은 아래 '저울의 용어' */}
          {typeof row.tail === 'string' && row.tail && <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>{row.tail} · <a href="#terms" style={{ color: TK.sub, textDecoration: 'underline', minHeight: 0 }}>코어·위성이란</a></span>}
        </section>
      ))}

      <ScoreCard s={sc.state === 'ok' ? sc.data : null} loading={sc.state === 'idle' || sc.state === 'loading'} />

      <section id="terms" aria-labelledby="scale-terms" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h2 id="scale-terms" style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>저울의 용어</h2>
        <span style={noteStyle()}>수업 순서대로 — 위에서부터 읽으면 저울 표가 풀려요.</span>
        {TERMS.map(t => (
          <details key={t.term} style={{ borderTop: `1px solid ${TK.border}` }}>
            <summary style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.body, fontWeight: 600, color: TK.slate100, cursor: 'pointer' }}>{t.term}</summary>
            <p style={{ margin: `0 0 ${SP.sm}px`, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate300, wordBreak: 'keep-all' }}>{t.mean}</p>
            {t.href && <Link href={t.href} style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.sky400, textDecoration: 'none' }}>{t.hrefText} ›</Link>}
          </details>
        ))}
      </section>

      {ok && (
        <span style={noteStyle()}>
          숫자 칸에는 전부 출처와 기준일을 달아요 — 출처·날짜가 없는 숫자는 쓰지 않고 칸을 비워요.
          {r.data!.oldestDate ? ` 가장 오래된 기준일 ${dot(r.data!.oldestDate)}(월간 통계).` : ''} 예측이 아니라 지금 상태예요.
        </span>
      )}
    </div>
  )
}
