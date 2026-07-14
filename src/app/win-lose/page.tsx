'use client'
// ⚔️ 승패 해부실 — "지금 장에서 오르는 종목 vs 떨어지는 종목은 뭐가 다른가"를 매일 자동 해부하는 교육 화면.
//   ①스코어보드+오늘의 교훈 ②대전표(나비 바) ③섹터 전장 지도 ④산점도 ⑤승패 Top8 ⑥캐비엇.
//   관측이지 추천 아님(점수·추천 미반영) · 전부 기존 SSOT 재사용 · 내 보유 하이라이트는 본인 RLS 조회로만.
import { useEffect, useMemo, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { sectorMeta } from '@/lib/gicsSectorMeta'
import {
  type WLApi, type WLRow, type WLPeriod, type WLQuad,
  WL_THRESH, WL_PERIOD_LABEL, retOf, splitGroups, factorStats, buildLesson,
} from '@/lib/winLose'

const CARD = '#12151f', BORDER = '#232838'
const QUAD_META: Record<WLQuad, { icon: string; label: string; color: string; order: number }> = {
  leading: { icon: '🌱', label: '주도', color: '#4ade80', order: 0 },
  improving: { icon: '❄️', label: '태동', color: '#38bdf8', order: 1 },
  weakening: { icon: '🔥', label: '과열', color: '#fb923c', order: 2 },
  lagging: { icon: '🍂', label: '이탈', color: '#f87171', order: 3 },
}
const fmt1 = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)
const retColor = (n: number | null) => (n == null ? '#8599ae' : n > 0 ? '#4ade80' : n < 0 ? '#f87171' : '#e2e8f0')

export default function WinLosePage() {
  const [data, setData] = useState<WLApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<WLPeriod>('1m')
  const [mine, setMine] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/win-lose').then(r => r.ok ? r.json() : null)
      .then(j => setData(j?.rows ? j : null)).catch(() => setData(null)).finally(() => setLoading(false))
    // 내 보유 하이라이트(본인 RLS만 — 다른 학생 보유는 절대 표시 안 함)
    const sb = createClient()
    sb.auth.getUser().then(({ data: u }) => {
      if (!u?.user) return
      sb.from('investments').select('ticker,market').eq('user_id', u.user.id).then(({ data: inv }) => {
        if (inv) setMine(new Set(inv.map(i => `${i.market}:${String(i.ticker).replace(/\.(KS|KQ)$/i, '').toUpperCase()}`)))
      })
    })
  }, [])

  const rows = data?.rows ?? []
  const { win, mid, lose } = useMemo(() => splitGroups(rows, period), [rows, period])
  const stats = useMemo(() => factorStats(win, lose), [win, lose])
  const lesson = useMemo(() => buildLesson(stats, WL_PERIOD_LABEL[period]), [stats, period])
  const isMine = (r: WLRow) => mine.has(`${r.market}:${r.ticker.toUpperCase()}`)
  const th = WL_THRESH[period]

  // 섹터 전장 지도 데이터 — 섹터별 승/패 종목, 로테이션 국면 순 정렬
  const battlefield = useMemo(() => {
    const bySec = new Map<string, { quad: WLQuad | null; win: WLRow[]; lose: WLRow[] }>()
    for (const r of [...win, ...lose]) {
      if (!r.sector) continue
      const e = bySec.get(r.sector) ?? { quad: r.rotQuad, win: [], lose: [] }
      if (retOf(r, period)! > th) e.win.push(r); else e.lose.push(r)
      if (r.rotQuad) e.quad = r.rotQuad
      bySec.set(r.sector, e)
    }
    return Array.from(bySec.entries())
      .map(([sector, e]) => ({ sector, ...e, total: e.win.length + e.lose.length, winRate: (e.win.length / Math.max(1, e.win.length + e.lose.length)) * 100 }))
      .filter(x => x.total >= 3)
      .sort((a, b) => (a.quad ? QUAD_META[a.quad].order : 9) - (b.quad ? QUAD_META[b.quad].order : 9) || b.winRate - a.winRate)
  }, [win, lose, period, th])

  const scatterData = useMemo(() => rows.filter(r => r.pos52 != null && retOf(r, period) != null)
    .map(r => ({ x: r.pos52!, y: Math.max(-60, Math.min(80, retOf(r, period)!)), r })), [rows, period])

  return (
    <div style={{ padding: '18px 20px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── 헤더: 스코어보드 + 기간 토글 ───────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 19, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>⚔️ 승패 해부실</h1>
          <span style={{ fontSize: 11.5, color: '#8599ae' }}>지금 장에서 <b style={{ color: '#cbd5e1' }}>오르는 종목 vs 떨어지는 종목</b>의 차이 — 시장의 채점 기준을 매일 해부</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 7, overflow: 'hidden' }}>
            {(['1w', '1m', '3m'] as WLPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                background: period === p ? '#4f46e5' : 'transparent', color: period === p ? '#fff' : '#8599ae',
              }}>{WL_PERIOD_LABEL[p].replace('최근 ', '')}</button>
            ))}
          </span>
        </div>
        {loading ? <div style={{ height: 60, background: '#171b26', borderRadius: 8, marginTop: 10 }} /> : !data ? (
          <div style={{ fontSize: 12, color: '#7f93a8', marginTop: 10 }}>데이터 준비 중 — 잠시 후 새로고침하세요(첫 계산은 1~2분).</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ background: '#0d2818', border: '1px solid #22c55e44', borderRadius: 9, padding: '7px 14px', fontSize: 13 }}>🔺 오르는 <b style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: 16 }}>{win.length}</b><span style={{ color: '#7f93a8', fontSize: 10 }}> (평균 {fmt1(win.length ? win.reduce((s, r) => s + retOf(r, period)!, 0) / win.length : null)})</span></span>
              <span style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 14px', fontSize: 13 }}>➖ 보합 <b style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 16 }}>{mid.length}</b></span>
              <span style={{ background: '#2a0f12', border: '1px solid #ef444444', borderRadius: 9, padding: '7px 14px', fontSize: 13 }}>🔻 떨어지는 <b style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 16 }}>{lose.length}</b><span style={{ color: '#7f93a8', fontSize: 10 }}> (평균 {fmt1(lose.length ? lose.reduce((s, r) => s + retOf(r, period)!, 0) / lose.length : null)})</span></span>
              <span style={{ fontSize: 10, color: '#7f93a8', alignSelf: 'center' }}>유니버스 {rows.length}종(추천 후보 풀+학교 종목) · 임계 ±{th}%</span>
            </div>
            {/* 🎓 오늘의 교훈 — 결정론 자동 생성 */}
            <div style={{ marginTop: 12, background: '#1a1330', border: '1px solid #7c3aed55', borderRadius: 10, padding: '10px 14px' }}>
              <b style={{ fontSize: 12, color: '#c4b5fd' }}>🎓 오늘의 교훈</b>
              <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 1.6 }}>{lesson.text}</div>
            </div>
          </>
        )}
      </div>

      {data && win.length >= 3 && lose.length >= 3 && (
        <>
          {/* ── ⚔️ 대전표 (Tale of the Tape) ───────────────────── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
            <b style={{ fontSize: 14, color: '#f1f5f9' }}>⚔️ 오늘의 대전표</b>
            <span style={{ fontSize: 10.5, color: '#7f93a8', marginLeft: 8 }}>격차 큰 요인이 진하게 — <b style={{ color: '#8599ae' }}>회색 요인은 승패를 못 가른 것</b>(그게 교훈)</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 4px', fontSize: 11.5, fontWeight: 800 }}>
              <span style={{ color: '#4ade80' }}>🔺 오르는 {win.length}종</span><span style={{ color: '#f87171' }}>떨어지는 {lose.length}종 🔻</span>
            </div>
            {stats.map(s => {
              const dim = s.gap < 12
              return (
                <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 190px 1fr', alignItems: 'center', gap: 8, padding: '5px 0', opacity: dim ? 0.45 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                    <b style={{ fontSize: 12, color: s.betterSide === 'win' && !dim ? '#4ade80' : '#cbd5e1', fontFamily: 'monospace' }}>{s.winDisp}</b>
                    <div style={{ width: '55%', height: 10, background: '#0f1117', borderRadius: 5, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ width: `${s.winBar}%`, background: dim ? '#3f4a5c' : '#22c55e', borderRadius: 5 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: dim ? '#8599ae' : '#e2e8f0', fontWeight: 700 }} title={s.desc}>
                    {s.icon} {s.label}{dim && <span style={{ color: '#7f93a8', fontWeight: 600 }}> (무변별)</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: '55%', height: 10, background: '#0f1117', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${s.loseBar}%`, background: dim ? '#3f4a5c' : '#ef4444', borderRadius: 5 }} />
                    </div>
                    <b style={{ fontSize: 12, color: s.betterSide === 'lose' && !dim ? '#f87171' : '#cbd5e1', fontFamily: 'monospace' }}>{s.loseDisp}</b>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── 🧭 섹터 전장 지도 ─────────────────────────────── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
            <b style={{ fontSize: 14, color: '#f1f5f9' }}>🧭 섹터 전장 지도</b>
            <span style={{ fontSize: 10.5, color: '#7f93a8', marginLeft: 8 }}>로테이션 국면(🌱주도→🍂이탈) 순 — 승자는 어느 섹터에, 패자는 어느 섹터에 몰려 있나</span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {battlefield.map(b => {
                const meta = sectorMeta(b.sector)
                const qm = b.quad ? QUAD_META[b.quad] : null
                const chips = (arr: WLRow[], color: string, bg: string) => (
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                    {arr.slice(0, 5).map(r => (
                      <span key={r.ticker} title={`${r.name} ${fmt1(retOf(r, period))}`} style={{
                        fontSize: 9.5, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '1px 6px',
                        border: isMine(r) ? '1px solid #f1f5f9' : '1px solid transparent',
                      }}>{r.name.length > 8 ? r.name.slice(0, 8) : r.name}</span>
                    ))}
                    {arr.length > 5 && <span style={{ fontSize: 9.5, color: '#7f93a8' }}>+{arr.length - 5}</span>}
                  </span>
                )
                return (
                  <div key={b.sector} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0f1117', borderRadius: 9, padding: '7px 11px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: meta?.color ?? '#cbd5e1', minWidth: 110 }}>{meta?.icon} {meta?.ko ?? b.sector}</span>
                    {qm && <span style={{ fontSize: 9.5, fontWeight: 800, color: qm.color, background: qm.color + '18', borderRadius: 4, padding: '1px 6px' }}>{qm.icon}{qm.label}</span>}
                    <div style={{ width: 90, height: 8, background: '#2a0f12', borderRadius: 4, overflow: 'hidden' }} title={`승률 ${Math.round(b.winRate)}%`}>
                      <div style={{ width: `${b.winRate}%`, height: '100%', background: '#22c55e' }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: b.winRate >= 50 ? '#4ade80' : '#f87171', minWidth: 56 }}>🔺{b.win.length} 🔻{b.lose.length}</span>
                    {chips(b.win, '#4ade80', '#0d2818')}{chips(b.lose, '#f87171', '#2a0f12')}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 🎯 산점도: 52주 위치 × 수익률 ───────────────────── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
            <b style={{ fontSize: 14, color: '#f1f5f9' }}>🎯 52주 위치 × {WL_PERIOD_LABEL[period]} 수익률</b>
            <span style={{ fontSize: 10.5, color: '#7f93a8', marginLeft: 8 }}>색 = 추세(🟢정배열·⚪혼조·🔴역배열) · 흰 테두리 = 내 보유 · 우상단 = 신고가권에서 계속 오르는 승자 구역</span>
            <div style={{ height: 330, marginTop: 8 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 16, bottom: 6, left: -14 }}>
                  <XAxis type="number" dataKey="x" domain={[0, 100]} tick={{ fontSize: 10, fill: '#7f93a8' }} label={{ value: '52주 위치 (0=저점 · 100=신고가)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#8599ae' }} />
                  <YAxis type="number" dataKey="y" tick={{ fontSize: 10, fill: '#7f93a8' }} unit="%" />
                  <ZAxis range={[28, 28]} />
                  <ReferenceLine y={0} stroke="#3f4a5c" />
                  <ReferenceLine x={50} stroke="#3f4a5c" strokeDasharray="4 4" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                    const p = payload?.[0]?.payload as { r: WLRow } | undefined
                    if (!p) return null
                    return (
                      <div style={{ background: '#1b2130', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 11 }}>
                        <b style={{ color: '#f1f5f9' }}>{p.r.name}</b> <span style={{ color: '#7f93a8' }}>{p.r.market}</span>
                        <div style={{ color: retColor(retOf(p.r, period)) }}>{WL_PERIOD_LABEL[period]} {fmt1(retOf(p.r, period))}</div>
                        <div style={{ color: '#8599ae' }}>52주 {Math.round(p.r.pos52 ?? 0)} · {p.r.trend === 'up' ? '정배열' : p.r.trend === 'down' ? '역배열' : '혼조'}{p.r.sector ? ` · ${sectorMeta(p.r.sector)?.ko ?? p.r.sector}` : ''}</div>
                      </div>
                    )
                  }} />
                  <Scatter data={scatterData}>
                    {scatterData.map((d, i) => (
                      <Cell key={i}
                        fill={d.r.trend === 'up' ? '#22c55e' : d.r.trend === 'down' ? '#ef4444' : '#64748b'}
                        stroke={isMine(d.r) ? '#f1f5f9' : 'none'} strokeWidth={isMine(d.r) ? 1.6 : 0} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 🏆/💀 개별 랭킹 ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            {([['🏆 상승 Top 8', win.slice(0, 8), '#4ade80'], ['💀 하락 Top 8', lose.slice(0, 8), '#f87171']] as const).map(([title, arr, color]) => (
              <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
                <b style={{ fontSize: 13.5, color }}>{title}</b>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {arr.map((r, i) => (
                    <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, background: '#0f1117', borderRadius: 7, padding: '5px 9px', border: isMine(r) ? '1px solid #f1f5f955' : '1px solid transparent' }}>
                      <span style={{ color: '#7f93a8', fontFamily: 'monospace', width: 14 }}>{i + 1}</span>
                      <b style={{ color: '#e2e8f0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isMine(r) && '⭐'}{r.name}</b>
                      <span style={{ fontSize: 9, color: '#7f93a8' }}>{r.market}</span>
                      {r.sector && <span style={{ fontSize: 9 }}>{sectorMeta(r.sector)?.icon}</span>}
                      <span style={{ fontSize: 9.5, color: r.trend === 'up' ? '#4ade80' : r.trend === 'down' ? '#f87171' : '#8599ae' }}>{r.trend === 'up' ? '📈정배열' : r.trend === 'down' ? '📉역배열' : '〰️혼조'}</span>
                      {r.fwd === 'accel' && <span style={{ fontSize: 9.5, color: '#4ade80' }}>EPS↑</span>}
                      {r.fwd === 'decline' && <span style={{ fontSize: 9.5, color: '#f87171' }}>EPS↓</span>}
                      <b style={{ color: retColor(retOf(r, period)), fontFamily: 'monospace', fontSize: 12 }}>{fmt1(retOf(r, period))}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── 🎓 캐비엇 ───────────────────────────────────── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 16px', fontSize: 11, color: '#8a9aaa', lineHeight: 1.7 }}>
            🎓 <b style={{ color: '#cbd5e1' }}>이 화면 읽는 법</b> — 여기 보이는 건 <b style={{ color: '#e2e8f0' }}>과거 {WL_PERIOD_LABEL[period]}의 채점 기준</b>이지 미래 보장이 아닙니다.
            장이 바뀌면 승부 요인도 바뀝니다(오늘 추세가 갈랐어도 다음 달엔 밸류가 가를 수 있음) — <b style={{ color: '#c4b5fd' }}>매일 와서 &lsquo;기준이 바뀌는 순간&rsquo;을 목격하는 것</b>이 이 화면의 사용법입니다.
            승자 추격 매수 신호가 아니며(과열 위험), 종목 선정(WHAT)은 펀더멘탈·통합추천, 타이밍(WHEN)은 타점 신호등이 담당합니다. 유니버스 = 추천 후보 풀(514종)+학교 보유 합집합 · 교육용.
          </div>
        </>
      )}
    </div>
  )
}
