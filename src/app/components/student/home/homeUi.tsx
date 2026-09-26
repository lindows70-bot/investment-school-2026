'use client'
// 학생 홈 카드들이 함께 쓰는 모양 — 카드 틀·제목 줄·상태 문구·다시 버튼·한눈 시황 말투 색
import Link from 'next/link'
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
export function FailRow({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
      <span style={noteStyle(TK.amber400)}>{text}</span>
      {onRetry && <button type="button" onClick={onRetry} style={retryBtn}>다시</button>}
    </div>
  )
}

export const retryBtn = { height: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer', flexShrink: 0 } as const

// 홈 페이지가 한 번 불러 여러 카드에 나눠 주는 응답(같은 원천을 두 번 부르지 않게) — 쓰는 필드만 적는다
export interface IndexRow { id: string; value: number; changePct: number }
export interface CalEventRow { type: string; date: string; ticker: string; name: string }   // dDay 는 캐시 시점 기준이라 안 쓴다 — 날짜로 거른다
export interface CalendarResp { events?: CalEventRow[] }

/** 'YYYY-MM-DD' 에 days 를 더한 날짜(달력 산술만 — 시계 안 봄) */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
/** 지금의 KST 달력일 — 렌더 중에 부르지 말고 마운트 뒤(useEffect)에만 부른다(서버 UTC·브라우저 KST 가 다른 날을 본다) */
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
