// 폰 홈 화면 설치(PWA)용 웹 앱 매니페스트 — /manifest.webmanifest 로 서빙, 설치 후 첫 화면은 역할별 착지(/start)
import type { MetadataRoute } from 'next'
import { TK } from '@/lib/theme'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '2026 투자학교',
    short_name: '투자학교',
    description: '내 포트폴리오 · 리그 · 오늘의 투자 공부를 한 번에',
    // 앱 신원 고정 — 나중에 start_url 을 바꿔도 이미 설치한 폰에서 다른 앱으로 취급되지 않게
    id: '/start',
    // 설치 아이콘을 누르면 로그인·역할·화면 모드에 맞는 곳으로 — 학생은 /s, 선생님은 /dashboard
    start_url: '/start',
    scope: '/',
    display: 'standalone',
    // 학생 셸 배경과 같은 색 — 스플래시에서 첫 화면으로 넘어갈 때 번쩍이지 않게
    background_color: TK.bg1,
    theme_color: TK.bg1,
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // 런처가 원·물방울로 잘라도 로고가 안전 영역(가운데 80%) 안에 남는 판
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
