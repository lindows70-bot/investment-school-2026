// 폰 앱 설치(PWA)를 위한 최소 서비스 워커 — 아무것도 캐시하지 않고, 요청에도 끼어들지 않는다
//
// 왜 fetch 처리기가 없나(의도된 선택):
//  · 이 앱은 시세·보유·순위가 매일 바뀐다. 캐시가 끼면 학생이 **옛 화면·옛 숫자**를 보게 된다(계획서 경계: "서비스 워커가 API·화면을 캐시하지 않는다").
//  · 통과만 시키는 `event.respondWith(fetch(event.request))` 도 무해하지 않다 — 모든 요청이 워커를 한 번 더 거쳐 느려지고,
//    워커가 잠든 상태면 깨우는 시간까지 더해진다. 리다이렉트(로그인 → /start)·POST 본문·스트리밍 응답에서 브라우저 기본 동작과
//    어긋날 여지만 생긴다. Chrome 도 '아무것도 안 하는 fetch 처리기'는 건너뛰라고 경고한다.
//  · 크롬 설치 조건에서 fetch 처리기는 **Chrome 108(안드로이드)·112(PC)부터 필수가 아니다** — 매니페스트(이름·아이콘 192/512·
//    start_url·display) + HTTPS 면 beforeinstallprompt 가 뜬다. 워커는 '설치형 웹앱' 기반으로만 둔다.
//  → fetch 리스너를 아예 등록하지 않으면 모든 요청이 워커 없이 그대로 네트워크로 간다. 가장 안전하다.
//
// 새 버전이 배포되면 기다리지 않고 바로 교체한다(옛 워커가 남아 있을 이유가 없다).
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })
