'use client'
// 학생 '코인' — ①대표 코인 4종(비트코인·이더리움·솔라나·리플) 원화 시세·오늘 등락·차트(24시간/7일/30일) ②규제 레이더(법안·규제 신호등) ③비트코인 현물 ETF 발행사별 일별 순유입 표
//   5단계-3(사용자 결정 2026-09-27): 코인은 빼지 않는다 · 4종은 늘 보인다 · 경고·훈계 문구는 넣지 않는다. 전부 기존 기능의 데이터(새 원천 0)
//   원천 = /api/stock-price(업비트 원화 · 1D=시간봉 24 · 1W=일봉 7 · 1M=일봉 30) · /api/crypto-regulation(구글 뉴스 헤드라인 → 신호등, 6h) · /api/btc-etf(TheBlock/Farside $M, 3h)
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { won, pct, upDown } from '@/lib/studentFormat'
import { niceTicks, hourTicks, dayTicks, kstParts, ymdDot } from '@/lib/marketScreen'
import { useJson, type JsonState } from '@/app/components/student/useJson'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { LinePlot, RangeTabs } from '@/app/components/student/market/marketUi'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import type { RegulationResult, RegImpact } from '@/app/api/crypto-regulation/route'
import type { BtcEtfResult } from '@/app/api/btc-etf/route'

// 늘 보이는 4종(사용자 결정 9/27) + 내가 가진 코인 중 4종 밖의 것(사용자 결정 2026-10-09 — 보유 코인은 자동으로 더한다)
const COINS = [
  { ticker: 'BTC', name: '비트코인' },
  { ticker: 'ETH', name: '이더리움' },
  { ticker: 'SOL', name: '솔라나' },
  { ticker: 'XRP', name: '리플' },
] as const
type FrameKey = '1D' | '1W' | '1M'
const FRAMES: { key: FrameKey; label: string }[] = [{ key: '1D', label: '24시간' }, { key: '1W', label: '7일' }, { key: '1M', label: '30일' }]
interface PricePoint { t: number; v: number }
interface PriceRow { ticker?: unknown; name?: unknown; currentPrice?: unknown; changePct?: unknown; charts?: Record<string, unknown>; error?: unknown; source?: unknown }

const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
/** 유효한 점만. 전부 같은 값이면 버린다 — 업비트 조회 실패 시 API 가 현재가로 만든 직선을 채워 보낸다(종목 상세와 같은 규칙) */
const cleanPts = (raw: unknown): PricePoint[] => {
  if (!Array.isArray(raw)) return []
  const pts = raw.filter((p): p is PricePoint => !!p && isNum(p.t) && isNum(p.v) && p.v > 0).sort((a, b) => a.t - b.t)
  return pts.length < 2 || pts.every(p => p.v === pts[0].v) ? [] : pts
}
// 눈금 글자 — 1천만 넘으면 '만' 단위(비트코인), 그 밖은 정수
const yFmtFor = (max: number) => (v: number) => max >= 10_000_000 ? `${Math.round(v / 10_000).toLocaleString('ko-KR')}만` : Math.round(v).toLocaleString('ko-KR')
const hm = (t: number) => kstParts(t).hm
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''
const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>
const h2 = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const

// ── ① 코인 4종 ─────────────────────────────────────────────────────────────
function CoinCard({ ticker, name, row, frame, loading }: { ticker: string; name: string; row: PriceRow | undefined; frame: FrameKey; loading: boolean }) {
  const price = row && isNum(row.currentPrice) && row.currentPrice > 0 ? row.currentPrice : null
  const chg = row && isNum(row.changePct) ? row.changePct : null
  const stale = price != null && !!row?.error   // 조회 실패 뒤 캐시에 남은 지난 시세
  const pts = row ? cleanPts(row.charts?.[frame]) : []
  const vals = pts.map(p => p.v)
  const min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 0
  const intraday = frame === '1D'
  const xt = pts.length >= 2 ? (intraday ? { ticks: hourTicks(pts[0].t, pts[pts.length - 1].t, 6), fmt: hm } : dayTicks(pts[0].t, pts[pts.length - 1].t)) : { ticks: [] as number[], fmt: tDay }
  return (
    <section aria-label={name} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
        <Link href={`/s/stock/${ticker}?m=CRYPTO&n=${encodeURIComponent(name)}`} style={{ display: 'flex', alignItems: 'baseline', gap: SP.xs, minHeight: 44, textDecoration: 'none', minWidth: 0 }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>{name}</span>
          <span style={{ fontSize: FS.micro, color: TK.sub }}>{ticker}</span>
          <span aria-hidden style={{ color: TK.sub }}>›</span>
        </Link>
        {price != null && chg != null && <span style={{ fontSize: FS.body, fontWeight: 700, color: upDown(chg), whiteSpace: 'nowrap' }}>{pct(chg)}</span>}
      </div>
      {loading ? <span style={noteStyle()}>시세를 불러오는 중…</span>
        : price == null ? <span style={noteStyle(TK.amber400)}>지금 시세를 못 가져왔어요.</span>
        : <span style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{won(price)}{stale && <span style={{ marginLeft: SP.sm, fontSize: FS.tiny, fontWeight: 500, color: TK.amber400 }}>마지막으로 가져온 가격</span>}</span>}
      {pts.length >= 2
        ? <div role="img" aria-label={`${name} ${FRAMES.find(f => f.key === frame)?.label} 가격 흐름`} style={{ height: 150, minWidth: 0 }}>
            <LinePlot points={pts} color={TK.slate300} tFmt={intraday ? hm : tDay} vFmt={v => won(v)} a11y={false} area endDot yAxis="right" yTicks={niceTicks(min, max, 4)} yFmt={yFmtFor(max)} xTicks={xt.ticks} xFmt={xt.fmt} />
          </div>
        : !loading && price != null && <span style={noteStyle()}>가격 흐름을 못 가져왔어요.</span>}
      {pts.length >= 2 && <span style={{ fontSize: FS.micro, color: TK.sub }}>{intraday ? '한국 시각' : '일봉 종가'}{max >= 10_000_000 ? ' · 눈금은 만원' : ''} · 업비트 원화</span>}
    </section>
  )
}

// ── ② 규제 레이더 ──────────────────────────────────────────────────────────
// 신호등은 좋다/나쁘다 지표라 초록·노랑·빨강 그대로(가격 등락색이 아니다)
const IMPACT: Record<RegImpact, { color: string; text: string }> = {
  green: { color: TK.green400, text: '친화' },
  yellow: { color: TK.amber400, text: '논의 중' },
  red: { color: TK.red400, text: '규제' },
}
function Regulation() {
  const r = useJson<Partial<RegulationResult> & { error?: unknown }>('/api/crypto-regulation')
  const ok = r.state === 'ok' && r.data && !r.data.error && Array.isArray(r.data.bills)
  const bills = ok ? (r.data!.bills as RegulationResult['bills']).filter(b => b && typeof b.title === 'string') : []
  const climate = ok && r.data!.climate && IMPACT[r.data!.climate as RegImpact] ? IMPACT[r.data!.climate as RegImpact] : null
  return (
    <section aria-label="규제 레이더" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <h2 style={h2}>규제 레이더</h2>
      <span style={noteStyle()}>코인 가격은 기술보다 법이 움직여요 — 요즘 법안·규제 이슈를 신호등으로.</span>
      {pending(r.state) && <span style={noteStyle()}>규제 뉴스를 정리하는 중… 조금 걸려요.</span>}
      {(r.state === 'failed' || (r.state === 'ok' && !ok)) && <FailRow text="규제 뉴스를 못 가져왔어요." onRetry={r.reload} retryLabel="규제 레이더 다시 불러오기" />}
      {ok && climate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minWidth: 0 }}>
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: RAD.pill, background: climate.color, flexShrink: 0 }} />
          <span style={{ fontSize: FS.body, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}><b style={{ color: climate.color }}>전반 {climate.text}</b>{typeof r.data!.climateText === 'string' && r.data!.climateText ? ` · ${r.data!.climateText}` : ''}</span>
        </div>
      )}
      {ok && bills.length === 0 && <span style={noteStyle()}>정리된 법안이 없어요.</span>}
      {bills.map((b, i) => {
        const im = IMPACT[b.impact] ?? IMPACT.yellow
        return (
          <div key={`${b.title}${i}`} style={{ display: 'flex', gap: SP.sm, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
            <span aria-label={im.text} style={{ width: 10, height: 10, marginTop: 6, borderRadius: RAD.pill, background: im.color, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{b.title} <span style={{ fontWeight: 500, color: TK.sub, fontSize: FS.tiny }}>{typeof b.status === 'string' ? b.status : ''}</span></span>
              {typeof b.summary === 'string' && b.summary && <span style={{ fontSize: FS.tiny, color: TK.slate300, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{b.summary}</span>}
              {Array.isArray(b.assets) && b.assets.length > 0 && <span style={{ fontSize: FS.micro, color: TK.sub }}>관련: {b.assets.filter(a => typeof a === 'string').join(' · ')}</span>}
              {/* 근거 기사 — 서버가 번호를 검증한 헤드라인만 온다. 학생이 직접 대조하도록 원문 링크(새 창) */}
              {Array.isArray(b.sources) && b.sources.length > 0 && (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: `2px ${SP.sm}px`, fontSize: FS.micro, color: TK.sub, minWidth: 0 }}>
                  근거 {b.sources.filter(s => s && typeof s.url === 'string' && typeof s.title === 'string').map((s, k) => (
                    <a key={s.url + k} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: `0 ${SP.xs}px`, color: TK.blue400, textDecoration: 'underline', wordBreak: 'keep-all' }}>기사 {k + 1} ↗</a>
                  ))}
                </span>
              )}
            </div>
          </div>
        )
      })}
      {ok && <span style={noteStyle()}>구글 뉴스 헤드라인(최근 45~120일)을 근거로 AI가 정리 · 근거 기사를 못 댄 항목은 버려요 · 6시간마다 갱신{typeof r.data!.asOf === 'string' ? ` · ${ymdDot(r.data!.asOf.slice(0, 10)) ?? ''} 기준` : ''}</span>}
    </section>
  )
}

// ── ③ 비트코인 ETF 발행사별 순유입 ──────────────────────────────────────────
const flowText = (v: number) => (Math.abs(v) < 0.05 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}`)
function EtfFlows() {
  const r = useJson<Partial<BtcEtfResult>>('/api/btc-etf')
  const d = r.data
  const ok = r.state === 'ok' && d && Array.isArray(d.issuers) && Array.isArray(d.issuerRecent) && Array.isArray(d.issuerTotals)
  const issuers = ok ? (d!.issuers as string[]) : []
  const rows = ok ? (d!.issuerRecent as { date: string; v: number[] }[]).filter(x => x && typeof x.date === 'string' && Array.isArray(x.v) && x.v.length === issuers.length) : []
  const totals = ok ? (d!.issuerTotals as number[]) : []
  const cell = { padding: `${SP.sm}px ${SP.sm}px`, fontSize: FS.tiny, whiteSpace: 'nowrap' as const, textAlign: 'right' as const }
  return (
    <section aria-label="비트코인 ETF 발행사별 순유입" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <h2 style={h2}>비트코인 ETF, 누가 돈을 넣었나</h2>
      <span style={noteStyle()}>미국 현물 비트코인 ETF의 발행사별 일별 순유입(+)·순유출(−). 단위 100만 달러($M).</span>
      {pending(r.state) && <span style={noteStyle()}>ETF 자금 흐름을 불러오는 중…</span>}
      {(r.state === 'failed' || (r.state === 'ok' && !ok)) && <FailRow text="ETF 자금 흐름을 못 가져왔어요." onRetry={r.reload} retryLabel="ETF 순유입 다시 불러오기" />}
      {ok && rows.length === 0 && <span style={noteStyle()}>발행사별 표가 아직 없어요(원천이 막혀 있을 수 있어요).</span>}
      {ok && rows.length > 0 && (
        <>
          {/* 발행사 12열은 폰 폭을 넘는다 — 표만 가로로 밀고(페이지는 안 넘침) 날짜 열은 고정 */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0, margin: `0 -${SP.sm}px` }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, background: TK.card, color: TK.sub, fontWeight: 500 }}>날짜</th>
                  <th scope="col" style={{ ...cell, color: TK.slate100, fontWeight: 700 }}>합계</th>
                  {issuers.map(i => <th key={i} scope="col" style={{ ...cell, color: TK.sub, fontWeight: 500 }}>{i}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(x => {
                  const sum = x.v.reduce((a, b) => a + b, 0)
                  return (
                    <tr key={x.date} style={{ borderTop: `1px solid ${TK.border}` }}>
                      <th scope="row" style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, background: TK.card, color: TK.slate300, fontWeight: 500 }}>{x.date.slice(5).replace('-', '/')}</th>
                      <td style={{ ...cell, color: upDown(sum), fontWeight: 700 }}>{flowText(sum)}</td>
                      {x.v.map((v, i) => <td key={issuers[i]} style={{ ...cell, color: Math.abs(v) < 0.05 ? TK.sub : upDown(v) }}>{flowText(v)}</td>)}
                    </tr>
                  )
                })}
                <tr style={{ borderTop: `1px solid ${TK.line1}` }}>
                  <th scope="row" style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, background: TK.card, color: TK.slate100, fontWeight: 700 }}>출범 후 누적</th>
                  <td style={{ ...cell, color: TK.slate100, fontWeight: 700 }}>{isNum(d!.flowCumulative) ? flowText(d!.flowCumulative) : '—'}</td>
                  {totals.map((v, i) => <td key={issuers[i]} style={{ ...cell, color: TK.slate200, fontWeight: 600 }}>{isNum(v) ? flowText(v) : '—'}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <span style={noteStyle()}>
            최근 {rows.length}거래일 · 유입 빨강·유출 파랑 · 출처 {d!.flowSource === 'theblock' ? 'TheBlock' : d!.flowSource === 'farside' ? 'Farside' : '—'}(원천 지연 약 2거래일)
            {typeof d!.flowAsOf === 'string' && d!.flowAsOf ? ` · ${ymdDot(d!.flowAsOf) ?? d!.flowAsOf}까지` : ''}
            {d!.flowStale ? ' · 지금 원천이 막혀 마지막으로 받은 표예요' : ''}
          </span>
        </>
      )}
    </section>
  )
}

export default function StudentCoin() {
  const [frame, setFrame] = useState<FrameKey>('1D')
  // 내 보유 코인(4종 밖) — 보유 목록이 늦게 와도 4종은 먼저 뜨고, 내 코인은 그 뒤에 붙는다(요청 본문이 바뀌면 useJson 이 한 번 더 부른다)
  const { holdings } = useMyPortfolio()
  const mine = holdings
    .filter(h => h.market === 'CRYPTO' && !COINS.some(c => c.ticker === h.ticker.toUpperCase()))
    .map(h => ({ ticker: h.ticker.toUpperCase(), name: h.name || h.ticker.toUpperCase() }))
  const coins = [...COINS, ...mine]
  const prices = useJson<PriceRow[]>('/api/stock-price', { method: 'POST', body: coins.map(c => ({ ticker: c.ticker, market: 'CRYPTO' as const })) })
  const list = prices.state === 'ok' && Array.isArray(prices.data) ? prices.data : []
  const rowOf = (t: string) => list.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === t)
  const frameLabel = FRAMES.find(f => f.key === frame)?.label ?? ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 960 }}>
      <style>{`
        .sc-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px }
        @media (min-width: 769px) { .sc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
      `}</style>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>코인</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>대표 코인 4종의 원화 시세와 흐름, 규제 소식, 비트코인 ETF로 들어온 돈.</p>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <h2 style={h2}>대표 코인 4종{mine.length > 0 ? ` + 내 코인 ${mine.length}종` : ''} <span style={{ fontSize: FS.tiny, fontWeight: 500, color: TK.sub }}>{frameLabel} 흐름</span></h2>
        <RangeTabs label="차트 기간" options={FRAMES} value={frame} onChange={setFrame} />
      </div>
      {prices.state === 'failed' && <FailRow text="코인 시세를 못 가져왔어요." onRetry={prices.reload} retryLabel="코인 시세 다시 불러오기" />}
      <div className="sc-grid">
        {coins.map(c => <CoinCard key={c.ticker} ticker={c.ticker} name={c.name} row={rowOf(c.ticker)} frame={frame} loading={pending(prices.state)} />)}
      </div>

      <Regulation />
      <EtfFlows />
      <span style={noteStyle()}>시세 업비트(원화) · 등락은 전날 대비 · 예측이 아니라 지금 상태예요</span>
    </div>
  )
}
