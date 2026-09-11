// 404 — 기본 영문 "This page could not be found." 대신 한글 안내 + 매일 화면으로 가는 길
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'

export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.md, textAlign: 'center', padding: SP.lg }}>
      <div style={{ fontSize: FS.h1, fontWeight: 900, color: TK.slate100 }}>404</div>
      <div style={{ fontSize: FS.body, color: TK.slate300, lineHeight: 1.7 }}>
        이 주소에는 화면이 없습니다.<br />메뉴가 바뀌었거나 주소가 틀렸을 수 있어요.
      </div>
      <Link href="/briefing" style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.lg}px`, borderRadius: RAD.md, background: TK.blue500, color: TK.slate100, fontWeight: 700, fontSize: FS.body, textDecoration: 'none' }}>
        🎯 오늘의 브리핑으로
      </Link>
    </div>
  )
}
