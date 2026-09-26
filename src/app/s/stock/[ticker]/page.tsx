'use client'
// 학생 종목 상세 — 지금 가격·등락·가격 흐름(평단 점선)·내 보유(수량·평단·평가·손익·비중)·내 거래 기록 → 이 종목 기록하기
//   보유하지 않은 종목(홈 검색 ?m=시장&n=이름)은 가격·등락·가격 흐름만 보이고 기록하기로 이어 준다
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio, type FailReason } from '@/app/components/student/useMyPortfolio'
import { isPriced, type Market, type PriceInput } from '@/lib/portfolioSummary'
import { won, signWon, pct, upDown, money, qtyText } from '@/lib/studentFormat'

// transactions 실제 컬럼(tradeWrite.ts TxBase 기준) — type 은 소문자 'buy' | 'sell'
interface Tx { id: string; type: 'buy' | 'sell'; price: number; quantity: number; transaction_date: string; currency: 'USD' | 'KRW' | null }
// /api/stock-price 의 charts 한 점 — t = epoch ms, v = 종가
interface PricePoint { t: number; v: number }
// 보유하지 않은 종목의 시세(stock-price 한 줄) — price null = 시세 못 가져옴 · stale = 조회 실패 뒤 캐시에 남은 지난 시세
interface Quote { name: string | null; price: number | null; changePct: number | null; stale: boolean }
type FrameKey = '1D' | '1W' | '1M'
type Charts = Partial<Record<FrameKey, PricePoint[]>>

// ⚠️ charts 의 키 이름은 기간이 아니다 — KR·US 는 1D=일봉 60(약 3개월)·1W=주봉 60(약 14개월)·1M=월봉 60(5년),
//    코인은 1D=시간봉 24·1W=일봉 7·1M=일봉 30. 그래서 버튼 이름은 데이터의 실제 시작~끝 간격에서 뽑는다.
const FRAME_KEYS: FrameKey[] = ['1D', '1W', '1M']
// 간격 = 끝−시작 + 봉 하나(중앙값) — 일봉 7개는 6일이 아니라 7일 치다
const spanLabel = (pts: PricePoint[]) => {
  const steps = pts.slice(1).map((p, i) => p.t - pts[i].t).sort((a, b) => a - b)
  const step = steps.length ? steps[Math.floor(steps.length / 2)] : 0
  const d = (pts[pts.length - 1].t - pts[0].t + step) / 86_400_000
  if (d < 1.5) return '최근 하루'
  if (d < 45) return `최근 ${Math.round(d)}일`
  if (d < 700) return `최근 ${Math.round(d / 30.44)}개월`
  return `최근 ${Math.round(d / 365.25)}년`
}
// 유효한 점만. 코인은 전부 같은 값이면 버린다 — 업비트 조회 실패 시 API 가 현재가로 만든 직선을 채워 보낸다.
//   (KR·US 는 그런 가짜 직선이 없고 거래정지 종목은 실제로 평평할 수 있어 그대로 둔다)
const cleanPts = (raw: unknown, isCrypto: boolean): PricePoint[] => {
  if (!Array.isArray(raw)) return []
  const pts = raw.filter((p): p is PricePoint => !!p && Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
  if (pts.length < 2) return []
  return isCrypto && pts.every(p => p.v === pts[0].v) ? [] : pts
}

const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg } as const
const recordBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: RAD.md, background: TK.blue600, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, textDecoration: 'none' } as const
const reloadBtn = { alignSelf: 'flex-start', height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer' } as const
// 실패 이유마다 다른 문장 — 내 자산 화면과 같은 말
const FAIL_TEXT: Record<FailReason | 'unknown', string> = {
  fx: '환율을 못 가져와서 달러 종목을 원화로 바꿀 수 없어요.',
  db: '내 종목 목록을 불러오지 못했어요.',
  other: '내 자산을 불러오지 못했어요.',
  unknown: '내 자산을 불러오지 못했어요.',
}

export default function StudentStock() {
  const params = useParams<{ ticker: string | string[] }>()
  const rawParam = Array.isArray(params?.ticker) ? params.ticker[0] : params?.ticker ?? ''
  let decoded = rawParam
  try { decoded = decodeURIComponent(rawParam) } catch { /* 이미 풀린 값 */ }
  const ticker = decoded.toUpperCase()
  // 홈 검색에서 오면 ?m=시장&n=이름 — 보유하지 않은 종목은 이것으로 시세를 부른다
  const sp = useSearchParams()
  const mParam = sp?.get('m') ?? ''
  const qMarket: Market | null = mParam === 'KR' || mParam === 'US' || mParam === 'CRYPTO' ? mParam : null
  const nParam = sp?.get('n')?.trim() || null

  const { state, holdings, summary, failReason, reload } = useMyPortfolio()
  const holding = holdings.find(h => h.ticker.toUpperCase() === ticker) ?? null
  const row = summary?.rows.find(r => r.ticker.toUpperCase() === ticker) ?? null
  const hTicker = holding?.ticker ?? null
  const hMarket = holding?.market ?? null
  // 환율만 못 받은 실패는 보유 목록은 받은 상태다(/s/record 의 holdingsKnown 과 같은 판정) — 종목 화면을 막지 않고
  //  원화 평가(평가금액·손익·비중)만 빼고 보여 준다. 추정 환율로 계산하지 않는다
  const fxOnly = state === 'failed' && failReason === 'fx'
  const holdingsKnown = state === 'ready' || fxOnly
  // 보유 목록을 실제로 받은 뒤에만 '보유 안 함'이라 판단한다(못 불러왔을 때 '없다'고 하지 않는다)
  const notHeld = holdingsKnown && !holding
  const cTicker = hTicker ?? (notHeld && qMarket ? decoded : null)
  const cMarket = hMarket ?? (notHeld ? qMarket : null)

  // 보유 안 한 종목의 시세: undefined = 불러오는 중 · null = 못 가져옴 · 객체 = 받음
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined)
  // 가격 흐름: undefined = 불러오는 중 · null = 못 가져옴 · 객체 = 받음
  const [charts, setCharts] = useState<Charts | null | undefined>(undefined)
  const [chartsStale, setChartsStale] = useState(false)
  const [frame, setFrame] = useState<FrameKey | null>(null)
  // 거래 기록: undefined = 불러오는 중 · 'failed' = 못 불러옴 · 배열 = 받음(빈 배열 = 기록 없음)
  const [txs, setTxs] = useState<Tx[] | 'failed' | undefined>(undefined)
  const [txMore, setTxMore] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!cTicker || !cMarket) return
    let cancelled = false
    setCharts(undefined); setChartsStale(false); setTxs(undefined); setQuote(undefined)

    fetch('/api/stock-price', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify([{ ticker: cTicker, market: cMarket }]),
    })
      .then(r => r.ok ? r.json() : null)
      .then((j: unknown) => {
        if (cancelled) return
        const list = Array.isArray(j) ? j as { ticker?: unknown; name?: unknown; currentPrice?: unknown; changePct?: unknown; charts?: Record<string, unknown>; error?: unknown; source?: unknown }[] : []
        const e = list.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === cTicker.toUpperCase()) ?? list[0]
        // 시세 판정은 내 자산과 같은 규칙(isPriced) — 지난 캐시 시세는 쓰되 stale 로 밝히고, 값이 0 이면 '못 가져옴'
        if (!e) setQuote(null)
        else {
          const ok = isPriced(e as unknown as PriceInput)
          setQuote({
            name: typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null,
            price: ok ? e.currentPrice as number : null,
            changePct: ok ? e.changePct as number : null,
            stale: ok && !!e.error,
          })
        }
        // 조회 실패 + 캐시도 없음 → API 가 빈 차트를 채워 보낸다. '기록 없음'이 아니라 '못 가져옴'이다
        if (!e || !e.charts || (e.error && e.source !== 'cache')) { setCharts(null); return }
        setCharts(Object.fromEntries(FRAME_KEYS.map(k => [k, cleanPts(e.charts?.[k], cMarket === 'CRYPTO')])) as Charts)
        setChartsStale(!!e.error && e.source === 'cache')
      })
      .catch(() => { if (!cancelled) { setCharts(null); setQuote(null) } })

    // 보유하지 않은 종목은 내 거래 기록이 없다 — 부르지 않는다
    if (hTicker) (async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (!cancelled) setTxs('failed'); return }
      // 본인 행만 — 선생님 계정은 RLS 가 다른 학생 거래까지 열어 줄 수 있다
      const { data, error } = await sb.from('transactions')
        .select('id,type,price,quantity,transaction_date,currency')
        .eq('user_id', user.id).eq('ticker', hTicker)
        .order('transaction_date', { ascending: false }).order('created_at', { ascending: false })
        .limit(21)  // 21건째가 오면 '더 있다'는 뜻 — 화면엔 20건
      if (cancelled) return
      if (error) { setTxs('failed'); return }
      const rows = (data ?? []) as Tx[]
      setTxMore(rows.length > 20); setTxs(rows.slice(0, 20))
    })().catch(() => { if (!cancelled) setTxs('failed') })

    return () => { cancelled = true }
  }, [cTicker, cMarket, hTicker, retry])

  // 보유 안 한 종목은 홈 검색에서 왔다 — 홈으로 돌려보낸다
  const back = <Link href={notHeld ? '/s' : '/s/assets'} style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>{notHeld ? '‹ 홈' : '‹ 내 자산'}</Link>
  const msg = (text: string) => <p style={{ color: TK.sub, fontSize: FS.body }}>{text}</p>
  if (state === 'loading') return <div>{back}{msg('불러오는 중이에요…')}</div>
  if (state === 'unauth') return <div>{back}{msg('로그인하면 내 종목이 보여요.')}</div>
  if (!fxOnly && (state === 'failed' || !summary)) return (
    <div>{back}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, color: TK.slate100 }}>{FAIL_TEXT[failReason ?? 'unknown']}</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>기록은 그대로 있어요. 서버가 잠시 응답하지 않았을 수 있어요.</span>
        <button type="button" onClick={reload} style={reloadBtn}>다시 불러오기</button>
      </div>
    </div>
  )
  if (!holding && !qMarket) return (
    <div>{back}{msg('어느 시장 종목인지 몰라요 — 검색에서 다시 골라 주세요.')}
      <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate200, fontSize: FS.body, textDecoration: 'none' }}>홈에서 찾기 ›</Link>
    </div>
  )
  if (holding && !row && !fxOnly) return <div>{back}{msg('이 종목은 내 보유 목록에 없어요.')}</div>
  // 이름·티커·통화 — 보유 종목이면 내 기록, 아니면 검색이 넘긴 이름(n) → 시세 응답 이름 → 티커
  const displayName = holding?.name ?? nParam ?? quote?.name ?? decoded
  const displayTicker = holding?.ticker ?? decoded
  const currency = holding?.currency ?? (qMarket === 'US' ? 'USD' : 'KRW')

  // ── 가격 흐름 ── 같은 간격 이름이 둘이면 하나만(버튼이 같은 말을 두 번 하지 않게)
  const labels: Partial<Record<FrameKey, string>> = {}
  const available: FrameKey[] = []
  if (charts) for (const k of FRAME_KEYS) {
    const kp = charts[k] ?? []
    if (kp.length < 2) continue
    const l = spanLabel(kp)
    if (Object.values(labels).includes(l)) continue
    labels[k] = l; available.push(k)
  }
  const active: FrameKey | null = frame && available.includes(frame) ? frame : available.includes('1W') ? '1W' : available[0] ?? null
  const pts = charts && active ? charts[active] ?? [] : []
  const vals = pts.map(p => p.v)
  const vMin = vals.length ? Math.min(...vals) : 0, vMax = vals.length ? Math.max(...vals) : 0
  const avg = holding?.purchase_price ?? NaN   // 보유하지 않은 종목은 평단 점선이 없다
  // 평단이 차트 범위에서 너무 멀면 선 하나 때문에 가격 흐름이 납작해진다 — 그때는 그리지 않고 말로 밝힌다
  const showAvg = Number.isFinite(avg) && avg > 0 && avg >= vMin * 0.5 && avg <= vMax * 2
  const min = showAvg ? Math.min(vMin, avg) : vMin, max = showAvg ? Math.max(vMax, avg) : vMax
  const W = 358, H = 120
  const y = (v: number) => max === min ? H / 2 : H - (v - min) / (max - min) * (H - 8) - 4
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(pts.length - 1, 1) * W).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')

  const stat = (label: string, value: string, color: string = TK.slate100, note?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub }}>{label}</span>
      <span style={{ fontSize: FS.lg, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value}</span>
      {note && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>{note}</span>}
    </div>
  )
  // 지금 가격 — 보유 종목은 내 자산 요약(row), 아니면 직접 부른 시세(quote). undefined = 아직 불러오는 중
  const px: Quote | null | undefined = row ? { name: null, price: row.priced ? row.currentPrice : null, changePct: row.changePct, stale: row.stale } : quote
  const curPrice = px?.price ?? null, curChg = px?.changePct ?? null, curStale = !!px?.stale
  const priced = curPrice != null
  const retryBtn = <button type="button" onClick={() => setRetry(n => n + 1)} style={reloadBtn}>다시 불러오기</button>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 560 }}>
      {back}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md }}>
        <div aria-hidden style={{ width: 48, height: 48, flexShrink: 0, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.lg, fontWeight: 700, color: TK.slate300 }}>{displayName.slice(0, 1)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, color: TK.slate100 }}>{displayName}</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, fontSize: FS.tiny, color: TK.sub }}>
            {displayTicker}
            {row && <span style={{ padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: row.role === 'CORE' ? `${TK.sky400}24` : `${TK.orange400}24`, color: row.role === 'CORE' ? TK.sky400 : TK.orange400, fontWeight: 600 }}>{row.role === 'CORE' ? '코어' : '위성'}</span>}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>{priced && curStale ? '마지막으로 가져온 가격' : '지금 가격'}</span>
        {px === undefined
          ? <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.sub }}>불러오는 중이에요…</span>
          : priced
          ? <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{money(curPrice, currency)}</span>
          : <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.sub }}>지금 시세를 못 가져왔어요{row ? ' · 매수가로 계산' : ''}</span>}
        {/* 지난 시세의 등락은 오늘 것이 아닐 수 있다 — '오늘'로 쓰지 않는다 */}
        {priced && curChg != null && (
          <span style={{ fontSize: FS.body, fontWeight: 600, color: TK.sub }}>{curStale ? '지난 시세' : '오늘'} <span style={{ color: upDown(curChg) }}>{pct(curChg)}</span></span>
        )}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>가격 흐름</h2>
        {charts === undefined ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>가격 흐름을 불러오는 중이에요…</span>
          // KR·US 차트 실패는 시세가 성공해도 빈 배열로 온다 — 쓸 수 있는 기간이 없으면 '기록 없음'이 아니라 '못 가져옴'
          : charts === null || !active ? <>
            <span style={{ fontSize: FS.tiny, color: TK.sub }}>가격 흐름을 못 가져왔어요.</span>
            {retryBtn}
          </>
          : (<>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${displayName} ${labels[active]} 가격 흐름`}>
              {showAvg && <path d={`M0,${y(avg).toFixed(1)} H${W}`} stroke={TK.sub} strokeDasharray="3 5" />}
              <path d={path} fill="none" stroke={TK.slate300} strokeWidth={2} />
            </svg>
            <span style={{ fontSize: FS.micro, color: TK.sub }}>
              {labels[active]}{holding && (showAvg ? ' · 점선 = 내 평균 매수가' : ' · 평균 매수가가 이 기간 범위 밖이에요')}
            </span>
            {chartsStale && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>지금 시세 조회가 안 돼서 지난 기록을 보여 드려요.</span>}
            {available.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))`, gap: SP.xs }}>
                {available.map(k => {
                  const on = k === active
                  return <button key={k} type="button" onClick={() => setFrame(k)} aria-pressed={on} style={{ height: 44, borderRadius: RAD.pill, border: on ? 'none' : `1px solid ${TK.border}`, background: on ? TK.slate100 : 'transparent', color: on ? TK.bg0 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{labels[k]}</button>
                })}
              </div>
            )}
          </>)}
      </section>

      {holding ? (<>
      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.md }}>
        {stat('보유 수량', qtyText(holding.quantity, holding.market))}
        {stat('평균 매수가', money(holding.purchase_price, holding.currency))}
        {row ? (<>
        {stat('평가금액', won(row.evalKrw), TK.slate100, priced ? undefined : '매수가로 계산')}
        {stat('평가손익', priced ? signWon(row.pnlKrw) : '—', priced ? upDown(row.pnlPct) : TK.sub)}
        {stat('수익률', priced && row.pnlPct != null ? pct(row.pnlPct) : '—', priced ? upDown(row.pnlPct) : TK.sub)}
        {stat('내 자산 중 비중', `${row.weightPct.toFixed(1)}%`, TK.slate100, priced ? undefined : '매수가로 계산')}
        </>) : (
          // 환율만 못 받음(fxOnly) — 원화 평가·손익·비중은 추정 환율로 채우지 않는다
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: SP.sm }}>
            <span style={{ fontSize: FS.body, color: TK.amber400 }}>환율을 못 가져와 원화 평가는 못 해요.</span>
            <button type="button" onClick={reload} style={reloadBtn}>다시 불러오기</button>
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, paddingBottom: SP.sm }}>내 거래 기록</h2>
        {txs === undefined ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>불러오는 중이에요…</span>
          : txs === 'failed' ? <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
            <span style={{ fontSize: FS.tiny, color: TK.sub }}>거래 기록을 불러오지 못했어요.</span>
            {retryBtn}
          </div>
          : txs.length === 0 ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>기록된 거래가 없어요.</span>
          : (<>
            {txs.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SP.sm, minHeight: 52, borderTop: `1px solid ${TK.border}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: FS.body, color: TK.slate100 }}>
                    <span style={{ color: t.type === 'buy' ? TK.red400 : TK.blue400 }}>{t.type === 'buy' ? '샀어요' : '팔았어요'}</span> {qtyText(t.quantity, holding.market)}
                  </span>
                  <span style={{ fontSize: FS.tiny, color: TK.sub }}>{t.transaction_date}</span>
                </div>
                <span style={{ fontSize: FS.body, color: TK.slate300, whiteSpace: 'nowrap', flexShrink: 0 }}>{money(t.price, t.currency ?? holding.currency)}</span>
              </div>
            ))}
            {txMore && <span style={{ fontSize: FS.tiny, color: TK.sub, paddingTop: SP.sm }}>최근 20건만 보여요.</span>}
          </>)}
      </section>
      </>) : (
        // 보유·거래 섹션 대신 — 기록하기로 이어 준다(시장·이름을 넘겨 기록하기가 미리 고르게)
        <section style={{ display: 'flex', flexDirection: 'column', gap: SP.md }}>
          <span style={{ fontSize: FS.body, color: TK.slate200 }}>아직 기록한 적 없는 종목이에요.</span>
          <Link href={`/s/record?ticker=${encodeURIComponent(displayTicker)}&m=${qMarket}&n=${encodeURIComponent(displayName)}`} style={recordBtn}>이 종목 샀어요 — 기록하기</Link>
        </section>
      )}

      {/* /research 는 ?q= 로 자동 검색한다(?ticker= 는 읽지 않음) */}
      <Link href={`/research?q=${encodeURIComponent(displayTicker)}`} style={{ padding: SP.lg, border: `1px solid ${TK.border}`, borderRadius: RAD.md, color: TK.slate200, fontSize: FS.body, textDecoration: 'none' }}>이 종목 더 깊이 보기 — 분석 화면에서 열려요 ›</Link>
      {holding && <Link href={`/s/record?ticker=${encodeURIComponent(holding.ticker)}`} style={recordBtn}>이 종목 매매 기록하기</Link>}
    </div>
  )
}
