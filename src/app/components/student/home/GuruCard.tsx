'use client'
// 학생 홈 '거장들의 포트폴리오' — guruFunds 앞 4명(이름·펀드), 누르면 기존 거장 화면(/guru-portfolio)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FUNDS } from '@/lib/guruFunds'
import { card, CardHead } from './homeUi'

export default function GuruCard() {
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <CardHead title="거장들의 포트폴리오" href="/guru-portfolio" linkText="더보기 ›" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm }}>
        {FUNDS.slice(0, 4).map(f => (
          <Link key={f.cik} href="/guru-portfolio" style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 56, padding: SP.sm, borderRadius: RAD.sm, background: TK.bg3, color: TK.slate200, textDecoration: 'none', minWidth: 0 }}>
            <span aria-hidden style={{ width: 36, height: 36, flexShrink: 0, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.tiny, fontWeight: 700, color: TK.slate300 }}>{f.mgr.slice(0, 1)}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.mgr}</span>
              <span style={{ fontSize: FS.micro, color: TK.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fund}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
