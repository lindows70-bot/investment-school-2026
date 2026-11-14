'use client'
// 🚀 IPO 하이프 사이클 — 신규 상장주 수명주기 곡선 위에 실제 종목을 상장 첫날 종가·일봉 종가 실데이터로 자동 매핑
import { useState, useEffect, useMemo, useRef } from 'react'
import type { IpoCycleResult, IpoStock, Phase } from '@/app/api/ipo-cycle/route'
import { PHASE_BAND } from '@/lib/ipoCycle'
import { TK, FS } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3, GOLD = '#d4af7a'
const PH: Record<Phase, { ko: string; en: string; color: string; desc: string; action: string }> = {
  hype: { ko: '광기', en: 'HYPE', color: TK.red400, desc: '미디어 포화 + FOMO 수급으로 펀더멘탈과 무관하게 폭등(상장 1~3개월).', action: '🚫 추격 매수 금지 — 상장 직후 고점은 대부분 함정. 락업 해제 전까지 관망.' },
  reality: { ko: '자각', en: 'REALITY', color: TK.orange400, desc: 'VC 락업 해제 + 첫 실적으로 기대 미달 자각 → 폭락(3~9개월).', action: '⏳ 하락 초입 — 떨어지는 칼날 잡지 말고 바닥 확인까지 대기.' },
  pain: { ko: '고통', en: 'PAIN', color: TK.purple500, desc: '"이 주식 끝났다" 대중·기관 외면. 변동성 축소·바닥 다지기(9~18개월).', action: '🔍 역발상 사냥터 — 사업 해자·현금 확인 후 소액 분할 관찰 시작(확신은 매집기에).' },
  smart: { ko: '스마트머니 매집', en: 'SMART MONEY', color: TK.blue400, desc: '대중 절망 속 기관·대가가 가치 대비 저가를 인지하고 조용히 분할 매집(12~24개월).', action: '💧 분할 매수 검토 — 수급(내부자·기관)과 실적 회복 신호가 함께면 리스크 대비 보상 우수.' },
  recovery: { ko: '회복', en: 'RECOVERY', color: TK.green400, desc: '흑자 전환·제품 가속이 실적으로 증명되며 의심 속 우상향(2~3년).', action: '📈 추세 확인 매수 — 실적이 뒷받침되면 눌림목마다 비중 확대. 이미 오른 만큼 분할로.' },
  uptrend: { ko: '대세 상승', en: 'STRONG UPTREND', color: TK.cyan400, desc: '펀더멘탈 완전 입증·전고점 돌파, 지배적 대형주로 졸업(3년+).', action: '🏆 사이클 완주 — 밸류에이션 관리하며 장기 보유. 신규 진입은 눌림목·밸류 확인.' },
}
const PHASE_ORDER: Phase[] = ['hype', 'reality', 'pain', 'smart', 'recovery', 'uptrend']

// 하이프 곡선: 초반 급등(hype 봉우리)→폭락→바닥(pain)→완만 회복→우상향 돌파
const W = 1000, H = 336
const X0 = 62, X1 = 955
const CHART_MIN = 860   // 차트 최소 폭(px) — 이보다 좁으면 줄이지 않고 가로로 민다(티커 글자 약 9.5px 유지)
// X축 타임 테이블(원본 이미지) — curveX 구간 → 상장 후 경과 시간 라벨
const TIME_BANDS: { from: number; to: number; time: string; phase: string; color: string }[] = [
  { from: 0, to: 16, time: '1–3개월', phase: 'HYPE', color: TK.red400 },
  { from: 16, to: 31, time: '3–9개월', phase: 'REALITY', color: TK.orange400 },
  { from: 31, to: 51, time: '9–18개월', phase: 'PAIN', color: TK.purple500 },
  { from: 51, to: 67, time: '12–24개월', phase: 'SMART MONEY', color: TK.blue400 },
  { from: 67, to: 85, time: '2–3년', phase: 'RECOVERY', color: TK.green400 },
  { from: 85, to: 100, time: '3년+', phase: 'UPTREND', color: TK.cyan400 },
]
const px = (x: number) => X0 + (x / 100) * (X1 - X0)
function cy(x: number): number {
  // 구간별 y(위=낮은 값). 원본 이미지 형태 근사: 봉우리(x~9)→저점(x~42)→우상향 돌파(x~98)
  const top = 38, mid = 168, bottom = 242, high = 28
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

  // 겹침 방지(2026-11-14 — 한 국면에 7~10종이 몰려 티커가 서로 덮였다):
  //   ① 국면 안에서 좌→우 순서는 지키되 점 사이 최소 간격을 벌린다(dx — 그리는 자리. 서버 값 curveX 는 그대로)
  //   ② 라벨은 가까운 이웃이 안 쓴 줄(lane)에 놓는다 — 곡선 위쪽이 비어 있어 위로 3줄, 아래로 2줄
  const placed = useMemo(() => {
    if (!d) return []
    const dx = new Map<string, number>()
    for (const ph of PHASE_ORDER) {
      const g = d.stocks.filter(s => s.phase === ph).sort((a, b) => a.curveX - b.curveX)
      if (!g.length) continue
      const [a, b] = PHASE_BAND[ph]
      const gap = g.length > 1 ? Math.min(2.2, (b - a) / (g.length - 1)) : 0
      const xs = g.map(s => s.curveX)
      for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + gap)
      if (xs[xs.length - 1] > b) { xs[xs.length - 1] = b; for (let i = xs.length - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - gap) }
      g.forEach((s, i) => dx.set(s.ticker, xs[i]))
    }
    // 라벨 자리는 '줄 번호'가 아니라 실제 좌표로 고른다 — 곡선이 기울어 있어 줄 번호가 달라도 높이가 겹쳤다(실측 6건 → 0건).
    //   후보(점 바로 위 → 바로 아래 → 위로 한 칸씩)를 차례로 놓아 보고, 이미 놓인 라벨·다른 점과 안 겹치는 첫 자리에 둔다
    const nodes = [...d.stocks]
      .map(s => { const x = dx.get(s.ticker) ?? s.curveX; return { s, x, X: px(x), y: cy(x), w: s.ticker.length * 7.6 + 6 } })
      .sort((p, q) => p.x - q.x)
    const CAND: [boolean, number][] = [[true, 0], [false, 0], [true, 1], [true, 2], [false, 1], [true, 3], [true, 4], [true, 5]]
    const out: (IpoStock & { x: number; up: boolean; lvl: number; ly: number; X: number; w: number })[] = []
    for (const n of nodes) {
      let pick: { up: boolean; lvl: number; ly: number } = { up: true, lvl: 0, ly: n.y - 15 }
      for (const [up, k] of CAND) {
        const ly = up ? n.y - 15 - k * 14 : n.y + 23 + k * 14
        if (ly < 26 || ly > 266) continue   // 위: 국면 이름 줄 · 아래: 시간 축
        const hitLabel = out.some(p => Math.abs(p.X - n.X) < (p.w + n.w) / 2 && Math.abs(p.ly - ly) < 12)
        const hitDot = nodes.some(o => o !== n && Math.abs(o.X - n.X) < n.w / 2 + 7 && ly + 2 > o.y - 8 && ly - 10 < o.y + 8)
        if (!hitLabel && !hitDot) { pick = { up, lvl: k, ly }; break }
      }
      out.push({ ...n.s, x: n.x, X: n.X, w: n.w, ...pick })
    }
    return out
  }, [d])

  const cur = d?.stocks.find(s => s.ticker === sel) ?? null

  // 📱 좁은 화면 — 곡선을 폭에 맞춰 줄이면 티커 글자가 3.6px(375폭)·7.9px(768폭)로 읽을 수 없었다(2026-11-14 실측).
  //    차트 최소 폭(CHART_MIN)을 지키고 가로로 밀어 보게 한다. 밀 수 있다는 안내는 실제로 넘칠 때만
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  useEffect(() => {
    const measure = () => { const el = wrapRef.current; if (el) setScrollable(el.scrollWidth > el.clientWidth + 4) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [d])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, #1a1020, ${CARD})`, borderRadius: 14, border: `1px solid ${GOLD}44`, padding: '16px 20px' }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 19 }}>🚀 IPO 하이프 사이클 — 신규 상장주는 왜 요동치나</div>
        <div style={{ color: TK.sub5, fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          대형 혁신주는 상장 후 <b style={{ color: TK.slate200 }}>기대(Hype)와 현실(Reality)의 간극</b>으로 독특한 궤적을 그립니다: 광기 폭등 → 락업·실적으로 폭락 → 고통의 바닥 → 스마트머니 매집 → 실적 회복 → 대세 상승.
          아래 곡선에 <b style={{ color: GOLD }}>실제 상장주</b>를 상장 첫날 종가와 그 뒤의 일봉 종가로 자동 배치했습니다 — 각 종목이 지금 어느 국면인지 한눈에.
        </div>
        {d && (
          <div style={{ color: TK.sub, fontSize: FS.tiny, marginTop: 6 }}>
            📅 {d.priceDate ? `${d.priceDate.slice(5).replace('-', '/')} 미국 장 가격` : '가격 날짜 확인 못 함'} · {d.stocks.length}종 · 12시간마다 다시 계산 · 출처 Yahoo Finance 일봉
          </div>
        )}
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: TK.sub, fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: TK.sub, fontSize: 13 }}>상장주들의 주가 경로를 분석 중입니다…</div>}

      {d && <>
        {/* 하이프 곡선 + 종목 노드 */}
        {scrollable && <div style={{ color: TK.sub, fontSize: FS.tiny, marginBottom: -8 }}>↔ 좌우로 밀면 곡선 전체가 보입니다</div>}
        <div ref={wrapRef} style={{ background: '#0b0d12', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '8px 6px', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: CHART_MIN, height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="ipoCurve" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={TK.red400} /><stop offset="25%" stopColor={TK.orange400} />
                <stop offset="45%" stopColor={TK.purple500} /><stop offset="62%" stopColor={TK.blue400} />
                <stop offset="80%" stopColor={TK.green400} /><stop offset="100%" stopColor={TK.cyan400} />
              </linearGradient>
            </defs>
            {/* Y축(PRICE) */}
            <line x1={X0 - 8} y1={22} x2={X0 - 8} y2={264} stroke="#3a4150" strokeWidth="1" />
            <polygon points={`${X0 - 8},18 ${X0 - 11},26 ${X0 - 5},26`} fill={TK.sub2} />
            <text x={X0 - 14} y={150} fill={TK.sub8} fontSize="11" fontWeight="700" textAnchor="middle" transform={`rotate(-90 ${X0 - 20} 150)`}>PRICE 주가</text>
            {/* 국면 라벨(상단) */}
            {PHASE_ORDER.map(ph => {
              const [a, b] = PHASE_BAND[ph]; const midX = (a + b) / 2
              return <text key={ph} x={px(midX)} y={16} fill={PH[ph].color} fontSize="11.5" fontWeight="800" textAnchor="middle" opacity="0.9">{PH[ph].en}</text>
            })}
            {/* 곡선 */}
            <path d={path()} fill="none" stroke="url(#ipoCurve)" strokeWidth="4.5" strokeLinecap="round" />
            {/* 종목 노드 */}
            {placed.map(s => {
              const x = px(s.x), y = cy(s.x), active = s.ticker === sel
              const ly = s.ly
              return (
                <g key={s.ticker} onClick={() => setSel(s.ticker)} style={{ cursor: 'pointer' }}>
                  {/* 둘째 줄부터는 점과 라벨을 가는 선으로 잇는다 — 어느 점의 이름인지 헷갈리지 않게 */}
                  {s.lvl > 0 && <line x1={x} y1={s.up ? y - 8 : y + 8} x2={x} y2={s.up ? ly + 3 : ly - 11} stroke={PH[s.phase].color} strokeWidth="1" opacity="0.45" />}
                  <circle cx={x} cy={y} r={active ? 8 : 6} fill={PH[s.phase].color} stroke={active ? '#fff' : '#0b0d12'} strokeWidth={active ? 2.5 : 1.5}>
                    {active && <animate attributeName="r" values="7;10;7" dur="1.6s" repeatCount="indefinite" />}
                  </circle>
                  <g style={{ paintOrder: 'stroke' }} stroke="#0b0d12" strokeWidth="3.5" strokeLinejoin="round">
                    <text x={x} y={ly} fill={active ? '#fff' : TK.sub11} fontSize={active ? 12.5 : 11} fontWeight="800" textAnchor="middle">{s.ticker}</text>
                  </g>
                </g>
              )
            })}
            {/* X축(TIME 타임 테이블) — 원본 이미지처럼 */}
            <line x1={X0 - 8} y1={272} x2={X1 + 3} y2={272} stroke="#3a4150" strokeWidth="1" />
            <polygon points={`${X1 + 3},272 ${X1 - 5},269 ${X1 - 5},275`} fill={TK.sub2} />
            <text x={X0 - 10} y={286} fill={TK.sub2} fontSize="10" fontWeight="700">IPO</text>
            <text x={X1 + 2} y={286} fill={TK.sub8} fontSize="10" fontWeight="700" textAnchor="end">TIME 시간 →</text>
            {TIME_BANDS.map((b, i) => {
              const cx = px((b.from + b.to) / 2)
              return (
                <g key={i}>
                  {i > 0 && <line x1={px(b.from)} y1={272} x2={px(b.from)} y2={278} stroke="#3a4150" strokeWidth="1" />}
                  <text x={cx} y={300} fill={TK.sub11} fontSize="10.5" fontWeight="700" textAnchor="middle">{b.time}</text>
                  <text x={cx} y={314} fill={b.color} fontSize="9.5" fontWeight="700" textAnchor="middle" opacity="0.85">{b.phase}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 종목 칩 선택 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.stocks.map(s => (
            <button key={s.ticker} onClick={() => setSel(s.ticker)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: s.ticker === sel ? `${PH[s.phase].color}26` : TK.bg6, color: s.ticker === sel ? '#fff' : TK.sub8, border: `1px solid ${s.ticker === sel ? PH[s.phase].color : TK.border}`, borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PH[s.phase].color }} />
              {s.ticker} <span style={{ color: PH[s.phase].color, fontSize: 10 }}>{PH[s.phase].ko}</span>
            </button>
          ))}
        </div>

        {/* 선택 종목 상세 */}
        {cur && (
          <div style={{ background: `${PH[cur.phase].color}0e`, border: `1px solid ${PH[cur.phase].color}44`, borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{cur.name} <span style={{ color: TK.sub, fontSize: 13 }}>{cur.ticker}</span></span>
              <span style={{ background: PH[cur.phase].color, color: '#0b0d12', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 900 }}>{PH[cur.phase].en} · {PH[cur.phase].ko}</span>
              <span style={{ color: TK.sub, fontSize: 11 }}>상장 {cur.ipo} · {cur.months}개월차</span>
              {cur.auto && <span style={{ background: `${TK.amber400}22`, color: TK.amber400, borderRadius: 6, padding: '2px 8px', fontSize: FS.tiny, fontWeight: 800 }}>🆕 새 상장 자동 감지</span>}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '8px 0' }}>
              {[['첫날 종가 대비', `${cur.multiple}배`, cur.multiple >= 1 ? TK.green400 : TK.red400], ['고점 대비', `${cur.ddFromPeak}%`, TK.red400], ['저점 대비', `+${cur.upFromTrough}%`, TK.green400], ['첫날 종가→현재', `$${cur.ipoPrice} → $${cur.current}`, TK.sub11]].map(([k, v, c]) => (
                <div key={k as string}><div style={{ color: TK.sub2, fontSize: 10 }}>{k}</div><div style={{ color: c as string, fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>{v}</div></div>
              ))}
              <Spark values={cur.spark} color={PH[cur.phase].color} />
            </div>
            {/* 이름표의 뜻 — '상장가'라고만 쓰면 공모가로 읽힌다(2026-11-14: 서클 화면 $107.70 은 첫 주 종가였고 첫날 종가는 $83.23) */}
            <div style={{ color: TK.sub2, fontSize: FS.tiny, lineHeight: 1.55, marginBottom: 6 }}>
              기준가는 공모가가 아니라 <b style={{ color: TK.sub8 }}>상장 첫날({cur.ipoBarDate.slice(5).replace('-', '/')}) 종가</b>입니다. 고점·저점은 상장 뒤 <b style={{ color: TK.sub8 }}>하루 종가</b> 중 가장 높은·낮은 값이라, 장중에 잠깐 찍힌 가격과는 다릅니다. 점선 = 첫날 종가.
              {cur.ipoBarDate !== cur.ipo && <span style={{ color: TK.amber400 }}> ⚠️ 상장일({cur.ipo}) 가격 자료가 없어 {cur.ipoBarDate} 종가를 기준가로 썼습니다.</span>}
            </div>
            <div style={{ color: TK.sub5, fontSize: 11.5, lineHeight: 1.6 }}>{PH[cur.phase].desc}</div>
            {/* 하락 국면(광기·자각·고통)인데 저점 반등이 붙어 있으면 — 학생이 "반등 중인데 왜 하락 구간?"으로
                읽는 모순을 문장으로 해소한다. 짧은 반등 ≠ 바닥 확인(전환은 매집·회복 국면 승격으로 판정). */}
            {(cur.phase === 'hype' || cur.phase === 'reality' || cur.phase === 'pain') && cur.upFromTrough >= 10 && (
              <div style={{ color: TK.amber400, fontSize: FS.tiny, lineHeight: 1.6, marginTop: 5 }}>
                🩹 저점 대비 +{cur.upFromTrough}% 반등을 시도 중입니다 — 다만 짧은 반등은 &lsquo;바닥 확인&rsquo;이 아닙니다.
                반등이 이어져 추세가 바뀌면 곡선 위치가 매집·회복 쪽으로 자동 이동합니다.
              </div>
            )}
            <div style={{ background: TK.bg3, borderRadius: 8, padding: '8px 12px', marginTop: 8, color: TK.slate200, fontSize: 11.5, lineHeight: 1.6, borderLeft: `3px solid ${PH[cur.phase].color}` }}>
              <b style={{ color: PH[cur.phase].color }}>린치·달리오식 대응</b> — {PH[cur.phase].action}
            </div>
          </div>
        )}

        {/* 6국면 전략 요약 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🎓 6단계 국면별 대응 전략</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {PHASE_ORDER.map(ph => {
              const members = d.stocks.filter(s => s.phase === ph)
              return (
                <div key={ph} style={{ background: TK.bg3, borderRadius: 9, borderTop: `2px solid ${PH[ph].color}`, padding: '9px 11px' }}>
                  <div style={{ color: PH[ph].color, fontWeight: 800, fontSize: 12 }}>{PH[ph].en} <span style={{ color: TK.sub8, fontSize: 10.5 }}>{PH[ph].ko}</span></div>
                  <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.5, marginTop: 3 }}>{PH[ph].action}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {members.length ? members.map(m => <button key={m.ticker} onClick={() => setSel(m.ticker)} style={{ background: `${PH[ph].color}18`, color: TK.sub11, border: `1px solid ${PH[ph].color}33`, borderRadius: 5, padding: '1px 7px', fontSize: 10.5, cursor: 'pointer' }}>{m.ticker}</button>) : <span style={{ color: '#5a6b7c', fontSize: 10 }}>해당 없음</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ color: TK.sub2, fontSize: 10, marginTop: 8, lineHeight: 1.55 }}>
            ⚠️ 곡선 위치는 실제 주가(고점에서 얼마나 내렸나 · 저점에서 얼마나 올랐나 · 첫날 종가의 몇 배인가)로 자동 판정합니다. 한 국면 안에서 점의 좌우 자리는 순서만 뜻합니다. 교과서적 &lsquo;평균 경로&rsquo;이며 모든 종목이 이 순서를 따르진 않습니다(상장 폐지·영구 하락도 존재). 같은 티커를 예전에 다른 종목이 썼던 경우(SPCX·CRCL)는 상장일 뒤의 가격만 잘라 씁니다. 스팩 합병 상장(RKLB·LUNR·HIMS)은 합병 뒤 첫 거래일이 기준입니다. 앤스로픽·오픈AI처럼 상장을 기다리는 대형사는 미국 거래소에 티커가 생기면 자동으로 올라옵니다. 매매 지시 아닌 심리·수급 교육용.
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
