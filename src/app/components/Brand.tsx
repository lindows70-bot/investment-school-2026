'use client'
// 앱 브랜드 한 벌 — 로고 아이콘 + '2026 투자학교 / Get Rich Slowly' 워드마크(BrandMark), DCF 철학 서명 '미래에 벌어들일 현금흐름을 할인한다 · PV = Σ FCFₜ/(1+r)ᵗ'(DcfSignature)
//   분석 화면 왼쪽 메뉴(Sidebar)와 간편 화면(StudentShell)이 같은 것을 쓴다(2026-09-28 사용자: 간편 화면에도 로고·시그니처를) — 마크업은 Sidebar 에 있던 그대로 옮겼다
import { FS, FONT_STACK } from '@/lib/theme'

/** 로고 아이콘 + 워드마크. compact 는 폰 상단 한 줄용(아이콘 28) */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const icon = compact ? 28 : 34
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 9 : 11, minWidth: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icon.svg" alt="2026 투자학교" style={{ width: icon, height: icon, flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.42))' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? FS.body : FS.lg, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15, whiteSpace: 'nowrap' as const, fontFamily: FONT_STACK,
          background: 'linear-gradient(135deg, #ffffff 0%, #f5e6c8 35%, #d4af37 65%, #f0f0f0 100%)',   // 토큰예외: 브랜드 워드마크의 골드 그라데이션 — 로고와 한 벌인 아이덴티티 색이라 TK 의미색으로 대체 불가
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          2026 투자학교
        </div>
        <div style={{ marginTop: 1, fontSize: FS.micro, fontWeight: 300, fontStyle: 'italic', letterSpacing: '0.12em', color: 'rgba(212,175,55,0.8)', fontFamily: '"Georgia", "Times New Roman", serif', whiteSpace: 'nowrap' as const }}>
          Get Rich Slowly
        </div>
      </div>
    </div>
  )
}

/** DCF 철학 서명 — 문장 + 분수 표기 공식 */
export function DcfSignature() {
  return (
    <div>
      <div style={{ fontSize: FS.micro, fontWeight: 600, lineHeight: 1.55, letterSpacing: '0.01em', color: 'rgba(245,230,200,0.88)', fontFamily: '"Georgia","Times New Roman",serif' }}>
        미래에 벌어들일 현금흐름을{' '}
        <span style={{
          fontWeight: 800, fontStyle: 'italic',
          background: 'linear-gradient(135deg,#f5e6c8 0%,#d4af37 60%,#fffbe6 100%)',   // 토큰예외: 위와 같은 브랜드 골드 그라데이션(철학 서명의 강조어)
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>할인한다</span>
      </div>
      {/* 공식 — PV = Σ FCFₜ / (1+r)ᵗ (실제 분수 표기) */}
      <div style={{ marginTop: 7, padding: '6px 10px', borderRadius: 9, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(212,175,55,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: '"Cambria Math","Georgia",serif', userSelect: 'none' as const }}>
        <span style={{ fontSize: FS.tiny, fontWeight: 800, color: '#d4af37', fontStyle: 'italic' }}>PV</span>{/* 토큰예외: 브랜드 골드 */}
        <span style={{ fontSize: FS.micro, color: 'rgba(245,230,200,0.6)' }}>=</span>
        <span style={{ fontSize: FS.lg, fontWeight: 700, color: '#d4af37', lineHeight: 1, marginRight: 1 }}>Σ</span>{/* 토큰예외: 브랜드 골드 */}
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
          {/* 수식의 아래·위 첨자(t)는 밑글자보다 작아야 수식으로 읽힌다 — FS 최소단(micro)으로는 첨자 표현 불가. 읽을 문장이 아니라 수식 기호 */}
          <span style={{ fontSize: FS.micro, color: '#f5e6c8', fontWeight: 700 }}>FCF<sub style={{ fontSize: 8 }}>t</sub></span>{/* 토큰예외: 브랜드 크림색 · 수식 첨자 8px */}
          <span style={{ height: 1, width: '100%', minWidth: 46, background: 'rgba(212,175,55,0.55)', margin: '1.5px 0' }} />
          <span style={{ fontSize: FS.micro, color: 'rgba(245,230,200,0.82)' }}>(1+r)<sup style={{ fontSize: 8 }}>t</sup></span>{/* 토큰예외: 수식 첨자 8px */}
        </span>
      </div>
    </div>
  )
}
