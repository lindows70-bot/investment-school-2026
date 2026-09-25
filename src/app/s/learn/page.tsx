// 학생 배우기 탭 자리 — 아직 준비 중. 탭을 눌러도 막다른 길(404)이 되지 않게 안내와 내 자산 링크만 둔다
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'

export default function StudentLearn() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>배우기</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, padding: SP.lg, background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md }}>
        <span style={{ fontSize: FS.body, color: TK.slate100 }}>준비 중이에요 — 곧 열려요.</span>
        <Link href="/s/assets" style={{ alignSelf: 'flex-start', height: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>내 자산 보기</Link>
      </div>
    </div>
  )
}
