'use client'
// 학생 홈 시장 카드 — 코스피 · 코스닥 · S&P 500 · 나스닥 · 금 · 은(market-indices?metals=1) · 비트코인(stock-price 업비트 원화)을 가로로 넘기는 카드 한 줄(2026-10-12 "더리치 메인처럼" · 10/13 금·은 추가 · 10/16 코스피·코스닥 카드에 개인·외국인·기관 순매매).
//   카드마다 이름 칩 · 값 · 등락 · 흐름선(점선 = 전날 종가) · 한 줄 설명. 폰은 카드 하나 + 다음 카드 끝이 살짝(78%), 769px↑ 는 260px 씩.
//   차트는 이미 받는 응답을 쓴다(새 요청 없음): 지수 = market-indices 의 장중 chartData(코스피·코스닥은 네이버 분봉), 비트코인 = stock-price 의 1D(지난 24시간 1시간봉).
//   점선 = 전날 종가(값 − 등락). 비트코인은 등락 기준(오전 9시)과 선의 시작(24시간 전)이 달라 기준선을 긋지 않고,
//   선 색도 등락색이 아니라 중립색이다(등락률은 올랐는데 24시간 선은 내려가는 모양일 수 있다).
//   한 줄 설명은 데이터에서만 나온다(전날 종가 값 · 기간) — 시황 해설을 지어내지 않는다(출처 없는 수치 금지).
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { won, usd, pct, upDown, points, signEok } from '@/lib/studentFormat'
import { sparkSeries, kstParts, mdDow } from '@/lib/marketScreen'
import { LinePlot } from '@/app/components/student/market/marketUi'
import { Chip } from '@/app/components/student/ui'
import { card, noteStyle, retryBtn, type IndexRow } from './homeUi'

type Spark = { t: number; v: number }[] | null
/** lineColor = 선 색 — 지수는 등락색(선과 등락의 기준이 같은 전날 종가), 비트코인은 중립색. note = 카드 아래 한 줄(데이터에서만) */
/** investors = 코스피·코스닥만(오늘 개인·외국인·기관 순매매 · 억원 · KRX 기준). 셋 다 숫자일 때만 싣는다 — 하나라도 없으면 줄 자체를 안 그린다(0 으로 안 채움) */
type Investors = { bizdate: string | null; personal: number; foreign: number; institutional: number }
type Cell = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; value: string; changePct: number; spark: Spark; baseline: number | null; lineColor: string; vFmt: (v: number) => string; note: string; investors?: Investors }
function readInvestors(x: unknown): Investors | undefined {
  const i = x as { bizdate?: unknown; personal?: unknown; foreign?: unknown; institutional?: unknown } | null | undefined
  return i && isNum(i.personal) && isNum(i.foreign) && isNum(i.institutional)
    ? { bizdate: typeof i.bizdate === 'string' ? i.bizdate : null, personal: i.personal, foreign: i.foreign, institutional: i.institutional }
    : undefined
}
interface PriceRow { ticker?: unknown; currentPrice?: unknown; changePct?: unknown; error?: unknown; charts?: { '1D'?: unknown } }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const BTC_BODY = [{ ticker: 'BTC', market: 'CRYPTO' }]
const hm = (t: number) => kstParts(t).hm

/** region = 카드 머리 칩(국내 · 미국 · 코인) — 국기는 쓰지 않는다(지수엔 티커 접미사가 없어 flagOf SSOT 를 못 탄다) */
function MarketCard({ label, region, cell, onRetry }: { label: string; region: string; cell: Cell; onRetry: () => void }) {
  const sp = cell.kind === 'ok' ? cell.spark : null
  return (
    <div className="sh-mcard" style={{ ...card, padding: `${SP.md}px ${SP.lg}px`, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{label}</span>
        <Chip text={region} />
      </span>
      {cell.kind === 'loading' && <span style={noteStyle()}>불러오는 중…</span>}
      {cell.kind === 'failed' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
          <span style={noteStyle(TK.amber400)}>못 가져옴</span>
          <button type="button" onClick={onRetry} aria-label={`${label} 다시 불러오기`} style={retryBtn}>다시</button>
        </span>
      )}
      {cell.kind === 'ok' && (
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm, minWidth: 0 }}>
          <span style={{ fontSize: FS.xl, fontWeight: 800, letterSpacing: '-0.03em', color: TK.slate100, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{cell.value}</span>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(cell.changePct), whiteSpace: 'nowrap' }}>{pct(cell.changePct)}</span>
        </span>
      )}
      {/* 차트 — 못 그리면(점 부족·가짜 평평선) 빈 자리. 값은 위 글자가 말하므로 접근성 층은 끈다. 축 눈금 없는 흐름선만(값은 글자가 말한다) */}
      <div className="sh-spark" aria-hidden>
        {cell.kind === 'ok' && sp && sp.length >= 2 && (
          <LinePlot points={sp} color={cell.lineColor} baseline={cell.baseline} tFmt={hm} vFmt={cell.vFmt} a11y={false} area endDot />
        )}
      </div>
      <span style={{ ...noteStyle(), minHeight: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.kind === 'ok' ? cell.note : ' '}</span>
      {cell.kind === 'ok' && cell.investors && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}>
          {/* 수급 3칸(2026-10-16 사용자 "코스피 카드에 개인·외인·기관 수급도") — 시장 화면 KrIndexBoard 와 같은 원천·같은 단위(억원). + 는 산 돈이 더 많음. 색은 등락색 규약(＋빨강·−파랑) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SP.sm }}>
            {([['개인', cell.investors.personal], ['외국인', cell.investors.foreign], ['기관', cell.investors.institutional]] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>{k}</span>
                <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(v), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{signEok(v)}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>순매매 · 억원 · KRX 기준{cell.investors.bizdate ? ` · ${mdDow(cell.investors.bizdate) ?? cell.investors.bizdate}` : ''}</span>
        </div>
      )}
    </div>
  )
}

export default function IndexCards({ indices }: { indices: JsonResult<IndexRow[]> }) {
  const btc = useJson<PriceRow[]>('/api/stock-price', { method: 'POST', body: BTC_BODY })

  /** fmt = 값 표기(지수는 소수 둘째 자리 점수, 금·은은 달러) · session = 한 줄 설명의 기간 말(지수 '오늘 장중' · 선물 '하루 거래') */
  const indexCell = (id: string, fmt: (v: number) => string = points, session = '오늘 장중', baseName = '전날 종가'): Cell => {
    if (indices.state === 'loading' || indices.state === 'idle') return { kind: 'loading' }
    const row = indices.state === 'ok' && Array.isArray(indices.data) ? indices.data.find(x => x?.id === id) : undefined
    if (!(row && isNum(row.value) && row.value > 0 && isNum(row.changePct))) return { kind: 'failed' }
    const baseline = isNum(row.change) ? row.value - row.change : null
    return {
      kind: 'ok', value: fmt(row.value), changePct: row.changePct, vFmt: fmt, lineColor: upDown(row.changePct),
      spark: sparkSeries(row.chartData), baseline,
      note: baseline != null ? `${session} · 점선 = ${baseName} ${fmt(baseline)}` : session,
      investors: readInvestors(row.investors),
    }
  }
  // 금·은 = COMEX 근월 선물(야후 GC=F·SI=F) · 달러/트로이온스 · 세션이 한국 13:00→다음날 12:59 라 '오늘 장중'이 아니라 '하루 거래' · 점선 = 전 거래일 정산가
  const metalCell = (id: string) => indexCell(id, usd, '달러/온스 선물', '전 거래일')
  const btcCell = ((): Cell => {
    if (btc.state === 'loading' || btc.state === 'idle') return { kind: 'loading' }
    const row = btc.state === 'ok' && Array.isArray(btc.data) ? btc.data.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === 'BTC') : undefined
    // error 가 붙은 행은 지난 캐시 시세이거나 실패 폴백(가격 0) — 지금 가격이 아니다
    if (!(row && !row.error && isNum(row.currentPrice) && row.currentPrice > 0 && isNum(row.changePct))) return { kind: 'failed' }
    return { kind: 'ok', value: won(row.currentPrice), changePct: row.changePct, vFmt: won, spark: sparkSeries(row.charts?.['1D']), baseline: null, lineColor: TK.slate300, note: '지난 24시간 · 업비트 원화 · 등락은 오전 9시 기준' }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <section aria-label="주요 지수" className="sh-row sh-bleed" style={{ gap: SP.sm }}>
        <MarketCard label="코스피" region="국내" cell={indexCell('kospi')} onRetry={indices.reload} />
        <MarketCard label="코스닥" region="국내" cell={indexCell('kosdaq')} onRetry={indices.reload} />
        <MarketCard label="S&P 500" region="미국" cell={indexCell('sp500')} onRetry={indices.reload} />
        <MarketCard label="나스닥" region="미국" cell={indexCell('nasdaq')} onRetry={indices.reload} />
        <MarketCard label="비트코인" region="코인" cell={btcCell} onRetry={btc.reload} />
        <MarketCard label="금" region="원자재" cell={metalCell('gold')} onRetry={indices.reload} />
        <MarketCard label="은" region="원자재" cell={metalCell('silver')} onRetry={indices.reload} />
      </section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <span style={noteStyle()}>옆으로 넘겨 더 보기</span>
        <Link href="/s/market" style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: `0 ${SP.xs}px`, fontSize: FS.tiny, color: TK.sub, textDecoration: 'none', whiteSpace: 'nowrap' }}>시장 더 보기 ›</Link>
      </div>
    </div>
  )
}
