import SchoolLeague from '@/app/components/SchoolLeague'
import AppHeader from '@/app/components/AppHeader'

export default function SchoolLeaguePage() {
  return (
    <>
      {/* 📱 모바일(≤768px)에선 숨김 — 셸의 TopHeader·하단 탭바가 이미 있어 이 헤더가 두 번째 헤더가 되고,
          375px 실측(2026-09-25)에서 '관리자 대시보드' 버튼(nowrap)에 밀린 제목이 11px 폭으로 세로 4줄이 됐다.
          데스크톱은 그대로(sticky 유지를 위해 래퍼 div 대신 nav 에 직접 클래스). */}
      <AppHeader title="스쿨 리그" className="m-hide" />
      <SchoolLeague />
    </>
  )
}
