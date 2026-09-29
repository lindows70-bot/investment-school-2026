'use client'
// 학생 '오늘의 저울' — 채권·주식·부동산·금·코인 다섯 자산을 같은 세 질문(①돈을 만드나 ②지금 비싼가 ③지금 계절은)으로 잰 5줄 × 3칸
//   기획 docs/student-mode/scale-plan.md · 원천 /api/scale(lib/scale). 규칙: 숫자 칸엔 출처·날짜 이름표 · 이름표 없는 숫자는 칸을 비움 ·
//   사라·팔라 없음 · 칩은 등락색이 아니라 중립색(좋다/나쁘다가 아니라 상태) · ③ 계절은 2단계(기준월 표시) 전까지 '곧 열려요'
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import type { ScaleResult, ScaleCell, ScaleQ } from '@/lib/scale'

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

export default function StudentScale() {
  const r = useJson<ScaleResult>('/api/scale')
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

      {(r.state === 'idle' || r.state === 'loading') && <div style={card}><span style={noteStyle()}>다섯 자산을 재는 중…</span></div>}
      {(r.state === 'failed' || r.state === 'unauth' || (r.state === 'ok' && !ok)) && <div style={card}><FailRow text="저울을 못 불러왔어요." onRetry={r.reload} retryLabel="저울 다시 불러오기" /></div>}

      {ok && r.data!.rows.map(row => (
        <section key={row.asset} aria-label={row.name} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>{row.name}</h2>
          <div className={seasonSoon ? 'sk-cells sk-two' : 'sk-cells'}>{row.cells.filter(c => !(seasonSoon && c.q === 'season')).map(c => <Cell key={c.q} c={c} />)}</div>
        </section>
      ))}

      {ok && (
        <span style={noteStyle()}>
          숫자 칸에는 전부 출처와 기준일을 달아요 — 출처·날짜가 없는 숫자는 쓰지 않고 칸을 비워요.
          {r.data!.oldestDate ? ` 가장 오래된 기준일 ${dot(r.data!.oldestDate)}(월간 통계).` : ''} 예측이 아니라 지금 상태예요.
        </span>
      )}
    </div>
  )
}
