'use client'
// 🏗️ 서울 정비사업(재건축·재개발) 레이더 — 자치구 히트맵·유형분포·신규지정/해제 (upisRebuild 라이브)
import { useState, useEffect, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { RedevelopResult } from '@/app/api/re-redevelopment/route'
import { LAWD_REGIONS } from '@/lib/rtms'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'
const GU_LAWD = new Map(LAWD_REGIONS.filter(r => r.sido === '서울').map(r => [r.name, r.lawd]))
const TYPE_COLOR: Record<string, string> = { 재개발: TK.orange400, 재건축: TK.violet400, 도시환경정비: '#2dd4bf', 주거환경: TK.green400, 기타: TK.sub2 }
const fmtDate = (d: string) => d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}` : d
// 구역 수 → 주황 강도(0~max)
const heat = (n: number, max: number) => {
  if (n <= 0) return TK.bg6
  const t = Math.min(1, n / (max || 1))
  const r = Math.round(60 + t * 189), g = Math.round(50 + t * 65), b = Math.round(40 + t * 5)
  return `rgb(${r},${g},${b})`
}

// 정비사업 6단계(표준 절차) — 안전진단 → 정비구역 지정 → 조합설립 → 사업시행인가 → 관리처분 → 착공·준공
const STAGES = [
  { n: '1', ic: '🔍', t: '안전진단', c: TK.sub2, d: '재건축 필수 관문 — D·E등급이면 재건축 확정. 재개발엔 없음(노후도로 판단).', p: '기대 형성(초기 소문)' },
  { n: '2', ic: '📌', t: '정비구역 지정·정비계획', c: '#fdba74', d: '구역 지정 고시 = 재개발/재건축 공식 출발점. 개발 기대가 가격에 선반영.', p: '첫 가격 점프', mark: '★ 데이터 시작점' },
  { n: '3', ic: '🤝', t: '조합설립인가', c: TK.orange400, d: '토지등소유자 3/4 이상 동의 → 사업 주체(조합) 확정. 사업 본격화.', p: '불확실성 축소' },
  { n: '4', ic: '📐', t: '사업시행인가', c: TK.violet400, d: '건축계획·세대수·설계 확정 → 사업 밑그림 확정, 리스크 대폭 감소.', p: '가격 상승 가속' },
  { n: '5', ic: '💰', t: '관리처분인가', c: TK.green400, d: '분담금·입주권 확정 → 사실상 성공 확정. 이주·철거 임박.', p: '프리미엄 급등·안정', mark: '★ 가격 핵심' },
  { n: '6', ic: '🏗️', t: '이주·착공·준공', c: '#2dd4bf', d: '철거→착공→준공. 입주권이 실제 새 아파트로 실현.', p: '신축 시세 반영' },
]

export default function RedevelopmentRadar() {
  const [d, setD] = useState<RedevelopResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState<string>('전체')
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/re-redevelopment', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!j.error) setD(j) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const guCount = useMemo(() => new Map((d?.districts ?? []).map(x => [x.gu, x])), [d])
  const maxCount = useMemo(() => Math.max(1, ...(d?.districts ?? []).map(x => x.count)), [d])
  const searchHits = useMemo(() => {
    if (!d) return []
    const qq = q.trim().replace(/\s/g, '')
    return d.zones
      .filter(z => typeF === '전체' || z.typeGroup === typeF)
      .filter(z => !qq || (z.rgn + (z.gu ?? '') + z.pos).replace(/\s/g, '').includes(qq))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40)
  }, [d, q, typeF])

  const goApt = (gu: string | null) => { const lawd = gu ? GU_LAWD.get(gu) : null; if (lawd) window.location.href = `/real-estate/apt?lawd=${lawd}` }

  if (loading) return <div style={{ padding: 24, color: TK.sub, background: TK.bg3, borderRadius: 14, border: `1px solid ${BORDER}` }}>🏗️ 서울 정비사업 데이터를 불러오는 중…</div>
  if (!d) return <div style={{ padding: 24, color: TK.sub, background: TK.bg3, borderRadius: 14, border: `1px solid ${BORDER}` }}>정비사업 데이터를 불러오지 못했습니다.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1180, margin: '0 auto', padding: '18px 20px' }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,${TK.orange400}18,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>🏗️ 서울 정비사업(재건축·재개발) 레이더</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 5, lineHeight: 1.6 }}>
          정비사업은 <b style={{ color: '#fdba74' }}>서울 부동산 가격의 핵심 변수</b>입니다 — 재개발·재건축 구역 지정은 그 일대 가격을 크게 움직입니다.
          서울 열린데이터광장 <b>upisRebuild</b> 라이브(6,581 고시 → <b style={{ color: TK.slate200 }}>{d.totalZones.toLocaleString()}</b> 구역)로 자치구별 현황·신규 지정·해제를 추적합니다.
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { k: '활성 정비구역', v: d.activeZones.toLocaleString(), s: '폐지·실효 제외', c: TK.orange400 },
          { k: '재개발', v: (d.typeDist.find(t => t.group === '재개발')?.count ?? 0).toLocaleString(), s: '주택·도시환경 포함', c: TK.orange400 },
          { k: '재건축', v: (d.typeDist.find(t => t.group === '재건축')?.count ?? 0).toLocaleString(), s: '아파트 재건축', c: TK.violet400 },
          { k: '최근 신규 지정', v: d.recentNew.length.toLocaleString(), s: '최신 고시 기준', c: TK.green400 },
        ].map(x => (
          <div key={x.k} style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${x.c}33`, borderRadius: 12, padding: '11px 14px' }}>
            <div style={{ fontSize: 11, color: TK.sub }}>{x.k}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: x.c, fontFamily: 'monospace', marginTop: 2 }}>{x.v}</div>
            <div style={{ fontSize: 9.5, color: TK.sub3, marginTop: 1 }}>{x.s}</div>
          </div>
        ))}
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
          {/* 자치구 랭킹 */}
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...d.districts].sort((a, b) => b.count - a.count).slice(0, 8).map((x, i) => (
              <span key={x.gu} onClick={() => goApt(x.gu)} style={{ cursor: 'pointer', fontSize: 10.5, color: TK.slate300, background: TK.bg6, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '3px 8px' }}>
                {i + 1}. {x.gu} <b style={{ color: TK.orange400 }}>{x.count}</b>
              </span>
            ))}
          </div>
        </div>

        {/* 유형 분포 + 신규/해제 */}
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

      {/* 구역 검색 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: TK.slate200 }}>🔍 정비구역 검색</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="구역명·지역 검색 (예: 한남, 반포, 노량진)"
            style={{ flex: '1 1 220px', background: TK.bg1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 11px', color: TK.slate100, fontSize: 12, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['전체', '재개발', '재건축', '도시환경정비', '주거환경'].map(t => (
              <span key={t} onClick={() => setTypeF(t)} style={{ cursor: 'pointer', fontSize: 10.5, padding: '4px 9px', borderRadius: 7, fontWeight: 700, background: typeF === t ? `${TK.orange400}22` : TK.bg6, color: typeF === t ? TK.orange400 : TK.sub2, border: `1px solid ${typeF === t ? `${TK.orange400}66` : BORDER}` }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
          {searchHits.length === 0
            ? <div style={{ color: TK.sub3, fontSize: 11, padding: '6px 0', lineHeight: 1.6 }}>검색 결과 없음 · <span style={{ color: TK.sub4 }}>안전진단만 통과하고 아직 정비구역 지정 前인 사업은 이 데이터에 없을 수 있습니다.</span></div>
            : searchHits.map((z, i) => (
              <div key={i} onClick={() => goApt(z.gu)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: TK.bg6, cursor: z.gu ? 'pointer' : 'default' }}>
                <span style={{ fontSize: 8.5, color: TYPE_COLOR[z.typeGroup], border: `1px solid ${TYPE_COLOR[z.typeGroup]}55`, borderRadius: 5, padding: '1px 6px', minWidth: 54, textAlign: 'center' }}>{z.typeGroup}</span>
                {z.gu && <span style={{ fontSize: 10, color: TK.sub2, minWidth: 44 }}>{z.gu}</span>}
                <span style={{ fontSize: 12, color: TK.slate200, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.rgn}</span>
                <span style={{ fontSize: 9.5, color: TK.sub3, whiteSpace: 'nowrap' }}>{z.pos.length > 22 ? z.pos.slice(0, 22) + '…' : z.pos}</span>
                {z.area != null && <span style={{ fontSize: 9.5, color: TK.sub3, fontFamily: 'monospace' }}>{z.area.toLocaleString()}㎡</span>}
              </div>
            ))}
        </div>
        <div style={{ fontSize: 9.5, color: TK.sub4, marginTop: 6 }}>총 {d.activeZones.toLocaleString()}개 활성 구역 · 상위 40개 표시(최신 고시순)</div>
      </div>

      {/* 📋 정비사업 단계 파이프라인 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: TK.slate200, marginBottom: 3 }}>📋 정비사업 단계 — 안전진단부터 준공까지</div>
        <div style={{ fontSize: 10.5, color: TK.sub3, marginBottom: 11 }}>단계가 오를수록 <b>불확실성↓ · 가격↑</b> (계단식 상승) · ★ 이 앱 데이터는 <b style={{ color: '#fdba74' }}>정비구역 지정</b>부터 잡힙니다(그 前 초기 단계는 미표시)</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 6, paddingBottom: 4 }}>
          {STAGES.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
              <div style={{ width: 172, alignSelf: 'stretch', background: `linear-gradient(160deg,${s.c}16,${TK.bg6})`, border: `1px solid ${s.c}${s.mark ? '99' : '44'}`, borderRadius: 11, padding: '10px 11px', position: 'relative' }}>
                {s.mark && <div style={{ position: 'absolute', top: -8, left: 8, fontSize: 8.5, fontWeight: 800, color: '#1c1917', background: s.c, borderRadius: 5, padding: '1px 6px' }}>{s.mark}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 15 }}>{s.ic}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: TK.slate100 }}>{s.n}. {s.t}</span>
                </div>
                <div style={{ fontSize: 10, color: TK.sub2, lineHeight: 1.5, marginBottom: 6, minHeight: 60 }}>{s.d}</div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: s.c }}>💹 {s.p}</div>
              </div>
              {i < STAGES.length - 1 && <div style={{ display: 'grid', placeItems: 'center', color: TK.sub3, fontSize: 15, flex: '0 0 auto' }}>→</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: TK.sub4, marginTop: 8, lineHeight: 1.5 }}>
          ⚠️ 아파트별 <b>현재 단계</b> 표시는 준비 중입니다 — 서울시 분기 통계(OA-22856)에 있으나 자동 다운로드가 막혀(브라우저 전용) 정적 스냅샷 방식으로 붙일 예정. 위 단계는 표준 절차 안내입니다.
        </div>
      </div>

      {/* 교육 + 해제 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', background: `linear-gradient(160deg,${TK.orange400}0c,${TK.bg3})`, border: `1px solid ${TK.orange400}33`, borderRadius: 13, padding: '13px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: TK.slate200, marginBottom: 7 }}>🎓 왜 정비사업이 가격 변수인가</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: TK.sub2, lineHeight: 1.7 }}>
            <li><b style={{ color: '#fdba74' }}>구역 지정</b>만으로 그 일대 기대감이 가격에 선반영됩니다.</li>
            <li>단계가 오를수록(조합설립→사업시행인가→<b>관리처분</b>) 불확실성이 줄어 가격이 계단식 상승 — 관리처분 이후가 안정 구간.</li>
            <li><b style={{ color: TK.red400 }}>초기 단계</b>는 무산(폐지) 리스크가 커 고위험·고수익.</li>
            <li>⚠️ 이 데이터는 <b style={{ color: '#fdba74' }}>정비구역으로 지정 고시된</b> 곳만 담습니다. <b>안전진단 통과했지만 아직 구역 지정 前</b>(정비계획 수립 단계)인 사업(예: 오금동 대림아파트)은 <b>아직 안 나올 수 있습니다</b> — 무료 API로는 지정 前 초기 단계를 잡을 소스가 없음.</li>
            <li>순서: 안전진단 → <b>구역 지정 고시</b>(여기부터 데이터에 잡힘) → 조합설립 → 사업시행인가 → 관리처분. 추진 단계는 별도 확인 필요 — 교육용 참고.</li>
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
        출처: 서울 열린데이터광장 upisRebuild(도시계획 정비사업) 라이브 · 기준일 {d.asOf} · 자치구는 지번 주소에서 추출(89% 커버, 일부 구 미상). 교육용 참고이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
