'use client'
// 학생 홈 '이번 주 기록' 타일 — 이번 주 월요일(KST)부터 내가 적은 거래 건수. 누르면 기록하기(/s/record)
//   개인 데이터라 공유 캐시를 쓰지 않는다 — 브라우저 Supabase(RLS) count 만. ⚠️ 선생님 계정은 RLS 상 전원 거래가 보이므로 user_id 로 반드시 거른다(useMySells 와 같은 이유)
//   0건은 숫자 대신 "아직 없어요"(이번 주 첫 기록으로 가는 입구) — 가짜 정밀 없이 '돌아올 이유' 한 줄
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FS } from '@/lib/theme'
import { card, FailRow } from './homeUi'
import { Tile, Chip, Label } from '@/app/components/student/ui'

type S = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; count: number }

/** 'YYYY-MM-DD' → 그 주 월요일 'YYYY-MM-DD'(문자열 산술 · 시계 안 봄) */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const back = (new Date(t).getUTCDay() + 6) % 7   // 월=0 … 일=6
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10)
}
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

export default function WeekRecordTile({ userId, today }: { userId: string | null | undefined; today: string | null }) {
  const [s, setS] = useState<S>({ kind: 'loading' })
  const [tick, setTick] = useState(0)
  const monday = today ? mondayOf(today) : null

  useEffect(() => {
    if (!userId || !monday) return
    let cancelled = false
    setS({ kind: 'loading' })
    ;(async () => {
      const sb = createClient()
      const { count, error } = await sb.from('transactions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('transaction_date', monday)
      if (cancelled) return
      // supabase-js 는 throw 하지 않는다 — error 를 안 보면 실패가 '0건'으로 둔갑한다
      if (error || typeof count !== 'number') setS({ kind: 'failed' })
      else setS({ kind: 'ok', count })
    })().catch(() => { if (!cancelled) setS({ kind: 'failed' }) })
    return () => { cancelled = true }
  }, [userId, monday, tick])

  if (userId === undefined || !monday) return <Tile label="이번 주 기록" value="…" sub="불러오는 중" />
  if (userId === null) return <Tile label="이번 주 기록" value="—" sub="로그인하면 보여요" />
  if (s.kind === 'loading') return <Tile label="이번 주 기록" value="…" sub={`${md(monday)} 월요일부터`} />
  if (s.kind === 'failed') return <div style={card}><Label>이번 주 기록</Label><FailRow text="기록 수를 못 가져왔어요." onRetry={() => setTick(t => t + 1)} retryLabel="이번 주 기록 다시 불러오기" /></div>
  if (s.count === 0) return <Tile href="/s/record" label="이번 주 기록" value="아직 없어요" valueSize={FS.lg} sub="산 것·판 것을 적어 두면 리그에 반영돼요 ›" />
  return <Tile href="/s/record" label="이번 주 기록" ariaLabel={`이번 주 기록 ${s.count}건`} value={`${s.count}건`} chip={<Chip text="기록" tone="gold" />} sub={`${md(monday)} 월요일부터 · 더 적기 ›`} />
}
