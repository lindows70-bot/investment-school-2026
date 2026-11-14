'use client'
// 학생 화면 공용 가격 흐름 차트 상자 — 선(점 목록)만 주면 색·눈금·기준선·끝점을 종목 상세와 같은 문법으로 그린다(내 종목 차트 · 코인 차트)
//   · 내 평균 매수가(avg)가 범위 안이면 두 색: 평단보다 위는 빨강, 아래는 파랑, 금색 점선 = 평단(종목 상세 C안)
//   · 아니면 기간 등락색 한 가지: 이 기간에 올랐으면 빨강, 내렸으면 파랑, 점선 = 시작값(B안)
//   · marks 를 켜면 기간 안 최고·최저에 말풍선
import { TK } from '@/lib/theme'
import { money, upDown } from '@/lib/studentFormat'
import { niceTicks, hourTicks, dayTicks, kstParts, ymdDot } from '@/lib/marketScreen'
import { avgInRange, highLow, isIntraday, type Pt } from '@/lib/studentCharts'
import { LinePlot } from '@/app/components/student/market/marketUi'

// 눈금 글자 — 원화는 1천만 넘으면 '만' 단위(비트코인 91,850,000 은 눈금 칸에 안 들어간다), 달러는 100 넘으면 정수
const yFmtFor = (currency: 'USD' | 'KRW', max: number) => (v: number) =>
  currency === 'USD' ? (max >= 100 ? `$${Math.round(v).toLocaleString('en-US')}` : `$${v.toFixed(2)}`)
    : max >= 10_000_000 ? `${Math.round(v / 10_000).toLocaleString('ko-KR')}만` : Math.round(v).toLocaleString('ko-KR')
const hm = (t: number) => kstParts(t).hm
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''
// 말풍선 속 값 — 눈금과 같은 줄임(원화 1천만↑ 은 만원)
const markValue = (v: number, currency: 'USD' | 'KRW') =>
  currency === 'KRW' && v >= 10_000_000 ? `${Math.round(v / 10_000).toLocaleString('ko-KR')}만원` : money(v, currency)

export default function TrendChart({ pts, currency, avg, height = 160, ariaLabel, marks = false }: {
  pts: Pt[]; currency: 'USD' | 'KRW'; avg?: number | null; height?: number; ariaLabel: string; marks?: boolean
}) {
  if (pts.length < 2) return null
  const vals = pts.map(p => p.v)
  const vMin = Math.min(...vals), vMax = Math.max(...vals)
  const showAvg = avgInRange(avg, pts)
  const a = showAvg ? (avg as number) : null
  const min = a != null ? Math.min(vMin, a) : vMin, max = a != null ? Math.max(vMax, a) : vMax
  const first = pts[0], last = pts[pts.length - 1]
  const periodColor = upDown(last.v - first.v) === TK.sub ? TK.slate300 : upDown(last.v - first.v)
  const intraday = isIntraday(pts)
  const xt = intraday ? { ticks: hourTicks(first.t, last.t, 6), fmt: hm } : dayTicks(first.t, last.t)
  const hl = marks ? highLow(pts) : null
  const when = intraday ? hm : tDay
  return (
    <div role="img" aria-label={ariaLabel} style={{ height, minWidth: 0 }}>
      <LinePlot points={pts} color={periodColor}
        baseline={a ?? first.v} baselineColor={a != null ? TK.amber400 : undefined}
        baselineLabel={a != null ? `내 평단 ${money(a, currency)}` : undefined}
        splitAt={a} splitUp={TK.red400} splitDown={TK.blue400} areaOpacity={0.42}
        tFmt={when} vFmt={v => money(v, currency)} a11y={false}
        area endDot yAxis="right" yTicks={niceTicks(min, max, 4)} yFmt={yFmtFor(currency, max)} xTicks={xt.ticks} xFmt={xt.fmt}
        marks={hl ? [
          { t: hl.hi.t, v: hl.hi.v, name: '최고', value: markValue(hl.hi.v, currency), when: when(hl.hi.t), place: 'above' },
          { t: hl.lo.t, v: hl.lo.v, name: '최저', value: markValue(hl.lo.v, currency), when: when(hl.lo.t), place: 'below' },
        ] : undefined} />
    </div>
  )
}
