'use client'
// 학생 '위기 신호등' 상세 — 종합(개수) · 돈줄 신호 3등 · 거품 신호 5등(미국 빚 · 한국 빚 포함) · 장단기 금리차 1년 차트 · 지금 할 일 · 막스의 다섯 신호 대조 · 뺀 신호
//   원천 /api/crisis-signal(lib/crisisSignal) — 색은 선생님 화면들의 판정을 그대로 모은 것. 규칙: 숫자엔 출처·날짜 · 못 가져온 등은 '모름'(초록 아님) ·
//   사라·팔라 없음 · 종합 점수·확률 없음(개수만) · 글자는 색칠하지 않고 등(동그라미)만 칠한다(등락색과 섞이지 않게)
//   설계 docs/crisis-signal/plan.md · 2026-11-21 사용자 요청(AI 버블 논쟁 · 수업 영상 EP55 · "장단기 금리차도 같이")
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { niceTicks, dayTicks, kstParts, ymdDot } from '@/lib/marketScreen'
import type { CrisisSignal, Light, LightKey } from '@/lib/crisisSignal'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { Segment } from '@/app/components/student/ui'
import { LinePlot } from '@/app/components/student/market/marketUi'
import { SignalCounts } from '@/app/components/student/home/CrisisSignalCard'
import { TrafficLight, Lamp, LampChip, COLOR_KO, dotDate } from '@/app/components/student/signal/signalUi'

const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>
const h2Style = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const
const pStyle = { margin: 0, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate300, wordBreak: 'keep-all', overflowWrap: 'anywhere' } as const
const summaryStyle = { display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.blue400, cursor: 'pointer' } as const

// 막스의 다섯 신호(수업 영상 EP55 가 정리한 틀) ↔ 이 화면의 등. ①②는 믿음이라 숫자로 재지 않는다 — 지어내지 않는다
const MARKS: { no: string; name: string; lights: LightKey[]; note: string }[] = [
  { no: '①', name: '이번엔 다르다', lights: [], note: '새 기술이 모든 걸 바꾸니 옛 잣대는 필요 없다는 믿음이에요. 믿음이라 숫자로 못 재요.' },
  { no: '②', name: '실패할 리 없다', lights: [], note: '1등 회사는 절대 손해 볼 수 없다는 믿음이에요. 이것도 숫자로 못 재요.' },
  { no: '③', name: '어떤 값도 비싸지 않다', lights: ['value'], note: '값을 따져 보기를 그만두는 태도예요. 주식 값 등이 이걸 봐요.' },
  { no: '④', name: '쉬운 돈(빚)', lights: ['usdebt', 'debt', 'capex', 'credit'], note: '빌린 돈이 쉽게 풀리는지예요. 미국 빚 · 한국 빚 · 설비투자 · 기업 돈줄 등이 이걸 봐요.' },
  { no: '⑤', name: '나만 빠질 수 없다', lights: ['mood'], note: '남들만 버는 것 같아 뒤늦게 뛰어드는 마음이에요. 심리 등이 이걸 봐요.' },
]
const EXCLUDED: { name: string; why: string }[] = [
  { name: 'VIX(변동성 지수) 단독', why: '공포·탐욕 지수 안에 이미 들어 있어요. 따로 세면 같은 걸 두 번 세게 돼요. 값은 심리 등에 곁들여 보여요.' },
  { name: '4계절(경기·물가) 판정', why: '계절은 무엇이 유리한가를 보는 다른 질문이에요. 위기 신호와 섞으면 둘 다 흐려져요.' },
  { name: '주가가 얼마나 빠졌나', why: '빠진 폭은 결과지 원인이 아니에요. 이 화면은 값 대신 빚과 돈줄을 봐요.' },
  { name: '침체 공식 선언(NBER)', why: '침체가 시작되고 여러 달 뒤에야 나와요. 경고로는 못 써요.' },
]

type SpreadKey = 's2' | 's3m'
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''
const ppFmt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%p`

/** 장단기 금리차 1년 — 0 아래(역전)는 빨강, 위는 초록. 점선 = 0 */
function CurveChart({ d }: { d: CrisisSignal }) {
  const [k, setK] = useState<SpreadKey>('s2')
  const pts = d.curveSeries.flatMap(p => { const v = p[k]; const t = Date.parse(`${p.date}T00:00:00+09:00`); return v != null && Number.isFinite(t) ? [{ t, v }] : [] })
  const h = d.curveHistory
  if (pts.length < 2) return null
  const vs = pts.map(p => p.v)
  const lo = Math.min(0, ...vs), hi = Math.max(0, ...vs)
  const xt = dayTicks(pts[0].t, pts[pts.length - 1].t)
  const label = k === 's2' ? '10년 − 2년' : '10년 − 3개월'
  return (
    <section aria-label="장단기 금리차 1년" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <h2 style={h2Style}>장단기 금리차, 지난 1년</h2>
      <Segment inCard label="금리차 종류" options={[{ key: 's2', label: '10년 − 2년' }, { key: 's3m', label: '10년 − 3개월' }]} value={k} onChange={setK} />
      <div role="img" aria-label={`${label} 금리차 1년 흐름 — 마지막 값 ${ppFmt(pts[pts.length - 1].v)}`} style={{ height: 180, minWidth: 0 }}>
        <LinePlot points={pts} color={TK.slate300} baseline={0} baselineColor={TK.amber400}
          splitAt={0} splitUp={TK.green400} splitDown={TK.red400} areaOpacity={0.36}
          tFmt={tDay} vFmt={ppFmt} a11y={false} area endDot yAxis="right" yTicks={niceTicks(lo, hi, 4)} yFmt={v => v.toFixed(1)} xTicks={xt.ticks} xFmt={xt.fmt} />
      </div>
      <span style={noteStyle()}>
        <b style={{ color: TK.amber400 }}>금색 점선</b>이 0이에요 — 그 아래로 내려가면 역전이에요. 눈금은 %p · 차트를 누르면 그날 값이 보여요.
      </span>
      {h && (
        <p style={pStyle}>
          {h.firstYear}년부터 오래 이어진 역전({h.minDays}거래일 넘게)은 {h.total}번 있었어요. 그중 {h.recession}번은 뒤에 침체가 왔고
          {h.medianMonths != null && h.minMonths != null && h.maxMonths != null ? `(역전 시작부터 침체까지 가운데 값 ${h.medianMonths}개월 · 짧게는 ${h.minMonths}개월, 길게는 ${h.maxMonths}개월)` : ''}
          , {h.falseAlarm}번은 침체가 오지 않았어요.
          {h.total - h.recession - h.falseAlarm > 0 ? ` 나머지 ${h.total - h.recession - h.falseAlarm}번은 이미 침체 중이었거나 아직 판단하기 일러요.` : ''}
          {' '}그래서 방향을 알려 줄 뿐, 언제인지는 알려 주지 않아요.
        </p>
      )}
    </section>
  )
}

function LightCard({ l }: { l: Light }) {
  return (
    <article aria-label={`${l.name} — ${COLOR_KO[l.color]}`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minWidth: 0 }}>
        <Lamp color={l.color} size={20} />
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all' }}>{l.title}</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.xs, flexWrap: 'wrap' }}>
        <span style={{ padding: `1px ${SP.sm}px`, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, color: TK.slate200, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>{COLOR_KO[l.color]} · {l.state}</span>
      </div>
      <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{l.line}</p>
      {l.rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {l.rows.map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: `${SP.sm}px 0`, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
                <span style={{ fontSize: FS.tiny, color: TK.sub, minWidth: 0, wordBreak: 'keep-all' }}>{r.label}</span>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
              </div>
              {r.note && <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{r.note}</span>}
            </div>
          ))}
        </div>
      )}
      <details>
        <summary style={summaryStyle}>이 등은 무엇을 재나요</summary>
        <p style={pStyle}>{l.what}</p>
        <p style={{ ...pStyle, marginTop: SP.sm }}><b style={{ color: TK.slate200 }}>색 규칙</b> — {l.rule}</p>
      </details>
      <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>출처 {l.source}{l.date ? ` · ${l.dateKind} ${dotDate(l.date)}` : ''}</span>
    </article>
  )
}

export default function StudentSignal() {
  const r = useJson<CrisisSignal>('/api/crisis-signal')
  const d = r.state === 'ok' && r.data && Array.isArray(r.data.lights) && r.data.lights.length > 0 && r.data.overall && r.data.counts && Array.isArray(r.data.groups) ? r.data : null
  const byKey = (k: LightKey) => d?.lights.find(l => l.key === k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 960 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* 등 카드는 높이가 제각각이라 단(column)으로 흘린다 — 격자로 두면 가장 긴 카드(설비투자 6줄) 옆 칸 아래가 비었다(2026-11-21 1280 실측) */
        .sg-grid { columns: 300px; column-gap: ${SP.lg}px; margin-bottom: -${SP.lg}px }
        .sg-grid > * { break-inside: avoid; margin-bottom: ${SP.lg}px; box-sizing: border-box; width: 100% }
        details > summary { list-style: none } details > summary::-webkit-details-marker { display: none }
      ` }} />
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>위기 신호등</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>앞날을 맞히는 기계가 아니에요 — 어디를 봐야 하는지 알려 줘요. 사라·팔라는 말은 하지 않아요.</p>
      </header>

      {(r.state === 'idle' || r.state === 'loading') && <div style={card}><span style={noteStyle()}>등을 켜는 중… 처음엔 조금 걸릴 수 있어요.</span></div>}
      {r.state === 'failed' && <div style={card}><FailRow text="신호를 못 가져왔어요." onRetry={r.reload} retryLabel="위기 신호등 다시 불러오기" /></div>}
      {r.state === 'ok' && !d && <div style={card}><FailRow text="신호가 아직 안 잡혔어요 — 잠시 뒤 다시 열어 보세요." onRetry={r.reload} retryLabel="위기 신호등 다시 불러오기" /></div>}

      {d && (
        <>
          {/* 종합 — 점수가 아니라 개수 */}
          <section aria-label="종합" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SP.lg, minWidth: 0 }}>
              <TrafficLight color={d.overall.color} lamp={30} vertical />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
                <span style={{ fontSize: FS.tiny, fontWeight: 600, color: TK.sub }}>등 {d.total}개 가운데</span>
                <SignalCounts counts={d.counts} size={FS.xl} />
                <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all' }}>{d.overall.line}</p>
              </div>
            </div>
            <details>
              <summary style={summaryStyle}>큰 신호등 색은 어떻게 정하나요</summary>
              <p style={pStyle}>{d.overall.rule}</p>
            </details>
            {d.stale && <span style={noteStyle(TK.amber400)}>새 값을 못 가져와 마지막으로 잰 값을 보여 주고 있어요.</span>}
          </section>

          {d.groups.map(g => (
            <section key={g.key} aria-label={g.name} style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
                <h2 style={h2Style}>{g.name}</h2>
                <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>{g.hint}</span>
                <span style={{ fontSize: FS.tiny, color: TK.slate200, wordBreak: 'keep-all' }}>{g.line}</span>
              </div>
              <div className="sg-grid">{d.lights.filter(l => l.group === g.key).map(l => <LightCard key={l.key} l={l} />)}</div>
              {g.key === 'money' && <CurveChart d={d} />}
            </section>
          ))}

          {d.overall.todo.length > 0 && (
            <section aria-label="지금 할 일" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
              <h2 style={h2Style}>지금 할 일</h2>
              {/* 번호는 직접 그린다 — 앱 전역 스타일이 목록 표식을 지워 ol 의 1·2·3 이 안 보였다(2026-11-21 화면 실측) */}
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
                {d.overall.todo.map((t, i) => (
                  <li key={t} style={{ display: 'flex', gap: SP.sm, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', minWidth: 0 }}>
                    <span aria-hidden style={{ flexShrink: 0, width: SP.xl, height: SP.xl, borderRadius: '50%', background: TK.bg7, color: TK.slate100, fontSize: FS.tiny, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>{t}</span>
                  </li>
                ))}
              </ol>
              <span style={noteStyle()}>수업 영상(크로스체크 55편)과 하워드 막스의 원칙 — 극단을 피하고, 빚을 조심하고, 공격과 수비의 무게를 고르는 것 — 에서 가져왔어요. 종목을 사거나 팔라는 말이 아니에요.</span>
            </section>
          )}

          <section aria-label="막스의 다섯 신호" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            <h2 style={h2Style}>막스의 다섯 신호와 이 화면</h2>
            <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>투자자 하워드 막스의 메모를 수업 영상이 다섯 가지로 정리했어요. 이 화면은 그중 숫자로 잴 수 있는 {MARKS.filter(m => m.lights.length > 0).length}가지만 등으로 만들었어요.</span>
            {MARKS.map(m => (
              <div key={m.no} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: `${SP.sm}px 0`, borderTop: `1px solid ${TK.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all' }}>{m.no} {m.name}</span>
                  {m.lights.length === 0
                    ? <span style={{ padding: `1px ${SP.sm}px`, borderRadius: RAD.pill, background: TK.bg7, color: TK.sub, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>숫자로 못 잼</span>
                    : <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: SP.md, rowGap: SP.xs, fontSize: FS.tiny, color: TK.slate200 }}>
                        {m.lights.map(k => { const l = byKey(k); return l ? <LampChip key={k} color={l.color} name={l.name} /> : null })}
                      </span>}
                </div>
                <span style={{ fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate300, wordBreak: 'keep-all' }}>{m.note}</span>
              </div>
            ))}
            <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>①②의 색은 수업 영상에서 선생님 판정으로 확인하세요 — 앱은 잴 수 없는 것을 지어내지 않아요.</span>
          </section>

          <section aria-label="뺀 신호" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            <h2 style={h2Style}>일부러 뺀 신호</h2>
            <span style={noteStyle()}>고른 이유만큼 뺀 이유도 적어 둬요.</span>
            {EXCLUDED.map(e => (
              <details key={e.name} style={{ borderTop: `1px solid ${TK.border}` }}>
                <summary style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.body, fontWeight: 600, color: TK.slate100, cursor: 'pointer' }}>{e.name}</summary>
                <p style={{ ...pStyle, marginBottom: SP.sm }}>{e.why}</p>
              </details>
            ))}
          </section>

          <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>
            색은 선생님 화면(수익률곡선 · 미국 유동성 · 위기 레이더 · 빚투 레이더)의 판정을 그대로 모은 거예요 — 같은 숫자, 같은 규칙. 등마다 출처와 날짜를 달았고, 못 가져온 등은 초록으로 세지 않아요.
            {d.asOf ? ` 조립 ${dotDate(d.asOf.slice(0, 10))}.` : ''}
          </span>
        </>
      )}
    </div>
  )
}
