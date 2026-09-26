'use client'
// 시장 화면 '외국인·기관은 무엇을 샀나' — 외국인/기관 × 순매수/순매도 × 시장(합침·코스피·코스닥) 상위 5 + 며칠째·함께·주가와 반대·ETF·내 종목 배지
//   원천 = /api/market-board/flow(네이버 KRX 순위 + 종목별 일별 추이). 화면에 들어올 때 부른다. 개인 순위는 원천이 없어 그 사실을 적는다.
//   ⛔ 관찰일 뿐 — 따라 사라는 권유 문구를 쓰지 않는다. '내 종목'은 브라우저에서만 겹친다(useMyTickers).
import { useState } from 'react'
import { TK, SP } from '@/lib/theme'
import { pct, upDown, eok } from '@/lib/studentFormat'
import { viewOf, mdDow, flowBadges, mergeFlowTop, holdingKey, type FlowBoardResp, type FlowSide, type FlowBadgeKey, type View } from '@/lib/marketScreen'
import type { FlowBoardSide, FlowTopRow, Investor } from '@/lib/foreignOrgFlow'
import type { KrMarket } from '@/lib/krMarketBoard'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { card, CardHead, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, StockRow, HelpButton, HelpBox, type BadgeTone } from './marketUi'
import { useMyTickers } from './useMyTickers'

type Who = Investor | 'PERSONAL'
type Mk = 'ALL' | KrMarket
const TOP = 5
const WHO_NAME: Record<Who, string> = { FOREIGNER: '외국인', ORGANIZATION: '기관', PERSONAL: '개인' }
const MK_NAME: Record<KrMarket, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const SIDE_NAME: Record<FlowSide, string> = { buy: '순매수', sell: '순매도' }
const TONE: Record<FlowBadgeKey, BadgeTone> = { mine: 'mine', streak: 'plain', together: 'plain', contrarian: 'warn', etf: 'plain', limit: 'warn' }
const HELP = [
  '순매수 = 산 돈이 판 돈보다 많아요. 순매도 = 판 돈이 더 많아요.',
  'N일째 = 마지막 거래일까지 며칠 연속 같은 쪽(사거나 팔거나)이었는지예요. 2일째부터 보여요.',
  '함께 샀어요·함께 팔았어요 = 그날 외국인과 기관이 둘 다 같은 쪽이었어요.',
  '주가와 반대 = 주가가 내린 날 샀거나, 오른 날 팔았어요.',
  'ETF = 여러 종목을 한데 묶은 상품이에요.',
  '±30% 넘음 = 하루에 30% 넘게 움직였어요 — 상장 첫날·거래 재개 같은 특별한 날에만 나와요.',
  '내 종목 = 내가 가진 종목이에요(이 표시는 내 화면에서만 보여요).',
  '금액은 한국거래소(KRX) 거래만 셌어요 — 넥스트레이드(NXT) 거래는 빠져요.',
]

type SideView = View<{ bizdate: string | null } & FlowBoardSide>

export default function FlowCard() {
  const [ref, seen] = useInView<HTMLElement>()
  const flow = useJson<FlowBoardResp>('/api/market-board/flow', { enabled: seen })
  const mine = useMyTickers(seen)
  const [who, setWho] = useState<Who>('FOREIGNER')
  const [side, setSide] = useState<FlowSide>('buy')
  const [mk, setMk] = useState<Mk>('ALL')
  const [help, setHelp] = useState(false)

  const inv: Investor = who === 'PERSONAL' ? 'FOREIGNER' : who
  const views: Record<KrMarket, SideView> = {
    KOSPI: viewOf(flow, d => d.markets.KOSPI[inv]),
    KOSDAQ: viewOf(flow, d => d.markets.KOSDAQ[inv]),
  }
  const shownMarkets: KrMarket[] = mk === 'ALL' ? ['KOSPI', 'KOSDAQ'] : [mk]
  const merged = mergeFlowTop<FlowTopRow>(shownMarkets.map(m => ({ market: m, rows: views[m].kind === 'ok' ? (views[m] as Extract<SideView, { kind: 'ok' }>).data[side] : null })), TOP)
  const anyLoading = shownMarkets.some(m => views[m].kind === 'loading')
  const allFailed = merged.missing.length === shownMarkets.length
  const okView = shownMarkets.map(m => views[m]).find((v): v is Extract<SideView, { kind: 'ok' }> => v.kind === 'ok')
  const bizdate = okView?.data.bizdate ?? null
  const estimated = merged.rows.some(r => r.estimated)
  const trendsFailed = flow.state === 'ok' && flow.data?.trends?.ok === false
  const scope = mk === 'ALL' ? '코스피·코스닥을 합친' : MK_NAME[mk]

  let body: React.ReactNode
  if (who === 'PERSONAL') {
    body = (
      <span style={noteStyle(TK.slate300)}>
        개인이 어떤 종목을 사고 팔았는지 순위는 네이버가 주지 않아요. 개인 전체 금액은 위 &lsquo;누가 사고 팔았나&rsquo;에서 볼 수 있어요.
      </span>
    )
  } else if (anyLoading) {
    body = <span style={noteStyle()}>순매매 목록을 불러오는 중…</span>
  } else if (allFailed) {
    body = <FailRow text={`${WHO_NAME[who]} ${SIDE_NAME[side]} 목록을 못 가져왔어요.`} onRetry={flow.reload} retryLabel="순매매 목록 다시 불러오기" />
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {merged.missing.length > 0 && (
          <FailRow text={`${merged.missing.map(m => MK_NAME[m]).join('·')} 목록은 못 가져와 나머지 시장만 봤어요.`} onRetry={flow.reload} retryLabel="순매매 목록 다시 불러오기" />
        )}
        {merged.rows.length === 0
          ? <span style={noteStyle()}>{WHO_NAME[who]} {SIDE_NAME[side]} 목록이 비어 있어요(네이버).</span>
          : merged.rows.map((r, i) => (
            <StockRow key={`${r.market}-${r.code}`} rank={i + 1}
              href={`/s/stock/${encodeURIComponent(r.code)}?m=KR&n=${encodeURIComponent(r.name)}`}
              name={r.name} tag={mk === 'ALL' ? MK_NAME[r.market] : null}
              badges={flowBadges(r, side, inv, mine?.has(holdingKey('KR', r.code)) ?? false).map(b => ({ text: b.text, tone: TONE[b.key] }))}
              main={eok(Math.abs(r.netEok))}
              sub={r.changePct == null ? '주가 등락 모름' : `주가 ${pct(r.changePct)}`} subColor={upDown(r.changePct)} />
          ))}
      </div>
    )
  }

  return (
    <section ref={ref} aria-label="외국인·기관은 무엇을 샀나" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="외국인·기관은 무엇을 샀나" extra={<HelpButton open={help} onToggle={() => setHelp(h => !h)} label="배지 뜻 보기" />} />
      {help && <HelpBox lines={HELP} />}
      <ChipRow label="누가" value={who} onChange={setWho}
        options={[{ key: 'FOREIGNER', label: '외국인' }, { key: 'ORGANIZATION', label: '기관' }, { key: 'PERSONAL', label: '개인', dim: true }]} />
      {who !== 'PERSONAL' && (
        <>
          <ChipRow label="샀나 팔았나" value={side} onChange={setSide} options={[{ key: 'buy', label: '순매수' }, { key: 'sell', label: '순매도' }]} />
          <ChipRow label="시장" value={mk} onChange={setMk}
            options={[{ key: 'ALL', label: '코스피+코스닥' }, { key: 'KOSPI', label: '코스피' }, { key: 'KOSDAQ', label: '코스닥' }]} />
        </>
      )}
      <div aria-live="polite">{body}</div>
      {who !== 'PERSONAL' && !anyLoading && !allFailed && (
        <>
          <span style={noteStyle()}>
            {[`${scope} ${WHO_NAME[who]} ${SIDE_NAME[side]} 금액 상위 ${TOP}`, bizdate ? mdDow(bizdate) : null, 'KRX 기준 · 네이버'].filter(Boolean).join(' · ')}
          </span>
          {estimated && <span style={noteStyle()}>장 중 잠정 숫자예요 — 장이 끝난 뒤 바뀔 수 있어요.</span>}
          {trendsFailed && <span style={noteStyle(TK.amber400)}>몇몇 종목은 며칠째·함께 여부를 못 셌어요(그 배지만 빠졌어요).</span>}
        </>
      )}
      <span style={noteStyle(TK.slate300)}>누가 샀는지는 지켜본 사실일 뿐이에요 — 따라 사라는 뜻이 아니에요.</span>
    </section>
  )
}
