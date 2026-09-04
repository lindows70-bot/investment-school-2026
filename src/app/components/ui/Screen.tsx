'use client'
// 🧱 학생 화면 공용 프리미티브 — 화면마다 다시 그리던 '결론·섹션·각주'를 한 벌로 통일한다.
//
// 왜 만들었나(2026-09-03 실측):
//   · 공유 UI 컴포넌트가 **0개**여서 '📌 매일' 4화면의 카드 배경이 넷 다 달랐다
//     (브리핑 '#12151f' 직접입력 / 주간 TK.bg6 / 승패 '#12151f'+'#232838' / 성적표 TK.bg8).
//   · 라운드는 RAD 5단을 정의해 뒀는데 실제로는 15종(2·3·4·5·6·7·8·9·10·11·12·14·18·99·999)이 쓰였다.
//   · 그래서 화면 단위 개선이 매번 그 화면에서 끝나고 옆 화면에서 재발했다.
//     한 파일이 전 화면에 먹은 개선(TK 색상 SSOT · FS 램프)만 살아남았다.
//
// ⭐ 규칙: **`Verdict` 는 한 페이지에 하나.** 그 화면이 답하는 질문 하나의 답이다.
//    나란히 놓인 결론이 둘이면 학생은 "그래서 뭘 믿지?"라는 새 문제를 받는다
//    (내부자 레이더 v4 이후 이 프로젝트가 세 번 확인한 원칙).
//    ⚠️ 코드로 강제하진 않았다 — 마운트 카운터는 StrictMode 이중 마운트에서 오탐이 나고,
//       한 줄 규칙을 지키자고 렌더 사이드이펙트를 넣는 건 배보다 배꼽이다. 리뷰에서 본다.
//
// 신규 파일이라 커밋 훅이 hex·fontSize 리터럴을 차단한다 — 여기 값은 전부 토큰이다.
import type { ReactNode } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'

/** 결론 칩 — 숫자가 곧 링크. `n`이 null(모름)이거나 0이면 링크로 만들지 않는다. */
export interface VerdictChip {
  label: string
  /** null = 아직 모름(로딩·실패·비로그인) · 0 = 확인했고 없음 — 둘을 같은 것으로 그리지 않는다 */
  value: string | number | null
  color?: string
  href?: string
}

/**
 * 🎯 화면의 답. 페이지 맨 위, 페이지당 하나.
 * headline 은 이 화면이 답하는 질문의 답이어야 한다 — 목차·제목·처방이 아니라.
 */
export function Verdict({ eyebrow, headline, sub, chips, footer }: {
  eyebrow?: string
  /** ReactNode 인 이유 = 손익 숫자에 등락 색(한국식 빨강=상승·파랑=하락)을 입혀야 하기 때문. 그래도 **한 문장**이다. */
  headline: ReactNode
  sub?: ReactNode
  chips?: VerdictChip[]
  footer?: ReactNode
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${TK.bg8}, ${TK.bg1})`,
      border: `1px solid ${TK.border}`,
      borderRadius: RAD.lg,
      padding: `${SP.xl}px ${SP.xl}px`,
    }}>
      {eyebrow && (
        <div style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.sub3, letterSpacing: '0.08em' }}>
          {eyebrow}
        </div>
      )}
      <div style={{
        fontSize: FS.h2, fontWeight: 900, color: TK.slate100,
        marginTop: eyebrow ? SP.xs + 2 : 0, lineHeight: 1.3, letterSpacing: '-0.5px',
      }}>
        {headline}
      </div>
      {sub && (
        <div style={{ fontSize: FS.body, color: TK.sub3, marginTop: SP.sm, lineHeight: 1.6 }}>
          {sub}
        </div>
      )}
      {footer && (
        <div style={{
          fontSize: FS.body, color: TK.sub3, marginTop: SP.md,
          lineHeight: 1.6, paddingTop: SP.md, borderTop: `1px solid ${TK.border}`,
        }}>
          {footer}
        </div>
      )}
      {chips && chips.length > 0 && (
        <div style={{ display: 'flex', gap: SP.sm, flexWrap: 'wrap', marginTop: SP.md }}>
          {chips.map(c => {
            const live = c.value !== null && c.value !== 0 && c.value !== '0'
            return (
              <a key={c.label} href={live ? c.href : undefined} style={{
                display: 'inline-flex', alignItems: 'baseline', gap: SP.xs + 2,
                background: TK.bg3, border: `1px solid ${TK.border}`, borderRadius: RAD.sm,
                padding: `${SP.xs + 1}px ${SP.md - 1}px`, textDecoration: 'none',
                fontSize: FS.tiny, color: TK.sub2,
                cursor: live && c.href ? 'pointer' : 'default',
                opacity: live ? 1 : 0.6,
              }}>
                {c.label}
                <b style={{
                  fontSize: FS.body, color: live ? (c.color ?? TK.slate100) : TK.sub,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {c.value === null ? '—' : c.value}
                </b>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 📄 섹션 카드 — 번호·제목·부제·상세 링크가 한 규격. */
export function Section({ id, no, title, sub, link, linkLabel, children }: {
  id?: string
  no?: string
  title: string
  sub?: string
  link?: string
  linkLabel?: string
  children: ReactNode
}) {
  return (
    <div id={id} style={{
      background: TK.card, border: `1px solid ${TK.border}`,
      borderRadius: RAD.lg, padding: `${SP.lg}px ${SP.lg + 2}px`, scrollMarginTop: SP.lg,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.md - 2, marginBottom: SP.sm, flexWrap: 'wrap' }}>
        {no && (
          <span style={{
            fontSize: FS.tiny, fontWeight: 900, color: TK.sub2,
            background: TK.bg3, borderRadius: RAD.xs + 2, padding: `2px ${SP.sm}px`,
          }}>{no}</span>
        )}
        <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>{title}</span>
        {sub && <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>{sub}</span>}
        {link && (
          <a href={link} style={{
            marginLeft: 'auto', fontSize: FS.tiny, fontWeight: 700,
            color: TK.indigo400, textDecoration: 'none',
          }}>{linkLabel ?? '상세 보기'} →</a>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * 📎 각주 — 출처·기준일·캐비엇.
 * ⚠️ 설명·해석 문장은 여기 넣지 마라(사용자 상설 규칙). 여기는 tiny(13)이고 micro 는 쓰지 않는다.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: FS.tiny, color: TK.sub, lineHeight: 1.6, padding: `0 ${SP.xs}px` }}>
      {children}
    </div>
  )
}
