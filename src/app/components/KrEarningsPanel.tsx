'use client'
// 🇰🇷 한국 실적 카드 — DART 잠정실적 공시의 숫자를 발표 당일 그대로.
//   미국은 규제기관이 '회사가 쓴 서술'(SEC 8-K EX-99)을 표준 공시로 받지만, 한국은 그 층위의 문서를 받지 않는다.
//   분기보고서의 「재무상태 및 영업실적」조차 "작성기준에 따라 분기보고서에는 기재하지 아니하였습니다"로 비어 있다(실측).
//   그래서 서술 요약 대신 **정정공시·단위·빈 항목을 정확히 옮기는 것**이 이 카드의 값어치다.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TK, FS } from '@/lib/theme'
import type { KrIndexRow, KrEarningsDoc } from '@/lib/krEarnings'
import ResearchVerdictCard from '@/app/components/ResearchVerdict'

const CARD = TK.bg6, BORDER = TK.border

function chip(on: boolean): React.CSSProperties {
  return {
    background: on ? TK.cyan400 + '22' : TK.bg4, color: on ? TK.cyan400 : TK.sub,
    border: `1px solid ${on ? TK.cyan400 + '66' : BORDER}`, borderRadius: 8,
    padding: '5px 11px', fontSize: FS.tiny, fontWeight: 700, cursor: 'pointer',
  }
}
function Badge({ c, children }: { c: string; children: React.ReactNode }) {
  return <span style={{ fontSize: FS.tiny, color: c, border: `1px solid ${c}44`, background: c + '14', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>{children}</span>
}

const won = (v: number | null) => {
  if (v == null) return '—'
  const a = Math.abs(v), s = v < 0 ? '−' : ''
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(a / 1e12 >= 100 ? 1 : 2)}조`
  if (a >= 1e8) return `${s}${(a / 1e8).toFixed(a / 1e8 >= 100 ? 0 : 1)}억`
  return `${s}${Math.round(a / 1e4).toLocaleString()}만`
}
const pctColor = (v: number | null) => (v == null ? TK.sub2 : v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.slate400)
const pctText = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString()}%`)
const dday = (d: string) => {
  const n = Math.floor((Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 86_400_000)
  return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`
}

export default function KrEarningsPanel() {
  const [rows, setRows] = useState<KrIndexRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [sort, setSort] = useState<'filed' | 'cap'>('filed')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kr-earnings')
      .then(r => r.json())
      .then(d => { if (d?.ok) { setRows(d.rows ?? []); setUpdatedAt(d.updatedAt ?? null) } else setPending(true) })
      .catch(() => setPending(true))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => {
    const c = [...rows]
    if (sort === 'cap') c.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    else c.sort((a, b) => b.filedAt.localeCompare(a.filedAt))
    return c
  }, [rows, sort])

  const divCount = rows.filter(r => r.divergence).length

  return (
    <>
      <p style={{ fontSize: FS.body, color: TK.sub, margin: '10px 0 16px', lineHeight: 1.75 }}>
        코스피·코스닥 시총 상위 50개 기업이 <b style={{ color: TK.slate300 }}>금융감독원 전자공시(DART)에 낸 잠정실적</b>을 발표 당일 그대로 옮깁니다.
        한국은 미국과 달리 <b style={{ color: TK.slate300 }}>회사가 쓴 설명글을 규제기관이 받지 않아</b>, 서술 요약 대신 숫자를 정확히 보여드립니다.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>
          {rows.length}개 기업
          {divCount > 0 && <> · <b style={{ color: TK.amber400 }}>매출↑ 이익↓ {divCount}곳</b></>}
          {updatedAt && ` · 갱신 ${new Date(updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([['filed', '발표일순'], ['cap', '시총순']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} style={chip(sort === k)}>{l}</button>
          ))}
        </span>
      </div>

      {loading && <div style={{ color: TK.sub, fontSize: FS.body, padding: 30, textAlign: 'center' }}>공시를 불러오는 중…</div>}
      {!loading && pending && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22, color: TK.sub, fontSize: FS.body, lineHeight: 1.8 }}>
          아직 수집 전입니다. 매일 아침 자동으로 모읍니다.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.map(r => (
          <div key={r.ticker} style={{ background: CARD, border: `1px solid ${open === r.ticker ? TK.cyan400 + '55' : BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div onClick={() => setOpen(open === r.ticker ? null : r.ticker)} style={{ padding: '13px 15px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: FS.body, color: TK.slate100 }}>{r.name}</b>
                <span style={{ fontSize: FS.tiny, color: TK.sub2, fontFamily: 'monospace' }}>{r.ticker}</span>
                <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>{won(r.marketCap)}원</span>
                {r.corrected && <Badge c={TK.amber400}>정정 반영</Badge>}
                {r.divergence && <Badge c={TK.amber400}>⚠️ 매출↑ 이익↓</Badge>}
                <span style={{ marginLeft: 'auto', fontSize: FS.tiny, color: TK.sub2, fontFamily: 'monospace' }}>
                  {r.periodLabel} · {r.filedAt} · {dday(r.filedAt)}
                </span>
              </div>

              {/* 3지표 — 전년 동기 대비가 핵심(회사가 직접 낸 증감율) */}
              <div style={{ display: 'flex', gap: 10, marginTop: 11, flexWrap: 'wrap' }}>
                {([['매출', r.revenue, r.revenueYoyPct], ['영업이익', r.opProfit, r.opProfitYoyPct], ['순이익', r.netProfit, r.netProfitYoyPct]] as const).map(([lab, val, pct]) => (
                  <div key={lab} style={{ flex: '1 1 150px', background: TK.bg4, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px' }}>
                    <div style={{ fontSize: FS.micro, color: TK.sub2 }}>{lab}</div>
                    <div style={{ fontSize: FS.lg, fontWeight: 900, color: val == null ? TK.sub2 : TK.slate100, fontFamily: 'monospace' }}>
                      {val == null ? '미공시' : `${won(val)}원`}
                    </div>
                    <div style={{ fontSize: FS.tiny, color: pctColor(pct), fontWeight: 700 }}>
                      전년 동기 대비 {pctText(pct)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {open === r.ticker && <KrDetail ticker={r.ticker} name={r.name} />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, background: TK.bg4, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.85 }}>
        <b style={{ color: TK.sub }}>왜 한국은 요약글이 없나요</b><br />
        · 미국은 증권거래위원회가 <b style={{ color: TK.sub }}>실적 보도자료 전문</b>을 표준 공시로 받습니다. 한국은 같은 층위의 문서를 규제기관이 받지 않습니다.<br />
        · 분기보고서의 「재무상태 및 영업실적」 항목은 <b style={{ color: TK.sub }}>작성기준에 따라 분기보고서에는 기재하지 않습니다</b>(연 1회 사업보고서에만).<br />
        · 회사의 설명 자료는 각 사 홈페이지 IR에 올라옵니다 — 상세를 열면 공시에 적힌 IR 주소를 연결해 둡니다.<br />
        · 감사 전 <b style={{ color: TK.sub }}>잠정치</b>라 확정 실적과 다를 수 있습니다. 회사가 정정하면 다음 수집 때 최신값으로 바뀝니다.<br />
        · 투자 추천이 아닙니다.
      </div>
    </>
  )
}

function KrDetail({ ticker, name }: { ticker: string; name: string }) {
  const [doc, setDoc] = useState<KrEarningsDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/kr-earnings?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => setDoc(d?.ok ? d.doc : null))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) return <div style={{ padding: '14px 16px', color: TK.sub2, fontSize: FS.body, borderTop: `1px solid ${BORDER}` }}>공시를 여는 중…</div>
  if (!doc) return <div style={{ padding: '14px 16px', color: TK.sub2, fontSize: FS.body, borderTop: `1px solid ${BORDER}` }}>공시를 아직 수집하지 못했습니다.</div>

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px 16px', background: TK.bg4 }}>
      <div style={{ fontSize: FS.tiny, color: TK.sub2, marginBottom: 8 }}>
        {doc.reportNm} · 원문 단위 {doc.unitLabel}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: FS.tiny }}>
          <thead>
            <tr style={{ color: TK.sub2 }}>
              <th style={thL}>항목</th>
              <th style={thR}>{doc.periodLabel}</th>
              <th style={thR}>{doc.prevLabel} 대비</th>
              <th style={thR}>{doc.yoyLabel} 대비</th>
              <th style={thR}>올해 누계</th>
              <th style={thR}>누계 전년 대비</th>
            </tr>
          </thead>
          <tbody>
            {doc.metrics.map(m => (
              <tr key={m.label} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ ...tdL, color: TK.slate300 }}>{m.label}</td>
                <td style={{ ...tdR, color: m.cur == null ? TK.sub2 : TK.slate100, fontWeight: 800 }}>{m.cur == null ? '미공시' : `${won(m.cur)}원`}</td>
                <td style={{ ...tdR, color: pctColor(m.qoqPct) }}>{m.qoqTurn ?? pctText(m.qoqPct)}</td>
                <td style={{ ...tdR, color: pctColor(m.yoyPct), fontWeight: 800 }}>{m.yoyTurn ?? pctText(m.yoyPct)}</td>
                <td style={{ ...tdR, color: TK.slate400 }}>{m.ytd == null ? '—' : `${won(m.ytd)}원`}</td>
                <td style={{ ...tdR, color: pctColor(m.ytdPct) }}>{m.ytdTurn ?? pctText(m.ytdPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {doc.notes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: FS.tiny, fontWeight: 800, color: TK.sub, marginBottom: 5 }}>📌 회사가 붙인 단서</div>
          <ul style={{ margin: 0, paddingLeft: 17, display: 'grid', gap: 4 }}>
            {doc.notes.map((n, i) => <li key={i} style={{ fontSize: FS.tiny, color: TK.slate400, lineHeight: 1.7 }}>{n}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 13, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <a href={doc.dartUrl} target="_blank" rel="noreferrer" style={{ ...chip(false), textDecoration: 'none', display: 'inline-block' }}>DART 공시 원문 ↗</a>
        {doc.irUrl && <a href={doc.irUrl} target="_blank" rel="noreferrer" style={{ ...chip(false), textDecoration: 'none', display: 'inline-block' }}>회사 IR 자료 ↗</a>}
        <Link href={`/research?q=${encodeURIComponent(ticker)}`} style={{ ...chip(false), textDecoration: 'none' }}>🔎 정성분석</Link>
        <Link href={`/tech-chart?ticker=${encodeURIComponent(ticker)}`} style={{ ...chip(false), textDecoration: 'none' }}>📉 기술 차트</Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: FS.tiny, fontWeight: 800, color: TK.sub, marginBottom: 6 }}>🎯 우리 앱의 종합 판정</div>
        <ResearchVerdictCard ticker={ticker} market="KR" name={name} />
      </div>
    </div>
  )
}

const thL: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontWeight: 700 }
const thR: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', fontWeight: 700 }
const tdL: React.CSSProperties = { textAlign: 'left', padding: '8px' }
const tdR: React.CSSProperties = { textAlign: 'right', padding: '8px', fontFamily: 'monospace' }
