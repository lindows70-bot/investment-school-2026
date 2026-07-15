'use client'
// 🗺️ 서울 자치구 실거래 히트맵 — 구별 평당가(최근 3개월·캐시 전용) 색칠 + 클릭 시 해당 구 단지 리서치 로드
//    + 선택 구의 대단지 핀(서울시 공동주택 마스터 좌표·세대수 상위) — 핀 클릭 = 단지 선택
import { useState, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import type { GuSummary } from '@/app/api/re-map/route'
import type { AptPin } from '@/app/api/re-apt-pins/route'
import { TK } from '@/lib/theme'

const BORDER = TK.border

// 평당가(억) → 색(낮음 어두운 청록 → 높음 주황·빨강)
function colorOf(p: number | null, min: number, max: number): string {
  if (p == null) return '#1a2030'
  const t = max > min ? (p - min) / (max - min) : 0.5
  if (t < 0.25) return '#155e63'
  if (t < 0.45) return '#0e7490'
  if (t < 0.65) return TK.amber700
  if (t < 0.85) return '#c2410c'
  return TK.red600
}

export default function SeoulAptMap({ lawd, onSelect, onSelectApt, refreshKey }: { lawd: string; onSelect: (lawd: string) => void; onSelectApt?: (query: string) => void; refreshKey?: string }) {
  const [data, setData] = useState<GuSummary[] | null>(null)
  const [hover, setHover] = useState<GuSummary | null>(null)
  const [pins, setPins] = useState<AptPin[]>([])
  const [pinHover, setPinHover] = useState<AptPin | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/re-map').then(r => r.json())
      .then(j => { if (alive && j.regions) setData(j.regions) })
      .catch(() => { /* graceful — 지도 색만 비활성 */ })
    return () => { alive = false }
  }, [refreshKey])   // ⚠️ lawd(수집 시작 전)가 아니라 수집 '완료' 시점(asOf)에 재조회해야 방금 본 구가 색칠됨

  useEffect(() => {
    let alive = true
    setPins([]); setPinHover(null)
    fetch(`/api/re-apt-pins?lawd=${lawd}`).then(r => r.json())
      .then(j => { if (alive && Array.isArray(j.pins)) setPins(j.pins) })
      .catch(() => { /* graceful — 핀만 비활성 */ })
    return () => { alive = false }
  }, [lawd])

  const byName = new Map((data ?? []).map(g => [g.name, g]))
  const vals = (data ?? []).map(g => g.pyeong).filter((v): v is number => v != null)
  const min = vals.length ? Math.min(...vals) : 0
  const max = vals.length ? Math.max(...vals) : 1

  return (
    <div style={{ background: TK.card, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🗺️ 서울 자치구 평당가 지도</span>
        <span style={{ color: TK.sub, fontSize: 10.5 }}>최근 3개월 매매 실거래 ㎡당 중위가 × 3.3(평) · 구 클릭 = 단지 리서치 · 회색 = 아직 미수집(클릭하면 수집 후 색칠) · ⚪핀 = 선택 구 대단지(세대수 상위·서울시 공동주택 마스터) — 핀 클릭 = 단지 선택</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 300, maxWidth: 640 }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [126.99, 37.555], scale: 95000 }}
            style={{ width: '100%', height: 'auto' }} width={640} height={430}>
            <Geographies geography="/geo/seoul-gu.json">
              {({ geographies }) => geographies.map(geo => {
                const g = byName.get(geo.properties.name as string)
                const active = g?.lawd === lawd
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    onClick={() => g && onSelect(g.lawd)}
                    onMouseEnter={() => setHover(g ?? null)}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: { fill: colorOf(g?.pyeong ?? null, min, max), stroke: active ? TK.orange400 : TK.bg1, strokeWidth: active ? 2.5 : 0.8, outline: 'none', cursor: 'pointer' },
                      hover: { fill: TK.orange400, stroke: TK.bg1, strokeWidth: 1, outline: 'none', cursor: 'pointer' },
                      pressed: { fill: TK.orange400, outline: 'none' },
                    }} />
                )
              })}
            </Geographies>
            {/* 선택 구 대단지 핀(세대수 상위 — 클릭 = 단지 선택) */}
            {pins.map(p => {
              const r = Math.min(6.5, 2.4 + Math.sqrt(p.hh ?? 0) / 18)
              return (
                <Marker key={`${p.dong}-${p.name}`} coordinates={[p.lng, p.lat]}>
                  <g style={{ cursor: 'pointer' }}
                    onClick={() => onSelectApt?.(p.query)}
                    onMouseEnter={() => setPinHover(p)}
                    onMouseLeave={() => setPinHover(null)}>
                    <circle r={r} fill="#f8fafc" fillOpacity={0.92} stroke={TK.bg1} strokeWidth={1} />
                    <circle r={Math.max(1.2, r - 2.2)} fill={TK.orange400} />
                    <title>{p.name} · {p.hh != null ? `${p.hh.toLocaleString()}세대` : '세대수 —'}{p.aprv ? ` · ${p.aprv} 준공` : ''}{p.deals > 0 ? ` · 최근 1년 ${p.deals}건` : ''}</title>
                  </g>
                </Marker>
              )
            })}
          </ComposableMap>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 190 }}>
          {/* 호버 정보 + 랭킹 */}
          <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', minHeight: 62 }}>
            {pinHover ? (
              <>
                <div style={{ color: TK.slate100, fontWeight: 800, fontSize: 13 }}>🏢 {pinHover.name}</div>
                <div style={{ color: TK.orange400, fontSize: 12, fontWeight: 700 }}>
                  {pinHover.dong}{pinHover.hh != null ? ` · ${pinHover.hh.toLocaleString()}세대` : ''}{pinHover.aprv ? ` · ${pinHover.aprv} 준공` : ''}
                </div>
                <div style={{ color: TK.sub, fontSize: 10 }}>핀 클릭 = 이 단지 리서치</div>
              </>
            ) : hover ? (
              <>
                <div style={{ color: TK.slate100, fontWeight: 800, fontSize: 13 }}>{hover.name}</div>
                <div style={{ color: hover.pyeong != null ? TK.orange400 : TK.sub, fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace' }}>
                  {hover.pyeong != null ? `평당 ${hover.pyeong}억 (${hover.count}건)` : hover.cached ? '표본 부족' : '미수집 — 클릭 시 수집(~30초)'}
                </div>
              </>
            ) : (
              <div style={{ color: TK.sub, fontSize: 11.5, lineHeight: 1.55 }}>구에 마우스를 올리면 평당가, 클릭하면 그 구의 단지 리서치로 이동합니다.</div>
            )}
          </div>
          {data && vals.length > 0 && (
            <div style={{ marginTop: 8, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700, marginBottom: 5 }}>평당가 순위 (수집된 구)</div>
              {data.filter(g => g.pyeong != null).sort((a, b) => b.pyeong! - a.pyeong!).slice(0, 8).map((g, i) => (
                <div key={g.lawd} onClick={() => onSelect(g.lawd)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0', cursor: 'pointer', color: g.lawd === lawd ? TK.orange400 : TK.slate300 }}>
                  <span>{i + 1}. {g.name}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{g.pyeong}억</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: TK.sub }}>
            낮음
            {['#155e63', '#0e7490', TK.amber700, '#c2410c', TK.red600].map(c => <span key={c} style={{ width: 16, height: 9, background: c, borderRadius: 2, display: 'inline-block' }} />)}
            높음 · <span style={{ width: 16, height: 9, background: '#1a2030', border: `1px solid ${BORDER}`, borderRadius: 2, display: 'inline-block' }} /> 미수집
          </div>
        </div>
      </div>
    </div>
  )
}
