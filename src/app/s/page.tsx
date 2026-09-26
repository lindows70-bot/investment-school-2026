'use client'
// 학생 홈 — 인사·검색·바로가기·내 자산 한 줄·한눈 시황·지수(미니 선)·요즘 강한 분야 3·공포탐욕(1년)·환율·일정·뉴스·거장·리그. 카드마다 따로 불러와 하나가 느려도 나머지는 뜬다
//   강한 분야·공포탐욕 1년·환율은 시장 화면과 같은 /api/market-board/overview 를 **한 번** 불러 나눠 쓴다(그 카드들이 화면에 들어올 때). 자세한 건 시장 화면(/s/market)
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import type { OverviewResp } from '@/lib/marketScreen'
import { useKstToday, type IndexRow, type CalendarResp, type FxResp, type MacroResp } from '@/app/components/student/home/homeUi'
import Greeting from '@/app/components/student/home/Greeting'
import HomeSearch from '@/app/components/student/home/HomeSearch'
import Shortcuts from '@/app/components/student/home/Shortcuts'
import MyAssetsLine from '@/app/components/student/home/MyAssetsLine'
import MarketBrief from '@/app/components/student/home/MarketBrief'
import IndexCards from '@/app/components/student/home/IndexCards'
import FearGreed from '@/app/components/student/home/FearGreed'
import UpcomingEvents from '@/app/components/student/home/UpcomingEvents'
import MyNews from '@/app/components/student/home/MyNews'
import GuruCard from '@/app/components/student/home/GuruCard'
import LeagueLine from '@/app/components/student/home/LeagueLine'
import StrongSectorsMini from '@/app/components/student/home/StrongSectorsMini'
import FxMini from '@/app/components/student/home/FxMini'

/** 로그인한 나 — id(리그 순위)·이름(인사). undefined = 아직 모름 */
function useMe() {
  const [me, setMe] = useState<{ id: string | null; name: string | null } | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (!cancelled) setMe({ id: null, name: null }); return }
      const { data, error } = await sb.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const name = !error && typeof data?.full_name === 'string' && data.full_name.trim() ? data.full_name.trim() : null
      if (!cancelled) setMe({ id: user.id, name })
    })().catch(() => { if (!cancelled) setMe({ id: null, name: null }) })
    return () => { cancelled = true }
  }, [])
  return me
}

export default function StudentHome() {
  const me = useMe()
  const today = useKstToday()   // 마운트 뒤에만 정해지고 자정에 넘어간다 — 한눈 시황·주요 일정이 같은 '오늘'을 본다
  // 두 카드가 함께 쓰는 원천은 여기서 한 번만 부른다(일정 원천은 콜드 20초대 — 두 번 부르면 서버가 두 번 계산한다)
  const indices = useJson<IndexRow[]>('/api/market-indices')
  const calendar = useJson<CalendarResp>('/api/event-calendar')
  const fx = useJson<FxResp>('/api/exchange-rate')   // 내 자산 한 줄(useMyPortfolio)은 자기 조회를 쓰되 같은 규칙(고정 상수 거부)
  const macro = useJson<MacroResp>('/api/macro-releases')   // 미국 CPI·고용·PCE 발표일(FRED 공식 일정) — 한눈 시황·주요 일정이 함께 쓴다
  const [ovRef, ovSeen] = useInView<HTMLDivElement>()
  const overview = useJson<OverviewResp>('/api/market-board/overview', { enabled: ovSeen })   // 강한 분야·공포탐욕 1년·환율이 함께 쓴다

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      {/* 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다 */}
      <style>{`
        .sh-idx-grid { grid-template-columns: minmax(0, 1fr) }
        .sh-idx { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center }
        .sh-spark { height: 32px; min-width: 0 }
        .sh-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
        @media (min-width: 769px) {
          .sh-idx-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }
          .sh-idx { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start }
          .sh-spark { order: 3; height: 40px }
          .sh-idx-v { justify-content: flex-start !important }
          .sh-two { grid-template-columns: repeat(2, minmax(0, 1fr)) }
        }
      `}</style>
      <Greeting name={me === undefined ? undefined : me.name} />
      <HomeSearch />
      <Shortcuts />
      <MyAssetsLine />
      <MarketBrief indices={indices} calendar={calendar} fx={fx} macro={macro} today={today} />
      <IndexCards indices={indices} />
      <div ref={ovRef} style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
        <div className="sh-two">
          <StrongSectorsMini overview={overview} />
          <FearGreed overview={overview} />
        </div>
        <div className="sh-two">
          <FxMini overview={overview} />
          <UpcomingEvents calendar={calendar} macro={macro} today={today} />
        </div>
      </div>
      <MyNews />
      <GuruCard />
      <LeagueLine userId={me === undefined ? undefined : me.id} />
    </div>
  )
}
