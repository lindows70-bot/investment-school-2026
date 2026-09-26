'use client'
// 학생 시장 화면(/s/market) — 국내/미국/코인 탭(주소 ?tab=us|coin 로 유지, 국내가 기본). 카드마다 자기 원천 상태(불러오는 중·못 가져옴·없음)를 따로 보인다.
//   한 번 연 탭만 그린다(연 뒤엔 숨겨 둔 채 유지 = 다시 불러오지 않음). 무거운 카드(순매매·아래쪽 요약)는 화면에 들어올 때 부른다.
//   하단 탭 추가·홈 연결은 3단계 — 지금은 주소로만 들어온다.
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { KrBoardResp, OverviewResp } from '@/lib/marketScreen'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { noteStyle } from '@/app/components/student/home/homeUi'
import KrIndexBoard from '@/app/components/student/market/KrIndexBoard'
import FlowCard from '@/app/components/student/market/FlowCard'
import KrMovers from '@/app/components/student/market/KrMovers'
import KrIndustry from '@/app/components/student/market/KrIndustry'
import KrNews from '@/app/components/student/market/KrNews'
import StrongSectors from '@/app/components/student/market/StrongSectors'

type Tab = 'kr' | 'us' | 'coin'
const TABS: { key: Tab; label: string }[] = [{ key: 'kr', label: '국내' }, { key: 'us', label: '미국' }, { key: 'coin', label: '코인' }]
const parseTab = (v: string | null): Tab => (v === 'us' || v === 'coin' ? v : 'kr')

// 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다
const CSS = `
  .mk-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
  .mk-idx-v { font-size: ${FS.body}px }
  @media (min-width: 769px) {
    .mk-two { grid-template-columns: repeat(2, minmax(0, 1fr)) }
    .mk-idx-v { font-size: ${FS.lg}px }
  }
`

export default function StudentMarket() {
  // useSearchParams 는 Suspense 경계 안에서만 정적 생성이 된다(Next 14)
  return (
    <Suspense fallback={<p style={noteStyle()}>불러오는 중이에요…</p>}>
      <MarketScreen />
    </Suspense>
  )
}

function MarketScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const tab = parseTab(params.get('tab'))
  const [opened, setOpened] = useState<Tab[]>([tab])
  useEffect(() => { setOpened(p => (p.includes(tab) ? p : [...p, tab])) }, [tab])
  const pick = (t: Tab) => router.replace(t === 'kr' ? '/s/market' : `/s/market?tab=${t}`, { scroll: false })

  // 요즘 강한 분야(국내)와 아래 요약 카드가 같은 응답을 쓴다 — 둘 중 하나가 화면에 들어오면 한 번 부른다
  const [ovRefA, seenA] = useInView<HTMLElement>()
  const overview = useJson<OverviewResp>('/api/market-board/overview', { enabled: seenA })

  const panel = (t: Tab) => ({ display: tab === t ? 'flex' : 'none', flexDirection: 'column', gap: SP.lg } as const)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      <style>{CSS}</style>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>시장</h1>
      <div role="group" aria-label="시장 종류" style={{ display: 'flex', gap: SP.xs, padding: SP.xs, borderRadius: RAD.md, background: TK.bg3 }}>
        {TABS.map(t => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => pick(t.key)}
            style={{ height: 44, flex: 1, borderRadius: RAD.sm, border: 'none', background: tab === t.key ? TK.bg7 : 'transparent', color: tab === t.key ? TK.slate100 : TK.sub, fontSize: FS.body, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {opened.includes('kr') && <div style={panel('kr')}><KrPanel overview={overview} ovRef={ovRefA} /></div>}
    </div>
  )
}

function KrPanel({ overview, ovRef }: { overview: JsonResult<OverviewResp>; ovRef: (el: HTMLElement | null) => void }) {
  const kr = useJson<KrBoardResp>('/api/market-board/kr')   // 지수·투자자별·등락 수·특징종목·업종·뉴스를 한 응답으로(첫 화면이라 바로)
  return (
    <>
      <KrIndexBoard kr={kr} />
      <FlowCard />
      <div className="mk-two">
        <KrMovers kr={kr} />
        <KrIndustry kr={kr} />
      </div>
      <div className="mk-two">
        <StrongSectors overview={overview} inViewRef={ovRef} />
        <KrNews kr={kr} />
      </div>
    </>
  )
}
