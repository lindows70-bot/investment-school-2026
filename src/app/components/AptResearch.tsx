'use client'
// 🔍 아파트 단지 리서치 — 지역 선택 → 단지 랭킹 → 매매/전세 실거래 추이(개별 거래 점 + 월 중위 선) + 밸류 3축
// (전세가율=사용가치 비율 · 고점 대비 · 지역 벌집 국면 연동). 전부 국토부 실거래 신고 데이터(호가 아님).
import { useState, useEffect, useMemo } from 'react'
import { ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { LAWD_REGIONS } from '@/lib/rtms'
import SeoulAptMap from '@/app/components/SeoulAptMap'
import type { AptResearchResult } from '@/app/api/re-apt/route'

const CARD = '#141824', BORDER = '#1e293b'

export default function AptResearch({ initialLawd }: { initialLawd?: string } = {}) {
  const [lawd, setLawd] = useState(initialLawd && LAWD_REGIONS.some(r => r.lawd === initialLawd) ? initialLawd : '11680')
  const [apt, setApt] = useState('')
  const [aptInput, setAptInput] = useState('')
  const [area, setArea] = useState<number | null>(null)
  const [d, setD] = useState<AptResearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    const q = `lawd=${lawd}${apt ? `&apt=${encodeURIComponent(apt)}` : ''}${area != null ? `&area=${area}` : ''}`
    fetch(`/api/re-apt?${q}`).then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setErr(j.error); else setD(j) })
      .catch(() => { if (alive) setErr('데이터를 불러오지 못했습니다.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [lawd, apt, area])

  const sel = d?.selected ?? null
  // 차트 데이터: 월 중위 선 + 개별 거래 점(같은 X축 ym)
  const chart = useMemo(() => {
    if (!sel) return []
    const rows = new Map<string, { ym: string; sale: number | null; jeonse: number | null; saleDots: number[]; jeonseDots: number[] }>()
    for (const m of sel.monthly) rows.set(m.ym, { ym: m.ym, sale: m.sale, jeonse: m.jeonse, saleDots: [], jeonseDots: [] })
    for (const dl of sel.deals) {
      const r = rows.get(dl.ym); if (!r) continue
      if (dl.type === '매매') r.saleDots.push(dl.price); else r.jeonseDots.push(dl.price)
    }
    return Array.from(rows.values())
  }, [sel])
  // Scatter용 평탄화
  const dots = useMemo(() => {
    const out: { ym: string; saleDot?: number; jeonseDot?: number }[] = []
    for (const r of chart) {
      for (const v of r.saleDots) out.push({ ym: r.ym, saleDot: v })
      for (const v of r.jeonseDots) out.push({ ym: r.ym, jeonseDot: v })
    }
    return out
  }, [chart])

  const regionLabel = LAWD_REGIONS.find(r => r.lawd === lawd)
  const v = sel?.value
  const ratioTone = v?.jeonseRatio == null ? '#e2e8f0' : v.jeonseRatio >= 70 ? '#4ade80' : v.jeonseRatio >= 55 ? '#eab308' : '#f87171'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 서울 자치구 히트맵 — 구 클릭 = 지역 선택 */}
      <SeoulAptMap lawd={lawd} onSelect={l => { setLawd(l); setApt(''); setAptInput(''); setArea(null) }}
        onSelectApt={q => { setApt(q); setAptInput(q); setArea(null) }} refreshKey={d?.asOf ?? ''} />
      {/* 지역 선택 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select value={lawd} onChange={e => { setLawd(e.target.value); setApt(''); setArea(null) }}
          style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}>
          {Array.from(new Set(LAWD_REGIONS.map(r => r.sido))).map(sido => (
            <optgroup key={sido} label={sido}>
              {LAWD_REGIONS.filter(r => r.sido === sido).map(r => <option key={r.lawd} value={r.lawd}>{sido} {r.name}</option>)}
            </optgroup>
          ))}
        </select>
        {/* 단지 검색 — Top40 밖 단지(예: '오금동 대림')도 부분일치 조회 */}
        <form onSubmit={e => { e.preventDefault(); const q = aptInput.trim(); if (q) { setApt(q); setArea(null) } }} style={{ display: 'flex', gap: 6 }}>
          <input value={aptInput} onChange={e => setAptInput(e.target.value)} placeholder="단지 검색 (예: 오금동 대림)"
            style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, width: 190 }} />
          <button type="submit" style={{ background: '#fb923c', border: 'none', borderRadius: 9, padding: '9px 14px', color: '#0d1017', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>🔍 검색</button>
        </form>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>최근 24개월 실거래(국토부 신고 기준·호가 아님) · 첫 로드는 수집에 ~30초</span>
      </div>

      {loading ? (
        <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🔍 {regionLabel?.name ?? lawd} 실거래 24개월을 수집 중…</div>
      ) : err ? (
        <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#f87171', fontSize: 12 }}>⚠️ {err}</div>
      ) : d && (
        <>
          {d.queryMiss && (
            <div style={{ background: '#2a1c0e', border: '1px solid #b45309', borderRadius: 10, padding: '9px 14px', fontSize: 11.5, color: '#fdba74' }}>
              ⚠️ &lsquo;{apt}&rsquo; 실거래를 최근 24개월에서 찾지 못했습니다(재건축 멸실·표기 차이 가능) — 거래 1위 단지를 대신 표시합니다.
            </div>
          )}
          {/* 단지 랭킹 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
              🏢 {d.sido} {regionLabel?.name} — 거래 활발 단지 Top {d.complexes.length} <span style={{ color: '#8a9aaa', fontWeight: 400, fontSize: 11 }}>(24개월 매매 건수순 · 클릭 선택)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.complexes.map(c => (
                <button key={c.name} onClick={() => { setApt(c.name); setArea(null) }} style={{
                  padding: '5px 11px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: sel?.name === c.name ? '#fb923c' : '#0f1117', color: sel?.name === c.name ? '#0d1017' : '#cbd5e1',
                  border: `1px solid ${sel?.name === c.name ? '#fb923c' : BORDER}`,
                }}>{c.name} <span style={{ opacity: 0.7 }}>{c.dealCount}건</span></button>
              ))}
              {sel && !d.complexes.some(c => c.name === sel.name) && (
                <button style={{
                  padding: '5px 11px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, cursor: 'default',
                  background: '#fb923c', color: '#0d1017', border: '1px solid #fb923c',
                }}>🔍 {sel.name} <span style={{ opacity: 0.7 }}>검색</span></button>
              )}
            </div>
          </div>

          {sel && (
            <>
              {/* 선택 단지 헤더 + 면적 칩 + 밸류 3축 */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 16 }}>🏢 {sel.name}</span>
                  <span style={{ display: 'inline-flex', gap: 5 }}>
                    {sel.areas.map(a => (
                      <button key={a.area} onClick={() => setArea(a.area)} style={{
                        padding: '3px 9px', borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                        background: sel.area === a.area ? '#2dd4bf' : '#0f1117', color: sel.area === a.area ? '#0d1017' : '#8a9aaa',
                        border: `1px solid ${sel.area === a.area ? '#2dd4bf' : BORDER}`,
                      }}>{a.area}㎡ <span style={{ opacity: 0.7 }}>{a.count}</span></button>
                    ))}
                  </span>
                </div>
                {sel.overview && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                    {([
                      ['🏢 세대수', sel.overview.households != null ? `${sel.overview.households.toLocaleString()}세대` : null],
                      ['🧱 동수', sel.overview.dongs != null ? `${sel.overview.dongs}개동` : null],
                      ['📅 준공', sel.overview.aprv],
                      ['🚗 주차', sel.overview.park != null ? `${sel.overview.park.toLocaleString()}대${sel.overview.parkPerHh != null ? ` (세대당 ${sel.overview.parkPerHh})` : ''}` : null],
                      ['🔥 난방', sel.overview.heat],
                    ] as [string, string | null][]).filter(([, val]) => val).map(([label, val]) => (
                      <span key={label} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: '#cbd5e1' }}>
                        <span style={{ color: '#8a9aaa', fontWeight: 700 }}>{label}</span> <span style={{ fontWeight: 800 }}>{val}</span>
                      </span>
                    ))}
                    <span style={{ fontSize: 9.5, color: '#8a9aaa', alignSelf: 'center' }}>서울시 공동주택 마스터</span>
                  </div>
                )}
                {v && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                      <div style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700 }}>💎 전세가율(사용가치 비율)</div>
                      <div style={{ color: ratioTone, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{v.jeonseRatio != null ? `${v.jeonseRatio}%` : '—'}</div>
                      <div style={{ color: '#8a9aaa', fontSize: 10 }}>매매 중위 {v.saleMed6 ?? '—'}억 vs 전세 중위 {v.jeonseMed6 ?? '—'}억 (6개월)</div>
                    </div>
                    <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                      <div style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700 }}>⛰️ 고점 대비</div>
                      <div style={{ color: v.vsPeak == null ? '#e2e8f0' : v.vsPeak >= -5 ? '#f87171' : v.vsPeak >= -20 ? '#eab308' : '#4ade80', fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>
                        {v.vsPeak != null ? `${v.vsPeak > 0 ? '+' : ''}${v.vsPeak}%` : '—'}
                      </div>
                      <div style={{ color: '#8a9aaa', fontSize: 10 }}>역대 최고 실거래 {v.peak ?? '—'}억 대비 현재 중위</div>
                    </div>
                    <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
                      <div style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700 }}>🐝 지역 국면 ({d.sido})</div>
                      <div style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 900 }}>{v.regionPhase ?? '—'}</div>
                      <div style={{ color: '#8a9aaa', fontSize: 10 }}>벌집순환모형 연동 · 주담대 {v.mortgageRate != null ? `${v.mortgageRate}%` : '—'} 참고</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 실거래 추이 차트 */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📈 실거래 추이 — {sel.name} 전용 {sel.area}㎡(±2㎡)</div>
                <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 8px' }}>점 = 개별 실거래(빨강 매매·초록 전세) · 선 = 월 중위가. 전세와 매매의 간격이 좁을수록 &lsquo;사용가치가 받치는 가격&rsquo;.</div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
                    <XAxis dataKey="ym" tick={{ fill: '#8a9aaa', fontSize: 9.5 }} interval={2} allowDuplicatedCategory={false} />
                    <YAxis tick={{ fill: '#8a9aaa', fontSize: 10 }} width={44} domain={['auto', 'auto']} tickFormatter={vv => `${vv}억`} />
                    <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#cbd5e1' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(vv: any, name: any) => [`${vv}억`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {/* 산점은 별도 data 배열이라 공유 툴팁이 다른 달 거래를 끌어옴 → 툴팁 제외(개별 거래는 하단 카드) */}
                    <Scatter data={dots} dataKey="saleDot" name="매매 실거래" fill="#f87171" fillOpacity={0.55} shape="circle" tooltipType="none" />
                    <Scatter data={dots} dataKey="jeonseDot" name="전세 실거래" fill="#4ade80" fillOpacity={0.5} shape="circle" tooltipType="none" />
                    <Line type="monotone" dataKey="sale" name="매매 월 중위" stroke="#f1f5f9" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="jeonse" name="전세 월 중위" stroke="#2dd4bf" strokeWidth={1.6} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 최근 거래 테이블 */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🧾 최근 실거래 (신고 기준)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: 6 }}>
                  {sel.deals.slice(0, 24).map((dl, i) => (
                    <div key={i} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 11px', fontSize: 11 }}>
                      <span style={{ color: dl.type === '매매' ? '#f87171' : '#4ade80', fontWeight: 800 }}>{dl.type}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 800, fontFamily: 'monospace', marginLeft: 7 }}>{dl.price}억</span>
                      <span style={{ color: '#8a9aaa', marginLeft: 7 }}>{dl.ym}-{String(dl.day).padStart(2, '0')} · {dl.area}㎡ · {dl.floor ?? '—'}층</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 정직 캐비엇 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 18px', fontSize: 10.5, color: '#8a9aaa', lineHeight: 1.65 }}>
            ⚠️ 실거래 신고는 계약 후 30일 이내라 최근 1개월 데이터는 불완전합니다. 같은 면적대라도 동·층·리모델링에 따라 가격 차가 크고, 월세 거래는 v1에서 제외(전세만).
            전세가율이 높다고 무조건 저평가가 아니며(역전세·깡통 위험 병존), 매수 추천이 아닌 <b style={{ color: '#cbd5e1' }}>가치 관측</b> 도구입니다(교육용).
            출처: 국토교통부 실거래가 공개시스템 · 서울 매매·단지 정보는 서울 열린데이터광장(국토부와 건별 교차검증 일치, 단지 개요는 의무관리단지만).
          </div>
        </>
      )}
    </div>
  )
}
