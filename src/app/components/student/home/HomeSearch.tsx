'use client'
// 학생 홈 검색창 — 종목 이름으로 찾아 종목 상세(/s/stock/{티커}?m=시장)로 간다. 기록하기 화면과 같은 규칙(300ms 멈춤·옛 응답 버림·실패/없음 구분)
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { SearchResult } from '@/lib/stockSearch'
import { money, pct, upDown } from '@/lib/studentFormat'
import { noteStyle, retryBtn } from './homeUi'

type SearchState = 'idle' | 'loading' | 'done' | 'failed'
const marketLabel = (r: SearchResult) => r.market === 'CRYPTO' ? '코인' : r.exchange || (r.market === 'KR' ? '한국' : '미국')
/** 결과 줄에 바로 보이는 시세 — 지금 가격·오늘 등락. null = 못 가져옴(가격을 지어내지 않는다) */
type Quote = { price: number; changePct: number | null } | null
interface PriceRow { ticker?: unknown; currentPrice?: unknown; changePct?: unknown; error?: unknown }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const QUOTE_MAX = 5   // 결과 중 앞 5개만 시세를 붙인다(한 번에 너무 많이 부르지 않게)

export default function HomeSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {   // 300ms 멈추면 부른다. 늦게 온 옛 응답은 버린다
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
  }, [q, tick])

  // 결과가 오면 앞 QUOTE_MAX 개의 시세를 바로 붙인다(2026-10-10 사용자: "종목을 치면 정보가 간략하게라도 나와야" — 전엔 이름 한 줄뿐이라 눌러야 하는지도 몰랐다)
  //   늦게 온 옛 응답은 버린다 · 실패는 '—' 로(없는 값을 0 으로 보이지 않게)
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  useEffect(() => {
    const head = results.slice(0, QUOTE_MAX)
    if (head.length === 0) { setQuotes({}); return }
    const ctrl = new AbortController()
    fetch('/api/stock-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(head.map(r => ({ ticker: r.ticker, market: r.market }))), signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((list: unknown) => {
        if (ctrl.signal.aborted) return
        const map: Record<string, Quote> = {}
        for (const r of head) {
          const row = Array.isArray(list) ? (list as PriceRow[]).find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === r.ticker.toUpperCase()) : undefined
          // error 가 붙은 행은 지난 캐시이거나 실패 폴백(가격 0) — 지금 가격이 아니다(홈 지수 카드와 같은 판정)
          map[`${r.market}:${r.ticker}`] = row && !row.error && isNum(row.currentPrice) && row.currentPrice > 0 ? { price: row.currentPrice, changePct: isNum(row.changePct) ? row.changePct : null } : null
        }
        setQuotes(map)
      })
      .catch(() => { if (!ctrl.signal.aborted) setQuotes(Object.fromEntries(head.map(r => [`${r.market}:${r.ticker}`, null]))) })
    return () => ctrl.abort()
  }, [results])

  const cryptoDown = failedSources.includes('crypto'), stocksDown = failedSources.includes('stocks')
  const go = (r: SearchResult) => router.push(`/s/stock/${encodeURIComponent(r.ticker)}?m=${r.market}&n=${encodeURIComponent(r.name)}`)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <input value={q} onChange={e => setQ(e.target.value)} aria-label="종목 찾기" placeholder="종목 찾기 — 삼성, 엔비디아, 비트코인" autoComplete="off"
        style={{ height: 48, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: `0 ${SP.lg}px`, borderRadius: RAD.pill, background: TK.card, border: `1px solid ${TK.border}`, color: TK.slate100, fontSize: FS.body }} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        {searchState === 'loading' && <span style={noteStyle()}>찾는 중…</span>}
        {searchState === 'failed' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
            <span style={noteStyle(TK.amber400)}>
              {results.length === 0
                ? `검색이 잠시 안 돼요${stocksDown && !cryptoDown ? '(주식 검색)' : cryptoDown && !stocksDown ? '(코인 검색)' : ''} — 다시 시도해 주세요.`
                : cryptoDown ? '코인 검색이 잠시 안 돼서 주식만 보여요.' : '주식 검색이 잠시 안 돼서 코인만 보여요.'}
            </span>
            <button type="button" onClick={() => setTick(t => t + 1)} style={retryBtn}>다시 찾기</button>
          </div>
        )}
        {searchState === 'done' && results.length === 0 && <span style={noteStyle()}>찾는 종목이 없어요.</span>}
      </div>
      {searchState !== 'loading' && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          {/* 행 = "이름 · 시장 / 가격 · 등락 ›" — 누르면 종목 상세(가격 흐름·내 보유·기록). 시세는 앞 QUOTE_MAX 개만 */}
          <div style={{ display: 'flex', flexDirection: 'column', background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.lg, overflow: 'hidden' }}>
            {results.map((r, i) => {
              const key = `${r.market}:${r.ticker}`
              const q = i < QUOTE_MAX ? quotes[key] : undefined   // undefined = 아직(또는 안 붙이는 줄) · null = 못 가져옴
              return (
                <button key={key} type="button" onClick={() => go(r)} aria-label={`${r.name} 종목 보기`}
                  style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 56, padding: `${SP.xs}px ${SP.lg}px`, border: 'none', borderTop: i ? `1px solid ${TK.border}` : 'none', background: 'transparent', color: TK.slate100, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: FS.body, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ ...noteStyle(), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{marketLabel(r)} · {r.ticker}</span>
                  </span>
                  {i < QUOTE_MAX && (
                    <span style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {q === undefined
                        ? <span style={noteStyle()}>…</span>
                        : q === null
                          ? <span style={noteStyle()}>시세 못 가져옴</span>
                          : (
                            <>
                              <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{money(q.price, r.currency)}</span>
                              <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(q.changePct), whiteSpace: 'nowrap' }}>{q.changePct == null ? '등락 모름' : `오늘 ${pct(q.changePct)}`}</span>
                            </>
                          )}
                    </span>
                  )}
                  <span aria-hidden style={{ fontSize: FS.lg, color: TK.slate500, flexShrink: 0 }}>›</span>
                </button>
              )
            })}
          </div>
          <span style={noteStyle()}>종목을 누르면 가격 흐름·내 보유·기록하기가 열려요</span>
        </div>
      )}
    </section>
  )
}
