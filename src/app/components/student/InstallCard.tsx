'use client'
// 배우기 화면 '폰 홈 화면에 앱으로 추가하기' 카드 — 크롬은 설치 버튼, 아이폰은 공유 → 홈 화면에 추가 안내, 이미 앱으로 열었으면 숨김
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import {
  captureInstallPrompt, clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt, wasInstalled,
} from '@/app/components/student/installPrompt'

// hidden = 이미 앱으로 열었거나 방금 설치함 · prompt = 크롬 설치 버튼 · ios = 공유 메뉴 안내
// android = 설치 이벤트가 없는 안드로이드(이미 한 번 닫았거나 다른 화면에서 열어 지나감)
// pc = 터치 기기가 아닌 컴퓨터(폰에서 열라고 안내) · other = 그 밖의 폰 브라우저
type Mode = 'hidden' | 'prompt' | 'ios' | 'android' | 'pc' | 'other'

// 폰·태블릿 UA 가 아니면 컴퓨터로 본다 — PC 크롬에서 "크롬에서 열면"이라고 안내하던 거짓 문구를 막는다.
// (pointer: coarse) 로 가르면 터치스크린 윈도우 노트북이 폰으로 잡힌다(2026-09-26 실측: maxTouchPoints 10 · coarse true)
const isPc = () => {
  const ua = navigator.userAgent
  return !/Mobi|Android|iPhone|iPad|iPod/.test(ua) && !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function detect(): Mode {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (wasInstalled() || window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true) return 'hidden'
  if (getInstallPrompt()) return 'prompt'
  const ua = nav.userAgent
  // iPadOS 13+ 는 스스로를 Mac 이라고 부른다 — 터치 지점 수로 가른다
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return isPc() ? 'pc' : 'other'
}

const step = { margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' } as const

export default function InstallCard() {
  // null = 아직 마운트 전 — 서버 렌더와 첫 렌더는 아무것도 그리지 않는다(브라우저 정보는 effect 에서만)
  const [mode, setMode] = useState<Mode | null>(null)
  // PC 크롬도 설치 버튼(prompt)이 뜬다 — 그땐 '폰 홈 화면' 대신 '이 컴퓨터' 문구로
  const [pc, setPc] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    captureInstallPrompt()
    const update = () => { const m = detect(); setMode(m); setPc(m === 'pc' || (m === 'prompt' && isPc())) }
    update()
    return subscribeInstallPrompt(update)
  }, [])

  if (mode === null || mode === 'hidden') return null

  const install = async () => {
    const e = getInstallPrompt()
    if (!e) return
    setBusy(true)
    try {
      await e.prompt()
      const { outcome } = await e.userChoice
      clearInstallPrompt()   // 한 번 쓴 이벤트는 다시 못 쓴다
      if (outcome === 'accepted') setMode('hidden')
    } catch {
      clearInstallPrompt()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title={pc ? '앱으로 추가하기' : '폰 홈 화면에 앱으로 추가하기'} />
      <span style={noteStyle()}>다음부터 아이콘 한 번으로 열려요</span>
      {mode === 'prompt' && (
        <button type="button" onClick={install} disabled={busy}
          style={{ alignSelf: 'flex-start', minHeight: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: 'none', background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {pc ? '이 컴퓨터에 앱으로 설치' : '홈 화면에 추가'}
        </button>
      )}
      {mode === 'ios' && (
        <ol style={{ margin: 0, paddingLeft: SP.xl, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <li style={step}>화면 아래(아이패드는 위) <b>공유 버튼(□↑)</b>을 눌러요</li>
          <li style={step}>목록에서 <b>&lsquo;홈 화면에 추가&rsquo;</b>를 눌러요</li>
        </ol>
      )}
      {mode === 'android' && <p style={step}>브라우저 메뉴(⋮)에서 <b>&lsquo;홈 화면에 추가&rsquo;</b> 또는 <b>&lsquo;앱 설치&rsquo;</b>를 눌러요</p>}
      {mode === 'pc' && <p style={step}>폰에서 이 화면을 열면 홈 화면에 앱으로 추가할 수 있어요</p>}
      {mode === 'other' && <p style={step}>크롬이나 사파리에서 열면 홈 화면에 추가할 수 있어요</p>}
    </section>
  )
}
