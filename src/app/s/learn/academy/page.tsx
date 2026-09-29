// 간편 화면 투자 아카데미(/s/learn/academy) — 분석 화면(/investment-academy)과 같은 원본(components/lessons/InvestmentAcademy)을 간편 껍데기 안에서 연다(5단계-5)
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import InvestmentAcademy from '@/app/components/lessons/InvestmentAcademy'

export default function Page() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.md, minWidth: 0 }}>
      <Link href="/s/learn" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 배우기</Link>
      <InvestmentAcademy simple />
    </div>
  )
}
