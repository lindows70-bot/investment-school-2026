'use client'
// 🕯️ 주간 캔들 리스크 신호 — 장악형(Engulfing) 패턴. 객관적 계산(주관 개입 0)이라 엘리어트 파동(주관적 카운팅)과 달리 채택.
import { useState, useEffect } from 'react'
import type { CandlePatternResult } from '@/app/api/candle-pattern/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3
// 양봉(상승)=빨강, 음봉(하락)=파랑 — 앱 기술차트와 동일한 한국식 캔들 색
const UP = '#f0475b', DOWN = '#3b82f6'

// 장악형 패턴 봉 도식 (완전 객관 계산을 학생이 눈으로 이해하도록)
function EngulfFig({ type }: { type: 'bearish' | 'bullish' }) {
  const bear = type === 'bearish'
  const prevColor = bear ? UP : DOWN   // 직전 주 작은 봉
  const curColor  = bear ? DOWN : UP   // 이번 주 큰 봉(감쌈)
  return (
    <svg viewBox="0 0 170 150" style={{ width: '100%', maxWidth: 190, height: 'auto', display: 'block', margin: '0 auto' }}>
      {/* 직전 주 (작은 봉) */}
      <line x1="52" y1="60" x2="52" y2="98" stroke={prevColor} strokeWidth="1.5" />
      <rect x="42" y="68" width="20" height="22" rx="1" fill={prevColor} />
      <text x="52" y="120" textAnchor="middle" fontSize="9" fill={TK.sub}>직전 주</text>
      <text x="52" y="132" textAnchor="middle" fontSize="8.5" fill={prevColor}>{bear ? '상승' : '하락'}</text>
      {/* 이번 주 (큰 봉 — 직전 몸통을 완전히 감쌈) */}
      <line x1="112" y1="46" x2="112" y2="114" stroke={curColor} strokeWidth="1.5" />
      <rect x="100" y="56" width="24" height="46" rx="1" fill={curColor} />
      {/* 감싸는 범위 점선 강조 */}
      <rect x="96" y="56" width="32" height="46" rx="2" fill="none" stroke={curColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.55" />
      <text x="112" y="120" textAnchor="middle" fontSize="9" fill={TK.slate200} fontWeight="700">이번 주</text>
      <text x="112" y="132" textAnchor="middle" fontSize="8.5" fill={curColor}>{bear ? '하락·감쌈' : '상승·감쌈'}</text>
      {/* 이번 주 봉의 시가/종가 (감싸는 핵심) */}
      <text x="130" y="61" fontSize="8" fill={TK.sub}>{bear ? '시가' : '종가'}</text>
      <text x="130" y="104" fontSize="8" fill={TK.sub}>{bear ? '종가' : '시가'}</text>
    </svg>
  )
}

export default function CandlePatternRisk() {
  const [data, setData] = useState<CandlePatternResult | null>(null)
  const [err, setErr] = useState(false)
  const [eduOpen, setEduOpen] = useState(false)

  useEffect(() => {
    fetch('/api/candle-pattern', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => setErr(true))
  }, [])

  if (err) return null
  if (!data || data.anchors.length === 0) return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 18, color: TK.sub, fontSize: 13 }}>
      🕯️ 주간 캔들 패턴을 분석 중입니다…
    </div>
  )

  const flagged = data.anchors.filter(a => a.pattern !== 'none')

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🕯️ 주간 캔들 리스크 신호</span>
        <span style={{ color: TK.sub, fontSize: 10.5 }}>장악형(Engulfing) 패턴 — 완전 객관 계산, 매매 지시 아님</span>
      </div>

      {flagged.length > 0 ? (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 9, padding: '8px 12px', marginBottom: 10, color: TK.red300, fontSize: 12, fontWeight: 700 }}>
          ⚠️ {flagged.map(a => `${a.label} ${a.pattern === 'bearish' ? '약세장악형' : '강세장악형'}`).join(' · ')} 포착 — 펀더멘탈과 별개로 단기 변동성 경계 신호입니다.
        </div>
      ) : (
        <div style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 9, padding: '8px 12px', marginBottom: 10, color: TK.sub8, fontSize: 12 }}>
          현재 감지된 장악형 패턴 없음 — 특이 리스크 신호 없음.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.anchors.map(a => {
          const c = a.pattern === 'bearish' ? TK.red400 : a.pattern === 'bullish' ? TK.green400 : TK.slate500
          const label = a.pattern === 'bearish' ? '🔻 약세장악형' : a.pattern === 'bullish' ? '🔺 강세장악형' : '— 없음'
          return (
            <div key={a.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <span style={{ width: 130, color: TK.sub11, fontWeight: 700 }}>{a.market === 'KR' ? '🇰🇷' : '🇺🇸'} {a.label}</span>
              <span style={{ color: c, fontWeight: 800, width: 90 }}>{label}</span>
              <span style={{ color: TK.sub2, fontSize: 10 }}>{a.weekOf} 완결주 · O{a.curOpen}→C{a.curClose} (전주 O{a.prevOpen}→C{a.prevClose})</span>
            </div>
          )
        })}
      </div>

      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 2px', textAlign: 'left' }}>
        <span style={{ color: TK.btcOrange, fontWeight: 800, fontSize: 12 }}>🎓 장악형 패턴이란? (왜 엘리어트 파동은 안 쓰나)</span>
        <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: TK.sub5, fontSize: 11, lineHeight: 1.65, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 📊 봉 예시 도식 — 약세/강세 장악형 나란히 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 190px', background: 'rgba(248,113,113,0.05)', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ color: TK.red400, fontWeight: 800, fontSize: 11.5, marginBottom: 2 }}>🔻 약세장악형 — 하락 반전 경고</div>
              <EngulfFig type="bearish" />
              <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>
                직전 주 <b style={{ color: UP }}>상승(빨강)</b> 뒤, 이번 주 <b style={{ color: DOWN }}>하락(파랑)</b> 봉의 시가·종가가 직전 몸통을 <b>통째로 감쌈</b> → 상승세 꺾임.
              </div>
            </div>
            <div style={{ flex: '1 1 190px', background: 'rgba(74,222,128,0.05)', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ color: TK.green400, fontWeight: 800, fontSize: 11.5, marginBottom: 2 }}>🔺 강세장악형 — 상승 반전 신호</div>
              <EngulfFig type="bullish" />
              <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>
                직전 주 <b style={{ color: DOWN }}>하락(파랑)</b> 뒤, 이번 주 <b style={{ color: UP }}>상승(빨강)</b> 봉의 시가·종가가 직전 몸통을 <b>통째로 감쌈</b> → 하락세 반전.
              </div>
            </div>
          </div>
          <div style={{ color: TK.sub, fontSize: 10, marginTop: -2 }}>※ 봉 색은 한국식(상승=빨강·하락=파랑). 신호 이름의 &lsquo;약세/강세&rsquo;는 앞으로의 방향을 뜻합니다 — 봉 색과 헷갈리지 마세요.</div>
          <div>🕯️ <b style={{ color: TK.red400 }}>약세장악형(Bearish Engulfing)</b> — 직전 주(양봉)의 몸통 전체를 이번 주(음봉)가 시가·종가로 완전히 감싸는 패턴. <b style={{ color: TK.green400 }}>강세장악형</b>은 그 반대(반등 신호).</div>
          <div>📐 <b style={{ color: TK.blue300 }}>완전 객관적 계산</b> — 시가·종가 네 숫자의 대소 비교뿐이라 사람마다 다르게 볼 여지가 없습니다.</div>
          <div>⚠️ <b style={{ color: TK.amber500 }}>왜 엘리어트 파동은 안 쓰나</b> — 파동(1~5, a-b-c) 카운팅은 분석가마다 다르게 셀 수 있는 <b>주관적</b> 기법입니다. 이 앱은 하드코딩·주관 개입을 배제하는 원칙이라, 객관적으로 계산 가능한 캔들 패턴만 채택했습니다.</div>
          <div style={{ color: TK.sub }}>🧭 <b>펀더멘탈이 여전히 주(主)</b> — 이 신호는 &lsquo;열기가 뜨거울 때 단기 되돌림 가능성&rsquo;을 알리는 보조 경고일 뿐, 매수·매도 지시가 아닙니다. 장악형 이후에도 추세가 이어지는 경우가 흔합니다(속임형/false signal).</div>
        </div>
      )}
    </div>
  )
}
