'use client'
// 💰 월세·수익률 축 — 아파트 전월세 전환율(임대시장의 금리) vs 주담대 금리 스프레드. "월세로 돌린 이율이 대출이자를 이기는가"를 15년 시계열로.
import { useState, useEffect } from 'react'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { TK } from '@/lib/theme'
import type { ReRentApi } from '@/app/api/re-rent/route'

const CARD = TK.card, BORDER = TK.border

export default function RentYieldSpread() {
  const [d, setD] = useState<ReRentApi | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/re-rent').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) { if (j?.latest) setD(j); else setErr(true) } })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  if (err) return null

  const sp = d?.latest.spread ?? null
  const pct = d?.latest.spreadPercentile ?? null
  const spTone = sp == null ? TK.slate200 : sp >= 1.5 ? TK.green400 : sp > 0 ? TK.yellow500 : TK.red400
  const verdict = pct == null ? null
    : pct >= 70 ? { label: '월세 캐리 여유(역사 상위)', desc: '전환율이 대출금리를 크게 웃돎 — 임대인은 전세보다 월세가 유리(전세의 월세화 압력)' }
    : pct <= 30 ? { label: '캐리 축소(역사 하위)', desc: '전환율과 대출금리의 격차가 좁음 — 레버리지 임대의 이자 부담이 상대적으로 큼' }
    : { label: '중간 수준', desc: '전환율−대출금리 격차가 역사 중간 범위' }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>💰 월세 수익률 축 — 전월세 전환율 vs 주담대 금리 (아파트)</div>
      <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 10px', lineHeight: 1.55 }}>
        전환율 = 전세보증금을 월세로 돌릴 때 적용되는 연이율(부동산원 실거래 기반) = <b style={{ color: TK.slate300 }}>임대시장의 금리이자 임대수익률의 상한 프록시</b>.
        스프레드(전환율−주담대)가 클수록 &lsquo;빌려서 세놓는&rsquo; 캐리가 좋고, 임대인은 전세보다 월세를 선호하게 됩니다{d ? ` · 기준월 ${d.latest.asOfMonth}` : ''}.
      </div>

      {!d ? (
        <div style={{ color: TK.sub, fontSize: 12, padding: '14px 0' }}>💰 전환율·금리 시계열을 수집 중…</div>
      ) : (
        <>
          {/* KPI 3 + 판정 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>아파트 전환율(전국)</div>
              <div style={{ color: TK.slate100, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{d.latest.convKor ?? '—'}%</div>
              <div style={{ color: TK.sub, fontSize: 10 }}>보증금→월세 연이율</div>
            </div>
            <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>주담대 금리(신규)</div>
              <div style={{ color: TK.violet400, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{d.latest.mortgage ?? '—'}%</div>
              <div style={{ color: TK.sub, fontSize: 10 }}>레버리지 비용</div>
            </div>
            <div style={{ flex: '2 1 220px', background: TK.bg3, border: `1px solid ${spTone}55`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>스프레드(전환율 − 주담대)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: spTone, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{sp != null ? `${sp > 0 ? '+' : ''}${sp}%p` : '—'}</span>
                {verdict && <span style={{ color: spTone, fontSize: 12, fontWeight: 800 }}>{verdict.label}{pct != null ? ` · 백분위 ${pct}%` : ''}</span>}
              </div>
              {verdict && <div style={{ color: TK.sub9, fontSize: 10.5, lineHeight: 1.5 }}>{verdict.desc}</div>}
            </div>
          </div>

          {/* 시계열 — 전부 %라 단일 축 */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={d.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.floor(d.series.length / 8)} />
              <YAxis tick={{ fill: TK.sub, fontSize: 10 }} width={36} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke={TK.sub2} />
              <Area type="monotone" dataKey="스프레드" fill={`${TK.green400}1e`} stroke={`${TK.green400}88`} strokeWidth={1} dot={false} connectNulls />
              <Line type="monotone" dataKey="전국" name="전환율(전국)" stroke={TK.slate100} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="서울" name="전환율(서울)" stroke={TK.orange400} strokeWidth={1.6} dot={false} connectNulls />
              <Line type="monotone" dataKey="지방" name="전환율(지방)" stroke={TK.sky400} strokeWidth={1.4} dot={false} connectNulls />
              <Line type="monotone" dataKey="주담대" stroke={TK.violet400} strokeWidth={1.8} strokeDasharray="5 3" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 시도 스냅샷 — 전환율 높은 순 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {d.regions.map(r => (
              <span key={r.name} style={{
                background: TK.bg3, borderRadius: 7, padding: '4px 9px', fontSize: 10.5, fontWeight: 700,
                border: `1px solid ${r.spread != null && r.spread <= 0 ? `${TK.red400}66` : BORDER}`, color: TK.slate300,
              }}>
                {r.name} {r.conv}%{r.spread != null ? <span style={{ color: r.spread > 0 ? TK.green400 : TK.red400, fontWeight: 800 }}> {r.spread > 0 ? '+' : ''}{r.spread}</span> : null}
              </span>
            ))}
            <span style={{ fontSize: 9.5, color: TK.sub, alignSelf: 'center' }}>칩 뒤 숫자 = 지역 전환율 − 주담대(%p)</span>
          </div>

          {/* 교육 캐비엇 */}
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 8, lineHeight: 1.65 }}>
            🎓 <b style={{ color: TK.slate300 }}>읽는 법</b> — 전환율 = (월세×12) ÷ (전세보증금 − 월세보증금). 지방 전환율이 높은 건 &lsquo;수익률이 좋아서&rsquo;라기보다
            <b style={{ color: TK.slate300 }}> 공실·유동성·시세차익 리스크의 보상</b>인 경우가 많습니다(주식의 고배당 함정과 동형).
            스프레드가 0 이하면 빌려서 세놓는 구조는 역마진 — 2022~23 금리 급등기에 서울은 실제 9개월 역마진(최저 −0.8%p), 전국도 +0.3%p까지 좁혀졌던 게 실사례.
            실제 순수익률은 공실·세금·수선비로 전환율보다 낮으며, 매수 신호가 아닌 <b style={{ color: TK.slate300 }}>구조 관측</b>입니다(교육용).
            출처: 한국부동산원 R-ONE(아파트 전월세전환율)·한국은행 ECOS(주담대 신규취급). 24시간 캐시.
          </div>
        </>
      )}
    </div>
  )
}
