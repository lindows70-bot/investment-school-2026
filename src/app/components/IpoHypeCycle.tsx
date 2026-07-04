'use client'
// 🚀 IPO 하이프 사이클 — 신규 상장주 수명주기 곡선 위에 실제 종목을 상장가·주봉 실데이터로 자동 매핑
import { useState, useEffect, useMemo } from 'react'
import type { IpoCycleResult, IpoStock, Phase } from '@/app/api/ipo-cycle/route'

const CARD = '#12151c', BORDER = '#252a36', GOLD = '#d4af7a'
const PH: Record<Phase, { ko: string; en: string; color: string; desc: string; action: string }> = {
  hype: { ko: '광기', en: 'HYPE', color: '#f87171', desc: '미디어 포화 + FOMO 수급으로 펀더멘탈과 무관하게 폭등(상장 1~3개월).', action: '🚫 추격 매수 금지 — 상장 직후 고점은 대부분 함정. 락업 해제 전까지 관망.' },
  reality: { ko: '자각', en: 'REALITY', color: '#fb923c', desc: 'VC 락업 해제 + 첫 실적으로 기대 미달 자각 → 폭락(3~9개월).', action: '⏳ 하락 초입 — 떨어지는 칼날 잡지 말고 바닥 확인까지 대기.' },
  pain: { ko: '고통', en: 'PAIN', color: '#a855f7', desc: '"이 주식 끝났다" 대중·기관 외면. 변동성 축소·바닥 다지기(9~18개월).', action: '🔍 역발상 사냥터 — 사업 해자·현금 확인 후 소액 분할 관찰 시작(확신은 매집기에).' },
  smart: { ko: '스마트머니 매집', en: 'SMART MONEY', color: '#60a5fa', desc: '대중 절망 속 기관·대가가 가치 대비 저가를 인지하고 조용히 분할 매집(12~24개월).', action: '💧 분할 매수 검토 — 수급(내부자·기관)과 실적 회복 신호가 함께면 리스크 대비 보상 우수.' },
  recovery: { ko: '회복', en: 'RECOVERY', color: '#4ade80', desc: '흑자 전환·제품 가속이 실적으로 증명되며 의심 속 우상향(2~3년).', action: '📈 추세 확인 매수 — 실적이 뒷받침되면 눌림목마다 비중 확대. 이미 오른 만큼 분할로.' },
  uptrend: { ko: '대세 상승', en: 'STRONG UPTREND', color: '#22d3ee', desc: '펀더멘탈 완전 입증·전고점 돌파, 지배적 대형주로 졸업(3년+).', action: '🏆 사이클 완주 — 밸류에이션 관리하며 장기 보유. 신규 진입은 눌림목·밸류 확인.' },
}
const PHASE_ORDER: Phase[] = ['hype', 'reality', 'pain', 'smart', 'recovery', 'uptrend']

// 하이프 곡선: 초반 급등(hype 봉우리)→폭락→바닥(pain)→완만 회복→우상향 돌파
const W = 1000, H = 300
const X0 = 50, X1 = 955
const px = (x: number) => X0 + (x / 100) * (X1 - X0)
function cy(x: number): number {
  // 구간별 y(위=낮은 값). 원본 이미지 형태 근사: 봉우리(x~9)→저점(x~42)→우상향 돌파(x~98)
  const top = 40, mid = 175, bottom = 250, high = 30
  if (x <= 9) return bottom - (bottom - top) * Math.sin((x / 9) * Math.PI / 2)          // 급등
  if (x <= 42) return top + (bottom - top) * Math.sin(((x - 9) / 33) * Math.PI / 2)     // 폭락→바닥
  if (x <= 66) return bottom - (bottom - mid) * ((x - 42) / 24)                          // 완만 회복
  return mid - (mid - high) * Math.pow((x - 66) / 34, 1.4)                               // 가속 상승
}
function path(from = 0, to = 100): string {
  const p: string[] = []
  for (let x = from; x <= to; x += 1) p.push(`${px(x).toFixed(1)} ${cy(x).toFixed(1)}`)
  return 'M ' + p.join(' L ')
}

export default function IpoHypeCycle() {
  const [d, setD] = useState<IpoCycleResult | null>(null)
  const [err, setErr] = useState(false)
  const [sel, setSel] = useState<string>('')

  useEffect(() => {
    fetch('/api/ipo-cycle', { cache: 'no-store' }).then(r => r.json()).then(x => { if (x?.stocks?.length) { setD(x); setSel(x.stocks[0].ticker) } else setErr(true) }).catch(() => setErr(true))
  }, [])

  // 겹침 방지: curveX 근접 노드 위/아래 교차
  const placed = useMemo(() => {
    if (!d) return []
    const out: (IpoStock & { up: boolean })[] = []
    d.stocks.forEach(s => {
      const near = out.filter(o => Math.abs(o.curveX - s.curveX) < 7)
      out.push({ ...s, up: near.length % 2 === 0 })
    })
    return out
  }, [d])

  const cur = d?.stocks.find(s => s.ticker === sel) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, #1a1020, ${CARD})`, borderRadius: 14, border: `1px solid ${GOLD}44`, padding: '16px 20px' }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 19 }}>🚀 IPO 하이프 사이클 — 신규 상장주는 왜 요동치나</div>
        <div style={{ color: '#aab6c4', fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          대형 혁신주는 상장 후 <b style={{ color: '#e2e8f0' }}>기대(Hype)와 현실(Reality)의 간극</b>으로 독특한 궤적을 그립니다: 광기 폭등 → 락업·실적으로 폭락 → 고통의 바닥 → 스마트머니 매집 → 실적 회복 → 대세 상승.
          아래 곡선에 <b style={{ color: GOLD }}>실제 상장주</b>를 상장가·주봉 실데이터로 자동 배치했습니다 — 각 종목이 지금 어느 국면인지 한눈에.
        </div>
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>상장주들의 주가 경로를 분석 중입니다…</div>}

      {d && <>
        {/* 하이프 곡선 + 종목 노드 */}
        <div style={{ background: '#0b0d12', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '8px 6px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="ipoCurve" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f87171" /><stop offset="25%" stopColor="#fb923c" />
                <stop offset="45%" stopColor="#a855f7" /><stop offset="62%" stopColor="#60a5fa" />
                <stop offset="80%" stopColor="#4ade80" /><stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            {/* 국면 라벨(상단) */}
            {PHASE_ORDER.map(ph => {
              const band: Record<Phase, [number, number]> = { hype: [3, 15], reality: [17, 30], pain: [33, 50], smart: [53, 66], recovery: [69, 84], uptrend: [87, 98] }
              const [a, b] = band[ph]; const midX = (a + b) / 2
              return <text key={ph} x={px(midX)} y={16} fill={PH[ph].color} fontSize="11.5" fontWeight="800" textAnchor="middle" opacity="0.9">{PH[ph].en}</text>
            })}
            {/* 곡선 */}
            <path d={path()} fill="none" stroke="url(#ipoCurve)" strokeWidth="4.5" strokeLinecap="round" />
            {/* 종목 노드 */}
            {placed.map(s => {
              const x = px(s.curveX), y = cy(s.curveX), active = s.ticker === sel
              const ly = s.up ? y - 16 : y + 24
              return (
                <g key={s.ticker} onClick={() => setSel(s.ticker)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r={active ? 8 : 6} fill={PH[s.phase].color} stroke={active ? '#fff' : '#0b0d12'} strokeWidth={active ? 2.5 : 1.5}>
                    {active && <animate attributeName="r" values="7;10;7" dur="1.6s" repeatCount="indefinite" />}
                  </circle>
                  <g style={{ paintOrder: 'stroke' }} stroke="#0b0d12" strokeWidth="3.5" strokeLinejoin="round">
                    <text x={x} y={ly} fill={active ? '#fff' : '#cdd6e3'} fontSize={active ? 12.5 : 11} fontWeight="800" textAnchor="middle">{s.ticker}</text>
                  </g>
                </g>
              )
            })}
            {/* 축 라벨 */}
            <text x={px(1)} y={H - 6} fill="#7f93a8" fontSize="10">← 상장(IPO)</text>
            <text x={px(99)} y={H - 6} fill="#7f93a8" fontSize="10" textAnchor="end">시간 3년+ →</text>
          </svg>
        </div>

        {/* 종목 칩 선택 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.stocks.map(s => (
            <button key={s.ticker} onClick={() => setSel(s.ticker)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: s.ticker === sel ? `${PH[s.phase].color}26` : '#161b25', color: s.ticker === sel ? '#fff' : '#9aa7b5', border: `1px solid ${s.ticker === sel ? PH[s.phase].color : '#1e293b'}`, borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PH[s.phase].color }} />
              {s.ticker} <span style={{ color: PH[s.phase].color, fontSize: 10 }}>{PH[s.phase].ko}</span>
            </button>
          ))}
        </div>

        {/* 선택 종목 상세 */}
        {cur && (
          <div style={{ background: `${PH[cur.phase].color}0e`, border: `1px solid ${PH[cur.phase].color}44`, borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{cur.name} <span style={{ color: '#8a9aaa', fontSize: 13 }}>{cur.ticker}</span></span>
              <span style={{ background: PH[cur.phase].color, color: '#0b0d12', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 900 }}>{PH[cur.phase].en} · {PH[cur.phase].ko}</span>
              <span style={{ color: '#8a9aaa', fontSize: 11 }}>상장 {cur.ipo} · {cur.months}개월차</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '8px 0' }}>
              {[['상장가 대비', `${cur.multiple}배`, cur.multiple >= 1 ? '#4ade80' : '#f87171'], ['고점 대비', `${cur.ddFromPeak}%`, '#f87171'], ['저점 대비', `+${cur.upFromTrough}%`, '#4ade80'], ['상장가→현재', `$${cur.ipoPrice} → $${cur.current}`, '#cdd6e3']].map(([k, v, c]) => (
                <div key={k as string}><div style={{ color: '#7f93a8', fontSize: 10 }}>{k}</div><div style={{ color: c as string, fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>{v}</div></div>
              ))}
              <Spark values={cur.spark} color={PH[cur.phase].color} />
            </div>
            <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6 }}>{PH[cur.phase].desc}</div>
            <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 12px', marginTop: 8, color: '#e2e8f0', fontSize: 11.5, lineHeight: 1.6, borderLeft: `3px solid ${PH[cur.phase].color}` }}>
              <b style={{ color: PH[cur.phase].color }}>린치·달리오식 대응</b> — {PH[cur.phase].action}
            </div>
          </div>
        )}

        {/* 6국면 전략 요약 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🎓 6단계 국면별 대응 전략</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {PHASE_ORDER.map(ph => {
              const members = d.stocks.filter(s => s.phase === ph)
              return (
                <div key={ph} style={{ background: '#0f1117', borderRadius: 9, borderTop: `2px solid ${PH[ph].color}`, padding: '9px 11px' }}>
                  <div style={{ color: PH[ph].color, fontWeight: 800, fontSize: 12 }}>{PH[ph].en} <span style={{ color: '#9aa7b5', fontSize: 10.5 }}>{PH[ph].ko}</span></div>
                  <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.5, marginTop: 3 }}>{PH[ph].action}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {members.length ? members.map(m => <button key={m.ticker} onClick={() => setSel(m.ticker)} style={{ background: `${PH[ph].color}18`, color: '#cdd6e3', border: `1px solid ${PH[ph].color}33`, borderRadius: 5, padding: '1px 7px', fontSize: 10.5, cursor: 'pointer' }}>{m.ticker}</button>) : <span style={{ color: '#5a6b7c', fontSize: 10 }}>해당 없음</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.55 }}>
            ⚠️ 곡선 위치는 상장가·주봉 실데이터(고점 낙폭·저점 반등·상장가 배수)로 자동 판정 — 교과서적 &lsquo;평균 경로&rsquo;이며 모든 종목이 이 순서를 따르진 않습니다(상장 폐지·영구 하락도 존재). 티커 재사용으로 옛 데이터가 섞인 종목(SPCX·CRCL 등)은 자동 제외. 매매 지시 아닌 심리·수급 교육용.
          </div>
        </div>
      </>}
    </div>
  )
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 150, h = 40
  const mn = Math.min(...values), mx = Math.max(...values), rg = mx - mn || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - mn) / rg) * (h - 6)}`).join(' ')
  const y100 = mn <= 100 && mx >= 100 ? h - 3 - ((100 - mn) / rg) * (h - 6) : null
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      {y100 != null && <line x1="0" y1={y100} x2={w} y2={y100} stroke="#5a6b7c" strokeDasharray="3 3" strokeWidth="0.8" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  )
}
