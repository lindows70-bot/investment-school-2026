'use client'
// 🏠⚔️📈 주택 vs 코스피 — 30년 가격 레이스(로그축) + 구간 토글(시작점 따라 승자가 바뀜) + 주택 시가총액 보조. 실데이터 관측(매수 신호 아님).
import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TK } from '@/lib/theme'
import type { HouseVsKospiApi } from '@/app/api/house-vs-kospi/route'

const CARD = TK.card, BORDER = TK.border
const WINDOWS = [
  { key: '1995', label: '1995~ (30년)', from: 1995 },
  { key: '2010', label: '2010~', from: 2010 },
  { key: '2016', label: '최근 10년', from: 2016 },
] as const

export default function HouseVsKospi() {
  const [d, setD] = useState<HouseVsKospiApi | null>(null)
  const [err, setErr] = useState(false)
  const [win, setWin] = useState<string>('1995')

  useEffect(() => {
    let alive = true
    fetch('/api/house-vs-kospi').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) { if (j?.series) setD(j); else setErr(true) } })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  const from = WINDOWS.find(w => w.key === win)?.from ?? 1995
  // 구간 재기준(시작연도=100) — 시작점에 따라 승자가 바뀌는 걸 그대로 보여줌
  const view = useMemo(() => {
    if (!d) return { rows: [] as { y: number; 코스피: number | null; '아파트(전국)': number | null; '아파트(서울)': number | null }[], mult: null as null | { kospi: number; kor: number; seoul: number | null } }
    const rows0 = d.series.filter(s => s.y >= from)
    const base = rows0.find(s => s.kospi != null && s.aptKor != null)
    if (!base) return { rows: [], mult: null }
    const rb = (v: number | null, b: number | null) => v != null && b ? Math.round(v / b * 1000) / 10 : null
    const rows = rows0.map(s => ({
      y: s.y,
      코스피: rb(s.kospi, base.kospi),
      '아파트(전국)': rb(s.aptKor, base.aptKor),
      '아파트(서울)': rb(s.aptSeoul, base.aptSeoul ?? null),
    }))
    const last = rows[rows.length - 1]
    const mult = last ? {
      kospi: Math.round((last.코스피 ?? 100) / 100 * 10) / 10,
      kor: Math.round((last['아파트(전국)'] ?? 100) / 100 * 10) / 10,
      seoul: last['아파트(서울)'] != null && base.aptSeoul != null ? Math.round(last['아파트(서울)'] / 100 * 10) / 10 : null,
    } : null
    return { rows, mult }
  }, [d, from])

  if (err) return null
  const cap = d?.houseCap ?? []
  const capFirst = cap[0], capLast = cap[cap.length - 1]

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🏠⚔️📈 주택 vs 코스피 — 30년, 어디에 둔 돈이 이겼나</div>
      <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 10px', lineHeight: 1.55 }}>
        KOSPI지수와 KB 아파트 매매지수를 <b style={{ color: TK.slate300 }}>가격끼리</b> 같은 시작점=100으로 재기준(로그축).
        구간 버튼을 눌러보세요 — <b style={{ color: TK.slate300 }}>시작점에 따라 승자가 바뀝니다</b>.
      </div>

      {!d ? (
        <div style={{ color: TK.sub, fontSize: 12, padding: '14px 0' }}>📈 30년 시계열을 수집 중…</div>
      ) : (
        <>
          {/* 구간 토글 + 배수 배지 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            {WINDOWS.map(w => (
              <button key={w.key} onClick={() => setWin(w.key)} style={{
                padding: '4px 11px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: win === w.key ? TK.orange400 : TK.bg3, color: win === w.key ? TK.bg1 : TK.slate300,
                border: `1px solid ${win === w.key ? TK.orange400 : BORDER}`,
              }}>{w.label}</button>
            ))}
            {view.mult && (
              <span style={{ marginLeft: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 11.5, color: TK.blue400, fontWeight: 800 }}>코스피 {view.mult.kospi}배</span>
                <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 11.5, color: TK.slate100, fontWeight: 800 }}>아파트 전국 {view.mult.kor}배</span>
                {view.mult.seoul != null && <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 11.5, color: TK.orange400, fontWeight: 800 }}>서울 {view.mult.seoul}배</span>}
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={view.rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="y" tick={{ fill: TK.sub, fontSize: 10 }} interval={Math.max(0, Math.floor(view.rows.length / 10))} />
              <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: TK.sub, fontSize: 10 }} width={46} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="코스피" stroke={TK.blue400} strokeWidth={2.2} dot={false} connectNulls />
              <Line type="monotone" dataKey="아파트(전국)" stroke={TK.slate100} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="아파트(서울)" stroke={TK.orange400} strokeWidth={1.8} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>

          {/* 주택 시가총액 보조 */}
          {capFirst && capLast && capFirst.kor != null && capLast.kor != null && (
            <div style={{ marginTop: 10, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 13px', fontSize: 11, color: TK.sub9, lineHeight: 1.6 }}>
              🏘️ <b style={{ color: TK.slate200 }}>대한민국 주택 시가총액</b>: {capFirst.y}년 {Math.round(capFirst.kor).toLocaleString()}조 → {capLast.y}년 <b style={{ color: TK.slate100 }}>{Math.round(capLast.kor).toLocaleString()}조원</b>
              ({Math.round(capLast.kor / capFirst.kor * 10) / 10}배{capLast.seoul != null ? ` · 서울만 ${Math.round(capLast.seoul).toLocaleString()}조` : ''}).
              단, 시가총액은 <b style={{ color: TK.slate300 }}>신축 공급(재고 증가)까지 포함</b>이라 가격 상승과 다릅니다 — 위 레이스는 그래서 지수(가격)끼리 비교.
            </div>
          )}

          {/* 교육 캐비엇 */}
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 8, lineHeight: 1.65 }}>
            🎓 <b style={{ color: TK.slate300 }}>공정 비교의 함정들</b> — 코스피는 가격지수라 <b style={{ color: TK.slate300 }}>배당 미반영</b>(재투자 시 장기 연 +1.5~2%p 상회),
            아파트 지수는 <b style={{ color: TK.slate300 }}>임대수익(전세 레버리지)·보유세·거래비용 미반영</b>. 지수는 평균이라 개별 단지·종목의 승패는 전혀 다를 수 있습니다.
            시작점 효과: 저점에서 시작한 쪽이 항상 이겨 보입니다 — 그래서 구간 토글이 있는 것. 매수 신호가 아닌 자산 배분 관점의 관측(교육용).
            출처: 한국은행 ECOS(KOSPI·KB국민은행 지수·주택시가총액). 7일 캐시.
          </div>
        </>
      )}
    </div>
  )
}
