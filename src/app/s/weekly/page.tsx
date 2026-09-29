// 간편 화면 주간 리포트(/s/weekly) — 분석 화면(/weekly-report)과 같은 원본(components/lessons/WeeklyReport)을 간편 껍데기 안에서 연다(5단계-5)
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import WeeklyReport from '@/app/components/lessons/WeeklyReport'

export default function Page() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.md, minWidth: 0 }}>
      <Link href="/s/learn" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 배우기</Link>
      <WeeklyReport simple />
    </div>
  )
}
