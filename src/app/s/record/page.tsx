'use client'
// 학생 기록하기 — 증권사에서 이미 한 매매를 적는다(주문 아님). 종목 → 수량 → 가격·날짜 확인 → 저장. 쓰기 규칙은 tradeWrite SSOT, 분류는 classifyAsset SSOT.
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { planBuy, planSell, executeTrade, type TradeInput, type ExistingHolding } from '@/lib/tradeWrite'
import { classifyAsset } from '@/lib/classifyAsset'
import type { SearchResult } from '@/lib/stockSearch'

// schoolIndex.kstDate 와 같은 식 — schoolIndex 는 yahoo-finance2(서버 전용 fs)를 끌고 와 브라우저 번들이 깨진다
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)   // Asia/Seoul 달력일

type Mode = 'buy' | 'sell'
type SearchState = 'idle' | 'loading' | 'done' | 'failed'

const inputStyle = { height: 48, minWidth: 0, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: TK.bg3, border: `1px solid ${TK.border}`, color: TK.slate100, fontSize: FS.body, boxSizing: 'border-box' as const, width: '100%' }
const stepBtn = { width: 48, height: 48, flexShrink: 0, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, background: TK.card, color: TK.slate200, fontSize: FS.body, cursor: 'pointer' } as const
const smallBtn = { height: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer' } as const
const note = (color: string = TK.sub) => ({ fontSize: FS.tiny, color })

// 달러는 소수 둘째 자리까지. 원화는 1원 미만(소액 코인)은 유효숫자 8자리, 100원 미만은 소수 둘째 자리, 그 위는 정수
const money = (n: number, currency: 'USD' | 'KRW') => currency === 'USD'
  ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  : `${n > 0 && n < 1 ? n.toLocaleString('ko-KR', { maximumSignificantDigits: 8 }) : n.toLocaleString('ko-KR', { maximumFractionDigits: n < 100 ? 2 : 0 })}원`
const qtyText = (q: number, market: string) => `${q.toLocaleString('ko-KR', { maximumFractionDigits: 8 })}${market === 'CRYPTO' ? '개' : '주'}`
// 숫자와 소수점 하나만 — 지수(1e5)·16진수(0x10)·빈 칸은 NaN. Number() 가 그런 것도 받아 주므로 형식을 먼저 본다
const parseStrict = (s: string) => /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN
// 쉼표는 천 단위 자리에만('1,5' 는 NaN) — 공백·'원'·'$' 를 걷어 내고, 쉼표 위치를 본 뒤 지운다
const parsePrice = (s: string) => { const t = s.replace(/[\s원$]/g, ''); return t.includes(',') && !/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(t) ? NaN : parseStrict(t.replace(/,/g, '')) }
const parseQty = (s: string) => parseStrict(s.trim())                        // 수량엔 쉼표를 안 받는다('1,0' 이 10 으로 읽히지 않게)
// 미리 채우는 시세를 입력 칸 형식으로 — String(1e-7) 은 '1e-7' 이 되어 위 검사에 걸린다
const plainNum = (n: number) => n >= 1e-6 ? String(n) : n.toFixed(12).replace(/\.?0+$/, '')
const MIN_DATE = '2000-01-01'
const normT = (t: string) => t.trim().toUpperCase()
const r8 = (n: number) => Math.round(n * 1e8) / 1e8   // +1·−1 을 반복해도 0.30000000000000004 가 생기지 않게
const marketLabel = (r: SearchResult) => r.market === 'CRYPTO' ? '코인' : r.exchange || (r.market === 'KR' ? '한국' : '미국')

export default function StudentRecord() {
  // useSearchParams 는 Suspense 경계 안에서만 정적 생성이 된다(Next 14)
  return (
    <Suspense fallback={<p style={{ color: TK.sub, fontSize: FS.body }}>불러오는 중이에요…</p>}>
      <RecordForm />
    </Suspense>
  )
}

function RecordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { state, failReason, holdings, reload } = useMyPortfolio()
  // 환율만 못 받은 실패(fx)는 보유 목록 자체는 받아 온 상태다 — 기록에는 환율이 필요 없다
  const holdingsKnown = state === 'ready' || (state === 'failed' && failReason === 'fx')

  const [mode, setMode] = useState<Mode>('buy')
  const [picked, setPicked] = useState<SearchResult | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [searchTick, setSearchTick] = useState(0)
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [priceState, setPriceState] = useState<'idle' | 'loading' | 'ok' | 'failed'>('idle')
  const [marketPrice, setMarketPrice] = useState<number | null>(null)
  // 날짜는 마운트 뒤에만 정한다 — 렌더 중 new Date() 는 서버·브라우저가 다른 날을 볼 수 있다(하이드레이션 오류 이력)
  const [today, setToday] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)   // 부분 기록 뒤엔 다시 저장하지 못하게 잠근다(거래가 두 번 적힌다)
  const busy = useRef(false)
  const paramApplied = useRef(false)

  useEffect(() => { const d = kstDate(); setToday(d); setDate(d) }, [])

  const mine = useMemo(() => holdings.map(h => ({ ticker: h.ticker, name: h.name, market: h.market, currency: h.currency, exchange: '' }) as SearchResult), [holdings])
  // 보유 판정은 티커만으로 — AddInvestmentModal·dedupeHoldings·DB 유일 키(user_id, ticker)와 같은 규칙
  const held = picked && holdingsKnown ? holdings.find(h => normT(h.ticker) === normT(picked.ticker)) ?? null : null
  const marketClash = !!held && !!picked && held.market !== picked.market
  const existing = marketClash ? null : held

  useEffect(() => {   // ?ticker= 로 들어오면 내 종목에서 한 번만 골라 둔다 — 그 전에 학생이 직접 고르면(choose) 건너뛴다
    if (paramApplied.current || !holdingsKnown) return
    paramApplied.current = true
    const t = params.get('ticker'); if (!t) return
    const m = mine.find(x => normT(x.ticker) === normT(t)); if (m) setPicked(m)
  }, [params, mine, holdingsKnown])

  useEffect(() => {   // 이름 검색 — 300ms 멈추면 부른다. 늦게 온 옛 응답은 버린다
    if (!q.trim()) { setResults([]); setSearchState('idle'); setFailedSources([]); return }
    setSearchState('loading')
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      fetch(`/api/stock-search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store', signal: ctrl.signal })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
        .then((j: { results?: SearchResult[]; failed?: boolean; failedSources?: string[] }) => {
          if (ctrl.signal.aborted) return
          setResults(Array.isArray(j.results) ? j.results : [])
          setFailedSources(Array.isArray(j.failedSources) ? j.failedSources : [])
          setSearchState(j.failed ? 'failed' : 'done')
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setResults([]); setFailedSources(['stocks', 'crypto']); setSearchState('failed')
        })
    }, 300)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [q, searchTick])

  const pTicker = picked?.ticker ?? null
  const pMarket = picked?.market ?? null
  useEffect(() => {   // 고른 종목의 지금 시세로 가격 칸을 미리 채운다(고칠 수 있음). 앞 종목의 가격은 먼저 지운다
    setPrice(''); setMarketPrice(null)
    if (!pTicker || !pMarket) { setPriceState('idle'); return }
    let cancelled = false
    setPriceState('loading')
    fetch('/api/stock-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify([{ ticker: pTicker, market: pMarket }]) })
      .then(r => r.ok ? r.json() : null)
      .then((j: unknown) => {
        if (cancelled) return
        const list = Array.isArray(j) ? j as { ticker?: unknown; currentPrice?: unknown; error?: unknown }[] : []
        const p = list.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === pTicker.toUpperCase()) ?? list[0]
        // error 가 있으면(지난 캐시 시세 포함) 미리 넣지 않는다 — 지금 가격이 아니다
        if (p && !p.error && typeof p.currentPrice === 'number' && p.currentPrice > 0) {
          const cp = p.currentPrice
          setMarketPrice(cp); setPriceState('ok')
          setPrice(prev => prev === '' ? plainNum(cp) : prev)   // 그새 학생이 적은 값은 덮지 않는다
        } else setPriceState('failed')
      })
      .catch(() => { if (!cancelled) setPriceState('failed') })
    return () => { cancelled = true }
  }, [pTicker, pMarket])

  const currency = existing?.currency ?? picked?.currency ?? 'KRW'
  const unit = picked?.market === 'CRYPTO' ? '개' : '주'
  const qtyNum = parseQty(qty)
  const priceNum = parsePrice(price)
  // 지금 시세와 3배 넘게 다르면 알려만 준다(막지 않는다) — 한 주 가격 대신 총액을 적는 실수가 흔하다
  const farFromMarket = priceState === 'ok' && marketPrice != null && Number.isFinite(priceNum) && priceNum > 0 && (priceNum > marketPrice * 3 || priceNum < marketPrice / 3)
  const role = existing ? (existing.asset_role ?? 'CORE') : picked ? classifyAsset(picked.ticker, picked.name, picked.market) : null
  const total = Number.isFinite(priceNum) && priceNum > 0 && Number.isFinite(qtyNum) && qtyNum > 0 ? priceNum * qtyNum : 0

  const ex: ExistingHolding | null = existing ? { id: existing.id, quantity: existing.quantity, purchase_price: existing.purchase_price, name: existing.name, asset_role: existing.asset_role } : null
  const inp: TradeInput | null = picked ? { ticker: picked.ticker, name: existing?.name ?? picked.name, market: picked.market, currency, price: priceNum, quantity: qtyNum, date, role: role ?? 'SATELLITE' } : null

  // 저장 전에 막는 이유 — 첫 번째 하나만 보여 준다. 마지막 판정은 tradeWrite 가 한다(같은 문장)
  const problem: string | null = (() => {
    if (state === 'loading') return '내 종목을 불러오는 중이에요…'
    if (state === 'unauth') return '로그인이 필요해요.'
    if (!holdingsKnown) return '내 종목을 불러온 뒤에 저장할 수 있어요.'
    if (!picked || !inp) return '종목을 골라 주세요.'
    if (marketClash) return `같은 티커(${normT(picked.ticker)})를 이미 다른 시장 종목으로 갖고 있어요.`
    if (mode === 'sell' && !existing) return '갖고 있지 않은 종목은 팔 수 없어요.'
    // 소수 수량은 막지 않는다 — 기존 두 모달이 모든 시장에서 소수를 받는다(규칙 일치)
    if (!(Number.isFinite(qtyNum) && qtyNum > 0)) return '수량을 적어 주세요.'
    if (!(Number.isFinite(priceNum) && priceNum > 0)) return price.trim() && !Number.isFinite(priceNum) ? '가격을 숫자로 적어 주세요. 쉼표는 천 단위에만 써요(예: 1,234).' : '가격을 적어 주세요.'
    if (!date || date < MIN_DATE) return '날짜를 확인해 주세요.'
    if (today && date > today) return '오늘보다 뒤 날짜는 적을 수 없어요.'
    const preview = mode === 'buy' ? planBuy('preview', ex, inp) : planSell('preview', ex, inp)
    return preview.kind === 'error' ? preview.message : null
  })()

  // 부분 기록 뒤(locked)엔 '선생님께 알려 주세요' 문구를 지우지 않는다
  const choose = (r: SearchResult) => { paramApplied.current = true; setPicked(r); if (!locked) setError(null) }
  const switchMode = (m: Mode) => {
    setMode(m); if (!locked) setError(null)
    if (m === 'sell') {
      setQ(''); setResults([])
      if (picked && !existing) setPicked(null)   // 팔기는 내 종목만
    }
  }
  const bump = (d: number) => setQty(prev => {
    const v = parseQty(prev)
    if (!Number.isFinite(v)) return d > 0 ? String(d) : prev
    if (d < 0) return v < 1 ? prev : String(Math.max(1, r8(v + d)))
    return String(r8(v + d))
  })

  const save = async () => {
    if (busy.current || locked || problem || !inp) return
    // 오늘은 저장하는 순간 다시 잰다 — 자정을 넘겨 화면을 열어 둔 경우
    const now = kstDate()
    if (now !== today) setToday(now)
    if (date > now) { setError('오늘보다 뒤 날짜는 적을 수 없어요.'); return }
    busy.current = true; setSaving(true); setError(null)
    let ok = false, partial = false
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setError('로그인이 필요해요.'); return }
      const plan = mode === 'buy' ? planBuy(user.id, ex, inp) : planSell(user.id, ex, inp)
      // 성공하면 executeTrade 가 서버 캐시 무효화 + 'portfolio-updated' 이벤트까지 한다
      const res = await executeTrade(sb, plan)
      if (!res.ok) {
        setError(res.message)
        // 거래는 적혔는데 보유 반영이 실패 — 다시 저장하면 거래가 두 번 적힌다. 잠그고 내 종목을 새로 읽는다
        if (res.partial) { partial = true; setLocked(true); reload() }
        return
      }
      ok = true
      router.push('/s/assets')
    } catch {
      setError('저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      // 성공이면 이동하는 동안 '저장하는 중'으로 잠가 두고, 부분 기록이면 locked 로 계속 잠근다
      if (!ok) setSaving(false)
      if (!ok && !partial) busy.current = false
    }
  }

  const seg = (on: boolean, color: string) => ({ height: 44, borderRadius: RAD.sm, border: 'none', background: on ? color : 'transparent', color: on ? TK.bg0 : TK.sub, fontSize: FS.body, fontWeight: 700, cursor: 'pointer' })
  const pickList = mine
  const cryptoDown = failedSources.includes('crypto'), stocksDown = failedSources.includes('stocks')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
        <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, color: TK.slate100 }}>매매 기록하기</h1>
        <Link href="/s/assets" style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.md}px`, fontSize: FS.tiny, color: TK.sub, textDecoration: 'none' }}>닫기</Link>
      </div>
      <span style={note()}>증권사에서 이미 한 매매를 적어 두는 곳이에요. 여기서 주문이 나가지는 않아요.</span>
      <div role="group" aria-label="샀어요 또는 팔았어요" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm, padding: SP.xs, background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md }}>
        <button type="button" aria-pressed={mode === 'buy'} onClick={() => switchMode('buy')} style={seg(mode === 'buy', TK.red400)}>샀어요</button>
        <button type="button" aria-pressed={mode === 'sell'} onClick={() => switchMode('sell')} style={seg(mode === 'sell', TK.blue400)}>팔았어요</button>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={note()}>1. 어떤 종목?</span>
        {state === 'loading' ? <span style={note()}>내 종목 불러오는 중…</span>
          : state === 'unauth' ? <span style={note()}>로그인하면 내 종목이 보여요.</span>
          : !holdingsKnown ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, padding: SP.md, background: TK.card, border: `1px solid ${TK.amber400}`, borderRadius: RAD.md }}>
              <span style={{ fontSize: FS.body, color: TK.slate100 }}>내 종목을 불러오지 못했어요.</span>
              <span style={note()}>내 종목을 불러온 뒤에 저장할 수 있어요 — 이미 가진 종목이 두 줄로 생기지 않게 하려고요.</span>
              <button type="button" onClick={reload} style={{ ...smallBtn, alignSelf: 'flex-start' }}>다시 불러오기</button>
            </div>
          ) : pickList.length > 0 ? (
            <div role="group" aria-label="내 종목" style={{ display: 'flex', flexWrap: 'wrap', gap: SP.xs }}>
              {pickList.map(m => {
                const on = picked?.ticker === m.ticker && picked?.market === m.market
                return <button key={`${m.market}:${m.ticker}`} type="button" onClick={() => choose(m)} aria-pressed={on} style={{ height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.pill, border: `1px solid ${on ? TK.sky400 : TK.border}`, background: on ? `${TK.sky400}1f` : TK.card, color: on ? TK.slate100 : TK.slate300, fontSize: FS.tiny, fontWeight: on ? 600 : 500, cursor: 'pointer' }}>{m.name}</button>
              })}
            </div>
          ) : mode === 'sell' ? <span style={note()}>팔 수 있는 종목이 없어요.</span> : null}

        {mode === 'buy' && (<>
          <label htmlFor="st-q" style={note()}>{pickList.length ? '내 종목에 없으면 이름으로 찾기' : '종목 이름으로 찾기'}</label>
          <input id="st-q" value={q} onChange={e => setQ(e.target.value)} placeholder="삼성, 엔비디아, TIGER 미국, 비트코인" style={inputStyle} autoComplete="off" />
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          {searchState === 'loading' && <span style={note()}>찾는 중…</span>}
          {searchState === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
              <span style={note(TK.amber400)}>
                {results.length === 0
                  ? `검색이 잠시 안 돼요${stocksDown && !cryptoDown ? '(주식 검색)' : cryptoDown && !stocksDown ? '(코인 검색)' : ''} — 다시 시도해 주세요.`
                  : cryptoDown ? '코인 검색이 잠시 안 돼서 주식만 보여요.' : '주식 검색이 잠시 안 돼서 코인만 보여요.'}
              </span>
              <button type="button" onClick={() => setSearchTick(t => t + 1)} style={smallBtn}>다시 찾기</button>
            </div>
          )}
          {searchState === 'done' && results.length === 0 && <span style={note()}>찾는 종목이 없어요.</span>}
          </div>
          {searchState !== 'loading' && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.sm, overflow: 'hidden' }}>
              {results.map((r, i) => (
                <button key={`${r.market}:${r.ticker}`} type="button" onClick={() => { choose(r); setQ(''); setResults([]) }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SP.sm, minHeight: 48, padding: `0 ${SP.md}px`, border: 'none', borderTop: i ? `1px solid ${TK.border}` : 'none', background: 'transparent', color: TK.slate100, fontSize: FS.body, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>{r.name}</span>
                  <span style={{ ...note(), flexShrink: 0, whiteSpace: 'nowrap' }}>{marketLabel(r)} · {r.ticker}</span>
                </button>
              ))}
            </div>
          )}
        </>)}
        {picked && (
          <span style={note(TK.slate300)}>
            고른 종목: <b>{picked.name}</b>{existing ? ` · 지금 ${qtyText(existing.quantity, existing.market)} 보유` : mode === 'buy' ? ' · 새 종목' : ''}
          </span>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={note()}>2. 몇 {unit}?</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
          <button type="button" aria-label="1 빼기" onClick={() => bump(-1)} style={{ ...stepBtn, fontSize: FS.xl }}>−</button>
          <input aria-label="수량" inputMode="decimal" value={qty}
            onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setQty(v) }}
            style={{ ...inputStyle, flex: 1, textAlign: 'center', fontSize: FS.xl, fontWeight: 700 }} />
          <button type="button" aria-label="1 더하기" onClick={() => bump(1)} style={stepBtn}>+1</button>
          <button type="button" aria-label="10 더하기" onClick={() => bump(10)} style={stepBtn}>+10</button>
        </div>
        {mode === 'sell' && existing && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm }}>
            <span style={note()}>지금 {qtyText(existing.quantity, existing.market)} 보유</span>
            <button type="button" onClick={() => setQty(String(existing.quantity))} style={smallBtn}>전부</button>
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.md }}>
        <span style={note()}>3. 가격·날짜 확인</span>
        <label htmlFor="st-px" style={{ fontSize: FS.body, color: TK.sub }}>{mode === 'buy' ? `한 ${unit} 매수가` : `한 ${unit} 매도가`}{currency === 'USD' ? ' ($)' : ' (원)'}</label>
        <input id="st-px" inputMode="decimal" value={price} onChange={e => { const v = e.target.value.replace(/[\s원$]/g, ''); if (/^[\d,]*\.?\d*$/.test(v)) setPrice(v) }} autoComplete="off" style={{ ...inputStyle, fontSize: FS.lg, fontWeight: 700, border: `1px solid ${TK.sky400}` }} />
        {picked && (
          <span style={note()}>
            {priceState === 'loading' ? '지금 시세를 가져오는 중…'
              : priceState === 'ok' && marketPrice != null ? `지금 시세 ${money(marketPrice, currency)}를 미리 넣어 뒀어요. 증권사에서 실제로 체결된 가격이 다르면 고쳐 주세요.`
              : '지금 시세를 못 가져왔어요. 증권사에서 체결된 가격을 적어 주세요.'}
          </span>
        )}
        {farFromMarket && marketPrice != null && <span style={note(TK.amber400)}>지금 시세({money(marketPrice, currency)})와 3배 넘게 달라요 — 한 {unit} 가격이 맞는지 확인해 보세요.</span>}
        <label htmlFor="st-date" style={{ fontSize: FS.body, color: TK.sub }}>날짜</label>
        {today
          ? <input id="st-date" type="date" value={date} min={MIN_DATE} max={today} onChange={e => setDate(e.target.value)} style={inputStyle} />
          : <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: TK.sub }}>…</div>}
        {role && (
          <span style={{ fontSize: FS.body, color: TK.slate200 }}>
            분류: <b style={{ color: role === 'CORE' ? TK.sky400 : TK.orange400 }}>{role === 'CORE' ? '코어' : '위성'}</b>{' '}
            <span style={note()}>{existing ? '이미 가진 종목이라 원래 분류' : '종목 종류로 자동 분류'}</span>
          </span>
        )}
      </section>

      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SP.sm, padding: SP.lg, background: TK.card, border: `1px solid ${TK.line1}`, borderRadius: RAD.md }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={note()}>{mode === 'buy' ? '총 매수 금액' : '총 매도 금액'}</span>
          <span style={note()}>{total > 0 ? `${money(priceNum, currency)} × ${qtyNum.toLocaleString('ko-KR', { maximumFractionDigits: 8 })}${unit}` : '가격과 수량을 적으면 계산돼요'}</span>
        </div>
        <span style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{total > 0 ? money(total, currency) : '—'}</span>
      </section>

      <div aria-live="polite">
        {error
          ? <p role="alert" style={{ margin: 0, fontSize: FS.tiny, color: TK.amber400 }}>{error}</p>
          : problem && <p style={{ margin: 0, fontSize: FS.tiny, color: marketClash || (mode === 'sell' && existing && qtyNum > existing.quantity) ? TK.amber400 : TK.sub }}>{problem}</p>}
      </div>
      {locked
        // 부분 기록 — 다시 저장하면 거래가 두 번 적힌다. 내 자산으로만 보낸다
        ? <Link href="/s/assets" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: RAD.md, border: `1px solid ${TK.line1}`, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, textDecoration: 'none' }}>내 자산으로</Link>
        : <button type="button" onClick={save} disabled={saving || !!problem}
            style={{ height: 56, borderRadius: RAD.md, border: 'none', background: TK.blue600, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, opacity: saving || problem ? 0.5 : 1, cursor: saving || problem ? 'default' : 'pointer' }}>
            {saving ? '저장하는 중…' : mode === 'buy' ? '매수 기록 저장' : '매도 기록 저장'}
          </button>}
    </div>
  )
}
