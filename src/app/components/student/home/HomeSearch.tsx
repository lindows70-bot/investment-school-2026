'use client'
// 학생 홈 검색창 — 종목 이름으로 찾아 종목 상세(/s/stock/{티커}?m=시장)로 간다. 기록하기 화면과 같은 규칙(300ms 멈춤·옛 응답 버림·실패/없음 구분)
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { SearchResult } from '@/lib/stockSearch'
import { noteStyle, retryBtn } from './homeUi'

type SearchState = 'idle' | 'loading' | 'done' | 'failed'
const marketLabel = (r: SearchResult) => r.market === 'CRYPTO' ? '코인' : r.exchange || (r.market === 'KR' ? '한국' : '미국')

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

  const cryptoDown = failedSources.includes('crypto'), stocksDown = failedSources.includes('stocks')
  const go = (r: SearchResult) => router.push(`/s/stock/${encodeURIComponent(r.ticker)}?m=${r.market}&n=${encodeURIComponent(r.name)}`)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <input value={q} onChange={e => setQ(e.target.value)} aria-label="종목 찾기" placeholder="종목 찾기 — 삼성, 엔비디아, 비트코인" autoComplete="off"
        style={{ height: 48, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: TK.bg3, border: `1px solid ${TK.border}`, color: TK.slate100, fontSize: FS.body }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.sm, overflow: 'hidden' }}>
          {results.map((r, i) => (
            <button key={`${r.market}:${r.ticker}`} type="button" onClick={() => go(r)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SP.sm, minHeight: 48, padding: `0 ${SP.md}px`, border: 'none', borderTop: i ? `1px solid ${TK.border}` : 'none', background: 'transparent', color: TK.slate100, fontSize: FS.body, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span style={{ ...noteStyle(), flexShrink: 0, whiteSpace: 'nowrap' }}>{marketLabel(r)} · {r.ticker}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
