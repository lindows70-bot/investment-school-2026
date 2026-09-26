'use client'
// 학생 홈 카드들이 함께 쓰는 모양 — 카드 틀·제목 줄·상태 문구·다시 버튼·한눈 시황 말투 색·KST 오늘
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { Tone } from '@/lib/homeBrief'

/** 내 자산 화면(/s/assets)과 같은 카드 틀 */
export const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg, minWidth: 0 } as const

/** 한눈 시황 조각 색 — 등락은 studentFormat.upDown 과 같은 한국식(오름 빨강·내림 파랑·보합 회색) */
export const toneColor = (t?: Tone): string =>
  t === 'up' ? TK.red400 : t === 'down' ? TK.blue400 : t === 'flat' || t === 'muted' ? TK.sub : t === 'warn' ? TK.amber400 : TK.slate200

export const noteStyle = (color: string = TK.sub) => ({ fontSize: FS.tiny, color })

/** 카드 제목 줄 — 오른쪽에 '더 보기 ›' 같은 링크(44px) */
export function CardHead({ title, href, linkText, extra }: { title: string; href?: string; linkText?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, minHeight: 44 }}>
      <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, minWidth: 0 }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexShrink: 0 }}>
        {extra}
        {href && linkText && (
          <Link href={href} style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: `0 ${SP.xs}px`, fontSize: FS.tiny, color: TK.sub, textDecoration: 'none', whiteSpace: 'nowrap' }}>{linkText}</Link>
        )}
      </div>
    </div>
  )
}

/** 못 가져왔을 때 — 문구 + '다시' 버튼 */
/** retryLabel = 화면 낭독기가 읽을 버튼 이름(어느 카드를 다시 부르는지 — '다시'만으론 모른다) */
export function FailRow({ text, onRetry, retryLabel }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
      <span style={noteStyle(TK.amber400)}>{text}</span>
      {onRetry && <button type="button" onClick={onRetry} aria-label={retryLabel} style={retryBtn}>다시</button>}
    </div>
  )
}

export const retryBtn = { height: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer', flexShrink: 0 } as const

// 홈 페이지가 한 번 불러 여러 카드에 나눠 주는 응답(같은 원천을 두 번 부르지 않게) — 쓰는 필드만 적는다
export interface IndexRow { id: string; value: number; changePct: number }
export interface CalEventRow { type: string; date: string; ticker: string; name: string }   // dDay 는 캐시 시점 기준이라 안 쓴다 — 날짜로 거른다
export interface CalendarResp { events?: CalEventRow[] }
export interface FxResp { rate?: unknown; source?: unknown }

/** 오늘(KST 'YYYY-MM-DD') — 마운트 뒤에만 정하고(렌더 중 new Date() 는 서버 UTC·브라우저 KST 가 다른 날을 봐 하이드레이션이 깨진다),
 *  화면을 켜 둔 채 자정을 넘기면 1분 안에 다음 날로 바뀐다. 마운트 전엔 null */
export function useKstToday(): string | null {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    setToday(kst())
    const id = setInterval(() => setToday(kst()), 60_000)   // 같은 값이면 React 가 다시 그리지 않는다
    return () => clearInterval(id)
  }, [])
  return today
}
