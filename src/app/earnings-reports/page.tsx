'use client'
// 📑 실적 리포트 — 회사가 SEC에 직접 제출한 실적 발표 원문(8-K Item 2.02의 EX-99)을 자동 수집·요약.
//   NotebookLM처럼 PDF를 사람이 올릴 필요 없이 분기마다 스스로 갱신되고, 우리 앱 지표(6축·타점)와 한 화면에서 만난다.
//   ⛔ 요약은 서술만 — 판정·점수는 기존 SSOT(종합 매수 판정)가 담당한다.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TK, FS } from '@/lib/theme'
import type { ErIndexRow, EarningsReportDoc, ErSummary } from '@/lib/earningsReport'
import ResearchVerdictCard from '@/app/components/ResearchVerdict'
import KrEarningsPanel, { ExpandHint } from '@/app/components/KrEarningsPanel'

const CARD = TK.bg6, BORDER = TK.border

const TONE: Record<string, { t: string; c: string }> = {
  positive: { t: '자신감', c: TK.green400 },
  neutral: { t: '중립', c: TK.slate400 },
  cautious: { t: '신중', c: TK.amber400 },
}

const fmtCap = (v: number | null) => (v == null ? '—' : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(0)}B`)
const dday = (d: string) => {
  const t = new Date(d + 'T00:00:00Z').getTime()
  const n = Math.floor((Date.now() - t) / 86_400_000)
  return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`
}

export default function EarningsReportsPage() {
  const [market, setMarket] = useState<'US' | 'KR'>('US')
  return (
    <div style={{ padding: '22px 20px 60px', maxWidth: 1180, margin: '0 auto' }}>
      <h1 style={{ fontSize: FS.h2, fontWeight: 900, color: TK.slate100, margin: 0 }}>📑 실적 리포트</h1>
      <div style={{ display: 'flex', gap: 7, marginTop: 12, marginBottom: 4 }}>
        {([['US', '🇺🇸 미국'], ['KR', '🇰🇷 한국']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMarket(k)} style={{
            ...chip(market === k), fontSize: FS.body, padding: '7px 16px',
          }}>{l}</button>
        ))}
      </div>
      {market === 'US' ? <UsPanel /> : <KrEarningsPanel />}
    </div>
  )
}

// ── 🇺🇸 미국 — SEC 8-K 실적 원문 서술 요약 ──────────────────────────────────
function UsPanel() {
  const [rows, setRows] = useState<ErIndexRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [sort, setSort] = useState<'filed' | 'cap'>('filed')
  const [open, setOpen] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [cmpMode, setCmpMode] = useState(false)

  useEffect(() => {
    fetch('/api/earnings-reports')
      .then(r => r.json())
      .then(d => {
        if (d?.ok) { setRows(d.rows ?? []); setUpdatedAt(d.updatedAt ?? null) }
        else setPending(true)
      })
      .catch(() => setPending(true))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => {
    const c = [...rows]
    if (sort === 'cap') c.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    else c.sort((a, b) => b.filedAt.localeCompare(a.filedAt))
    return c
  }, [rows, sort])

  const withSummary = rows.filter(r => r.hasSummary).length

  return (
    <>
      <p style={{ fontSize: FS.body, color: TK.sub, margin: '10px 0 16px', lineHeight: 1.75 }}>
        미국 시총 상위 50개 기업이 <b style={{ color: TK.slate300 }}>증권거래위원회(SEC)에 직접 제출한 실적 발표 원문</b>을 자동으로 모아 한국어로 정리합니다.
        기자가 쓴 기사나 남의 해설이 아니라 <b style={{ color: TK.slate300 }}>회사가 자기 손으로 쓴 문서</b>가 출처입니다.
      </p>

      {/* 상태 바 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>
          {rows.length}개 기업 · 요약 완료 {withSummary}개
          {updatedAt && ` · 갱신 ${new Date(updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([['filed', '발표일순'], ['cap', '시총순']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} style={chip(sort === k)}>{l}</button>
          ))}
          <button onClick={() => { setCmpMode(!cmpMode); setCompare([]) }} style={chip(cmpMode)}>
            ⚖️ 비교{cmpMode && ` ${compare.length}/4`}
          </button>
        </span>
      </div>

      {/* 비교 모드 안내 — 아래로 스크롤해 고르는 동안에도 몇 개 골랐는지 보이게 */}
      {cmpMode && (
        <div style={{ marginBottom: 12, background: TK.cyan400 + '14', border: `1px solid ${TK.cyan400}44`, borderRadius: 9, padding: '9px 12px', fontSize: FS.tiny, color: TK.slate300 }}>
          비교할 기업을 카드에서 <b>최대 4개</b>까지 고르세요{compare.length > 0 && ` — 현재 ${compare.map(t => t).join('·')}`}
          {compare.length === 1 && <span style={{ color: TK.sub2 }}> (2개 이상 고르면 비교 표가 나타납니다)</span>}
        </div>
      )}

      {loading && <div style={{ color: TK.sub, fontSize: FS.body, padding: 30, textAlign: 'center' }}>실적 원문을 불러오는 중…</div>}

      {!loading && pending && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22, color: TK.sub, fontSize: FS.body, lineHeight: 1.8 }}>
          아직 수집 전입니다. 매일 아침 자동으로 모으며, 첫 수집이 끝나면 이 자리에 기업별 실적 요약이 나타납니다.
        </div>
      )}

      {/* 비교 표 */}
      {cmpMode && compare.length >= 2 && (
        <CompareTable tickers={compare} rows={rows} onRemove={t => setCompare(c => c.filter(x => x !== t))} />
      )}

      {/* 목록 */}
      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.map(r => (
          <div key={r.ticker} style={{ background: CARD, border: `1px solid ${open === r.ticker ? TK.cyan400 + '55' : BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div
              onClick={() => (cmpMode
                ? setCompare(c => (c.includes(r.ticker) ? c.filter(x => x !== r.ticker) : c.length < 4 ? [...c, r.ticker] : c))
                : setOpen(open === r.ticker ? null : r.ticker))}
              style={{ padding: '13px 15px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              {cmpMode && (
                <span style={{
                  width: 18, height: 18, flexShrink: 0, marginTop: 2, borderRadius: 5,
                  border: `1.5px solid ${compare.includes(r.ticker) ? TK.cyan400 : TK.sub2}`,
                  background: compare.includes(r.ticker) ? TK.cyan400 : 'transparent',
                  color: TK.bg0, fontSize: FS.tiny, textAlign: 'center', lineHeight: '16px', fontWeight: 900,
                }}>{compare.includes(r.ticker) ? '✓' : ''}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: FS.body, color: TK.slate100, fontFamily: 'monospace' }}>{r.ticker}</b>
                  <span style={{ fontSize: FS.body, color: TK.slate300 }}>{r.name}</span>
                  <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>{fmtCap(r.marketCap)}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontSize: FS.tiny, color: TK.sub2, fontFamily: 'monospace' }}>
                      {r.filedAt} · {dday(r.filedAt)}
                    </span>
                    {!cmpMode && <ExpandHint open={open === r.ticker} />}
                  </span>
                </div>
                <div style={{ fontSize: FS.body, color: r.headline ? TK.slate300 : TK.sub2, marginTop: 6, lineHeight: 1.7 }}>
                  {r.headline ?? '요약 준비 중 — 원문은 아래에서 바로 볼 수 있습니다.'}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.tone && <Badge c={TONE[r.tone].c}>{TONE[r.tone].t}</Badge>}
                  {r.exhibitTypes.map(t => <Badge key={t} c={TK.sub2}>{t}</Badge>)}
                  <a href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                     style={{ fontSize: FS.tiny, color: TK.cyan400, textDecoration: 'none', marginLeft: 'auto' }}>SEC 원문 ↗</a>
                </div>
              </div>
            </div>
            {open === r.ticker && !cmpMode && <Detail ticker={r.ticker} name={r.name} />}
          </div>
        ))}
      </div>

      {/* 캐비엇 */}
      <div style={{ marginTop: 18, background: TK.bg4, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.85 }}>
        <b style={{ color: TK.sub }}>읽기 전에</b><br />
        · 요약은 AI가 원문을 정리한 것입니다. <b style={{ color: TK.sub }}>숫자는 반드시 SEC 원문으로 확인</b>하세요(원문 링크 병기).<br />
        · 컨퍼런스 콜의 질의응답 전문은 SEC 공시 대상이 아니라 담기지 않습니다. 실적 보도자료와 최고재무책임자 코멘터리까지가 범위입니다.<br />
        · 한국 기업은 서술형 공시가 제도적으로 없어 숫자 카드로 따로 다룹니다(🇰🇷 탭).<br />
        · 투자 추천이 아닙니다. 회사가 발표한 내용의 정리입니다.
      </div>
    </>
  )
}

function chip(on: boolean): React.CSSProperties {
  return {
    background: on ? TK.cyan400 + '22' : TK.bg4, color: on ? TK.cyan400 : TK.sub,
    border: `1px solid ${on ? TK.cyan400 + '66' : BORDER}`, borderRadius: 8,
    padding: '5px 11px', fontSize: FS.tiny, fontWeight: 700, cursor: 'pointer',
  }
}

function Badge({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: FS.tiny, color: c, border: `1px solid ${c}44`, background: c + '14', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>
      {children}
    </span>
  )
}

// ── 종목 상세 ─────────────────────────────────────────────────────────────────
function Detail({ ticker, name }: { ticker: string; name: string }) {
  const [doc, setDoc] = useState<EarningsReportDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [rawOpen, setRawOpen] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/earnings-reports?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => setDoc(d?.ok ? d.doc : null))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) return <div style={{ padding: '14px 16px', color: TK.sub2, fontSize: FS.body, borderTop: `1px solid ${BORDER}` }}>원문을 여는 중…</div>
  if (!doc) return <div style={{ padding: '14px 16px', color: TK.sub2, fontSize: FS.body, borderTop: `1px solid ${BORDER}` }}>원문을 아직 수집하지 못했습니다.</div>

  const s = doc.summary
  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px 16px', background: TK.bg4 }}>
      {s ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Section title="📈 이번 분기 실적" items={s.performance} />
          <div>
            <div style={sectionTitle}>🔭 다음 분기 전망(가이던스)</div>
            <div style={{ fontSize: FS.body, color: TK.slate300, lineHeight: 1.8 }}>{s.guidance}</div>
          </div>
          {s.segments.length > 0 && <Section title="🧩 사업 부문" items={s.segments} />}
          {s.risks.length > 0 && <Section title="⚠️ 회사가 언급한 위험" items={s.risks} color={TK.amber400} />}
        </div>
      ) : (
        <div style={{ fontSize: FS.body, color: TK.sub2, lineHeight: 1.8 }}>
          요약이 아직 준비되지 않았습니다. 아래에서 원문을 바로 읽을 수 있습니다.
        </div>
      )}

      {/* 원문 전문 */}
      <div style={{ marginTop: 14, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {doc.exhibits.map(e => (
          <button key={e.type + e.file} onClick={() => setRawOpen(rawOpen === e.type ? null : e.type)} style={chip(rawOpen === e.type)}>
            📄 {e.type} 원문 {(e.chars / 1024).toFixed(0)}KB
          </button>
        ))}
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ ...chip(false), textDecoration: 'none', display: 'inline-block' }}>SEC 공시 페이지 ↗</a>
      </div>
      {rawOpen && (
        <pre style={{
          marginTop: 10, maxHeight: 340, overflow: 'auto', background: TK.bg0, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: 12, fontSize: FS.tiny, color: TK.slate400, whiteSpace: 'pre-wrap', lineHeight: 1.7,
        }}>{doc.exhibits.find(e => e.type === rawOpen)?.text}</pre>
      )}

      {/* 앱 지표 결합 — 판정은 기존 SSOT가 담당(같은 컴포넌트 재사용) */}
      <div style={{ marginTop: 16 }}>
        <div style={sectionTitle}>🎯 우리 앱의 종합 판정</div>
        <ResearchVerdictCard ticker={ticker} market="US" name={name} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/research?q=${encodeURIComponent(ticker)}`} style={{ ...chip(false), textDecoration: 'none' }}>🔎 정성분석</Link>
        <Link href={`/tech-chart?ticker=${encodeURIComponent(ticker)}`} style={{ ...chip(false), textDecoration: 'none' }}>📉 기술 차트</Link>
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: FS.tiny, fontWeight: 800, color: TK.sub, marginBottom: 6 }

function Section({ title, items, color }: { title: string; items: string[]; color?: string }) {
  return (
    <div>
      <div style={sectionTitle}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 17, display: 'grid', gap: 5 }}>
        {items.map((x, i) => (
          <li key={i} style={{ fontSize: FS.body, color: color ?? TK.slate300, lineHeight: 1.75 }}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

// ── 여러 기업 비교 ────────────────────────────────────────────────────────────
function CompareTable({ tickers, rows, onRemove }: { tickers: string[]; rows: ErIndexRow[]; onRemove: (t: string) => void }) {
  const [docs, setDocs] = useState<Record<string, EarningsReportDoc | null>>({})
  useEffect(() => {
    tickers.forEach(t => {
      if (t in docs) return
      fetch(`/api/earnings-reports?ticker=${encodeURIComponent(t)}`)
        .then(r => r.json())
        .then(d => setDocs(p => ({ ...p, [t]: d?.ok ? d.doc : null })))
        .catch(() => setDocs(p => ({ ...p, [t]: null })))
    })
  }, [tickers, docs])

  return (
    <div style={{ background: CARD, border: `1px solid ${TK.cyan400}44`, borderRadius: 12, padding: 14, marginBottom: 14, overflowX: 'auto' }}>
      <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, marginBottom: 10 }}>⚖️ 기업 비교 ({tickers.length})</div>

      {/* 같은 축으로 줄을 맞춘 표 — 카드를 옆에 늘어놓으면 회사마다 다른 지표를 말해 비교가 되지 않는다 */}
      <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: FS.tiny, marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ ...cthL, width: 104, color: TK.sub2 }}>항목</th>
            {tickers.map(t => {
              const row = rows.find(r => r.ticker === t)
              return (
                <th key={t} style={{ ...cthR, color: TK.slate100 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: 'monospace' }}>{t}</span>
                    <button onClick={() => onRemove(t)} title="비교에서 빼기"
                      style={{ background: 'none', border: 'none', color: TK.sub2, cursor: 'pointer', fontSize: FS.tiny, padding: 0 }}>✕</button>
                  </span>
                  <div style={{ fontSize: FS.micro, color: TK.sub2, fontWeight: 400 }}>{row?.name}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {([
            ['실적 분기', (s: ErSummary) => s.period, true],
            ['발표일', null, true],
            ['매출', (s: ErSummary) => s.revenue, false],
            ['↳ 전년 대비', (s: ErSummary) => s.revenueChange, false],
            ['주당순이익', (s: ErSummary) => s.eps, false],
            ['↳ 전년 대비', (s: ErSummary) => s.epsChange, false],
          ] as const).map(([label, get, dim], ri) => (
            <tr key={label + ri} style={{ borderTop: ri % 2 === 0 ? `1px solid ${BORDER}` : undefined }}>
              <td style={{ ...ctdL, color: String(label).startsWith('↳') ? TK.sub2 : TK.sub, paddingLeft: String(label).startsWith('↳') ? 18 : 8 }}>{label}</td>
              {tickers.map(t => {
                const d = docs[t]
                if (label === '발표일') return <td key={t} style={{ ...ctdR, color: TK.slate400 }}>{rows.find(r => r.ticker === t)?.filedAt ?? '—'}</td>
                const v = d?.summary && get ? get(d.summary) : ''
                return (
                  <td key={t} style={{ ...ctdR, color: v ? (dim ? TK.slate400 : TK.slate100) : TK.sub2, fontWeight: v && !dim ? 800 : 400 }}>
                    {d === undefined ? '…' : v || '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 서술은 표 아래에 — 숫자로 줄을 맞춘 뒤 회사가 한 말을 읽는다 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tickers.length}, minmax(210px, 1fr))`, gap: 10 }}>
        {tickers.map(t => {
          const d = docs[t]
          return (
            <div key={t} style={{ background: TK.bg4, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 10 }}>
              {d === undefined ? <div style={{ fontSize: FS.tiny, color: TK.sub2 }}>불러오는 중…</div>
                : !d?.summary ? <div style={{ fontSize: FS.tiny, color: TK.sub2 }}>요약 준비 중</div>
                : (
                  <div style={{ display: 'grid', gap: 7 }}>
                    {d.summary.tone && <Badge c={TONE[d.summary.tone].c}>{TONE[d.summary.tone].t}</Badge>}
                    <div style={{ fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.7 }}>{d.summary.headline}</div>
                    <div>
                      <div style={{ fontSize: FS.micro, color: TK.sub2, fontWeight: 800 }}>다음 분기 전망</div>
                      <div style={{ fontSize: FS.tiny, color: TK.slate400, lineHeight: 1.65, marginTop: 3 }}>{d.summary.guidance}</div>
                    </div>
                  </div>
                )}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 9, lineHeight: 1.7 }}>
        · 표의 숫자는 회사가 원문에 쓴 값입니다. <b style={{ color: TK.sub }}>—는 그 회사가 원문에서 밝히지 않았거나 요약 갱신 중</b>이라는 뜻입니다.<br />
        · <b style={{ color: TK.sub }}>실적 분기와 발표일을 먼저 보세요</b> — 회사마다 회계연도가 달라 같은 날 발표라도 다른 분기일 수 있습니다.
      </div>
    </div>
  )
}

const cthL: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontWeight: 700 }
const cthR: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', fontWeight: 700 }
const ctdL: React.CSSProperties = { textAlign: 'left', padding: '7px 8px' }
const ctdR: React.CSSProperties = { textAlign: 'right', padding: '7px 8px', fontFamily: 'monospace' }
