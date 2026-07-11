'use client'
// 🗺️ 서울 자치구 실거래 히트맵 — 구별 평당가(최근 3개월·캐시 전용) 색칠 + 클릭 시 해당 구 단지 리서치 로드
import { useState, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { GuSummary } from '@/app/api/re-map/route'

const BORDER = '#1e293b'

// 평당가(억) → 색(낮음 어두운 청록 → 높음 주황·빨강)
function colorOf(p: number | null, min: number, max: number): string {
  if (p == null) return '#1a2030'
  const t = max > min ? (p - min) / (max - min) : 0.5
  if (t < 0.25) return '#155e63'
  if (t < 0.45) return '#0e7490'
  if (t < 0.65) return '#b45309'
  if (t < 0.85) return '#c2410c'
  return '#dc2626'
}

export default function SeoulAptMap({ lawd, onSelect }: { lawd: string; onSelect: (lawd: string) => void }) {
  const [data, setData] = useState<GuSummary[] | null>(null)
  const [hover, setHover] = useState<GuSummary | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/re-map').then(r => r.json())
      .then(j => { if (alive && j.regions) setData(j.regions) })
      .catch(() => { /* graceful — 지도 색만 비활성 */ })
    return () => { alive = false }
  }, [lawd])   // 구 수집 완료 후 재조회 → 방금 본 구가 색칠됨

  const byName = new Map((data ?? []).map(g => [g.name, g]))
  const vals = (data ?? []).map(g => g.pyeong).filter((v): v is number => v != null)
  const min = vals.length ? Math.min(...vals) : 0
  const max = vals.length ? Math.max(...vals) : 1

  return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🗺️ 서울 자치구 평당가 지도</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>최근 3개월 매매 실거래 ㎡당 중위가 × 3.3(평) · 구 클릭 = 단지 리서치 · 회색 = 아직 미수집(클릭하면 수집 후 색칠)</span>
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
                      default: { fill: colorOf(g?.pyeong ?? null, min, max), stroke: active ? '#fb923c' : '#0d1017', strokeWidth: active ? 2.5 : 0.8, outline: 'none', cursor: 'pointer' },
                      hover: { fill: '#fb923c', stroke: '#0d1017', strokeWidth: 1, outline: 'none', cursor: 'pointer' },
                      pressed: { fill: '#fb923c', outline: 'none' },
                    }} />
                )
              })}
            </Geographies>
          </ComposableMap>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 190 }}>
          {/* 호버 정보 + 랭킹 */}
          <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', minHeight: 62 }}>
            {hover ? (
              <>
                <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 13 }}>{hover.name}</div>
                <div style={{ color: hover.pyeong != null ? '#fb923c' : '#8a9aaa', fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace' }}>
                  {hover.pyeong != null ? `평당 ${hover.pyeong}억 (${hover.count}건)` : hover.cached ? '표본 부족' : '미수집 — 클릭 시 수집(~30초)'}
                </div>
              </>
            ) : (
              <div style={{ color: '#8a9aaa', fontSize: 11.5, lineHeight: 1.55 }}>구에 마우스를 올리면 평당가, 클릭하면 그 구의 단지 리서치로 이동합니다.</div>
            )}
          </div>
          {data && vals.length > 0 && (
            <div style={{ marginTop: 8, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, marginBottom: 5 }}>평당가 순위 (수집된 구)</div>
              {data.filter(g => g.pyeong != null).sort((a, b) => b.pyeong! - a.pyeong!).slice(0, 8).map((g, i) => (
                <div key={g.lawd} onClick={() => onSelect(g.lawd)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0', cursor: 'pointer', color: g.lawd === lawd ? '#fb923c' : '#cbd5e1' }}>
                  <span>{i + 1}. {g.name}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{g.pyeong}억</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#8a9aaa' }}>
            낮음
            {['#155e63', '#0e7490', '#b45309', '#c2410c', '#dc2626'].map(c => <span key={c} style={{ width: 16, height: 9, background: c, borderRadius: 2, display: 'inline-block' }} />)}
            높음 · <span style={{ width: 16, height: 9, background: '#1a2030', border: `1px solid ${BORDER}`, borderRadius: 2, display: 'inline-block' }} /> 미수집
          </div>
        </div>
      </div>
    </div>
  )
}
