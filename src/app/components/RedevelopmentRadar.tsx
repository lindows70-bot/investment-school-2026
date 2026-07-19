'use client'
// 🏗️ 서울 정비사업(재건축·재개발) 레이더 — 자치구 히트맵·유형분포·신규지정/해제 + 추진단계(xlsx)
import { useState, useEffect, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { RedevelopResult } from '@/app/api/re-redevelopment/route'
import { LAWD_REGIONS } from '@/lib/rtms'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'
const GU_LAWD = new Map(LAWD_REGIONS.filter(r => r.sido === '서울').map(r => [r.name, r.lawd]))
const TYPE_COLOR: Record<string, string> = { 재개발: TK.orange400, 재건축: TK.violet400, 도시환경정비: '#2dd4bf', 주거환경: TK.green400, 기타: TK.sub2 }
// 추진 7단계 색(idx 0=미상 ~ 7=착공)
const STAGE_C = ['#8599ae', '#fdba74', '#fbbf24', '#f97316', '#60a5fa', '#a78bfa', '#4ade80', '#2dd4bf']
// 안전진단(재건축 관문·xlsx 단계 아님) + 추진 7단계
const STAGES = [
  { key: '안전진단', ic: '🔍', c: TK.sub2, d: '재건축 관문 — D·E등급 시 확정(재개발엔 없음).', pre: true },
  { key: '구역지정', ic: '📌', c: '#fdba74', d: '정비구역 지정 고시 = 공식 출발. 기대가 가격에 선반영.', mark: '★ 데이터 시작' },
  { key: '추진위', ic: '👥', c: '#fbbf24', d: '추진위원회 구성 — 조합 설립 준비 단계.' },
  { key: '조합설립', ic: '🤝', c: '#f97316', d: '토지등소유자 3/4 동의 → 조합 확정, 본격화.' },
  { key: '건축심의', ic: '📐', c: '#60a5fa', d: '건축·경관 심의 통과 — 설계 구체화.' },
  { key: '사업시행', ic: '📋', c: '#a78bfa', d: '사업시행인가 — 계획 확정, 리스크 대폭 감소.' },
  { key: '관리처분', ic: '💰', c: '#4ade80', d: '분담금·입주권 확정 → 사실상 성공. 이주 임박.', mark: '★ 가격 핵심' },
  { key: '착공', ic: '🏗️', c: '#2dd4bf', d: '철거·착공 → 준공. 입주권이 새 아파트로 실현.' },
]
const fmtDate = (d: string) => !d ? '' : d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}` : d.replace('-', '.')
const heat = (n: number, max: number) => {
  if (n <= 0) return TK.bg6
  const t = Math.min(1, n / (max || 1))
  const r = Math.round(60 + t * 189), g = Math.round(50 + t * 65), b = Math.round(40 + t * 5)
  return `rgb(${r},${g},${b})`
}

export default function RedevelopmentRadar() {
  const [d, setD] = useState<RedevelopResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState<string>('전체')
  const [stageF, setStageF] = useState<string>('전체')
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/re-redevelopment', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!j.error) setD(j) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const guCount = useMemo(() => new Map((d?.districts ?? []).map(x => [x.gu, x])), [d])
  const maxCount = useMemo(() => Math.max(1, ...(d?.districts ?? []).map(x => x.count)), [d])
  const stageCount = useMemo(() => new Map((d?.stagePipeline ?? []).map(s => [s.stage, s.count])), [d])
  const searchHits = useMemo(() => {
    if (!d) return []
    const qq = q.trim().replace(/\s/g, '')
    return d.stageProjects
      .filter(p => typeF === '전체' || p.typeGroup === typeF)
      .filter(p => stageF === '전체' || p.stage === stageF)
      .filter(p => !qq || (p.name + p.gu + p.addr).replace(/\s/g, '').includes(qq))
      .slice(0, 60)
  }, [d, q, typeF, stageF])

  const goApt = (gu: string | null) => { const lawd = gu ? GU_LAWD.get(gu) : null; if (lawd) window.location.href = `/real-estate/apt?lawd=${lawd}` }

  if (loading) return <div style={{ padding: 24, color: TK.sub, background: TK.bg3, borderRadius: 14, border: `1px solid ${BORDER}` }}>🏗️ 서울 정비사업 데이터를 불러오는 중…</div>
  if (!d) return <div style={{ padding: 24, color: TK.sub, background: TK.bg3, borderRadius: 14, border: `1px solid ${BORDER}` }}>정비사업 데이터를 불러오지 못했습니다.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1180, margin: '0 auto', padding: '18px 20px' }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,${TK.orange400}18,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>🏗️ 서울 정비사업(재건축·재개발) 레이더</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 5, lineHeight: 1.6 }}>
          정비사업은 <b style={{ color: '#fdba74' }}>서울 부동산 가격의 핵심 변수</b>입니다 — 재개발·재건축 구역 지정과 단계 진행이 그 일대 가격을 크게 움직입니다.
          <b> upisRebuild 라이브</b>({d.totalZones.toLocaleString()} 구역)로 현황을, <b>서울시 분기 통계</b>({d.stageTotal} 프로젝트·{d.stageAsOf} 기준)로 <b style={{ color: TK.green400 }}>추진 단계</b>를 함께 봅니다.
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { k: '활성 정비구역', v: d.activeZones.toLocaleString(), s: '지정 고시 기준', c: TK.orange400 },
          { k: '추진 중 프로젝트', v: d.stageTotal.toLocaleString(), s: `단계 추적(${d.stageAsOf})`, c: TK.green400 },
          { k: '재개발', v: (d.typeDist.find(t => t.group === '재개발')?.count ?? 0).toLocaleString(), s: '주택·도시환경', c: TK.orange400 },
          { k: '재건축', v: (d.typeDist.find(t => t.group === '재건축')?.count ?? 0).toLocaleString(), s: '아파트 재건축', c: TK.violet400 },
        ].map(x => (
          <div key={x.k} style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${x.c}33`, borderRadius: 12, padding: '11px 14px' }}>
            <div style={{ fontSize: 11, color: TK.sub }}>{x.k}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: x.c, fontFamily: 'monospace', marginTop: 2 }}>{x.v}</div>
            <div style={{ fontSize: 9.5, color: TK.sub3, marginTop: 1 }}>{x.s}</div>
          </div>
        ))}
      </div>

      {/* 📋 추진 단계 파이프라인 (실제 단계별 프로젝트 수) */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: TK.slate200, marginBottom: 3 }}>📋 추진 단계별 프로젝트 <span style={{ color: TK.sub3, fontWeight: 400, fontSize: 10 }}>— 안전진단→준공, 단계 오를수록 불확실성↓·가격↑</span></div>
        <div style={{ fontSize: 10.5, color: TK.sub3, marginBottom: 11 }}>숫자 = 현재 그 단계에 있는 프로젝트 수({d.stageAsOf} 기준) · ★ 이 앱 데이터는 <b style={{ color: '#fdba74' }}>정비구역 지정</b>부터</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 8, paddingBottom: 4 }}>
          {STAGES.map((s, i) => {
            const cnt = s.pre ? null : (stageCount.get(s.key) ?? 0)
            const on = stageF === s.key
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                <div onClick={() => !s.pre && setStageF(on ? '전체' : s.key)}
                  style={{ width: 150, alignSelf: 'stretch', cursor: s.pre ? 'default' : 'pointer', background: on ? `${s.c}26` : `linear-gradient(160deg,${s.c}16,${TK.bg6})`, border: `1px solid ${s.c}${on || s.mark ? '99' : '44'}`, borderRadius: 11, padding: '10px 11px', position: 'relative' }}>
                  {s.mark && <div style={{ position: 'absolute', top: -8, left: 8, fontSize: 8.5, fontWeight: 800, color: '#1c1917', background: s.c, borderRadius: 5, padding: '1px 6px' }}>{s.mark}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{s.ic}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: TK.slate100 }}>{s.key}</span>
                    {cnt != null && <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 900, color: s.c, fontFamily: 'monospace' }}>{cnt}</span>}
                  </div>
                  <div style={{ fontSize: 9.5, color: TK.sub2, lineHeight: 1.45, minHeight: 40 }}>{s.d}</div>
                  {s.pre && <div style={{ fontSize: 8.5, color: TK.sub4, marginTop: 3 }}>※ 데이터엔 미포함</div>}
                  {cnt != null && <div style={{ fontSize: 8.5, color: TK.sub4, marginTop: 3 }}>클릭 → 이 단계만 보기</div>}
                </div>
                {i < STAGES.length - 1 && <div style={{ display: 'grid', placeItems: 'center', color: TK.sub3, fontSize: 15, flex: '0 0 auto' }}>→</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* 자치구 히트맵 */}
        <div style={{ flex: '1 1 480px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TK.slate200, marginBottom: 2 }}>🗺️ 자치구별 정비구역 밀도</div>
          <div style={{ fontSize: 10.5, color: TK.sub3, marginBottom: 6 }}>진할수록 활성 구역 많음 · 구 클릭 → 실거래 리서치</div>
          <div style={{ position: 'relative' }}>
            <ComposableMap projection="geoMercator" projectionConfig={{ scale: 62000, center: [126.99, 37.55] }} width={520} height={340} style={{ width: '100%', height: 'auto' }}>
              <Geographies geography="/geo/seoul-gu.json">
                {({ geographies }) => geographies.map(geo => {
                  const nm = geo.properties.name as string
                  const e = guCount.get(nm)
                  const isH = hover === nm
                  return (
                    <Geography key={geo.rsmKey} geography={geo}
                      onClick={() => goApt(nm)}
                      onMouseEnter={() => setHover(nm)} onMouseLeave={() => setHover(null)}
                      style={{
                        default: { fill: isH ? '#fdba74' : heat(e?.count ?? 0, maxCount), stroke: TK.bg1, strokeWidth: 0.8, outline: 'none', cursor: 'pointer' },
                        hover: { fill: '#fdba74', stroke: TK.bg1, strokeWidth: 1, outline: 'none', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }} />
                  )
                })}
              </Geographies>
            </ComposableMap>
            {hover && guCount.get(hover) && (
              <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(2,6,23,0.9)', border: `1px solid ${TK.orange400}66`, borderRadius: 9, padding: '8px 11px', pointerEvents: 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate100 }}>{hover}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: TK.orange400, fontFamily: 'monospace' }}>{guCount.get(hover)!.count}<span style={{ fontSize: 10, color: TK.sub }}> 구역</span></div>
                <div style={{ fontSize: 9.5, color: TK.sub2, marginTop: 2 }}>재개발 {guCount.get(hover)!.redev} · 재건축 {guCount.get(hover)!.rebuild} · 도시환경 {guCount.get(hover)!.urban}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...d.districts].sort((a, b) => b.count - a.count).slice(0, 8).map((x, i) => (
              <span key={x.gu} onClick={() => goApt(x.gu)} style={{ cursor: 'pointer', fontSize: 10.5, color: TK.slate300, background: TK.bg6, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '3px 8px' }}>
                {i + 1}. {x.gu} <b style={{ color: TK.orange400 }}>{x.count}</b>
              </span>
            ))}
          </div>
        </div>

        {/* 유형 분포 + 신규 */}
        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 16px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate200, marginBottom: 8 }}>📊 사업유형 분포</div>
            {d.typeDist.map(t => {
              const pct = Math.round(t.count / d.activeZones * 100)
              return (
                <div key={t.group} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: TK.slate300 }}>{t.group}</span>
                    <span style={{ color: TYPE_COLOR[t.group] ?? TK.sub, fontWeight: 800, fontFamily: 'monospace' }}>{t.count.toLocaleString()} · {pct}%</span>
                  </div>
                  <div style={{ height: 6, background: TK.bg6, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: TYPE_COLOR[t.group] ?? TK.sub }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ background: TK.bg3, border: `1px solid ${TK.green400}33`, borderRadius: 14, padding: '13px 16px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.green400, marginBottom: 7 }}>🆕 최근 신규 지정 <span style={{ color: TK.sub3, fontWeight: 400, fontSize: 10 }}>— 초기 진입 관심 구역</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 168, overflowY: 'auto' }}>
              {d.recentNew.map((z, i) => (
                <div key={i} onClick={() => goApt(z.gu)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: z.gu ? 'pointer' : 'default', fontSize: 11 }}>
                  <span style={{ fontSize: 9, color: TK.sub3, fontFamily: 'monospace', minWidth: 46 }}>{fmtDate(z.date)}</span>
                  <span style={{ fontSize: 8.5, color: TYPE_COLOR[z.typeGroup], border: `1px solid ${TYPE_COLOR[z.typeGroup]}55`, borderRadius: 5, padding: '0 5px' }}>{z.typeGroup}</span>
                  {z.gu && <span style={{ fontSize: 9.5, color: TK.sub2 }}>{z.gu}</span>}
                  <span style={{ color: TK.slate300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.rgn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 단계별 프로젝트 검색 (xlsx 추진현황) */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate200 }}>🔍 어느 아파트가 어느 단계인가</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="단지·구역명·지역 (예: 잠실주공5, 오금현대, 한남)"
            style={{ flex: '1 1 220px', background: TK.bg1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 11px', color: TK.slate100, fontSize: 12, outline: 'none' }} />
        </div>
        {/* 단계 필터 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 9 }}>
          {['전체', ...STAGES.filter(s => !s.pre).map(s => s.key)].map(st => {
            const on = stageF === st
            const c = st === '전체' ? TK.sub2 : STAGE_C[STAGES.findIndex(s => s.key === st)]
            return <span key={st} onClick={() => setStageF(st)} style={{ cursor: 'pointer', fontSize: 10.5, padding: '3px 9px', borderRadius: 7, fontWeight: 700, background: on ? `${c}26` : TK.bg6, color: on ? c : TK.sub2, border: `1px solid ${on ? `${c}88` : BORDER}` }}>{st}{st !== '전체' && ` ${stageCount.get(st) ?? 0}`}</span>
          })}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {['전체', '재개발', '재건축'].map(t => (
              <span key={t} onClick={() => setTypeF(t)} style={{ cursor: 'pointer', fontSize: 10.5, padding: '3px 9px', borderRadius: 7, fontWeight: 700, background: typeF === t ? `${TK.orange400}22` : TK.bg6, color: typeF === t ? TK.orange400 : TK.sub2, border: `1px solid ${typeF === t ? `${TK.orange400}66` : BORDER}` }}>{t}</span>
            ))}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 320, overflowY: 'auto' }}>
          {searchHits.length === 0
            ? <div style={{ color: TK.sub3, fontSize: 11, padding: '6px 0', lineHeight: 1.6 }}>검색 결과 없음 · <span style={{ color: TK.sub4 }}>추진 중({d.stageAsOf}) 472개 프로젝트만 단계 표시 — 아직 구역 지정 前(안전진단만 통과)인 사업은 미포함.</span></div>
            : searchHits.map((p, i) => {
              const sc = STAGE_C[p.stageIdx] ?? TK.sub2
              return (
                <div key={i} onClick={() => goApt(p.gu)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: TK.bg6, cursor: 'pointer' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#1c1917', background: sc, borderRadius: 5, padding: '2px 6px', minWidth: 50, textAlign: 'center' }}>{p.stage}</span>
                  <span style={{ fontSize: 10, color: TK.sub2, minWidth: 44 }}>{p.gu}</span>
                  <span style={{ fontSize: 12, color: TK.slate200, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 8.5, color: TYPE_COLOR[p.typeGroup], border: `1px solid ${TYPE_COLOR[p.typeGroup]}55`, borderRadius: 5, padding: '0 5px', whiteSpace: 'nowrap' }}>{p.typeGroup}</span>
                  {p.units != null && p.units > 0 && <span style={{ fontSize: 9.5, color: TK.sub3, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{p.units.toLocaleString()}세대</span>}
                  {p.dZone && <span style={{ fontSize: 9, color: TK.sub4, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>지정 {fmtDate(p.dZone)}</span>}
                </div>
              )
            })}
        </div>
        <div style={{ fontSize: 9.5, color: TK.sub4, marginTop: 6 }}>추진 중 {d.stageTotal}개 프로젝트 · 단계순(착공→구역지정) 상위 60개 표시 · 세대수·지정일 포함</div>
      </div>

      {/* 교육 + 해제 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', background: `linear-gradient(160deg,${TK.orange400}0c,${TK.bg3})`, border: `1px solid ${TK.orange400}33`, borderRadius: 13, padding: '13px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: TK.slate200, marginBottom: 7 }}>🎓 왜 정비사업이 가격 변수인가</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: TK.sub2, lineHeight: 1.7 }}>
            <li><b style={{ color: '#fdba74' }}>구역 지정</b>만으로 그 일대 기대감이 가격에 선반영됩니다.</li>
            <li>단계가 오를수록(조합설립→사업시행→<b>관리처분</b>) 불확실성↓ → 가격 계단식 상승. 관리처분 이후가 안정 구간.</li>
            <li><b style={{ color: TK.red400 }}>초기 단계</b>는 무산(폐지) 리스크가 커 고위험·고수익.</li>
            <li>⚠️ 추진 단계는 <b>정비구역 지정 이후</b>부터 잡힙니다 — 안전진단만 통과하고 <b>구역 지정 前</b>인 사업(예: 오금동 대림아파트)은 아직 미포함.</li>
          </ul>
        </div>
        <div style={{ flex: '1 1 280px', background: TK.bg3, border: `1px solid ${TK.red400}33`, borderRadius: 13, padding: '13px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: TK.red400, marginBottom: 7 }}>❌ 최근 해제 구역 <span style={{ color: TK.sub3, fontWeight: 400, fontSize: 10 }}>— 무산·직권해제</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
            {d.recentCancelled.map((z, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                <span style={{ fontSize: 9, color: TK.sub3, fontFamily: 'monospace', minWidth: 46 }}>{fmtDate(z.date)}</span>
                {z.gu && <span style={{ fontSize: 9.5, color: TK.sub2 }}>{z.gu}</span>}
                <span style={{ color: TK.slate400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.rgn}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.5 }}>
        출처: 서울 열린데이터광장 upisRebuild(구역 현황·라이브, 기준일 {d.asOf}) + 서울시 정비사업 추진현황(단계·세대수, {d.stageAsOf} 분기 통계). 자치구는 지번 주소에서 추출(89% 커버). 교육용 참고이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
