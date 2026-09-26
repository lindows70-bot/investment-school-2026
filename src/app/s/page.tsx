'use client'
// 학생 홈 — 인사·검색·바로가기·내 자산 한 줄·한눈 시황·지수·공포탐욕·일정·뉴스·거장·리그. 카드마다 따로 불러와 하나가 느려도 나머지는 뜬다
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import type { IndexRow, CalendarResp } from '@/app/components/student/home/homeUi'
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
  // 두 카드가 함께 쓰는 원천은 여기서 한 번만 부른다(일정 원천은 콜드 20초대 — 두 번 부르면 서버가 두 번 계산한다)
  const indices = useJson<IndexRow[]>('/api/market-indices')
  const calendar = useJson<CalendarResp>('/api/event-calendar')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      {/* 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다 */}
      <style>{`
        .sh-idx-grid { grid-template-columns: minmax(0, 1fr) }
        .sh-idx { display: flex; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap }
        .sh-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
        @media (min-width: 769px) {
          .sh-idx-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }
          .sh-idx { flex-direction: column; align-items: flex-start; justify-content: flex-start }
          .sh-two { grid-template-columns: repeat(2, minmax(0, 1fr)) }
        }
      `}</style>
      <Greeting name={me === undefined ? undefined : me.name} />
      <HomeSearch />
      <Shortcuts />
      <MyAssetsLine />
      <MarketBrief indices={indices} calendar={calendar} />
      <IndexCards indices={indices} />
      <div className="sh-two">
        <FearGreed />
        <UpcomingEvents calendar={calendar} />
      </div>
      <MyNews />
      <GuruCard />
      <LeagueLine userId={me === undefined ? undefined : me.id} />
    </div>
  )
}
