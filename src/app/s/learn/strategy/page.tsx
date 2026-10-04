'use client'
// 간편 화면 최일 전략(/s/learn/strategy) — 분석 화면의 최일 전략 두 가지(사이드바 '최일 가치분석' · 대시보드 '4계절 내비게이터')를 같은 원본 컴포넌트로 연다
//   예전엔 마스터 전략 슬라이드(components/lessons/MasterStrategy)를 열어 엉뚱한 화면이 나왔다(2026-10-04 사용자 지적)
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { TK, FS, RAD, SP } from '@/lib/theme'
import ChoiValuationPanel from '@/app/components/ChoiValuationPanel'
import SeasonNavigator from '@/app/components/SeasonNavigator'

type Tab = 'value' | 'season'
const TABS: { key: Tab; label: string }[] = [{ key: 'value', label: '최일 가치분석' }, { key: 'season', label: '4계절 내비게이터' }]
const parseTab = (v: string | null): Tab => (v === 'season' ? 'season' : 'value')

export default function Page() {
  // useSearchParams 는 Suspense 경계 안에서만 정적 생성이 된다(Next 14)
  return (
    <Suspense fallback={<p style={{ margin: 0, fontSize: FS.body, color: TK.sub }}>불러오는 중이에요…</p>}>
      <StrategyScreen />
    </Suspense>
  )
}

function StrategyScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const tab = parseTab(params.get('tab'))
  // 한 번 연 탭만 그린다(연 뒤엔 유지 = 다시 돌아와도 재조회 없음) — 안 연 화면의 데이터는 부르지 않는다
  const [opened, setOpened] = useState<Tab[]>([tab])
  useEffect(() => { setOpened(p => (p.includes(tab) ? p : [...p, tab])) }, [tab])
  const pick = (t: Tab) => router.replace(t === 'value' ? '/s/learn/strategy' : `/s/learn/strategy?tab=${t}`, { scroll: false })
  const panel = (t: Tab) => ({ display: tab === t ? 'block' : 'none', minWidth: 0 } as const)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.md, minWidth: 0 }}>
      <Link href="/s/learn" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 배우기</Link>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>최일 전략</h1>
      <div role="group" aria-label="최일 전략 종류" style={{ display: 'flex', gap: SP.xs, padding: SP.xs, borderRadius: RAD.md, background: TK.bg3 }}>
        {TABS.map(t => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => pick(t.key)}
            style={{ height: 44, flex: 1, minWidth: 0, borderRadius: RAD.sm, border: 'none', background: tab === t.key ? TK.bg7 : 'transparent', color: tab === t.key ? TK.slate100 : TK.sub, fontSize: FS.body, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      {opened.includes('value') && <div style={panel('value')}><ChoiValuationPanel /></div>}
      {opened.includes('season') && <div style={panel('season')}><SeasonNavigator /></div>}
    </div>
  )
}
