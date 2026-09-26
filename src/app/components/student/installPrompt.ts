// 크롬의 '앱 설치' 이벤트(beforeinstallprompt)를 학생 화면 어디서든 받아 두는 저장소 — 설치 카드가 나중에 꺼내 쓴다
//
// 왜 카드가 직접 듣지 않나: 이 이벤트는 **페이지를 처음 열 때 한 번만** 온다. 학생이 홈(/s)에서 열고 배우기로
// 탭 이동(클라이언트 이동)하면 카드가 마운트될 땐 이미 지나가 있다. 그래서 /s 레이아웃(RegisterSW)이 먼저 붙잡아 둔다.

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
let attached = false
const subs = new Set<() => void>()
const notify = () => subs.forEach(fn => fn())

/** 브라우저에서만 부른다(마운트 뒤 effect) — 여러 번 불러도 리스너는 한 벌 */
export function captureInstallPrompt(): void {
  if (attached) return
  attached = true
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()   // 크롬 기본 하단 배너 대신 우리 카드의 버튼으로 띄운다
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

export const getInstallPrompt = () => deferred
export const wasInstalled = () => installed
/** prompt() 는 한 이벤트에 한 번만 된다 — 쓰고 나면 비운다 */
export function clearInstallPrompt(): void { deferred = null; notify() }
export function subscribeInstallPrompt(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}
