'use client'

/**
 * 🌤️ MacroWeather — 피터 린치의 13분 날씨예보 (비밀병기 6단계)
 *
 * 복잡한 유동성·신용 지표(순유동성, 하이일드 스프레드)를 '오늘의 날씨' 하나로 치환.
 * 대시보드 거시경제 탭 상단 배치. 폭풍우(신용 경보) 시 포트폴리오의
 * 회생주(적자·고부채 취약 종목)에 교차 경고등을 켠다.
 *
 * 데이터: /api/macro-weather (FRED, 12시간 캐시)
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import { TK } from '@/lib/theme'

interface Investment { ticker: string; name?: string; lynch_category?: string | null }
interface Props { investments?: Investment[] }

interface WeatherData {
  weather:      'clear' | 'cloudy' | 'storm'
  emoji:        string
  label:        string
  advice:       string
  lynchQuote:   string
  hySpread:     number | null
  hySpike:      number | null
  netLiquidity: number | null
  nlTrend:      number | null
  nlRising:     boolean
  source:       'fred' | 'fallback'
  asOf:         string
}

const C = {
  card: TK.bg7, card2: TK.bg5, border: TK.line1,
  gold: TK.amber500, green: TK.green400, red: TK.red400, blue: TK.blue400,
  text: TK.slate100, textSub: TK.slate400, textLow: TK.sub3,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

const TONE: Record<WeatherData['weather'], { color: string; bg: string }> = {
  clear:  { color: C.green, bg: 'rgba(74,222,128,0.08)' },
  cloudy: { color: C.gold,  bg: 'rgba(245,158,11,0.08)' },
  storm:  { color: C.red,   bg: 'rgba(248,113,113,0.10)' },
}

export default function MacroWeather({ investments = [] }: Props) {
  const [data, setData] = useState<WeatherData | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/macro-weather')
      .then(r => r.json())
      .then(d => { if (alive) setData(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data) {
    return (
      <div style={{ padding: '14px 18px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.textLow, fontFamily: FONT }}>
        🌤️ 오늘의 매크로 날씨를 확인하는 중…
      </div>
    )
  }

  const t = TONE[data.weather]
  // 폭풍우 교차체크: 포트폴리오 내 회생주(적자·고부채 취약)
  const fragile = data.weather === 'storm'
    ? investments.filter(i => i.lynch_category === 'turnaround')
    : []

  const fmtT = (n: number | null) => n != null ? `$${n.toFixed(2)}조` : '—'
  const fmtB = (n: number | null) => n != null ? `${n >= 0 ? '+' : ''}${n.toLocaleString()}억$` : '—'

  return (
    <div style={{ borderRadius: 14, background: C.card, border: `1px solid ${t.color}55`, fontFamily: FONT, overflow: 'hidden',
      boxShadow: data.weather === 'storm' ? `0 0 22px ${t.color}22` : 'none' }}>

      {/* 상단: 날씨 한 줄 (항상 표시) */}
      <div style={{
        padding: '14px 18px', background: t.bg,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 30 }}>{data.emoji}</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: t.color }}>오늘의 매크로 날씨 · {data.label}</span>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: `${C.blue}22`, color: C.blue, fontWeight: 700 }}>13분 예보</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 3 }}>{data.advice}</div>
        </div>
        {/* 핵심 수치 2개 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.textLow }}>신용 스프레드</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.color, fontFamily: 'monospace' }}>
              {data.hySpread != null ? `${data.hySpread.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.textLow }}>순유동성</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
              {fmtT(data.netLiquidity)} <span style={{ color: data.nlRising ? C.green : C.red }}>{data.nlRising ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 폭풍우 교차경고 (항상 노출) */}
      {data.weather === 'storm' && fragile.length > 0 && (
        <div style={{ padding: '10px 18px', background: 'rgba(248,113,113,0.12)', borderTop: `1px solid ${C.red}44`, fontSize: 12, color: '#fecaca', lineHeight: 1.6 }}>
          ⚠️ <strong>폭풍 경보 — 내 포트폴리오 점검</strong>: 신용 경색에 가장 취약한 <strong style={{ color: C.red }}>회생주(적자·고부채) {fragile.length}종목</strong>이 있습니다 —{' '}
          {fragile.slice(0, 6).map(i => i.name || i.ticker).join(', ')}{fragile.length > 6 ? ' 외' : ''}. 폭풍우엔 빚 많은 기업이 먼저 흔들립니다.
        </div>
      )}

      {/* 상세 (항상 노출 — 학생 교육용) */}
      <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
            <Metric label="하이일드 스프레드" value={data.hySpread != null ? `${data.hySpread.toFixed(2)}%` : '—'}
              sub={data.hySpike != null ? `4주 ${data.hySpike >= 0 ? '+' : ''}${data.hySpike.toFixed(2)}%p` : ''}
              color={data.hySpread != null && data.hySpread > 4 ? C.red : C.green} />
            <Metric label="순유동성 (Net Liquidity)" value={fmtT(data.netLiquidity)}
              sub={`4주 ${fmtB(data.nlTrend)}`} color={data.nlRising ? C.green : C.gold} />
            <Metric label="유동성 추세" value={data.nlRising ? '확장 ▲' : '축소 ▼'}
              sub={data.nlRising ? '시중 자금 증가' : '시중 자금 감소'} color={data.nlRising ? C.green : C.gold} />
          </div>
          <div style={{ fontSize: 11, color: C.textLow, lineHeight: 1.7, marginBottom: 8 }}>
            · <strong style={{ color: C.textSub }}>하이일드 스프레드</strong>: 기업 부도위험의 체온계. 4% 미만=평온, 5.5%↑=경색.<br/>
            · <strong style={{ color: C.textSub }}>순유동성</strong> = 연준 대차대조표 − 재무부 TGA − 역레포. 시중에 풀린 돈.
          </div>
          <div style={{ fontSize: 11.5, color: C.textSub, fontStyle: 'italic', borderLeft: `2px solid ${t.color}`, paddingLeft: 12 }}>
            &ldquo;{data.lynchQuote}&rdquo;
          </div>
          <div style={{ fontSize: 9, color: C.textLow, marginTop: 10 }}>
            📊 FRED(세인트루이스 연준) 데이터 · 12시간 갱신 · 교육용 참고 지표{data.source === 'fallback' ? ' · ⚠️ 일시적으로 캐시/추정값 표시' : ''}
          </div>
        </div>
    </div>
  )
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 9.5, color: C.textLow, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textSub, marginTop: 3, fontFamily: 'monospace' }}>{sub}</div>}
    </div>
  )
}
