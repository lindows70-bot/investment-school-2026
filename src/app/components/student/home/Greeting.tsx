'use client'
// 학생 홈 맨 위 인사 — 내 이름(profiles.full_name). '분석 화면' 링크는 배우기 → 내 계정으로 옮겼다(2026-10-09 사용자 결정 — 학생이 50탭 대시보드로 빠지는 출구가 가장 눈에 띄는 자리에 있었다)
import { TK, FS } from '@/lib/theme'

/** name: undefined = 아직 모름(불러오는 중), null = 이름 없음·못 가져옴 → '반가워요!' */
export default function Greeting({ name }: { name: string | null | undefined }) {
  return (
    <h1 style={{ margin: 0, minHeight: 48, display: 'flex', alignItems: 'center', fontSize: FS.xl, fontWeight: 800, color: TK.slate100, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {name === undefined ? '반가워요' : name ? `반가워요, ${name}님` : '반가워요!'}
    </h1>
  )
}
