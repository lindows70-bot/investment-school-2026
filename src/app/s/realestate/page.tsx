'use client'
// 학생 '부동산' — ①아파트 단지 리서치(중심): 지역 고르기 → 단지 검색/거래 많은 단지 → 면적대 → 최근 실거래(매매·전세)와 24개월 매매 중위가 선 + 전세가율·고점 대비 두 칸 ②시장 4칸(기준금리·주담대·KB 아파트 전년비·미분양)
//   5단계-3(사용자 결정 2026-09-27): 부동산은 배우기 탭의 간편 버전 — "특정 아파트 값이 얼마인지 찾기"가 가장 자주 쓰는 기능이라 그걸 중심으로. 분석 화면 AptResearch 와 같은 API(새 원천 0)
//   원천 = /api/re-apt(국토부 실거래 신고 24개월 · 호가 아님) · /api/re-market(kpi — 한은·KB·국토부)
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { LAWD_REGIONS } from '@/lib/rtms'
import { niceTicks, dayTicks } from '@/lib/marketScreen'
import { useJson, type JsonState } from '@/app/components/student/useJson'
import { LinePlot } from '@/app/components/student/market/marketUi'
import { card, FailRow, noteStyle, retryBtn } from '@/app/components/student/home/homeUi'
import type { AptResearchResult } from '@/app/api/re-apt/route'
import type { ReMarketResult } from '@/app/api/re-market/route'

const DEFAULT_LAWD = '11680'   // 분석 화면 AptResearch 와 같은 첫 지역(강남구)
const LIST_SHOWN = 8
const DEALS_SHOWN = 10
const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
/** 억 단위(소수 1) → '12.5억' */
const eokText = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`
const ymText = (ym: string) => `${ym.slice(0, 4)}.${Number(ym.slice(5, 7))}`
const back = <Link href="/s/learn" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 배우기</Link>
const h2 = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const
const input = { height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: TK.bg3, color: TK.slate100, fontSize: FS.body, minWidth: 0 } as const
const chip = (on: boolean) => ({ height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.pill, border: `1px solid ${on ? TK.line4 : TK.line1}`, background: on ? TK.bg7 : 'transparent', color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' as const })

// ── 시장 4칸 ─────────────────────────────────────────────────────────────────
function MarketBoxes() {
  const r = useJson<Partial<ReMarketResult> & { error?: unknown }>('/api/re-market')
  const k = r.state === 'ok' && r.data && !r.data.error && r.data.kpi ? r.data.kpi : null
  const boxes: { label: string; value: string | null; sub: string }[] = [
    { label: '한국 기준금리', value: k && isNum(k.baseRate) ? `${k.baseRate.toFixed(2)}%` : null, sub: '한국은행' },
    { label: '주택담보대출 금리', value: k && isNum(k.mortgageRate) ? `${k.mortgageRate.toFixed(2)}%` : null, sub: '신규 취급 평균' },
    { label: '전국 아파트값 1년 전 대비', value: k && isNum(k.kbAptYoY) ? `${k.kbAptYoY > 0 ? '+' : ''}${k.kbAptYoY.toFixed(1)}%` : null, sub: k && typeof k.asOfKb === 'string' && k.asOfKb ? `KB 매매지수 · ${k.asOfKb}` : 'KB 매매지수' },
    { label: '전국 미분양', value: k && isNum(k.unsold) ? `${Math.round(k.unsold).toLocaleString('ko-KR')}호` : null, sub: k && typeof k.asOfUnsold === 'string' && k.asOfUnsold ? `국토부 · ${k.asOfUnsold}` : '국토부' },
  ]
  return (
    <section aria-label="부동산 시장" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <h2 style={h2}>지금 시장</h2>
      {pending(r.state) && <span style={noteStyle()}>시장 지표를 불러오는 중…</span>}
      {(r.state === 'failed' || (r.state === 'ok' && !k)) && <FailRow text="시장 지표를 못 가져왔어요." onRetry={r.reload} retryLabel="시장 지표 다시 불러오기" />}
      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm }}>
          {boxes.map(b => (
            <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3, minWidth: 0 }}>
              <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all' }}>{b.label}</span>
              <span style={{ fontSize: FS.lg, fontWeight: 700, color: b.value ? TK.slate100 : TK.sub, whiteSpace: 'nowrap' }}>{b.value ?? '못 가져옴'}</span>
              <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all' }}>{b.sub}</span>
            </div>
          ))}
        </div>
      )}
      <span style={noteStyle()}>금리는 집값의 중력이에요 — 금리가 오르면 살 수 있는 돈이 줄어요(예측이 아니라 관계).</span>
    </section>
  )
}

// ── 아파트 단지 리서치 ────────────────────────────────────────────────────────
export default function StudentRealEstate() {
  const [lawd, setLawd] = useState(DEFAULT_LAWD)
  const [apt, setApt] = useState('')          // 서버에 보내는 단지(선택·검색어)
  const [aptInput, setAptInput] = useState('')
  const [area, setArea] = useState<number | null>(null)
  // undefined = 불러오는 중 · null = 못 가져옴(문구는 err) · 객체 = 받음
  const [d, setD] = useState<AptResearchResult | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [listMore, setListMore] = useState(false)
  const [dealsMore, setDealsMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setD(undefined); setErr(null)
    const q = `lawd=${lawd}${apt ? `&apt=${encodeURIComponent(apt)}` : ''}${area != null ? `&area=${area}` : ''}`
    fetch(`/api/re-apt?${q}`, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => null)
        if (cancelled) return
        if (!j || typeof j !== 'object' || j.error || !Array.isArray(j.complexes)) { setD(null); setErr(typeof j?.error === 'string' ? j.error : '실거래 데이터를 못 가져왔어요.'); return }
        setD(j as AptResearchResult)
      })
      .catch(() => { if (!cancelled) { setD(null); setErr('실거래 데이터를 못 가져왔어요.') } })
    return () => { cancelled = true }
  }, [lawd, apt, area, retry])

  const region = LAWD_REGIONS.find(r => r.lawd === lawd)
  const sel = d?.selected ?? null
  // 24개월 매매 중위가 선 — 거래가 없는 달은 점을 두지 않는다(0 으로 그리면 거짓)
  const linePts = sel ? sel.monthly.filter(m => isNum(m.sale) && m.sale! > 0).map(m => ({ t: Date.UTC(Number(m.ym.slice(0, 4)), Number(m.ym.slice(5, 7)) - 1, 15), v: m.sale as number })) : []
  const vals = linePts.map(p => p.v)
  const min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 0
  const xt = linePts.length >= 2 ? dayTicks(linePts[0].t, linePts[linePts.length - 1].t) : { ticks: [] as number[], fmt: () => '' }
  const monthsWithDeals = linePts.length
  const deals = sel ? sel.deals : []
  const v = sel?.value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 720 }}>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>아파트 단지 리서치</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>궁금한 아파트가 실제로 얼마에 거래됐는지 — 국토부에 신고된 실거래(호가 아님) 24개월.</p>
      </header>

      {/* 지역 + 단지 검색 */}
      <section aria-label="지역과 단지 고르기" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>지역</span>
          <select value={lawd} onChange={e => { setLawd(e.target.value); setApt(''); setAptInput(''); setArea(null); setListMore(false); setDealsMore(false) }} style={input}>
            {Array.from(new Set(LAWD_REGIONS.map(r => r.sido))).map(sido => (
              <optgroup key={sido} label={sido}>
                {LAWD_REGIONS.filter(r => r.sido === sido).map(r => <option key={r.lawd} value={r.lawd}>{sido} {r.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <form onSubmit={e => { e.preventDefault(); setApt(aptInput.trim()); setArea(null); setDealsMore(false) }} style={{ display: 'flex', gap: SP.sm }}>
          <input value={aptInput} onChange={e => setAptInput(e.target.value)} placeholder="단지 이름 (예: 오금동 대림, 래미안)" aria-label="단지 검색" style={{ ...input, flexGrow: 1 }} />
          <button type="submit" style={{ ...retryBtn, background: TK.blue600, border: 'none', color: TK.slate100, fontWeight: 700 }}>찾기</button>
        </form>
        {d && d.queryMiss && apt && <span style={noteStyle(TK.amber400)}>‘{apt}’ 실거래를 24개월 안에서 못 찾았어요 — 거래 많은 1위 단지를 대신 보여 드려요(이름 표기가 다르거나 거래가 없었을 수 있어요).</span>}
      </section>

      {d === undefined && <div style={card}><span style={noteStyle()}>{region ? `${region.sido} ${region.name}` : ''} 실거래 24개월을 모으는 중… 처음 여는 지역은 30초 넘게 걸릴 수 있어요.</span></div>}
      {d === null && <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}><span style={{ fontSize: FS.body, color: TK.slate100 }}>{err}</span><button type="button" onClick={() => setRetry(n => n + 1)} style={retryBtn}>다시 불러오기</button></div>}

      {d && (
        <>
          {/* 거래 많은 단지 */}
          <section aria-label="거래 많은 단지" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            <h2 style={{ ...h2, fontSize: FS.body }}>{d.sido} {region?.name} 거래 많은 단지 <span style={{ fontSize: FS.tiny, fontWeight: 500, color: TK.sub }}>{d.months}개월 매매 건수순 · {d.complexes.length}곳</span></h2>
            {d.complexes.length === 0 && <span style={noteStyle()}>이 지역엔 최근 {d.months}개월 매매 신고가 없어요.</span>}
            {(listMore ? d.complexes : d.complexes.slice(0, LIST_SHOWN)).map((c, i) => {
              const on = sel?.name === c.name
              return (
                <button key={c.name} type="button" aria-pressed={on} onClick={() => { setApt(c.name); setAptInput(c.name); setArea(null); setDealsMore(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 48, padding: `0 ${SP.sm}px`, borderRadius: RAD.sm, border: 'none', background: on ? TK.bg7 : 'transparent', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                  <span style={{ width: 22, flexShrink: 0, fontSize: FS.tiny, color: TK.sub }}>{i + 1}</span>
                  <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, fontWeight: on ? 700 : 500, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}{c.buildYear ? <span style={{ fontSize: FS.micro, fontWeight: 500, color: TK.sub, marginLeft: SP.xs }}>{c.buildYear}년</span> : null}</span>
                  <span style={{ flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{c.dealCount}건 · 최근 {eokText(c.lastPrice)}</span>
                </button>
              )
            })}
            {d.complexes.length > LIST_SHOWN && <button type="button" onClick={() => setListMore(m => !m)} style={{ ...retryBtn, alignSelf: 'flex-start' }}>{listMore ? '접기' : `${d.complexes.length - LIST_SHOWN}곳 더 보기`}</button>}
          </section>

          {sel && (
            <section aria-label={`${sel.name} 실거래`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 style={h2}>{sel.name}</h2>
                {sel.overview && (sel.overview.households || sel.overview.aprv) && (
                  <span style={{ fontSize: FS.tiny, color: TK.sub }}>{[sel.overview.households ? `${sel.overview.households.toLocaleString('ko-KR')}세대` : null, sel.overview.dongs ? `${sel.overview.dongs}개 동` : null, sel.overview.aprv ? `${sel.overview.aprv} 준공` : null].filter(Boolean).join(' · ')}</span>
                )}
              </div>
              {sel.areas.length > 1 && (
                <div role="group" aria-label="면적대" style={{ display: 'flex', gap: SP.xs, flexWrap: 'wrap' }}>
                  {sel.areas.map(a => <button key={a.area} type="button" aria-pressed={a.area === sel.area} onClick={() => { setArea(a.area); setDealsMore(false) }} style={chip(a.area === sel.area)}>{a.area}㎡ <span style={{ fontWeight: 400 }}>{a.count}건</span></button>)}
                </div>
              )}
              <span style={{ fontSize: FS.micro, color: TK.sub }}>{sel.area}㎡ 안팎(±2㎡) 거래만 · ㎡ ÷ 3.3 ≈ 평(전용 {Math.round(sel.area / 3.3)}평)</span>

              {/* 두 칸 — 전세가율 · 고점 대비 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3, minWidth: 0 }}>
                  <span style={{ fontSize: FS.micro, color: TK.sub }}>최근 6개월 매매 중간값</span>
                  <span style={{ fontSize: FS.lg, fontWeight: 700, color: v && isNum(v.saleMed6) ? TK.slate100 : TK.sub, whiteSpace: 'nowrap' }}>{v && isNum(v.saleMed6) ? eokText(v.saleMed6) : '거래 없음'}</span>
                  <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all' }}>{v && isNum(v.jeonseRatio) ? `전세는 매매의 ${v.jeonseRatio}% (전세 중간값 ${isNum(v.jeonseMed6) ? eokText(v.jeonseMed6) : '—'})` : '전세 거래가 없어 비율 없음'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3, minWidth: 0 }}>
                  <span style={{ fontSize: FS.micro, color: TK.sub }}>가장 비쌌을 때 대비</span>
                  <span style={{ fontSize: FS.lg, fontWeight: 700, color: v && isNum(v.vsPeak) ? TK.slate100 : TK.sub, whiteSpace: 'nowrap' }}>{v && isNum(v.vsPeak) ? `${v.vsPeak > 0 ? '+' : ''}${v.vsPeak}%` : '—'}</span>
                  <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all' }}>{v && isNum(v.peak) ? `${d.months}개월 안 최고 실거래 ${eokText(v.peak)}` : '비교할 거래가 없어요'}</span>
                </div>
              </div>

              {/* 24개월 매매 중위가 선 */}
              {linePts.length >= 2
                ? <>
                    <div role="img" aria-label={`${sel.name} ${sel.area}㎡ 월별 매매 중간값`} style={{ height: 160, minWidth: 0 }}>
                      <LinePlot points={linePts} color={TK.slate300} tFmt={t => { const dt = new Date(t); return `${dt.getUTCFullYear()}.${dt.getUTCMonth() + 1}` }} vFmt={eokText} a11y={false} area endDot yAxis="right" yTicks={niceTicks(min, max, 4)} yFmt={vv => `${vv.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`} xTicks={xt.ticks} xFmt={xt.fmt} />
                    </div>
                    <span style={{ fontSize: FS.micro, color: TK.sub }}>달마다 매매 중간값 · {d.months}개월 중 거래가 있던 {monthsWithDeals}개월만 점을 찍었어요</span>
                  </>
                : <span style={noteStyle()}>선을 그릴 만큼 거래가 있는 달이 없어요(거래가 있던 달 {monthsWithDeals}개).</span>}

              {/* 최근 실거래 */}
              <h3 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>최근 실거래 <span style={{ fontSize: FS.tiny, fontWeight: 500, color: TK.sub }}>매매·전세 {deals.length}건</span></h3>
              {deals.length === 0 && <span style={noteStyle()}>이 면적대엔 최근 {d.months}개월 거래가 없어요.</span>}
              {(dealsMore ? deals.slice(0, 40) : deals.slice(0, DEALS_SHOWN)).map((x, i) => (
                <div key={`${x.ym}${x.day}${x.type}${x.price}${i}`} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 40, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
                  <span style={{ width: 64, flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{ymText(x.ym)}.{x.day}</span>
                  <span style={{ flexShrink: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: x.type === '매매' ? `${TK.sky400}24` : `${TK.orange400}24`, color: x.type === '매매' ? TK.sky400 : TK.orange400, fontSize: FS.micro, fontWeight: 700 }}>{x.type}</span>
                  <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.tiny, color: TK.slate300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.area}㎡{x.floor != null ? ` · ${x.floor}층` : ''}</span>
                  <span style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{eokText(x.price)}</span>
                </div>
              ))}
              {deals.length > DEALS_SHOWN && <button type="button" onClick={() => setDealsMore(m => !m)} style={{ ...retryBtn, alignSelf: 'flex-start' }}>{dealsMore ? '접기' : `${Math.min(deals.length, 40) - DEALS_SHOWN}건 더 보기`}</button>}
              <span style={noteStyle()}>국토교통부 실거래가 신고(계약일 기준·신고까지 최대 30일 늦어요) · 취득세·중개비 미포함 · 사라는 뜻이 아니에요</span>
            </section>
          )}
        </>
      )}

      <MarketBoxes />
    </div>
  )
}
