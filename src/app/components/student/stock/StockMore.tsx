'use client'
// 종목 상세 '더 알아보기'(접이식) — PER·PEG·시가총액·52주 위치·업종·배당수익률. 분석 화면으로 나가던 '이 종목 더 깊이 보기'(/research)를 대신한다(간편 화면 5단계-4)
//   원천 = /api/stock-info — PER·PEG 의 SSOT(분석 화면·canon-fund 캐시와 같은 라우트라 전 화면 같은 값, docs/reference/data-model.md).
//   열 때만 부른다(닫힌 채로는 요청 0). 값이 'N/A'·null 이면 '없음'이 아니라 '모름'. ETF·코인은 있는 칸만.
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { eok, usdBig, money } from '@/lib/studentFormat'
import { sectorKo } from '@/lib/sectorNames'

interface Fund { pe?: unknown; peg?: unknown; marketCap?: unknown; high52w?: unknown; low52w?: unknown; sector?: unknown; dividendYield?: unknown; earningsGrowth?: unknown; growthSource?: unknown; isEtf?: unknown }
interface Info { currency?: unknown; fundamentals?: Fund; source?: unknown; error?: unknown }
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const GROWTH_KO: Record<string, string> = { eps: '이익', revenue: '매출', 'fwd-eps': '예상이익' }

function Box({ label, value, note, wide }: { label: string; value: string; note: string; wide?: boolean }) {
  const unknown = value === '모름'
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 2, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3, minWidth: 0 }}>
      <span style={{ fontSize: FS.micro, color: TK.sub }}>{label}</span>
      <span style={{ fontSize: FS.lg, fontWeight: 700, color: unknown ? TK.sub : TK.slate100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <span style={{ fontSize: FS.micro, lineHeight: 1.5, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{note}</span>
    </div>
  )
}

export default function StockMore({ ticker, market, price, currency }: { ticker: string; market: 'KR' | 'US' | 'CRYPTO'; price: number | null; currency: 'USD' | 'KRW' }) {
  const [open, setOpen] = useState(false)
  const r = useJson<Info>(open ? `/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${market}` : null)
  const f = r.state === 'ok' && r.data && !r.data.error ? r.data.fundamentals ?? null : null
  const pe = f ? num(f.pe) : null
  const peg = f ? num(f.peg) : null
  const mc = f ? num(f.marketCap) : null
  const hi = f ? num(f.high52w) : null, lo = f ? num(f.low52w) : null
  const dy = f ? num(f.dividendYield) : null
  const g = f ? num(f.earningsGrowth) : null
  const gSrc = f && typeof f.growthSource === 'string' ? GROWTH_KO[f.growthSource] ?? null : null
  const sector = f ? sectorKo(typeof f.sector === 'string' ? f.sector : null) : null
  const isEtf = f?.isEtf === true
  const crypto = market === 'CRYPTO'
  // 52주 위치 — 지금 가격이 최저~최고 사이 어디(0% = 최저, 100% = 최고). 같은 통화의 세 값이 있을 때만
  const pos = price != null && hi != null && lo != null && hi > lo ? Math.max(0, Math.min(100, ((price - lo) / (hi - lo)) * 100)) : null

  return (
    <details onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)} style={{ border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: `0 ${SP.lg}px` }}>
      {/* 폰은 두 칸, 769px↑ 는 세 칸 — 기본값 + min-width 하나(정확한 여집합) */}
      <style>{`.sm-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${SP.sm}px } @media (min-width: 769px) { .sm-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) } } details > summary::-webkit-details-marker { display: none }`}</style>
      {/* 제목은 한 줄 고정, 설명은 아랫줄 — 옆에 두면 폰(375px)에서 제목이 '더 알아보 / 기'로 깨졌다(2026-09-29 실측) */}
      <summary style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minHeight: 52, padding: `${SP.sm}px 0`, cursor: 'pointer', listStyle: 'none' }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>더 알아보기 ›</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>{crypto ? '거래 정보' : 'PER · PEG · 시가총액 · 52주 위치 · 업종 · 배당'}</span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, paddingBottom: SP.lg }}>
        {(r.state === 'idle' || r.state === 'loading') && <span style={noteStyle()}>종목 정보를 불러오는 중…</span>}
        {(r.state === 'failed' || r.state === 'unauth' || (r.state === 'ok' && !f)) && <FailRow text="종목 정보를 못 가져왔어요." onRetry={r.reload} retryLabel="종목 정보 다시 불러오기" />}
        {f && (
          <>
            <div className="sm-grid">
              {!crypto && !isEtf && <Box label="PER" value={pe != null && pe > 0 ? `${pe.toFixed(1)}배` : '모름'} note="주가가 최근 확정 이익의 몇 배인지 — 높을수록 이익에 비해 비싸게 사는 거예요" />}
              {!crypto && !isEtf && <Box label="PEG" value={peg != null && peg > 0 ? peg.toFixed(2) : '모름'} note={`PER ÷ ${gSrc ?? '이익'} 성장률${g != null ? `(${(g * 100).toFixed(1)}%)` : ''} — 1보다 낮으면 성장에 비해 싼 편이라고 봐요(피터 린치의 잣대)`} />}
              {!crypto && <Box label="시가총액" value={mc != null && mc > 0 ? (currency === 'KRW' ? eok(mc / 1e8) : usdBig(mc)) : '모름'} note="주가 × 주식 수 — 이 회사 전체를 사려면 드는 돈이에요" />}
              {!crypto && !isEtf && <Box label="업종" value={sector ?? '모름'} note="같은 업종끼리 PER 을 견주면 비싼지 싼지 가늠하기 쉬워요" />}
              {!crypto && <Box label="배당수익률" value={dy != null ? `${(dy * 100).toFixed(2)}%` : '모름'} note="1년 배당금 ÷ 주가 — 최근 배당을 1년치로 잡은 값이라 배당이 막 오른 종목은 지난 1년 실제보다 높게 나와요" />}
            </div>
            {!crypto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3 }}>
                <span style={{ fontSize: FS.micro, color: TK.sub }}>52주 위치</span>
                {pos != null && hi != null && lo != null ? (
                  <>
                    <div aria-hidden style={{ position: 'relative', height: 8, borderRadius: RAD.pill, background: TK.bg7 }}>
                      <span style={{ position: 'absolute', left: `calc(${pos}% - 6px)`, top: -2, width: 12, height: 12, borderRadius: RAD.pill, background: TK.slate100 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SP.sm, fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>
                      <span>최저 {money(lo, currency)}</span><span>최고 {money(hi, currency)}</span>
                    </div>
                    <span style={{ fontSize: FS.tiny, color: TK.slate200, wordBreak: 'keep-all' }}>지금 가격은 1년 최저~최고 사이의 {Math.round(pos)}% 지점이에요(0% = 최저, 100% = 최고).</span>
                  </>
                ) : <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.sub }}>모름</span>}
              </div>
            )}
            <span style={noteStyle()}>
              {crypto ? '코인은 이익·배당이 없어 PER·PEG·배당을 잴 수 없어요. ' : ''}
              {isEtf ? 'ETF 는 여러 종목 묶음이라 PER·PEG·업종을 한 숫자로 말하지 않아요. ' : ''}
              국내 = 네이버 · 해외 = 네이버/야후{typeof r.data?.source === 'string' && r.data.source === 'cache' ? ' · 조회가 안 돼서 마지막으로 받은 값이에요' : ''} · 분석 화면과 같은 값이에요
            </span>
          </>
        )}
      </div>
    </details>
  )
}
