'use client'
// 🗺️ 2040 서울플랜 중심지 공간 지도 — 25개구 경계 위에 3도심·7광역중심·12지역중심 마커(서울시 도시계획포털 공간구조도 재현). 마커 클릭 = 단지 리서치
import { useRouter } from 'next/navigation'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { TK } from '@/lib/theme'

const BORDER = TK.border

// 중심지 좌표(경도, 위도) — 서울시 2040 공간구조도 기준 근사 배치(정적 정책 참조 데이터). lawd=단지 리서치 딥링크
const CORE3 = [
  { name: '서울도심', lng: 126.98, lat: 37.570, lawd: '11110' },
  { name: '여의도·영등포', lng: 126.92, lat: 37.522, lawd: '11560' },
  { name: '강남', lng: 127.048, lat: 37.500, lawd: '11680' },
]
const REGION7 = [
  { name: '용산', lng: 126.968, lat: 37.532, lawd: '11170' },
  { name: '잠실', lng: 127.100, lat: 37.512, lawd: '11710' },
  { name: '청량리·왕십리', lng: 127.045, lat: 37.575, lawd: '11230' },
  { name: '창동·상계', lng: 127.062, lat: 37.655, lawd: '11350' },
  { name: '상암·수색', lng: 126.892, lat: 37.580, lawd: '11440' },
  { name: '마곡', lng: 126.828, lat: 37.560, lawd: '11500' },
  { name: '가산·대림', lng: 126.900, lat: 37.480, lawd: '11530' },
]
const LOCAL12 = [
  { name: '동대문', lng: 127.040, lat: 37.571 }, { name: '성수', lng: 127.055, lat: 37.545 },
  { name: '망우', lng: 127.095, lat: 37.598 }, { name: '미아', lng: 127.028, lat: 37.618 },
  { name: '신촌', lng: 126.938, lat: 37.557 }, { name: '마포', lng: 126.952, lat: 37.543 },
  { name: '연신내·불광', lng: 126.918, lat: 37.620 }, { name: '목동', lng: 126.868, lat: 37.532 },
  { name: '봉천', lng: 126.942, lat: 37.482 }, { name: '사당·이수', lng: 126.982, lat: 37.480 },
  { name: '수서·문정', lng: 127.102, lat: 37.488 }, { name: '천호·길동', lng: 127.140, lat: 37.540 },
]

export default function SeoulPlanMap() {
  const router = useRouter()
  return (
    <div style={{ background: TK.card, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🗺️ 서울 공간구조도 — 중심지 배치</div>
      <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 8px', lineHeight: 1.5 }}>
        서울시 2040 공간구조도 재현 — 🔴 3도심 · 🔵 7광역중심 · ⚪ 12지역중심이 어디에 배치됐는지 한눈에. 마커 클릭 = 해당 지역 단지 리서치로 이동.
      </div>
      <div style={{ background: TK.bg1, borderRadius: 10, overflow: 'hidden' }}>
        <ComposableMap projection="geoMercator" projectionConfig={{ center: [126.99, 37.558], scale: 62000 }}
          style={{ width: '100%', height: 'auto' }} width={880} height={520}>
          <Geographies geography="/geo/seoul-gu.json">
            {({ geographies }) => geographies.map(geo => (
              <Geography key={geo.rsmKey} geography={geo}
                style={{
                  default: { fill: '#161d2b', stroke: '#334155', strokeWidth: 0.7, outline: 'none' },
                  hover: { fill: '#1c2740', stroke: TK.slate600, strokeWidth: 0.7, outline: 'none' },
                  pressed: { fill: '#1c2740', outline: 'none' },
                }} />
            ))}
          </Geographies>
          {/* 12지역중심 — 작은 점 */}
          {LOCAL12.map(c => (
            <Marker key={c.name} coordinates={[c.lng, c.lat]}>
              <circle r={3.5} fill={TK.slate300} stroke={TK.bg1} strokeWidth={0.8} />
              <text textAnchor="middle" y={-6} style={{ fontSize: 8.5, fill: TK.slate400, fontWeight: 600 }}>{c.name}</text>
            </Marker>
          ))}
          {/* 7광역중심 — 파랑 */}
          {REGION7.map(c => (
            <Marker key={c.name} coordinates={[c.lng, c.lat]}>
              <g onClick={() => router.push(`/real-estate/apt?lawd=${c.lawd}`)} style={{ cursor: 'pointer' }}>
                <circle r={6} fill={TK.blue500} stroke={TK.bg1} strokeWidth={1.2} />
                <text textAnchor="middle" y={-9} style={{ fontSize: 10, fill: TK.blue300, fontWeight: 800 }}>{c.name}</text>
              </g>
            </Marker>
          ))}
          {/* 3도심 — 빨강 크게 */}
          {CORE3.map(c => (
            <Marker key={c.name} coordinates={[c.lng, c.lat]}>
              <g onClick={() => router.push(`/real-estate/apt?lawd=${c.lawd}`)} style={{ cursor: 'pointer' }}>
                <circle r={10} fill={TK.red500} stroke="#fff" strokeWidth={1.5} opacity={0.92} />
                <text textAnchor="middle" y={-14} style={{ fontSize: 12.5, fill: TK.red300, fontWeight: 900, paintOrder: 'stroke', stroke: TK.bg1, strokeWidth: 3 }}>{c.name}</text>
              </g>
            </Marker>
          ))}
        </ComposableMap>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10.5, color: TK.sub, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: TK.red500, marginRight: 4, verticalAlign: 'middle' }} />3도심(국제 중심)</span>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: TK.blue500, marginRight: 4, verticalAlign: 'middle' }} />7광역중심</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: TK.slate300, marginRight: 4, verticalAlign: 'middle' }} />12지역중심</span>
        <span style={{ color: '#6b7686' }}>· 좌표는 공간구조도 기준 근사 배치(교육용)</span>
      </div>
    </div>
  )
}
