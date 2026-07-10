'use client'
// 🧭 섹터 로테이션 시계 — 17섹터(GICS 11+테마 6)를 상대강도×모멘텀 4사분면에. 클릭 시 드릴다운(SectorCanvas).
import { useEffect, useState } from 'react'
import type { RotationResult, RotationItem, Quadrant } from '@/app/api/sector-rotation/route'
import SectorCanvas from '@/app/components/SectorCanvas'
import TimingBadge from '@/app/components/TimingBadge'

const BORDER = '#2a2f3a'
const pcol = (v: number | null) => v == null ? '#8a9aaa' : v > 0 ? '#34d399' : v < 0 ? '#f87171' : '#8a9aaa'
const pfmt = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`
const it2 = (emoji: string, label: string) => `${emoji}${label}`
const QC: Record<Quadrant, string> = { leading: '#22c55e', weakening: '#ef4444', lagging: '#94a3b8', improving: '#38bdf8' }
const QI: Record<Quadrant, string> = { leading: '🌱', weakening: '🔥', lagging: '🍂', improving: '❄️' }
const QN: Record<Quadrant, string> = { leading: '주도', weakening: '과열', lagging: '이탈', improving: '태동' }
// 풀 라벨(키별 고정) — 잘림 없이 전체 표기
const FULL: Record<string, string> = {
  energy: '에너지', materials: '소재', industrials: '산업재', discretionary: '자유소비재', staples: '필수소비재',
  healthcare: '헬스케어', financials: '금융', infotech: '정보기술', communication: '커뮤니케이션', utilities: '유틸리티', realestate: '리츠',
  quantum: '양자컴퓨팅', 'ai-semi': 'AI반도체', power: 'AI전력망', 'phys-ai': '피지컬AI', 'ai-bio': 'AI바이오', defense: '우주항공·방산',
}

export default function SectorRotation() {
  const [data, setData] = useState<RotationResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sector-rotation').then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j)))
      .then(j => {
        if (j.error) return setErr(j.error)
        setData(j)
        // 기본으로 자금 유입 1순위 섹터 드릴다운을 펼쳐 보여줌(학생이 클릭할 줄 몰라도 상세가 보이게)
        setSel(prev => prev ?? (j.inflow?.[0]?.key ?? j.items?.[0]?.key ?? null))
      })
      .catch(j => setErr(j?.error || '로테이션 데이터를 불러오지 못했습니다. 섹터 탭을 몇 개 방문하면 캐시가 채워집니다.'))
  }, [])

  if (err) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>🧭 섹터 자금 순환 계산 중… (17개 섹터 집계)</div>

  // ── 시계 좌표 (파워 스케일링으로 중앙 뭉침을 펼침) ──
  const cx = 260, cy = 252, halfW = 184, halfH = 214
  const maxRs = Math.max(1, ...data.items.map(i => Math.abs(i.rs)))
  const maxMom = Math.max(1, ...data.items.map(i => Math.abs(i.mom)))
  const spread = (v: number, max: number) => (v >= 0 ? 1 : -1) * Math.pow(Math.min(Math.abs(v) / max, 1), 0.5)
  const px = (rs: number) => cx + spread(rs, maxRs) * halfW * 0.9
  const py = (mom: number) => cy - spread(mom, maxMom) * halfH * 0.9

  // ── 라벨 필(pill) 배치 — 폭 추정 + 좌우 자동 플립 + 세로 2-pass 분산(겹침 원천 차단) ──
  const labelOf = (it: RotationItem) => `${it.emoji} ${FULL[it.key] ?? it.label.replace(/\s*\(.*\)/, '')}`
  const pillW = (s: string) => 14 + Array.from(s).reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 8.4 : /[ ·]/.test(ch) ? 3.4 : /[A-Za-z0-9]/.test(ch) ? 5.2 : 10), 0)
  const PH = 16, GAP = PH + 3                       // 필 높이·최소 세로 간격
  const minY = cy - halfH + 34, maxY = cy + halfH - 34   // 코너 사분면 칩 영역 회피
  const laid = data.items.map(it => {
    const x = px(it.rs), y = py(it.mom)
    const lbl = labelOf(it), w = pillW(lbl)
    // 바깥쪽 우선 배치 + 경계 넘치면 안쪽으로 플립
    let side: 'r' | 'l' = x > cx ? 'r' : 'l'
    if (side === 'l' && x - 12 - w < cx - halfW + 4) side = 'r'
    if (side === 'r' && x + 12 + w > cx + halfW - 4) side = 'l'
    const pxl = side === 'r' ? Math.min(x + 11, cx + halfW - 4 - w) : Math.max(x - 11 - w, cx - halfW + 4)
    return { it, x, y, ly: y, side, lbl, w, pxl }
  })
  for (const side of ['l', 'r'] as const) {
    const grp = laid.filter(d => d.side === side).sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < grp.length; i++) if (grp[i].ly < grp[i - 1].ly + GAP) grp[i].ly = grp[i - 1].ly + GAP   // ① 아래로 밀기
    for (let i = grp.length - 1; i >= 0; i--) {                                                                  // ② 위로 되밀기(양방향 분산)
      const bound = i === grp.length - 1 ? maxY : grp[i + 1].ly - GAP
      if (grp[i].ly > bound) grp[i].ly = bound
    }
    for (const d of grp) if (d.ly < minY) d.ly = minY
  }
  // ③ 전역 충돌 해소 — 좌·우 그룹이 달라도(플립) 필이 '가로로' 겹치면 세로로 밀기(우주방산↔AI반도체 겹침 케이스)
  const xOverlap = (a: typeof laid[0], b: typeof laid[0]) => a.pxl < b.pxl + b.w + 6 && b.pxl < a.pxl + a.w + 6
  for (let pass = 0; pass < 2; pass++) {
    const all = [...laid].sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < all.length; i++) for (let j = 0; j < i; j++)
      if (all[i].ly - all[j].ly < GAP && xOverlap(all[i], all[j])) all[i].ly = all[j].ly + GAP
    // 하단 초과분은 위로 되밀기(가로 겹침 체인만)
    const rev = [...laid].sort((a, b) => b.ly - a.ly)
    for (const d of rev) if (d.ly > maxY) d.ly = maxY
    for (let i = 1; i < rev.length; i++) for (let j = 0; j < i; j++)
      if (rev[j].ly - rev[i].ly < GAP && xOverlap(rev[i], rev[j])) rev[i].ly = rev[j].ly - GAP
    for (const d of laid) if (d.ly < minY) d.ly = minY
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#141824,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>🧭 섹터 로테이션 시계 — 지금 돈이 어디로 도나</div>
        <div style={{ fontSize: 12, color: '#8599ae', marginTop: 4, lineHeight: 1.5 }}>
          17개 섹터(GICS 11 + 테마 6)를 <b style={{ color: '#cbd5e1' }}>상대강도(가로)×모멘텀(세로)</b>로 배치. 자금은 🌱주도→🔥과열→🍂이탈→❄️태동을 <b style={{ color: '#cbd5e1' }}>시계방향</b>으로 순환.
          점 클릭 → 소섹터·대표종목 드릴다운. <b style={{ color: '#cbd5e1' }}>예측이 아니라 현재 위치.</b>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {/* 시계 */}
        <div style={{ flex: '1 1 480px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 8 }}>
          <svg viewBox="0 0 520 500" style={{ width: '100%' }}>
            <defs>
              {/* 사분면 코너 라디얼 틴트 — 각 국면 색이 코너에서 은은히 번짐 */}
              {([['gLead', QC.leading, 1, 0], ['gImp', QC.improving, 0, 0], ['gWeak', QC.weakening, 1, 1], ['gLag', QC.lagging, 0, 1]] as const).map(([id, col, fx, fy]) => (
                <radialGradient key={id} id={id} cx={fx} cy={fy} r={1.15}>
                  <stop offset="0%" stopColor={col} stopOpacity={0.22} />
                  <stop offset="55%" stopColor={col} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={col} stopOpacity={0.02} />
                </radialGradient>
              ))}
              <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* 사분면 배경(라운드 외곽 + 코너 틴트) */}
            <g>
              <rect x={cx} y={cy - halfH} width={halfW} height={halfH} fill="url(#gLead)" />
              <rect x={cx - halfW} y={cy - halfH} width={halfW} height={halfH} fill="url(#gImp)" />
              <rect x={cx} y={cy} width={halfW} height={halfH} fill="url(#gWeak)" />
              <rect x={cx - halfW} y={cy} width={halfW} height={halfH} fill="url(#gLag)" />
              <rect x={cx - halfW} y={cy - halfH} width={halfW * 2} height={halfH * 2} rx={14} fill="none" stroke="#2a3242" strokeWidth={1.2} />
            </g>
            {/* 축(중앙 십자 — 점선으로 존재감 낮춤). 축 제목·방향은 프레임 '밖'에 배치(필과 절대 안 겹침) */}
            <line x1={cx - halfW + 8} y1={cy} x2={cx + halfW - 8} y2={cy} stroke="#334155" strokeWidth={0.8} strokeDasharray="3 4" />
            <line x1={cx} y1={cy - halfH + 8} x2={cx} y2={cy + halfH - 8} stroke="#334155" strokeWidth={0.8} strokeDasharray="3 4" />
            {/* Y축(왼쪽 밖): 모멘텀 = 평균 대비 1주 수익률 — 위로 갈수록 가속 */}
            <text x={cx - halfW - 40} y={cy} fontSize={10} fill="#8599ae" fontWeight={700} textAnchor="middle" transform={`rotate(-90 ${cx - halfW - 40} ${cy})`}>모멘텀 (1주 페이스)</text>
            <text x={cx - halfW - 22} y={cy - halfH + 42} fontSize={10.5} fill="#4ade80" fontWeight={800} textAnchor="middle">▲ 가속</text>
            <text x={cx - halfW - 22} y={cy + halfH - 36} fontSize={10.5} fill="#94a3b8" fontWeight={800} textAnchor="middle">▼ 둔화</text>
            {/* X축(아래 밖): 상대강도 = 17섹터 평균 대비 1개월 수익률 — 오른쪽일수록 강함(돈 몰림) */}
            <text x={cx - halfW + 4} y={cy + halfH + 18} fontSize={10.5} fill="#94a3b8" fontWeight={800}>◀ 약함</text>
            <text x={cx} y={cy + halfH + 18} fontSize={10} fill="#8599ae" fontWeight={700} textAnchor="middle">상대강도 (17섹터 평균 대비 1개월 수익률)</text>
            <text x={cx + halfW - 4} y={cy + halfH + 18} fontSize={10.5} fill="#4ade80" fontWeight={800} textAnchor="end">강함 ▶</text>

            {/* 시계방향 순환 화살표(모서리 S커브) */}
            {(() => {
              const A = '#66748a', op = 0.5, m = 42, o = 13
              const R = cx + halfW - o, L = cx - halfW + o, T = cy - halfH + o, B = cy + halfH - o
              const arrow = (path: string, hx: number, hy: number, pts: string) => (
                <g opacity={op}>
                  <path d={path} fill="none" stroke={A} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="1 4" />
                  <path d={`M ${hx} ${hy} ${pts} z`} fill={A} />
                </g>
              )
              return (<>
                {arrow(`M ${cx - m} ${T} Q ${cx} ${T - 7} ${cx + m} ${T}`, cx + m, T, `l -6 -4 l 1 8`)}
                {arrow(`M ${R} ${cy - m} Q ${R + 7} ${cy} ${R} ${cy + m}`, R, cy + m, `l -4 -6 l 8 1`)}
                {arrow(`M ${cx + m} ${B} Q ${cx} ${B + 7} ${cx - m} ${B}`, cx - m, B, `l 6 -4 l -1 8`)}
                {arrow(`M ${L} ${cy + m} Q ${L - 7} ${cy} ${L} ${cy - m}`, L, cy - m, `l -4 6 l 8 -1`)}
              </>)
            })()}

            {/* 리더 라인(점→필) — 필 아래 레이어 */}
            {laid.map(({ it, x, y, ly, side, w, pxl }) => {
              const c = QC[it.quadrant]
              const edgeX = side === 'r' ? pxl : pxl + w
              return Math.abs(ly - y) > 3 || Math.abs(edgeX - x) > 14
                ? <path key={'ld' + it.key} d={`M ${x} ${y} L ${x} ${ly} L ${edgeX} ${ly}`} fill="none" stroke={c} strokeWidth={0.7} opacity={0.35} />
                : null
            })}

            {/* 섹터 점(글로우) */}
            {laid.map(({ it, x, y }) => {
              const c = QC[it.quadrant], on = sel === it.key
              return (
                <g key={'dot' + it.key} onClick={() => setSel(it.key)} style={{ cursor: 'pointer' }}>
                  {on && <circle cx={x} cy={y} r={11} fill={c} opacity={0.22} />}
                  <circle cx={x} cy={y} r={on ? 5.5 : 4.5} fill={c} stroke="#0d1017" strokeWidth={1.3} filter="url(#dotGlow)" />
                  {it.group === 'theme' && <circle cx={x} cy={y} r={on ? 9.5 : 8} fill="none" stroke={c} strokeWidth={0.9} strokeDasharray="2.5 2" opacity={0.7} />}
                </g>
              )
            })}

            {/* 라벨 필(pill) — 다크 캡슐 + 국면색 테두리(겹침 원천 차단) */}
            {laid.map(({ it, ly, lbl, w, pxl }) => {
              const c = QC[it.quadrant], on = sel === it.key
              return (
                <g key={'pill' + it.key} onClick={() => setSel(it.key)} style={{ cursor: 'pointer' }}>
                  <rect x={pxl} y={ly - PH / 2} width={w} height={PH} rx={PH / 2} fill={on ? c : '#0d1017'} fillOpacity={on ? 0.95 : 0.88} stroke={c} strokeWidth={on ? 1.4 : 0.9} strokeOpacity={on ? 1 : 0.6} />
                  <text x={pxl + w / 2} y={ly + 3.2} textAnchor="middle" fontSize={8.4} fontWeight={on ? 800 : 650} fill={on ? '#0d1017' : '#dbe3ee'}>{lbl}</text>
                </g>
              )
            })}

            {/* 코너 사분면 칩(맨 위 레이어 — 절대 가려지지 않음) */}
            {([['🌱 주도', QC.leading, cx + halfW - 10, cy - halfH + 10, 'end', 0], ['❄️ 태동', QC.improving, cx - halfW + 10, cy - halfH + 10, 'start', 0],
               ['🔥 과열', QC.weakening, cx + halfW - 10, cy + halfH - 10, 'end', 1], ['🍂 이탈', QC.lagging, cx - halfW + 10, cy + halfH - 10, 'start', 1]] as const).map(([t, c, tx, ty, anch, bot]) => {
              const w2 = 58, rx0 = anch === 'end' ? tx - w2 : tx
              const ry0 = bot ? ty - 18 : ty
              return (
                <g key={t}>
                  <rect x={rx0} y={ry0} width={w2} height={18} rx={9} fill="#0d1017" fillOpacity={0.9} stroke={c} strokeWidth={1} strokeOpacity={0.7} />
                  <text x={rx0 + w2 / 2} y={ry0 + 12.5} textAnchor="middle" fontSize={10} fontWeight={800} fill={c}>{t}</text>
                </g>
              )
            })}
          </svg>
          <div style={{ fontSize: 10, color: '#8a9aaa', padding: '0 8px 6px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>◌ 점선 링 = 테마 섹터</span><span><b style={{ color: '#a8b5c2' }}>오른쪽·위로 갈수록 좋음</b>(평균보다 많이 오르고 + 최근 가속)</span><span>점·라벨 클릭 → 드릴다운</span>
          </div>
        </div>

        {/* 자금 순환 랭킹 */}
        <div style={{ flex: '1 1 240px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>💰 자금 순환 랭킹</div>
          <Rank title="🔥 유입 Top (돈 몰림)" color="#22c55e" items={data.inflow} onSel={setSel} sel={sel} />
          <div style={{ height: 10 }} />
          <Rank title="❄️ 이탈 Top (돈 빠짐)" color="#94a3b8" items={data.outflow} onSel={setSel} sel={sel} />
          <div style={{ fontSize: 10, color: '#8a9aaa', marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 8, lineHeight: 1.5 }}>
            쏠림 점수 = 상대강도(1M) 0.6 + 모멘텀(1W) 0.4. 17섹터 평균 대비 %p. 가격 상대강도 기준(수급의 결과=가격). 옆 사분면 배지로 국면 확인 — ❄️태동은 아직 약하나 모멘텀이 돌기 시작(순점수 낮아도 이탈과 결이 다름).
          </div>
        </div>
      </div>

      {/* 🎯 소섹터 통합 실전 랭킹 — 매수 후보 vs 매도·익절 (드릴다운 카드와 동일 SSOT) */}
      {(data.buys?.length || data.sells?.length) ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {/* 매수 후보 */}
          <div style={{ flex: '1.2 1 340px', background: 'linear-gradient(135deg,#10241a,#0d1017)', border: '1px solid #22c55e44', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#4ade80' }}>🎯 실전 매수 후보 랭킹 — 돈 몰리며 실제로 오르는 소섹터</div>
            <div style={{ fontSize: 10, color: '#7f93a8', margin: '3px 0 10px' }}>매수 게이트(상대강세+주간상승+추세유지) 통과 소섹터만 · 오른쪽 <b style={{ color: '#a8b5c2' }}>+N점 = 쏠림 점수</b>(섹터 쏠림+소섹터 쏠림, 평균 대비 %p — 수익률 아님) · <b style={{ color: '#a8b5c2' }}>🚦 = 대표 ETF 타점</b>(EMA112·224+일목 구름 — 돈이 몰려도 진입 타이밍은 별도 확인) · <b style={{ color: '#a8b5c2' }}>줄 클릭 시 상세</b></div>
            {data.buys?.length ? data.buys.map((p, i) => (
              <div key={p.sectorKey + p.subKey} onClick={() => setSel(p.sectorKey)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: i === 0 ? '#14532d33' : 'transparent', border: i === 0 ? '1px solid #22c55e44' : '1px solid transparent', marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: i < 3 ? 14 : 10, width: 22, textAlign: 'center', color: '#8599ae', fontWeight: 700 }}>{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                  <span style={{ color: '#8599ae', fontWeight: 500 }}>{it2(p.sectorEmoji, FULL[p.sectorKey] ?? p.sectorLabel)} › </span>{p.subEmoji}{p.subLabel}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: QC[p.q], background: QC[p.q] + '22', borderRadius: 4, padding: '1px 5px' }}>{QI[p.q]}{QN[p.q]}</span>
                <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#8599ae' }}>1주 <b style={{ color: pcol(p.ret1w) }}>{pfmt(p.ret1w)}</b> · 1년 <b style={{ color: pcol(p.ret1y) }}>{pfmt(p.ret1y)}</b></span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                  {p.etfUs && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e55', borderRadius: 5, padding: '1px 7px', fontSize: 10 }}>🇺🇸 {p.etfUs}</b>}
                  {p.etfKr && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e55', borderRadius: 5, padding: '1px 7px', fontSize: 10 }}>🇰🇷 {p.etfKr}</b>}
                  {p.etfTiming && <TimingBadge t={p.etfTiming} compact />}
                  <b style={{ color: '#4ade80', fontSize: 11, fontFamily: 'monospace' }}>+{p.total}점</b>
                </span>
              </div>
            )) : <div style={{ fontSize: 11, color: '#8599ae', padding: '6px 8px' }}>⏳ 지금은 매수 게이트를 통과한 소섹터가 없습니다 — 반등 확인 후.</div>}
          </div>
          {/* 매도·익절 신호 */}
          <div style={{ flex: '1 1 300px', background: 'linear-gradient(135deg,#241710,#0d1017)', border: '1px solid #f59e0b44', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fbbf24' }}>⚠️ 매도·익절 신호 — 돈 빠지기 시작한 소섹터</div>
            <div style={{ fontSize: 10, color: '#7f93a8', margin: '3px 0 10px' }}>과열(강했으나 모멘텀 반전) 소섹터 · 이탈 심한 순 · 1년+ = 익절 / 1년− = 비중 축소</div>
            {data.sells?.length ? data.sells.map((p, i) => (
              <div key={p.sectorKey + p.subKey} onClick={() => setSel(p.sectorKey)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, width: 16, textAlign: 'center', color: '#8599ae', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                  <span style={{ color: '#8599ae', fontWeight: 500 }}>{it2(p.sectorEmoji, FULL[p.sectorKey] ?? p.sectorLabel)} › </span>{p.subEmoji}{p.subLabel}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: p.profit ? '#fbbf24' : '#f87171', background: (p.profit ? '#f59e0b' : '#ef4444') + '22', borderRadius: 4, padding: '1px 6px' }}>{p.profit ? '💰 분할 익절' : '✂️ 비중 축소'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: 'monospace', color: '#8599ae' }}>1주 <b style={{ color: pcol(p.ret1w) }}>{pfmt(p.ret1w)}</b> · 1년 <b style={{ color: pcol(p.ret1y) }}>{pfmt(p.ret1y)}</b>{p.etfUs || p.etfKr ? <span style={{ color: '#a78b6d' }}> · {[p.etfUs, p.etfKr].filter(Boolean).join('·')}</span> : null}</span>
              </div>
            )) : <div style={{ fontSize: 11, color: '#8599ae', padding: '6px 8px' }}>현재 매도 신호 소섹터 없음.</div>}
          </div>
        </div>
      ) : null}

      {/* 🔥 52주 신고가 × 소섹터 국면 — "최고가는 다 같은 최고가가 아니다" */}
      {data.highs?.length ? (
        <div style={{ background: 'linear-gradient(135deg,#1a1524,#0d1017)', border: '1px solid #a855f744', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c4b5fd' }}>🔥 오늘의 52주 신고가 × 소섹터 국면 — 최고가는 다 같은 최고가가 아니다</div>
          <div style={{ fontSize: 10, color: '#7f93a8', margin: '3px 0 10px' }}>
            같은 &lsquo;신고가&rsquo;라도 소섹터가 <b style={{ color: QC.leading }}>🌱주도</b>면 섹터 전체 강세(신뢰↑) · <b style={{ color: QC.improving }}>❄️태동</b>이면 약한 무리 속 대장(품질 프리미엄) · <b style={{ color: QC.weakening }}>🔥과열</b>이면 모멘텀 식는 중(추격 주의) · 주봉 기준 52주 최고가의 98%+ 종목
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.highs.map(h => (
              <div key={h.sectorKey + h.ticker} onClick={() => setSel(h.sectorKey)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: '#0f1117', border: `1px solid ${QC[h.q]}33`, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: QC[h.q], background: QC[h.q] + '22', borderRadius: 4, padding: '2px 6px', minWidth: 42, textAlign: 'center' }}>{QI[h.q]}{QN[h.q]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#f1f5f9' }}>{h.name}</span>
                <span style={{ fontSize: 10.5, color: '#8599ae' }}>{h.sectorEmoji}{FULL[h.sectorKey] ?? h.sectorLabel} › {h.subEmoji}{h.subLabel}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: 'monospace', color: '#8599ae' }}>1년 <b style={{ color: pcol(h.ret1y) }}>{pfmt(h.ret1y)}</b></span>
                <span style={{ fontSize: 10, fontWeight: 800, color: h.q === 'leading' ? '#4ade80' : h.q === 'weakening' ? '#fbbf24' : '#c4b5fd' }}>
                  {h.q === 'leading' ? '섹터 강세·신뢰' : h.q === 'improving' ? '약한 무리 속 대장' : h.q === 'weakening' ? '추격 주의' : '나홀로 반등'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#8a9aaa', marginTop: 8, lineHeight: 1.5 }}>👆 종목 줄을 클릭하면 해당 섹터 드릴다운이 열립니다 · 신고가 자체가 매수 신호는 아니며, 소섹터 국면으로 &lsquo;초입 vs 막차&rsquo;를 가늠하는 교육용 지표.</div>
        </div>
      ) : null}

      {/* 드릴다운 */}
      {sel ? (
        <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#8599ae', marginBottom: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>🔎 <b style={{ color: '#cbd5e1' }}>{FULL[sel] ?? sel} 드릴다운</b> — 소섹터 카드 + 미국·한국 대표종목</span>
            {data.inflow?.[0]?.key === sel && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#4ade80', background: '#14532d55', border: '1px solid #22c55e44', borderRadius: 5, padding: '1px 7px' }}>🔥 자금 유입 1위 — 기본 표시</span>}
            <span style={{ marginLeft: 'auto', color: '#8a9aaa' }}>👆 다른 섹터가 궁금하면 위 시계의 점이나 랭킹 줄을 클릭하세요</span>
          </div>
          <SectorCanvas sectorKey={sel} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: '#8599ae', textAlign: 'center', padding: '10px 0' }}>👆 시계의 섹터 점이나 랭킹을 클릭하면 소섹터·대표종목이 여기 펼쳐집니다.</div>
      )}

      <div style={{ fontSize: 10.5, color: '#8a9aaa', lineHeight: 1.6, padding: '0 4px' }}>
        ⚠️ 🌱주도(강+가속)·🔥과열(강했으나 둔화·차익경계)·🍂이탈(약+둔화)·❄️태동(약했으나 가속·역발상 매집징후) — 막스 시계추와 같은 철학(과열은 경계, 소외+반등은 기회). 예측 아닌 현재 위치. 섹터 수익률은 섹터 탭과 동일(제2원칙). 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}

function Rank({ title, color, items, onSel, sel }: { title: string; color: string; items: RotationItem[]; onSel: (k: string) => void; sel: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color, marginBottom: 5 }}>{title}</div>
      {items.length ? items.map((it, i) => (
        <div key={it.key} onClick={() => onSel(it.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: sel === it.key ? '#1b2230' : 'transparent', marginBottom: 2 }}>
          <span style={{ color: '#8a9aaa', fontSize: 10, width: 12 }}>{i + 1}</span>
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, flex: 1 }}>{it.emoji} {it.label.replace(/\s*\(.*\)/, '')}</span>
          <span style={{ fontSize: 9.5, color: QC[it.quadrant], fontWeight: 700, marginRight: 2 }}>{QI[it.quadrant]}{QN[it.quadrant]}</span>
          <span style={{ color, fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{it.score >= 0 ? '+' : ''}{it.score}</span>
        </div>
      )) : <div style={{ fontSize: 10.5, color: '#8a9aaa', padding: '4px 6px' }}>해당 없음</div>}
    </div>
  )
}
