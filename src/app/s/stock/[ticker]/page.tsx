'use client'
// 학생 종목 상세 — 지금 가격·등락·가격 흐름(평단 점선)·내 보유(수량·평단·평가·손익·비중)·내 거래 기록 → 이 종목 기록하기
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio, type FailReason } from '@/app/components/student/useMyPortfolio'

// transactions 실제 컬럼(tradeWrite.ts TxBase 기준) — type 은 소문자 'buy' | 'sell'
interface Tx { id: string; type: 'buy' | 'sell'; price: number; quantity: number; transaction_date: string; currency: 'USD' | 'KRW' | null }
// /api/stock-price 의 charts 한 점 — t = epoch ms, v = 종가
interface PricePoint { t: number; v: number }
type FrameKey = '1D' | '1W' | '1M'
type Charts = Partial<Record<FrameKey, PricePoint[]>>

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const signWon = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`
// 한국식 — 오름 빨강 · 내림 파랑 · 보합(±0.05% 안)과 값 없음은 회색
const upDown = (n: number | null) => n == null || Math.abs(n) < 0.05 ? TK.sub : n > 0 ? TK.red400 : TK.blue400
// 달러는 소수 둘째 자리까지, 원화는 100원 미만(소액 코인)만 소수를 남긴다
const money = (n: number, currency: 'USD' | 'KRW' | null) => currency === 'USD'
  ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  : `${n.toLocaleString('ko-KR', { maximumFractionDigits: n < 100 ? 2 : 0 })}원`
const qtyText = (q: number, market: string) => `${q.toLocaleString('ko-KR', { maximumFractionDigits: 8 })}${market === 'CRYPTO' ? '개' : '주'}`

// ⚠️ charts 의 키 이름은 기간이 아니다 — KR·US 는 1D=일봉 60(약 3개월)·1W=주봉 60(약 14개월)·1M=월봉 60(5년),
//    코인은 1D=시간봉 24·1W=일봉 7·1M=일봉 30. 그래서 버튼 이름은 데이터의 실제 시작~끝 간격에서 뽑는다.
const FRAME_KEYS: FrameKey[] = ['1D', '1W', '1M']
const spanLabel = (pts: PricePoint[]) => {
  const d = (pts[pts.length - 1].t - pts[0].t) / 86_400_000
  if (d < 1.5) return '최근 하루'
  if (d < 45) return `최근 ${Math.round(d)}일`
  if (d < 700) return `최근 ${Math.round(d / 30.44)}개월`
  return `최근 ${Math.round(d / 365.25)}년`
}
// 유효한 점만 — 그리고 전부 같은 값이면 버린다(코인 조회 실패 시 API 가 현재가로 만든 직선을 채워 보낸다)
const cleanPts = (raw: unknown): PricePoint[] => {
  if (!Array.isArray(raw)) return []
  const pts = raw.filter((p): p is PricePoint => !!p && Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
  return pts.length > 1 && pts.some(p => p.v !== pts[0].v) ? pts : []
}

const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg } as const
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
  let ticker = rawParam
  try { ticker = decodeURIComponent(rawParam) } catch { /* 이미 풀린 값 */ }
  ticker = ticker.toUpperCase()

  const { state, holdings, summary, failReason, reload } = useMyPortfolio()
  const holding = holdings.find(h => h.ticker.toUpperCase() === ticker) ?? null
  const row = summary?.rows.find(r => r.ticker.toUpperCase() === ticker) ?? null
  const hTicker = holding?.ticker ?? null
  const hMarket = holding?.market ?? null

  // 가격 흐름: undefined = 불러오는 중 · null = 못 가져옴 · 객체 = 받음
  const [charts, setCharts] = useState<Charts | null | undefined>(undefined)
  const [chartsStale, setChartsStale] = useState(false)
  const [frame, setFrame] = useState<FrameKey | null>(null)
  // 거래 기록: undefined = 불러오는 중 · 'failed' = 못 불러옴 · 배열 = 받음(빈 배열 = 기록 없음)
  const [txs, setTxs] = useState<Tx[] | 'failed' | undefined>(undefined)

  useEffect(() => {
    if (!hTicker || !hMarket) return
    let cancelled = false
    setCharts(undefined); setChartsStale(false); setTxs(undefined)

    fetch('/api/stock-price', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify([{ ticker: hTicker, market: hMarket }]),
    })
      .then(r => r.ok ? r.json() : null)
      .then((j: unknown) => {
        if (cancelled) return
        const list = Array.isArray(j) ? j as { ticker?: unknown; charts?: Record<string, unknown>; error?: unknown; source?: unknown }[] : []
        const e = list.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === hTicker.toUpperCase()) ?? list[0]
        // 조회 실패 + 캐시도 없음 → API 가 빈 차트를 채워 보낸다. '기록 없음'이 아니라 '못 가져옴'이다
        if (!e || !e.charts || (e.error && e.source !== 'cache')) { setCharts(null); return }
        setCharts(Object.fromEntries(FRAME_KEYS.map(k => [k, cleanPts(e.charts?.[k])])) as Charts)
        setChartsStale(!!e.error && e.source === 'cache')
      })
      .catch(() => { if (!cancelled) setCharts(null) })

    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (!cancelled) setTxs('failed'); return }
      // 본인 행만 — 선생님 계정은 RLS 가 다른 학생 거래까지 열어 줄 수 있다
      const { data, error } = await sb.from('transactions')
        .select('id,type,price,quantity,transaction_date,currency')
        .eq('user_id', user.id).eq('ticker', hTicker)
        .order('transaction_date', { ascending: false }).limit(20)
      if (!cancelled) setTxs(error ? 'failed' : (data ?? []) as Tx[])
    })().catch(() => { if (!cancelled) setTxs('failed') })

    return () => { cancelled = true }
  }, [hTicker, hMarket])

  const back = <Link href="/s/assets" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 내 자산</Link>
  const msg = (text: string) => <p style={{ color: TK.sub, fontSize: FS.body }}>{text}</p>
  if (state === 'loading') return <div>{back}{msg('불러오는 중이에요…')}</div>
  if (state === 'unauth') return <div>{back}{msg('로그인하면 내 종목이 보여요.')}</div>
  if (state === 'failed' || !summary) return (
    <div>{back}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, color: TK.slate100 }}>{FAIL_TEXT[failReason ?? 'unknown']}</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>기록은 그대로 있어요. 서버가 잠시 응답하지 않았을 수 있어요.</span>
        <button type="button" onClick={reload} style={reloadBtn}>다시 불러오기</button>
      </div>
    </div>
  )
  if (!holding || !row) return <div>{back}{msg('이 종목은 내 보유 목록에 없어요.')}</div>

  // ── 가격 흐름 ──
  const available = charts ? FRAME_KEYS.filter(k => (charts[k]?.length ?? 0) > 1) : []
  const active: FrameKey | null = frame && available.includes(frame) ? frame : available.includes('1W') ? '1W' : available[0] ?? null
  const pts = charts && active ? charts[active] ?? [] : []
  const vals = pts.map(p => p.v)
  const vMin = vals.length ? Math.min(...vals) : 0, vMax = vals.length ? Math.max(...vals) : 0
  const avg = holding.purchase_price
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
  const priced = row.priced && row.currentPrice != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 560 }}>
      {back}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md }}>
        <div aria-hidden style={{ width: 48, height: 48, flexShrink: 0, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.lg, fontWeight: 700, color: TK.slate300 }}>{holding.name.slice(0, 1)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, color: TK.slate100 }}>{holding.name}</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, fontSize: FS.tiny, color: TK.sub }}>
            {holding.ticker}
            <span style={{ padding: `0 ${SP.xs + 2}px`, borderRadius: RAD.pill, background: row.role === 'CORE' ? `${TK.sky400}24` : `${TK.orange400}24`, color: row.role === 'CORE' ? TK.sky400 : TK.orange400, fontWeight: 600 }}>{row.role === 'CORE' ? '코어' : '위성'}</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>{priced && row.stale ? '마지막으로 가져온 가격' : '지금 가격'}</span>
        {priced
          ? <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{money(row.currentPrice as number, holding.currency)}</span>
          : <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.sub }}>지금 시세를 못 가져왔어요 · 매수가로 계산</span>}
        {/* 지난 시세의 등락은 오늘 것이 아닐 수 있다 — '오늘'로 쓰지 않는다 */}
        {priced && row.changePct != null && (
          <span style={{ fontSize: FS.body, fontWeight: 600, color: TK.sub }}>{row.stale ? '지난 시세' : '오늘'} <span style={{ color: upDown(row.changePct) }}>{pct(row.changePct)}</span></span>
        )}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>가격 흐름</h2>
        {charts === undefined ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>가격 흐름을 불러오는 중이에요…</span>
          : charts === null ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>가격 흐름을 못 가져왔어요.</span>
          : !active ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>이 종목의 가격 기록이 없어요.</span>
          : (<>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${holding.name} ${spanLabel(pts)} 가격 흐름`}>
              {showAvg && <path d={`M0,${y(avg).toFixed(1)} H${W}`} stroke={TK.sub} strokeDasharray="3 5" />}
              <path d={path} fill="none" stroke={TK.slate300} strokeWidth={2} />
            </svg>
            <span style={{ fontSize: FS.micro, color: TK.sub }}>
              {spanLabel(pts)} · {showAvg ? '점선 = 내 평균 매수가' : '평균 매수가가 이 기간 범위 밖이에요'}
            </span>
            {chartsStale && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>지금 시세 조회가 안 돼서 지난 기록을 보여 드려요.</span>}
            {available.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))`, gap: SP.xs }}>
                {available.map(k => {
                  const on = k === active
                  return <button key={k} type="button" onClick={() => setFrame(k)} aria-pressed={on} style={{ height: 36, borderRadius: RAD.pill, border: on ? 'none' : `1px solid ${TK.border}`, background: on ? TK.slate100 : 'transparent', color: on ? TK.bg0 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{spanLabel(charts[k] ?? [])}</button>
                })}
              </div>
            )}
          </>)}
      </section>

      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.md }}>
        {stat('보유 수량', qtyText(holding.quantity, holding.market))}
        {stat('평균 매수가', money(holding.purchase_price, holding.currency))}
        {stat('평가금액', won(row.evalKrw), TK.slate100, priced ? undefined : '매수가로 계산')}
        {stat('평가손익', priced ? signWon(row.pnlKrw) : '—', priced ? upDown(row.pnlPct) : TK.sub)}
        {stat('수익률', priced && row.pnlPct != null ? pct(row.pnlPct) : '—', priced ? upDown(row.pnlPct) : TK.sub)}
        {stat('내 자산 중 비중', `${row.weightPct.toFixed(1)}%`)}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, paddingBottom: SP.sm }}>내 거래 기록</h2>
        {txs === undefined ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>불러오는 중이에요…</span>
          : txs === 'failed' ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>거래 기록을 불러오지 못했어요.</span>
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
            {txs.length === 20 && <span style={{ fontSize: FS.tiny, color: TK.sub, paddingTop: SP.sm }}>최근 20건만 보여요.</span>}
          </>)}
      </section>

      {/* /research 는 ?q= 로 자동 검색한다(?ticker= 는 읽지 않음) */}
      <Link href={`/research?q=${encodeURIComponent(holding.ticker)}`} style={{ padding: SP.lg, border: `1px solid ${TK.border}`, borderRadius: RAD.md, color: TK.slate200, fontSize: FS.body, textDecoration: 'none' }}>이 종목 더 깊이 보기 — 분석 화면에서 열려요 ›</Link>
      <Link href={`/s/record?ticker=${encodeURIComponent(holding.ticker)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: RAD.md, background: TK.blue600, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, textDecoration: 'none' }}>이 종목 매매 기록하기</Link>
    </div>
  )
}
