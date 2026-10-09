'use client'
// 학생 홈 맨 위 인사 — 날짜 한 줄(작게) + 내 이름 큰 제목(profiles.full_name). '분석 화면' 링크는 배우기 → 내 계정으로 옮겼다(2026-10-09 사용자 결정)
//   리디자인(2026-10-09 · docs/student-design): 다른 화면의 PageHead 와 같은 머리 — 화면에서 가장 큰 글자는 제목과 핵심 숫자 둘뿐이다
import { PageHead } from '@/app/components/student/ui'

/** name: undefined = 아직 모름(불러오는 중), null = 이름 없음·못 가져옴 → '반가워요!' · today: KST 'YYYY-MM-DD'(마운트 전 null → 빈 줄 자리만) */
export default function Greeting({ name, today }: { name: string | null | undefined; today: string | null }) {
  return <PageHead today={today} title={name === undefined ? '반가워요' : name ? `반가워요, ${name}님` : '반가워요!'} />
}
