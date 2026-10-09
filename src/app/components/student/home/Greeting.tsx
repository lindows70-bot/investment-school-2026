'use client'
// 학생 홈 맨 위 인사 — 날짜 한 줄(작게) + 내 이름 큰 제목(profiles.full_name). '분석 화면' 링크는 배우기 → 내 계정으로 옮겼다(2026-10-09 사용자 결정)
//   리디자인(2026-10-09 · docs/student-design): 큰 제목 FS.h2 · 자간 −0.03em — 화면에서 가장 큰 글자는 인사와 내 자산 숫자 둘뿐이다
import { TK, FS, SP } from '@/lib/theme'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
/** 'YYYY-MM-DD' → '10월 9일 목요일' — 문자열만 본다(시계 안 봄 · 페이지의 useKstToday 가 마운트 뒤 준다) */
export function dateLine(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return `${mo}월 ${d}일 ${DOW[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]}요일`
}

/** name: undefined = 아직 모름(불러오는 중), null = 이름 없음·못 가져옴 → '반가워요!' · today: KST 'YYYY-MM-DD'(마운트 전 null → 빈 줄 자리만) */
export default function Greeting({ name, today }: { name: string | null | undefined; today: string | null }) {
  const d = today ? dateLine(today) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
      <span style={{ fontSize: FS.tiny, fontWeight: 600, color: TK.sub, minHeight: 20 }}>{d ?? ' '}</span>
      <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name === undefined ? '반가워요' : name ? `반가워요, ${name}님` : '반가워요!'}
      </h1>
    </div>
  )
}
