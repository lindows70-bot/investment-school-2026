'use client'

/**
 * CocktailPartyGauge — 🍸 시장 칵테일 파티 지수 (비밀병기 3단계)
 *
 * 피터 린치의 '칵테일 파티 이론'을 객관적 시장 데이터로 시각화.
 * VIX(변동성) + S&P500 모멘텀을 결합한 0~100 지수를 반원형 게이지로 표시.
 *
 * 데이터: /api/cocktail-party (실시간 + 1시간 캐시)
 */

import { useState, useEffect } from 'react'
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface PartyData {
  partyScore: number
  source:     'cnn' | 'calculated' | 'fallback'
  rating:     string | null
  prevClose:  number | null
  prev1Week:  number | null
  prev1Month: number | null
  vix:        number | null
  vixGreed:   number
  vixHistory: { date: string; vix: number }[]
  sp500:      number | null
  momentum:   number
  status:     { level: string; label: string; emoji: string; advice: string; lynchQuote: string }
  asOf:       string
}

const C = {
  card: '#111827', card2: '#0d1420', border: '#1e293b',
  text: '#f1f5f9', sub: '#94a3b8', low: '#8599ae',
}

// 점수 → 색상 (status 경계와 통일: 25/45/56/76)
// 낮을수록 공포=기회=파랑/초록, 높을수록 탐욕=위험=빨강
function scoreColor(s: number): string {
  if (s < 25) return '#3b82f6'   // 극공포 — 파랑(기회)
  if (s < 45) return '#10b981'   // 공포 — 초록(매수)
  if (s < 56) return '#fbbf24'   // 중립 — 골드
  if (s < 76) return '#fb923c'   // 탐욕 — 주황(주의)
  return '#ef4444'               // 극탐욕 — 빨강(위험)
}

// ── 반원형 게이지 (CNN 원본 스타일: 구간 라벨 + 현재 구간 강조 + 바늘) ────────
//   각도 매핑: 0점 = 180°(왼쪽), 50점 = 90°(꼭대기), 100점 = 0°(오른쪽)
//   SVG y축은 아래가 + → 위쪽 반원은 (cy − sin) 으로 계산
function SemiGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score))
  const cx = 130, cy = 128, r = 100
  const peri = Math.PI * r
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  // 점수 → 각도(도). 0점=180°, 100점=0°
  const scoreToAngle = (s: number) => 180 - (Math.max(0, Math.min(100, s)) / 100) * 180
  // 각도 → 좌표 (반지름 len)
  const pt = (s: number, len: number) => {
    const a = scoreToAngle(s) * (Math.PI / 180)
    return { x: cx + len * Math.cos(a), y: cy - len * Math.sin(a) }
  }

  // 5구간 (경계 25/45/56/76 — status·scoreColor 통일)
  const segs = [
    { from: 0,  to: 25,  c: '#3b82f6', label: '극공포' },
    { from: 25, to: 45,  c: '#10b981', label: '공포' },
    { from: 45, to: 56,  c: '#fbbf24', label: '중립' },
    { from: 56, to: 76,  c: '#fb923c', label: '탐욕' },
    { from: 76, to: 100, c: '#ef4444', label: '극탐욕' },
  ]
  const currentSeg = segs.find(s => clamp >= s.from && clamp < s.to) ?? segs[segs.length - 1]
  const needle = pt(clamp, r * 0.92)
  const color = scoreColor(clamp)

  return (
    <svg width="260" height="158" viewBox="0 0 260 158" style={{ overflow: 'visible' }}>
      {/* 5구간 띠 (현재 구간만 진하게, 나머지는 흐리게) */}
      {segs.map((seg, i) => {
        const segLen = ((seg.to - seg.from) / 100) * peri
        const offset = -(seg.from / 100) * peri
        const isCur = seg === currentSeg
        return (
          <path key={i} d={arc} fill="none" stroke={seg.c}
            strokeWidth={isCur ? 22 : 16} strokeOpacity={isCur ? 1 : 0.3} strokeLinecap="butt"
            strokeDasharray={`${segLen} ${peri}`} strokeDashoffset={offset}
            style={{ filter: isCur ? `drop-shadow(0 0 5px ${seg.c})` : 'none', transition: 'all 0.6s' }} />
        )
      })}
      {/* 구간 경계 눈금 */}
      {[25, 45, 56, 76].map(mark => {
        const p1 = pt(mark, r - 11), p2 = pt(mark, r + 5)
        return <line key={mark} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#0a0e1a" strokeWidth={2} />
      })}
      {/* 구간 라벨 (호 바깥) — 현재 구간만 강조 */}
      {segs.map(seg => {
        const mid = (seg.from + seg.to) / 2
        const lp = pt(mid, r + 18)
        const isCur = seg === currentSeg
        return (
          <text key={seg.label} x={lp.x} y={lp.y} fontSize={isCur ? 10 : 8.5}
            fontWeight={isCur ? 800 : 600} fill={isCur ? seg.c : '#8599ae'}
            textAnchor="middle" dominantBaseline="middle">
            {seg.label}
          </text>
        )
      })}
      {/* 바늘 (현재 위치) */}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#f1f5f9" strokeWidth={3.5} strokeLinecap="round"
        style={{ transition: 'all 0.8s ease' }} />
      <circle cx={cx} cy={cy} r={9} fill="#1b1e2e" stroke="#f1f5f9" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={4} fill={color} />
      {/* 0 / 100 눈금 */}
      <text x={cx - r} y={cy + 16} fontSize={9} fill={C.low} textAnchor="middle">0</text>
      <text x={cx + r} y={cy + 16} fontSize={9} fill={C.low} textAnchor="middle">100</text>
    </svg>
  )
}

// ── VIX 미니 트렌드 라인차트 ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VixTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#1f2937', border: '1px solid #7a8fa3', borderRadius: 6, padding: '4px 8px', fontSize: 10 }}>
      <span style={{ color: '#94a3b8' }}>{d?.date} </span>
      <span style={{ color: '#fbbf24', fontWeight: 700 }}>VIX {d?.vix?.toFixed(1)}</span>
    </div>
  )
}

export default function CocktailPartyGauge() {
  const [data,    setData]    = useState<PartyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/cocktail-party')
        if (r.ok) {
          const d = await r.json()
          if (!cancelled) setData(d)
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: C.low, fontSize: 13 }}>
      🍸 시장 분위기를 측정하는 중…
    </div>
  )
  if (!data) return null

  const color = scoreColor(data.partyScore)
  const st = data.status

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
      border: `1px solid ${color}44`, borderRadius: 14, padding: '20px 22px',
      boxShadow: `0 0 30px ${color}11`,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🍸</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>시장 칵테일 파티 지수</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${color}22`, color, fontWeight: 700 }}>
              {data.source === 'cnn' ? 'CNN 실시간' : data.source === 'calculated' ? 'VIX 추정' : '추정'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.low, marginTop: 3 }}>
            {data.source === 'cnn'
              ? '피터 린치의 인간지표 · CNN 공포-탐욕 지수(7개 지표 종합)'
              : '피터 린치의 인간지표 · VIX 변동성 + S&P500 모멘텀 종합'}
          </div>
        </div>
      </div>

      {/* 게이지 + 점수 + 상태 */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'center' }}>
        {/* 반원 게이지 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SemiGauge score={data.partyScore} />
          <div style={{ marginTop: -6, textAlign: 'center' }}>
            <div style={{ fontSize: 38, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1 }}>
              {data.partyScore}
            </div>
            <div style={{ fontSize: 22, marginTop: 2 }}>{st.emoji}</div>
          </div>
        </div>

        {/* 상태 + 조언 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color }}>{st.label}</div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>{st.advice}</div>
          <div style={{
            padding: '10px 12px', borderRadius: 8, background: `${color}10`, border: `1px solid ${color}33`,
            fontSize: 11, color: `${color}dd`, fontStyle: 'italic', lineHeight: 1.6,
          }}>
            {st.lynchQuote}
          </div>
        </div>
      </div>

      {/* CNN 추세 (CNN 소스일 때) */}
      {data.source === 'cnn' && (data.prevClose != null || data.prev1Week != null || data.prev1Month != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
          {[
            { label: '어제', val: data.prevClose },
            { label: '1주 전', val: data.prev1Week },
            { label: '1달 전', val: data.prev1Month },
          ].map(t => {
            const v = t.val != null ? Math.round(t.val) : null
            const diff = v != null ? data.partyScore - v : null
            return (
              <div key={t.label} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.low, marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: v != null ? scoreColor(v) : C.low, fontFamily: 'monospace' }}>
                  {v ?? '—'}
                </div>
                {diff != null && (
                  <div style={{ fontSize: 9, color: diff > 0 ? '#f87171' : diff < 0 ? '#60a5fa' : C.low, marginTop: 1 }}>
                    {diff > 0 ? '▲' : diff < 0 ? '▼' : '−'} {Math.abs(diff)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 보조 지표: VIX 추이(좌) + S&P500 위치(우) — 한 줄 좌우 분할 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginTop: 10, alignItems: 'stretch' }}>
        {/* ① VIX 변동성 1년 추이 (트렌드 라인차트) */}
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: C.sub }}>📉 VIX · 1년 추이</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(data.vixGreed), fontFamily: 'monospace' }}>
              {data.vix != null ? `현재 ${data.vix.toFixed(1)}` : 'N/A'}
            </span>
          </div>
          {data.vixHistory && data.vixHistory.length > 1 ? (
            <div style={{ flex: 1, minHeight: 78, marginLeft: -6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.vixHistory} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <YAxis domain={[10, 35]} ticks={[10, 20, 30]} width={22} allowDecimals={false}
                    tick={{ fontSize: 9, fill: C.low }} axisLine={false} tickLine={false} />
                  <Tooltip content={<VixTip />} />
                  {/* 공포 임계선 (VIX 20·30) */}
                  <ReferenceLine y={20} stroke="#fb923c" strokeDasharray="3 3" strokeOpacity={0.5}
                    label={{ value: '경계 20', position: 'insideTopRight', fontSize: 8, fill: '#fb923c' }} />
                  <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5}
                    label={{ value: '공포 30', position: 'insideTopRight', fontSize: 8, fill: '#ef4444' }} />
                  <Line type="monotone" dataKey="vix" stroke="#fbbf24" strokeWidth={1.8} dot={false}
                    isAnimationActive={true} animationDuration={700} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 78, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.low }}>
              추이 데이터를 불러오는 중…
            </div>
          )}
          <div style={{ fontSize: 9, color: C.low, marginTop: 2 }}>낮음(15↓)=안일 · 20↑ 경계 · 30↑ 공포</div>
        </div>

        {/* ② S&P500 52주 위치 */}
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.sub }}>📈 S&P500 52주 위치</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(data.momentum), fontFamily: 'monospace' }}>
              {data.momentum}%
            </span>
          </div>
          <div style={{ height: 7, background: '#1e293b', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${data.momentum}%`, background: scoreColor(data.momentum), borderRadius: 999, transition: 'width 0.6s' }} />
          </div>
          <div style={{ fontSize: 9, color: C.low, marginTop: 8, lineHeight: 1.5 }}>고점 근처 = 파티 활기<br/>저점 = 파티 끝</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9, color: '#7a8fa3', lineHeight: 1.6 }}>
        {data.source === 'cnn'
          ? '* CNN 공포-탐욕 지수(7개 지표 종합)를 사용합니다. 매시간 자동 갱신 · 투자 참고용이며 매매 권유가 아닙니다.'
          : '* CNN 데이터 일시 불가 → VIX·S&P500 자체 계산으로 대체 표시 중입니다. 투자 참고용입니다.'}
      </div>
    </div>
  )
}
