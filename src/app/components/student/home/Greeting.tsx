'use client'
// 학생 홈 맨 위 인사 — 내 이름(profiles.full_name) + 오른쪽 '분석 화면' 링크
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { setViewMode } from '@/lib/viewMode'

/** name: undefined = 아직 모름(불러오는 중), null = 이름 없음·못 가져옴 → '반가워요!' */
export default function Greeting({ name }: { name: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, minHeight: 48 }}>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name === undefined ? '반가워요' : name ? `반가워요, ${name}님` : '반가워요!'}
      </h1>
      <Link href="/dashboard" onClick={() => setViewMode('full')} style={{ display: 'flex', alignItems: 'center', height: 44, flexShrink: 0, whiteSpace: 'nowrap', padding: `0 ${SP.md}px`, borderRadius: RAD.pill, border: `1px solid ${TK.border}`, color: TK.sub, fontSize: FS.tiny, textDecoration: 'none' }}>분석 화면</Link>
    </div>
  )
}
