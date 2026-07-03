'use client'
// 🚨 개인 빚투 레이더 — 신용잔고·고객예탁금 실데이터 추이 + 빚투 비율 백분위 경보 + 역발상 교육(시뮬레이터 없음)
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts'
import type { LeverageRadarResult } from '@/app/api/leverage-radar/route'

const CARD = '#12151c', BORDER = '#252a36'
const LEVEL_META = {
  stable: { ko: '🟢 안정', color: '#4ade80', note: '빚투 비율이 역사적 평균 이하 — 신용발 투매 위험이 낮은 구간입니다.' },
  caution: { ko: '🟡 주의', color: '#fbbf24', note: '빚투 비율이 역사적 상위권 — 하락 시 반대매매가 낙폭을 키울 수 있는 구간입니다.' },
  danger: { ko: '🔴 위험', color: '#f87171', note: '빚투 비율이 역사적 극단 — 시장이 가장 낙관적인 순간일수록 신용발 연쇄 투매(마진콜)에 취약합니다.' },
} as const

export default function LeverageRadar() {
  const [d, setD] = useState<LeverageRadarResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/leverage-radar', { cache: 'no-store' }).then(r => r.json()).then(x => (x?.current ? setD(x) : setErr(true))).catch(() => setErr(true))
  }, [])

  const chart = useMemo(() => d?.series.map(s => ({ date: s.date.slice(2), 신용잔고: Math.round(s.margin / 1000) / 10, 예탁금: Math.round(s.deposit / 1000) / 10, 비율: s.ratio })) ?? [], [d])
  const lv = d ? LEVEL_META[d.current.level] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>🚨 개인 빚투 레이더 — 신용잔고로 시장 과열을 읽다</span>
          {d && <span style={{ background: `${lv!.color}1c`, color: lv!.color, border: `1px solid ${lv!.color}55`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{lv!.ko} (비율 백분위 {d.current.ratioPercentile}%)</span>}
        </div>
        <div style={{ color: '#8a9aaa', fontSize: 11, marginTop: 3 }}>
          신용잔고 = 개인이 증권사에서 <b style={{ color: '#cdd6e3' }}>빚내서 산 주식</b>(빚투). 예탁금 대비 비율이 역사적 극단이면 하락 시 반대매매(강제 청산)가 낙폭을 증폭 — 실데이터 자동 판정(네이버 일별 공표치, 절대 임계 하드코딩 없음).
        </div>

        {err && <div style={{ color: '#8a9aaa', fontSize: 13, padding: 12 }}>데이터를 불러오지 못했습니다.</div>}
        {!d && !err && <div style={{ color: '#8a9aaa', fontSize: 13, padding: 12 }}>신용잔고 3년 이력을 수집 중입니다…</div>}

        {d && <>
          {/* KPI 카드 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {[
              ['신용잔고(빚투)', `${(d.current.margin / 10000).toFixed(1)}조`, d.current.marginPercentile >= 90 ? '#f87171' : '#e2e8f0', `이력 백분위 ${d.current.marginPercentile}%`],
              ['고객예탁금(실탄)', `${(d.current.deposit / 10000).toFixed(1)}조`, '#e2e8f0', '증시 대기 자금'],
              ['빚투 비율', `${d.current.ratio}%`, lv!.color, `신용잔고 ÷ 예탁금`],
              ['신용잔고 20일 변화', `${d.current.margin20dChgPct > 0 ? '+' : ''}${d.current.margin20dChgPct}%`, d.current.margin20dChgPct > 5 ? '#f87171' : d.current.margin20dChgPct < -5 ? '#60a5fa' : '#e2e8f0', d.current.margin20dChgPct > 5 ? '급증(과열 가속)' : d.current.margin20dChgPct < -5 ? '급감(청산 진행)' : '완만'],
            ].map(([k, v, c, sub]) => (
              <div key={k as string} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 14px', minWidth: 140 }}>
                <div style={{ color: '#7f93a8', fontSize: 10 }}>{k}</div>
                <div style={{ color: c as string, fontWeight: 800, fontSize: 17 }}>{v}</div>
                <div style={{ color: '#8a9aaa', fontSize: 9.5 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: `${lv!.color}10`, border: `1px solid ${lv!.color}44`, borderRadius: 9, padding: '8px 12px', marginTop: 10, color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6 }}>
            <b style={{ color: lv!.color }}>{lv!.ko}</b> — {lv!.note}
          </div>
        </>}
      </div>

      {d && <>
        {/* 신용잔고 vs 예탁금 추이 (이중축) */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>📈 신용잔고(빚투) vs 고객예탁금 — 일별 {Math.round(d.series.length / 250 * 10) / 10}년</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 10.5, marginBottom: 6 }}>
            <span style={{ color: '#f87171' }}>■ 신용잔고(조원, 좌)</span>
            <span style={{ color: '#60a5fa' }}>■ 고객예탁금(조원, 우)</span>
            <span style={{ color: '#8a9aaa' }}>▲최고 {d.peak.date} {(d.peak.margin / 10000).toFixed(1)}조 · ▼최저 {d.trough.date} {(d.trough.margin / 10000).toFixed(1)}조</span>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9 }} minTickGap={60} axisLine={{ stroke: BORDER }} tickLine={false} />
                <YAxis yAxisId="m" domain={['auto', 'auto']} tick={{ fill: '#f87171', fontSize: 9.5 }} axisLine={false} tickLine={false} width={38} tickFormatter={(v: number) => `${v}조`} />
                <YAxis yAxisId="d" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#60a5fa', fontSize: 9.5 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v}조`} />
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, n: any) => [`${v}조`, n]} />
                <Area yAxisId="m" type="monotone" dataKey="신용잔고" stroke="#f87171" strokeWidth={2} fill="#f8717118" isAnimationActive={false} />
                <Line yAxisId="d" type="monotone" dataKey="예탁금" stroke="#60a5fa" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <ReferenceDot yAxisId="m" x={d.peak.date.slice(2)} y={Math.round(d.peak.margin / 1000) / 10} r={4} fill="#f87171" stroke="#fff" strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 빚투 비율 추이 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>⚖️ 빚투 비율(신용잔고 ÷ 예탁금) 추이</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>비율이 높다 = 대기 실탄 대비 빚이 많다(취약). 현재 {d.current.ratio}% = 이력 백분위 {d.current.ratioPercentile}% 지점.</div>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9 }} minTickGap={60} axisLine={{ stroke: BORDER }} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v}%`, '빚투 비율']} />
                <Area type="monotone" dataKey="비율" stroke="#fbbf24" strokeWidth={2} fill="#fbbf2415" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🆕 반대매매(강제청산) 실측 — 금융투자협회 */}
        {d.misu && (
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>💥 반대매매(강제청산) 실측 — 미수금 대비 반대매매</span>
              <span style={{ background: d.misu.current.forcedPct >= 10 ? '#f8717122' : '#4ade8018', color: d.misu.current.forcedPct >= 10 ? '#f87171' : '#4ade80', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>
                오늘 비중 {d.misu.current.forcedPct}% (백분위 {d.misu.current.forcedPctPercentile}%)
              </span>
            </div>
            <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 2, marginBottom: 8 }}>
              미수금 = 돈 없이 외상(T+2)으로 산 주식 대금. 못 갚으면 다음날 아침 <b style={{ color: '#cdd6e3' }}>시가 하한가로 강제 처분(반대매매)</b> — 급락장 투매의 연료. 데이터: 금융투자협회 일별 공표.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                ['위탁매매 미수금', `${(d.misu.current.misu / 1e4).toFixed(2)}조`, '#e2e8f0'],
                ['오늘 반대매매', `${d.misu.current.forced}억`, d.misu.current.forced > 500 ? '#f87171' : '#e2e8f0'],
                ['역대 최악(교육 앵커)', `${d.misu.peak.date} ${d.misu.peak.forced.toLocaleString()}억 (${d.misu.peak.forcedPct}%)`, '#f87171'],
              ].map(([k, v, c]) => (
                <div key={k as string} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 14px' }}>
                  <div style={{ color: '#7f93a8', fontSize: 10 }}>{k}</div>
                  <div style={{ color: c as string, fontWeight: 800, fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 10.5, marginBottom: 4 }}>
              <span style={{ color: '#f87171' }}>■ 반대매매금액(억, 좌)</span>
              <span style={{ color: '#fbbf24' }}>— 미수금 대비 비중(%, 우)</span>
            </div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={d.misu.series.map(s => ({ date: s.date.slice(2), 반대매매: s.forced, 비중: s.forcedPct }))} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9 }} minTickGap={60} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis yAxisId="a" tick={{ fill: '#f87171', fontSize: 9.5 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v}억`} />
                  <YAxis yAxisId="p" orientation="right" tick={{ fill: '#fbbf24', fontSize: 9.5 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [n === '반대매매' ? `${v}억` : `${v}%`, n]} />
                  <Bar yAxisId="a" dataKey="반대매매" fill="#f87171" opacity={0.75} isAnimationActive={false} />
                  <Line yAxisId="p" type="monotone" dataKey="비중" stroke="#fbbf24" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
              💡 스파이크가 솟는 날 = 급락 다음날 아침 강제청산 폭탄. 역대 최악 {d.misu.peak.date}(비중 {d.misu.peak.forcedPct}%)은 테마주 급락 사태 당시 — 빚투가 시장 전체 투매로 번진 실증 사례입니다.
            </div>
          </div>
        )}

        {/* 교육 — 양방향 해석 */}
        <div style={{ background: 'rgba(212,175,122,0.06)', border: '1px solid rgba(212,175,122,0.33)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: '#d4af7a', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>🎓 빚투 지표 읽는 법 — 두 방향 모두</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
            <div style={{ background: '#0f1117', borderRadius: 9, borderLeft: '3px solid #f87171', padding: '9px 12px' }}>
              <div style={{ color: '#f87171', fontWeight: 800, fontSize: 12 }}>📈 신용잔고 사상 최고권 = 과열 경고</div>
              <div style={{ color: '#9aa7b5', fontSize: 11, lineHeight: 1.6, marginTop: 3 }}>모두가 빚내서 살 만큼 낙관적인 순간 — 달리오 버블 지표의 &lsquo;신용 팽창&rsquo;과 같은 신호. 작은 하락에도 반대매매(담보부족 강제청산)가 연쇄 투매를 일으켜 낙폭을 증폭합니다.</div>
            </div>
            <div style={{ background: '#0f1117', borderRadius: 9, borderLeft: '3px solid #60a5fa', padding: '9px 12px' }}>
              <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12 }}>📉 신용잔고 급감 = 역발상 바닥 신호이기도</div>
              <div style={{ color: '#9aa7b5', fontSize: 11, lineHeight: 1.6, marginTop: 3 }}>반대매매가 쓸고 간 뒤(20일 변화 −5%↓ 급감)는 빚이 청산돼 매물 압력이 줄어든 상태 — 역사적으로 바닥권에서 자주 나타난 패턴입니다(보장 아님·참고 신호).</div>
            </div>
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.55 }}>
            ⚠️ 판정은 최근 {Math.round(d.series.length / 250 * 10) / 10}년 분포 기준 백분위(상대 판정) — 절대 임계 하드코딩 없음. 데이터: 네이버 증권 일별 공표(억원). 이 지표는 시장 전체 온도계이지 개별 종목 매매 지시가 아닙니다. 빚투의 수학적 위험(음의 복리)은 시뮬레이션 → 레버리지 위험 시뮬레이터 참조.
          </div>
        </div>
      </>}
    </div>
  )
}
