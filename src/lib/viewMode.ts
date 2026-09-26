// 화면 모드(간편 simple / 분석 full) 쿠키를 브라우저에서 저장 — 다음 로그인 때 /start 가 이 값으로 착지를 정한다(클라이언트 전용)
import { VIEW_MODE_COOKIE } from '@/lib/landing'

export function setViewMode(mode: 'simple' | 'full'): void {
  document.cookie = `${VIEW_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
}

// 로그아웃할 때 지운다 — 쿠키는 사람이 아니라 브라우저에 붙어서, 공용 PC 에서 앞 학생의 선택이 다음 학생 착지를 정해 버린다
export function clearViewMode(): void {
  document.cookie = `${VIEW_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`
}
