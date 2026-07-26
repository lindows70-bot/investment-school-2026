'use client'
// 📄 주간 자산 리포트 — 클라우드 코워크 리포트(build_v4) 디자인·내용 이식판(앱 다크 테마).
//   헤드라인 배너 + KPI 8종 스파크라인 + ✦핵심요약 + 한국(수급)·미국·자산군 스코어보드·코인·부동산·이슈·전략·체크포인트 + 개인 섹션.
//   🖨️ PDF 저장=라이트 인쇄 문서(새 창 window.print). 상승 초록·하락 빨강(앱 규칙 통일). 서사는 Gemini(실측 숫자만 주입)·실패 시 결정론 폴백.
import { useEffect, useState } from 'react'
import type { WeeklyReportResult, WrHolding, WrIndex } from '@/app/api/weekly-report/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const pct = (v: number | null | undefined, d = 1) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`
const bp = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)}bp`
const pcol = (v: number | null | undefined) => v == null ? TK.sub : v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.slate300
const won = (n: number) => n >= 1e8 ? `${(n / 1e8).toFixed(2)}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`
const jo = (eok: number) => `${eok >= 0 ? '+' : ''}${(eok / 1e4).toFixed(2)}조`
const num = (n: number | null) => n == null ? '—' : n >= 1000 ? Math.round(n).toLocaleString() : String(n)

const SIG_META: Record<string, { label: string; c: string }> = {
  SELL: { label: '매도검토', c: TK.red400 }, BUY: { label: '매수기회', c: TK.green400 }, HOLD: { label: '보유', c: TK.slate400 },
}
const LIGHT_META: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' }
const RISK_META: Record<string, { label: string; c: string }> = {
  ok: { label: '적정', c: TK.green400 }, warn: { label: '주의', c: TK.amber500 }, bad: { label: '위험', c: TK.red400 }, unknown: { label: '미등록', c: TK.slate400 },
}
const VOL_ICON: Record<string, string> = { extreme: '🔴', high: '🟠', normal: '🟡', calm: '🟢' }
const TAG_COLOR: Record<string, string> = { 주식: TK.blue400, 원자재: '#eda100', 암호화폐: '#1baf7a', 부동산: '#c084fc', 수급: TK.amber500 }
const STRAT_ICON: Record<string, string> = { '현금·헤지': '🛡️', 주식: '📈', 암호화폐: '🪙', 부동산: '🏠', 매크로: '🌐' }

// ── 미니 SVG 유틸 ─────────────────────────────────────────────────────────────
function sparkPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return ''
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1
  return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (data.length - 1) * w).toFixed(1)},${(h - ((v - mn) / rg) * (h - 2) - 1).toFixed(1)}`).join(' ')
}
function Spark({ data, color, w = 84, h = 22 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null
  return <svg width={w} height={h} style={{ display: 'block' }}><path d={sparkPath(data, w, h)} fill="none" stroke={color} strokeWidth={1.4} /></svg>
}
// 상대추이(첫 값=100 재기준) 멀티라인
function RelChart({ series, h = 130 }: { series: { name: string; color: string; data: number[] }[]; h?: number }) {
  const W = 560
  const reb = series.filter(s => s.data.length >= 2).map(s => ({ ...s, r: s.data.map(v => v / s.data[0] * 100) }))
  if (!reb.length) return null
  const all = reb.flatMap(s => s.r)
  const mn = Math.min(...all), mx = Math.max(...all), rg = mx - mn || 1
  const y = (v: number) => h - 14 - ((v - mn) / rg) * (h - 26)
  // 끝점 라벨 겹침 방지 — 코인 4선처럼 종착값이 비슷하면 글자가 뭉쳐 판독이 안 된다.
  // 위에서부터 최소 간격(10px)을 강제해 세로로 흩는다(선 위치는 그대로).
  const labelY = new Map<string, number>()
  {
    const ends = reb.map(s => ({ name: s.name, y: y(s.r[s.r.length - 1]) })).sort((a, b) => a.y - b.y)
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 10) ends[i].y = ends[i - 1].y + 10
    const over = ends.length ? ends[ends.length - 1].y - (h - 3) : 0
    if (over > 0) for (const e of ends) e.y -= over   // 아래로 밀려 잘리면 통째로 위로
    for (const e of ends) labelY.set(e.name, e.y)
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={0} x2={W} y1={y(100)} y2={y(100)} stroke={TK.border} strokeDasharray="3 3" strokeWidth={1} />
        <text x={2} y={y(100) - 3} fill={TK.sub} fontSize={8}>100</text>
        {reb.map(s => (
          <g key={s.name}>
            <path d={s.r.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (s.r.length - 1) * (W - 44)).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.7} />
            <text x={W - 42} y={(labelY.get(s.name) ?? y(s.r[s.r.length - 1])) + 3} fill={s.color} fontSize={9} fontWeight={700}>{(s.r[s.r.length - 1] - 100) > 0 ? '+' : ''}{(s.r[s.r.length - 1] - 100).toFixed(1)}%</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 9.5, color: TK.sub2, marginTop: 2 }}>
        {reb.map(s => <span key={s.name}><span style={{ display: 'inline-block', width: 9, height: 3, background: s.color, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />{s.name}</span>)}
      </div>
    </div>
  )
}
// 상대추이 차트 기간 라벨 — 세 섹션이 같은 문구를 쓰도록 실제 데이터 길이에서 파생(하드코딩 '12거래일' 금지)
function relNote(len: number | undefined) {
  if (!len || len < 2) return undefined
  return <span style={{ fontSize: 9.5, color: TK.sub }}>최근 {len}거래일 상대추이(시작=100)</span>
}
function Sec({ no, title, right, children }: { no: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: TK.amber500, background: `${TK.amber500}18`, border: `1px solid ${TK.amber500}44`, borderRadius: 6, padding: '1px 7px' }}>{no}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: TK.slate200 }}>{title}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
    </div>
  )
}

// ── 🖨️ 인쇄용 라이트 문서(매거진형 미러) ─────────────────────────────────────
function relSvgStr(series: { name: string; color: string; data: number[] }[], h = 120): string {
  const W = 560
  const reb = series.filter(s => s.data.length >= 2).map(s => ({ ...s, r: s.data.map(v => v / s.data[0] * 100) }))
  if (!reb.length) return ''
  const all = reb.flatMap(s => s.r)
  const mn = Math.min(...all), mx = Math.max(...all), rg = mx - mn || 1
  const y = (v: number) => h - 14 - ((v - mn) / rg) * (h - 26)
  // 끝점 라벨 겹침 방지(화면 RelChart와 동일 규칙)
  const labelY = new Map<string, number>()
  const ends = reb.map(s => ({ name: s.name, y: y(s.r[s.r.length - 1]) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 10) ends[i].y = ends[i - 1].y + 10
  const over = ends.length ? ends[ends.length - 1].y - (h - 3) : 0
  if (over > 0) for (const e of ends) e.y -= over
  for (const e of ends) labelY.set(e.name, e.y)
  const lines = reb.map(s => `<path d="${s.r.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (s.r.length - 1) * (W - 44)).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="1.7"/>`
    + `<text x="${W - 42}" y="${((labelY.get(s.name) ?? y(s.r[s.r.length - 1])) + 3).toFixed(1)}" fill="${s.color}" font-size="9" font-weight="700">${(s.r[s.r.length - 1] - 100) > 0 ? '+' : ''}${(s.r[s.r.length - 1] - 100).toFixed(1)}%</text>`).join('')
  const legend = reb.map(s => `<span style="margin-right:12px"><span style="display:inline-block;width:9px;height:3px;background:${s.color};border-radius:2px;margin-right:4px;vertical-align:middle"></span>${s.name}</span>`).join('')
  const note = `<span style="color:#8a94a2">최근 ${reb[0].r.length}거래일 상대추이(시작=100)</span>`   // 화면 relNote와 동일 문구
  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:auto"><line x1="0" x2="${W}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}" stroke="#d8dde3" stroke-dasharray="3 3"/>${lines}</svg><div style="font-size:9px;color:#6b7684;display:flex;justify-content:space-between;gap:8px"><span>${legend}</span>${note}</div>`
}

function printReport(d: WeeklyReportResult) {
  const m = d.me, c = d.common, ai = c.ai
  const p = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  const pc = (v: number | null | undefined) => v == null ? '#666' : v > 0 ? '#0a8a3c' : v < 0 ? '#c02b2b' : '#333'
  const ix = (k: string) => c.indices.find(i => i.key === k)
  const dateStr = c.weekOf.replace(/-/g, '')
  const kpiKeys = ['kospi', 'kosdaq', 'sp500', 'nasdaq', 'btc', 'gold', 'wti', 'usdkrw']
  const kpi = kpiKeys.map(k => ix(k)).filter((x): x is WrIndex => !!x)
    .map(i => `<div class="kpi"><div class="kl">${i.flag} ${i.label}</div><b>${num(i.close)}</b><div style="color:${pc(i.weekPct)};font-weight:800">${p(i.weekPct)}</div></div>`).join('')
  const bullets = (ai?.bullets ?? []).map(b => `<li><b>${b.tag}</b> · ${b.text}</li>`).join('')
  const krRel = relSvgStr([{ name: '코스피', color: '#2a78d6', data: ix('kospi')?.spark ?? [] }, { name: '코스닥', color: '#eb6834', data: ix('kosdaq')?.spark ?? [] }])
  const usRel = relSvgStr([{ name: 'S&P 500', color: '#2a78d6', data: ix('sp500')?.spark ?? [] }, { name: '나스닥', color: '#1baf7a', data: ix('nasdaq')?.spark ?? [] }])
  const coRel = relSvgStr([{ name: 'BTC', color: '#eda100', data: ix('btc')?.spark ?? [] }, { name: 'ETH', color: '#2a78d6', data: ix('eth')?.spark ?? [] }, { name: 'SOL', color: '#1baf7a', data: ix('sol')?.spark ?? [] }, { name: 'XRP', color: '#8a5cd6', data: ix('xrp')?.spark ?? [] }])
  const kf = c.krFlow
  const krFlowTbl = kf ? `<table><tr><th></th><th class="n">최근일(${kf.lastDate.slice(5)})</th><th class="n">최근 5거래일</th></tr>
    <tr><td>외국인</td><td class="n" style="color:${pc(kf.day.foreign)}">${jo(kf.day.foreign)}</td><td class="n" style="color:${pc(kf.w5.foreign)}"><b>${jo(kf.w5.foreign)}</b></td></tr>
    <tr><td>기관</td><td class="n" style="color:${pc(kf.day.institution)}">${jo(kf.day.institution)}</td><td class="n" style="color:${pc(kf.w5.institution)}"><b>${jo(kf.w5.institution)}</b></td></tr>
    <tr><td>개인</td><td class="n" style="color:${pc(kf.day.personal)}">${jo(kf.day.personal)}</td><td class="n" style="color:${pc(kf.w5.personal)}"><b>${jo(kf.w5.personal)}</b></td></tr></table>` : ''
  const macroChips = ['us10y', 'nikkei', 'gold', 'silver', 'wti', 'usdkrw'].map(k => ix(k)).filter((x): x is WrIndex => !!x)
    .map(i => `<span class="chip">${i.label} <b>${num(i.close)}</b> <span style="color:${pc(i.weekPct)}">${i.isYield ? bp(i.weekPct) : p(i.weekPct)}</span></span>`).join('')
  // 변동성 칩·극단 배너 — 화면과 동일 정보를 PDF에도(⑩ 리스크 배너가 이 근거를 전제로 말한다)
  const volChips = c.vol.map(v => `<span class="chip">${VOL_ICON[v.verdict] ?? ''} ${v.flag} ${v.label} <b style="color:${v.verdict === 'extreme' ? '#c02b2b' : v.verdict === 'high' ? '#b7791f' : '#16202c'}">${v.vol20}%</b></span>`).join('')
  const exList = c.vol.filter(v => v.verdict === 'extreme')
  const exWarn = exList.length ? `<div class="warn">🌪️ <b>극단 변동 시장</b>: ${exList.map(v => `${v.flag} ${v.label}`).join(' · ')} — 손절이 갭에 뚫릴 수 있는 국면입니다. 비중 축소·분할 진입 원칙을 지키세요.</div>` : ''
  const sc1 = (keys: string[]) => keys.map(k => { const i = ix(k); return i ? `<div class="scr">${i.label.replace(/\s*\(.*\)/, '')} <span>${num(i.close)}</span> <span style="color:${pc(i.weekPct)}">${i.isYield ? bp(i.weekPct) : p(i.weekPct)}</span></div>` : '' }).join('')
  const scb = [
    ['주식', ['kospi', 'sp500', 'nasdaq']], ['원자재', ['gold', 'silver', 'wti']], ['암호화폐', ['btc', 'eth', 'sol']],
  ].map(([g, keys]) => `<td><b>${g}</b>${sc1(keys as string[])}</td>`).join('')
  const bondTd = `<td><b>채권·환율</b>${sc1(['us10y', 'usdkrw'])}</td>`
  const reTd = c.realestate ? `<td><b>부동산(주간)</b>${c.realestate.map(r => `<div class="scr">${r.name} 아파트 <span style="color:${pc(r.w1)}">${p(r.w1)}</span></div>`).join('')}</td>` : ''
  const coins = ['btc', 'eth', 'xrp', 'sol'].map(k => ix(k)).filter((x): x is WrIndex => !!x)
    .map(i => `<tr><td>${i.label}</td><td class="n">${num(i.close)}</td><td class="n" style="color:${pc(i.weekPct)}"><b>${p(i.weekPct)}</b></td></tr>`).join('')
  const cat = c.catalyst?.items?.map(i => `<li><b>${i.title}</b>${i.note ? ` — ${i.note}` : ''}</li>`).join('') ?? ''
  const strat = (ai?.strategy ?? []).map(s => `<div class="sg"><div class="st">${STRAT_ICON[s.title] ?? '▸'} ${s.title}</div><p>${s.text}</p></div>`).join('')
  const chk = (ai?.checkpoints ?? []).map(x => `<tr><td><b>${x.k}</b></td><td>${x.text}</td></tr>`).join('')
  const holRows = m.holdings.map(h => `<tr><td>${h.name}<span class="mut"> ${h.ticker}</span></td><td>${h.cls}</td><td class="n">${h.weight.toFixed(1)}%</td><td class="n" style="color:${pc(h.pnlPct)}">${p(h.pnlPct)}</td><td class="n" style="color:${pc(h.weekPct)}"><b>${p(h.weekPct)}</b></td><td class="n">${h.signal ? (SIG_META[h.signal]?.label ?? h.signal) : '—'}</td></tr>`).join('')
  const secRows = m.sectorImpact.map(s => `<tr><td>${s.sector}</td><td class="n">${s.weight.toFixed(1)}%</td><td class="n" style="color:${pc(s.weekPct)}">${p(s.weekPct)}</td><td class="n" style="color:${pc(s.contrib)}"><b>${s.contrib != null ? `${s.contrib > 0 ? '+' : ''}${s.contrib.toFixed(1)}%p` : '—'}</b></td></tr>`).join('')
  const riskRows = m.risks.map(r => `<tr><td>${r.label}</td><td class="n">${r.value != null ? `${r.value.toFixed(1)}${r.unit}` : '미등록'}</td><td><b>${RISK_META[r.level]?.label ?? r.level}</b></td><td class="mut">${r.note}</td></tr>`).join('')
  const calRows = (m.calendar ?? []).map(e => `<tr><td>D-${e.dDay}</td><td>${e.date}</td><td>${e.name}</td><td>${e.type === 'earnings' ? '실적 발표' : e.type === 'exDiv' ? '배당락' : '배당 지급'}</td></tr>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>2026투자학교_주간리포트_${m.name}_${dateStr}</title>
<style>
 @page{margin:11mm 12mm} body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#16202c;font-size:10.5px;line-height:1.5;margin:0}
 .mast{border-bottom:3px solid #12284C;padding-bottom:8px;margin-bottom:10px}
 .brand{font-size:10px;font-weight:800;color:#B8860B;letter-spacing:1.5px} h1{font-size:19px;color:#12284C;margin:1px 0}
 .who{display:inline-block;font-size:10.5px;font-weight:800;color:#12284C;background:#f6efdc;border:1px solid #d9c48a;border-radius:999px;padding:2px 12px;margin-top:4px}
 .hb{background:linear-gradient(120deg,#12284C,#1d3a63);color:#fff;border-radius:12px;padding:12px 16px;margin:9px 0}
 .hb h2{margin:0;font-size:17px;color:#fff;border:none;padding:0} .hb p{margin:4px 0 0;font-size:10.5px;color:#dbe4f0}
 h2{font-size:13px;color:#12284C;border-left:4px solid #B8860B;padding-left:8px;margin:15px 0 6px}
 table{border-collapse:collapse;width:100%;margin:3px 0} th,td{border-bottom:1px solid #e3e6ea;padding:3.5px 7px;text-align:left;vertical-align:top} th{background:#f2f4f7;font-size:9.5px;color:#5a6675}
 .n{text-align:right;font-variant-numeric:tabular-nums} .mut{color:#8a94a2;font-size:9px}
 .kpis{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin:7px 0} .kpi{border:1px solid #e3e6ea;border-radius:8px;padding:5px 7px} .kpi .kl{font-size:8.5px;color:#6b7684} .kpi b{font-size:11.5px}
 .chip{display:inline-block;border:1px solid #e3e6ea;border-radius:999px;padding:2px 9px;margin:2px 4px 2px 0;font-size:9.5px}
 ul{margin:3px 0 3px 16px;padding:0} li{margin:2px 0}
 .cols{display:grid;grid-template-columns:1fr 1fr;gap:10px} .sgw{display:grid;grid-template-columns:1fr 1fr;gap:7px}
 .sg{border:1px solid #e3e6ea;border-left:4px solid #B8860B;border-radius:9px;padding:7px 10px;break-inside:avoid} .sg .st{font-size:10.5px;font-weight:800;color:#12284C} .sg p{margin:2px 0 0;font-size:9.8px;color:#4c5866}
 .scb td{border:1px solid #e3e6ea;border-radius:8px;padding:7px 9px} .scr{font-size:9.8px;display:flex;justify-content:space-between;gap:6px}
 .warn{background:#fdf0ef;border:1px solid #ecc4c0;border-radius:9px;padding:7px 11px;margin:6px 0;font-size:10px}
 .kpi2{display:inline-block;border:1px solid #e3e6ea;border-radius:9px;padding:6px 12px;margin:3px 5px 3px 0} .kpi2 b{font-size:13px}
 .fn{color:#8a94a2;font-size:8.6px;margin-top:12px;border-top:1px solid #e3e6ea;padding-top:6px}
 .pb{page-break-before:always}
</style></head><body>
<div class="mast"><div class="brand">2026 투자학교 · WEEKLY ASSET REPORT</div><h1>자산 전반 주간 리포트 — 주식·코인·금·부동산</h1>
<div class="mut">${c.weekOf} · ${c.weekRange} · ${c.anchorNote} · 상승 <span style="color:#0a8a3c">초록</span>/하락 <span style="color:#c02b2b">빨강</span></div>
<div class="who">${m.name} 님 · 개인 맞춤본</div></div>
${ai ? `<div class="hb"><h2>${ai.headline}</h2><p>${ai.sub}</p></div>` : ''}
<div class="kpis">${kpi}</div>
${bullets ? `<h2>✦ 이번 주 핵심 요약</h2><ul>${bullets}</ul>` : ''}
<h2>① 한국 증시 — 코스피·코스닥</h2>
<div class="cols"><div>${krRel}</div><div>${krFlowTbl}<div class="mut">단위 조원 · 코스피 투자자별 순매수(네이버 집계)</div></div></div>
<h2>② 미국·글로벌 — 매크로 스냅샷</h2>
<div class="cols"><div>${usRel}</div><div>${macroChips}${c.macro ? `<div style="margin-top:5px;font-size:10px">${c.macro.icon} <b>${c.macro.label}</b> — ${c.macro.description}</div>` : ''}</div></div>
<div style="margin-top:6px">${volChips}</div>${exWarn}
<h2>✦ 자산군 스코어보드</h2>
<table class="scb"><tr>${scb}${reTd}${bondTd}</tr></table>
<div class="pb"></div>
<h2>③ 암호화폐</h2>
<div class="cols"><div>${coRel}</div><div><table><tr><th>코인</th><th class="n">가격</th><th class="n">주간</th></tr>${coins}</table></div></div>
${c.realestate ? `<h2>④ 부동산 — 부동산원 주간 아파트 매매지수</h2><div>${c.realestate.map(r => `<span class="kpi2">${r.name} <b style="color:${pc(r.w1)}">${p(r.w1)}</b> <span class="mut">4주 ${p(r.w4)}</span></span>`).join('')}</div>` : ''}
${cat ? `<h2>⑤ 이슈 분석</h2>${c.catalyst?.mood ? `<div class="mut">${c.catalyst.mood}</div>` : ''}<ul>${cat}</ul>` : ''}
${strat ? `<h2>⑥ 2026 투자학교 — 자산배분 실전 전략</h2><div class="sgw">${strat}</div>` : ''}
${chk ? `<h2>⑦ 다음 주 체크포인트</h2><table>${chk}</table>` : ''}
<div class="pb"></div>
<h2>⑧ 내 포트폴리오 — ${m.name} 님</h2>
<div><span class="kpi2">평가액 <b>${won(m.kpi.totalKrw)}</b></span><span class="kpi2">누적 손익 <b style="color:${pc(m.kpi.pnlPct)}">${p(m.kpi.pnlPct)}</b></span><span class="kpi2">이번 주 <b style="color:${pc(m.kpi.weekPct)}">${p(m.kpi.weekPct)}</b></span><span class="kpi2">종목 <b>${m.kpi.count}개</b></span></div>
<table><tr><th>종목</th><th>자산군</th><th class="n">비중</th><th class="n">누적</th><th class="n">주간</th><th class="n">신호</th></tr>${holRows}</table>
<h2>⑨ 이번 주 시장이 내 계좌에 미친 영향</h2>
<table><tr><th>섹터</th><th class="n">비중</th><th class="n">주간</th><th class="n">기여도</th></tr>${secRows}</table>
<h2>⑩ 리스크 점검(구조 진단)</h2>
<table><tr><th>지표</th><th class="n">값</th><th>판정</th><th>기준</th></tr>${riskRows}</table>
${calRows ? `<h2>⑪ 다음 2주 내 캘린더</h2><table><tr><th>D-day</th><th>날짜</th><th>종목</th><th>이벤트</th></tr>${calRows}</table>` : ''}
<p class="fn">※ 2026 투자학교 교육용 리포트 — 매수·매도 권유가 아닙니다. 주간 등락은 직전 금요일 종가 대비(전 지표 동일 함수). 달러 자산 누적 손익은 매입환율 미등록으로 현재 환율 근사, 현금(예수금·CMA)은 앱 미등록으로 리스크 점검 제외. 서사·전략은 실측 수치만으로 생성(${ai?.source === 'gemini' ? 'AI 요약' : '규칙 기반'})했으며 규칙 기반 자동 판정입니다. 생성 ${new Date(d.asOf).toLocaleString('ko-KR')} ⓒ 2026 투자학교</p>
</body></html>`
  const w = window.open('', '_blank', 'width=920,height=1100')
  if (!w) return
  w.document.write(html); w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 500)
}

export default function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string>('')

  const load = (userId?: string) => {
    setLoading(true); setErr(null)
    fetch(`/api/weekly-report${userId ? `?userId=${userId}` : ''}`, { cache: 'no-store' })
      .then(r => r.status === 401 ? Promise.reject(new Error('로그인이 필요합니다.')) : r.json())
      .then(j => { if (j.error) throw new Error(j.error); setData(j) })
      .catch(e => setErr(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading) return <div style={{ maxWidth: 1020, margin: '24px auto', padding: 24, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, color: TK.sub }}>📄 주간 리포트를 조립 중입니다… (첫 로드는 30초 안팎)</div>
  if (err || !data) return <div style={{ maxWidth: 1020, margin: '24px auto', padding: 24, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, color: TK.red400 }}>{err ?? '리포트를 불러오지 못했습니다.'}</div>

  const { common: c, me: m } = data
  const ai = c.ai
  const ix = (k: string) => c.indices.find(i => i.key === k)
  const extremes = c.vol.filter(v => v.verdict === 'extreme')
  const kpiKeys = ['kospi', 'kosdaq', 'sp500', 'nasdaq', 'btc', 'gold', 'wti', 'usdkrw']
  const kpis = kpiKeys.map(k => ix(k)).filter((x): x is WrIndex => !!x)
  const macroChips = ['us10y', 'nikkei', 'gold', 'silver', 'wti', 'usdkrw'].map(k => ix(k)).filter((x): x is WrIndex => !!x)
  const coins = ['btc', 'eth', 'xrp', 'sol'].map(k => ix(k)).filter((x): x is WrIndex => !!x)
  const kf = c.krFlow

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0 40px' }}>
      {/* 마스트헤드 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(184,134,11,0.13),rgba(18,40,76,0.35))', border: `1px solid ${TK.amber500}44`, borderRadius: 12, padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: TK.amber500, letterSpacing: 1.6 }}>2026 투자학교 · WEEKLY ASSET REPORT</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: TK.slate100, marginTop: 1 }}>자산 전반 주간 리포트 — 주식·코인·금·부동산</div>
            <div style={{ fontSize: 10, color: TK.sub, marginTop: 3 }}>{c.weekOf} · {c.weekRange} · {c.anchorNote}</div>
            <div style={{ display: 'inline-block', marginTop: 6, fontSize: 10.5, fontWeight: 800, color: TK.amber400, background: `${TK.amber500}15`, border: `1px solid ${TK.amber500}55`, borderRadius: 999, padding: '2px 12px' }}>
              {m.name} 님 · 개인 맞춤본{data.isTeacherView && ' · 교사 대리 조회'}
            </div>
          </div>
          {data.students && (
            <select value={sel} onChange={e => { setSel(e.target.value); load(e.target.value || undefined) }}
              style={{ background: TK.bg3, color: TK.slate200, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 9px', fontSize: 11.5 }}>
              <option value="">내 리포트</option>
              {data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={() => printReport(data)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: TK.amber500, color: '#1c1917', fontSize: 11.5, fontWeight: 900 }}>🖨️ PDF 저장</button>
        </div>
      </div>

      {/* 헤드라인 배너 */}
      {ai && (
        <div style={{ background: 'linear-gradient(120deg,#12284C,#1d3a63)', borderRadius: 12, border: `1px solid ${TK.blue400}44`, padding: '14px 18px' }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#fff' }}>{ai.headline}</div>
          <div style={{ fontSize: 11.5, color: '#dbe4f0', marginTop: 5, lineHeight: 1.65 }}>{ai.sub}</div>
          {ai.source === 'fallback' && <div style={{ fontSize: 9, color: '#8ea4c4', marginTop: 4 }}>※ 규칙 기반 자동 요약(AI 미사용)</div>}
        </div>
      )}

      {/* KPI 8종 + 스파크라인 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 7 }}>
        {kpis.map(i => (
          <div key={i.key} style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '8px 10px' }}>
            <div style={{ fontSize: 9.5, color: TK.sub2 }}>{i.flag} {i.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: TK.slate200, fontFamily: 'monospace' }}>{num(i.close)}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: pcol(i.weekPct), fontFamily: 'monospace' }}>{pct(i.weekPct)}</div>
            <div style={{ marginTop: 3 }}><Spark data={i.spark} color={pcol(i.weekPct)} /></div>
          </div>
        ))}
      </div>

      {/* ✦ 핵심 요약 */}
      {ai && ai.bullets.length > 0 && (
        <Sec no="✦" title="이번 주 핵심 요약">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ai.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: TK.slate300, lineHeight: 1.6 }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: TAG_COLOR[b.tag] ?? TK.sub2, background: `${TAG_COLOR[b.tag] ?? TK.sub2}18`, border: `1px solid ${TAG_COLOR[b.tag] ?? TK.sub2}44`, borderRadius: 5, padding: '1px 7px', marginTop: 1 }}>{b.tag}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* ① 한국 증시 + 수급 */}
      <Sec no="①" title="한국 증시 — 코스피·코스닥" right={relNote(ix('kospi')?.spark?.length)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,3fr) minmax(220px,2fr)', gap: 14 }}>
          <RelChart series={[{ name: '코스피', color: TK.blue400, data: ix('kospi')?.spark ?? [] }, { name: '코스닥', color: '#eb6834', data: ix('kosdaq')?.spark ?? [] }]} />
          <div>
            {kf ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ color: TK.sub, fontSize: 9.5 }}><th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>코스피 수급</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>최근일({kf.lastDate.slice(5)})</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>5거래일</th></tr></thead>
                <tbody>
                  {([['외국인', kf.day.foreign, kf.w5.foreign], ['기관', kf.day.institution, kf.w5.institution], ['개인', kf.day.personal, kf.w5.personal]] as const).map(([l, d1, w5]) => (
                    <tr key={l as string} style={{ borderBottom: `1px solid ${TK.bg3}` }}>
                      <td style={{ padding: '5px 6px', color: TK.slate300 }}>{l}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: pcol(d1 as number), fontFamily: 'monospace' }}>{jo(d1 as number)}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: pcol(w5 as number), fontFamily: 'monospace', fontWeight: 800 }}>{jo(w5 as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div style={{ fontSize: 10.5, color: TK.sub2 }}>수급 데이터 미집계(장 마감 후 갱신)</div>}
            <div style={{ fontSize: 9, color: TK.sub8, marginTop: 4 }}>단위 조원 · 코스피 투자자별 순매수(수급 레이더 SSOT)</div>
          </div>
        </div>
      </Sec>

      {/* ② 미국·글로벌 + 매크로 스냅샷 */}
      <Sec no="②" title="미국·글로벌 — 매크로 스냅샷" right={relNote(ix('sp500')?.spark?.length)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,3fr) minmax(220px,2fr)', gap: 14 }}>
          <RelChart series={[{ name: 'S&P 500', color: TK.blue400, data: ix('sp500')?.spark ?? [] }, { name: '나스닥', color: '#1baf7a', data: ix('nasdaq')?.spark ?? [] }]} />
          <div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {macroChips.map(i => (
                <span key={i.key} style={{ fontSize: 10, color: TK.slate300, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '3px 10px' }}>
                  {i.label} <b style={{ fontFamily: 'monospace' }}>{num(i.close)}</b> <span style={{ color: pcol(i.weekPct), fontFamily: 'monospace' }}>{i.isYield ? bp(i.weekPct) : pct(i.weekPct)}</span>
                </span>
              ))}
            </div>
            {c.macro && <div style={{ fontSize: 11, color: TK.slate300, lineHeight: 1.6, marginTop: 8 }}>{c.macro.icon} <b style={{ color: TK.slate200 }}>{c.macro.label}</b> — {c.macro.description}<div style={{ fontSize: 9.5, color: TK.sub, marginTop: 2 }}>기준금리 {c.macro.fedRate}% · CPI {c.macro.cpiYoY}% · 다음 FOMC {c.macro.nextFomc ?? '—'}</div></div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
          {c.vol.map(v => (
            <span key={v.label} title={`20일 변동성 ${v.vol20}% · 자국 5년 백분위 ${v.pctile}% · ±3% ${v.big3}일`}
              style={{ fontSize: 9.5, fontWeight: 700, color: v.verdict === 'extreme' ? TK.red400 : v.verdict === 'high' ? TK.amber500 : TK.sub2, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '2px 8px' }}>
              {VOL_ICON[v.verdict] ?? ''} {v.flag} {v.label} {v.vol20}%
            </span>
          ))}
        </div>
        {extremes.length > 0 && (
          <div style={{ marginTop: 8, background: '#2a1010', border: `1px solid ${TK.red400}55`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>
            🌪️ <b>극단 변동 시장</b>: {extremes.map(v => `${v.flag} ${v.label}`).join(' · ')} — 손절이 갭에 뚫릴 수 있는 국면입니다. 비중 축소·분할 진입 원칙을 지키세요.
          </div>
        )}
      </Sec>

      {/* ✦ 자산군 스코어보드 */}
      <Sec no="✦" title="자산군 스코어보드 — 주간 한눈에">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7 }}>
          {([['📈 주식', ['kospi', 'sp500', 'nasdaq']], ['🥇 원자재', ['gold', 'silver', 'wti']], ['🪙 암호화폐', ['btc', 'eth', 'sol']]] as const).map(([g, keys]) => (
            <div key={g} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 11px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: TK.slate200, marginBottom: 5 }}>{g}</div>
              {keys.map(k => { const i = ix(k); return i ? (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: TK.sub2, padding: '1.5px 0' }}>
                  <span>{i.label.replace(/\s*\(.*\)/, '')}</span><span style={{ fontFamily: 'monospace', color: TK.slate300 }}>{num(i.close)}</span><span style={{ fontFamily: 'monospace', color: pcol(i.weekPct), fontWeight: 700 }}>{pct(i.weekPct)}</span>
                </div>) : null })}
            </div>
          ))}
          {c.realestate && (
            <div style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 11px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: TK.slate200, marginBottom: 5 }}>🏠 부동산(주간)</div>
              {c.realestate.map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: TK.sub2, padding: '1.5px 0' }}>
                  <span>{r.name} 아파트</span><span style={{ fontFamily: 'monospace', color: pcol(r.w1), fontWeight: 700 }}>{pct(r.w1, 2)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 11px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: TK.slate200, marginBottom: 5 }}>📜 채권·환율</div>
            {(['us10y', 'usdkrw'] as const).map(k => { const i = ix(k); return i ? (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: TK.sub2, padding: '1.5px 0' }}>
                <span>{i.label.replace(/\s*\(.*\)/, '')}</span><span style={{ fontFamily: 'monospace', color: TK.slate300 }}>{num(i.close)}</span><span style={{ fontFamily: 'monospace', color: pcol(i.weekPct), fontWeight: 700 }}>{i.isYield ? bp(i.weekPct) : pct(i.weekPct)}</span>
              </div>) : null })}
          </div>
        </div>
      </Sec>

      {/* ③ 암호화폐 */}
      <Sec no="③" title="암호화폐 — BTC·ETH·XRP·SOL" right={relNote(ix('btc')?.spark?.length)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,3fr) minmax(200px,2fr)', gap: 14 }}>
          <RelChart series={[
            { name: 'BTC', color: '#eda100', data: ix('btc')?.spark ?? [] },
            { name: 'ETH', color: TK.blue400, data: ix('eth')?.spark ?? [] },
            { name: 'SOL', color: '#1baf7a', data: ix('sol')?.spark ?? [] },
            { name: 'XRP', color: TK.violet400, data: ix('xrp')?.spark ?? [] },
          ]} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, alignSelf: 'start' }}>
            <thead><tr style={{ color: TK.sub, fontSize: 9.5 }}><th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>코인</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>가격($)</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>주간</th></tr></thead>
            <tbody>
              {coins.map(i => (
                <tr key={i.key} style={{ borderBottom: `1px solid ${TK.bg3}` }}>
                  <td style={{ padding: '5px 6px', color: TK.slate300 }}>{i.label.replace(/\(\$\)/, '')}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: TK.slate300 }}>{num(i.close)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: pcol(i.weekPct) }}>{pct(i.weekPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      {/* ④ 부동산 */}
      {c.realestate && (
        <Sec no="④" title="부동산 — 부동산원 주간 아파트 매매지수">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {c.realestate.map(r => (
              <div key={r.name} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 14px' }}>
                <div style={{ fontSize: 10, color: TK.sub2 }}>{r.name} 아파트</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: pcol(r.w1), fontFamily: 'monospace' }}>{pct(r.w1, 2)}</div>
                <div style={{ fontSize: 9.5, color: TK.sub }}>4주 {pct(r.w4, 2)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9.5, color: TK.sub8, marginTop: 6 }}>부동산원 주간 매매가격지수(부동산 주간 펄스 SSOT). 자세한 지역별 랭킹은 부동산 → 벌집순환모형에서.</div>
        </Sec>
      )}

      {/* ⑤ 이슈 */}
      {c.catalyst && c.catalyst.items.length > 0 && (
        <Sec no="⑤" title="이슈 분석">
          {c.catalyst.mood && <div style={{ fontSize: 10.5, color: TK.sub2, marginBottom: 6 }}>{c.catalyst.mood}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.catalyst.items.map((it, i) => (
              <div key={i} style={{ background: TK.bg3, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '7px 11px', fontSize: 11, color: TK.slate300, lineHeight: 1.55 }}>
                <b style={{ color: TK.slate200 }}>{it.title}</b>{it.note && <span style={{ color: TK.sub2 }}> — {it.note}</span>}
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* ⑥ 자산배분 실전 전략 */}
      {ai && ai.strategy.length > 0 && (
        <Sec no="⑥" title="2026 투자학교 — 자산배분 실전 전략" right={<span style={{ fontSize: 9, color: TK.sub }}>{ai.source === 'gemini' ? 'AI 요약(실측 수치만 주입)' : '규칙 기반'}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 7 }}>
            {ai.strategy.map((s, i) => (
              <div key={i} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TK.amber500}`, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: TK.slate200 }}>{STRAT_ICON[s.title] ?? '▸'} {s.title}</div>
                <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.55, marginTop: 3 }}>{s.text}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9.5, color: TK.sub8, marginTop: 7 }}>※ 매수·매도 지시가 아닌 교육용 점검 프레임입니다. 실행 판단·책임은 본인에게 있습니다.</div>
        </Sec>
      )}

      {/* ⑦ 다음 주 체크포인트 */}
      {ai && ai.checkpoints.length > 0 && (
        <Sec no="⑦" title="다음 주 체크포인트">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ai.checkpoints.map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, background: TK.bg3, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '6px 11px', fontSize: 11 }}>
                <span style={{ flexShrink: 0, minWidth: 78, fontWeight: 800, color: TK.amber400 }}>{x.k}</span>
                <span style={{ color: TK.slate300, lineHeight: 1.5 }}>{x.text}</span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* ⑧ 내 포트폴리오 */}
      <Sec no="⑧" title={`내 포트폴리오 — ${m.name} 님`}>
        {!m.hasPortfolio ? (
          <div style={{ fontSize: 12, color: TK.sub2, padding: '14px 4px', lineHeight: 1.7 }}>
            아직 등록된 포트폴리오가 없습니다. <b style={{ color: TK.slate300 }}>자산 관리</b>에서 보유 종목을 등록하면 다음 리포트부터 개인 분석(종목 진단·섹터 기여·리스크 점검)이 시작됩니다.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
              {[
                { l: '평가액', v: won(m.kpi.totalKrw), c: TK.slate200 },
                { l: '누적 손익', v: pct(m.kpi.pnlPct), c: pcol(m.kpi.pnlPct) },
                { l: '이번 주', v: pct(m.kpi.weekPct), c: pcol(m.kpi.weekPct) },
                { l: '종목', v: `${m.kpi.count}개`, c: TK.slate200 },
              ].map(k => (
                <div key={k.l} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, padding: '7px 13px' }}>
                  <div style={{ fontSize: 9.5, color: TK.sub }}>{k.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: k.c, fontFamily: 'monospace' }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
              {m.byClass.map((b, i) => (
                <div key={b.cls} title={`${b.cls} ${b.weight.toFixed(1)}%`} style={{ width: `${b.weight}%`, background: [TK.blue400, '#eb6834', '#1baf7a', '#eda100', TK.slate400][i % 5] }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9.5, color: TK.sub2, marginBottom: 10 }}>
              {m.byClass.map((b, i) => <span key={b.cls}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: [TK.blue400, '#eb6834', '#1baf7a', '#eda100', TK.slate400][i % 5], marginRight: 4 }} />{b.cls} {b.weight.toFixed(1)}%</span>)}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ color: TK.sub, fontSize: 10 }}>
                  {['종목', '자산군', '비중', '누적', '주간', '기여', '신호', '타점'].map(h => <th key={h} style={{ textAlign: h === '종목' || h === '자산군' ? 'left' : 'right', padding: '4px 7px', borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {m.holdings.map((h: WrHolding) => (
                    <tr key={`${h.market}-${h.ticker}`} style={{ borderBottom: `1px solid ${TK.bg3}` }}>
                      <td style={{ padding: '5px 7px', color: TK.slate200, fontWeight: 700 }}>{h.name} <span style={{ color: TK.sub, fontSize: 9, fontWeight: 400 }}>{h.ticker}</span></td>
                      <td style={{ padding: '5px 7px', color: TK.sub2, fontSize: 10 }}>{h.cls}</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right', color: TK.slate300, fontFamily: 'monospace' }}>{h.weight.toFixed(1)}%</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right', color: pcol(h.pnlPct), fontFamily: 'monospace' }}>{pct(h.pnlPct)}</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right', color: pcol(h.weekPct), fontFamily: 'monospace', fontWeight: 700 }}>{pct(h.weekPct)}</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right', color: pcol(h.weekContrib), fontFamily: 'monospace', fontSize: 10 }}>{h.weekContrib != null ? `${h.weekContrib > 0 ? '+' : ''}${h.weekContrib.toFixed(1)}%p` : '—'}</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right' }}>{h.signal ? <span title={h.signalTitle ?? ''} style={{ fontSize: 9.5, fontWeight: 800, color: SIG_META[h.signal]?.c ?? TK.sub }}>{SIG_META[h.signal]?.label ?? h.signal}</span> : <span style={{ color: TK.sub, fontSize: 9.5 }}>—</span>}</td>
                      <td style={{ padding: '5px 7px', textAlign: 'right', fontSize: 11 }}>{h.timing ? LIGHT_META[h.timing] : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 9.5, color: TK.sub8, marginTop: 6, lineHeight: 1.5 }}>
              ※ 가격 실측 {m.kpi.liveCoverage}% · 달러 자산 누적 손익은 매입환율 미등록으로 현재 환율 근사 · 신호=Jarvis 규칙 판정 · 타점=신호등(🟢적기/🟡대기/🔴유예)
            </div>
          </>
        )}
      </Sec>

      {m.hasPortfolio && (
        <>
          {/* ⑨ 섹터 기여 */}
          <Sec no="⑨" title="이번 주 시장이 내 계좌에 미친 영향 — 섹터 기여">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {m.sectorImpact.map(s => (
                <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 9, background: TK.bg3, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '6px 11px', fontSize: 11 }}>
                  <span style={{ minWidth: 130, color: TK.slate200, fontWeight: 700 }}>{s.sector}</span>
                  <span style={{ color: TK.sub2, fontFamily: 'monospace', fontSize: 10 }}>비중 {s.weight.toFixed(1)}%</span>
                  <span style={{ color: pcol(s.weekPct), fontFamily: 'monospace', fontSize: 10 }}>주간 {pct(s.weekPct)}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 900, color: pcol(s.contrib), fontFamily: 'monospace' }}>{s.contrib != null ? `${s.contrib > 0 ? '+' : ''}${s.contrib.toFixed(1)}%p` : '미집계'}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: TK.sub8, marginTop: 6 }}>기여도 = 비중 × 주간 등락. 위 ①·② 시장 등락이 내 계좌의 어느 섹터를 통해 얼마나 들어왔는지 보여줍니다.</div>
          </Sec>

          {/* ⑩ 리스크 점검 */}
          <Sec no="⑩" title="리스크 점검 — 포트폴리오 구조 진단">
            {m.krExtreme && (
              <div style={{ marginBottom: 8, background: '#2a1010', border: `1px solid ${TK.red400}55`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>
                🌪️ <b>코스피 극단 변동 국면 + 한국 종목 보유</b> — 이번 주 신규 진입은 계산 수량의 절반 이하·분할을 권장합니다.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 7 }}>
              {m.risks.map(r => {
                const rm = RISK_META[r.level]
                return (
                  <div key={r.key} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${r.level === 'bad' ? `${TK.red400}55` : BORDER}`, padding: '8px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: TK.slate200 }}>{r.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 800, color: rm.c }}>{rm.label}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: rm.c, fontFamily: 'monospace' }}>{r.value != null ? `${r.value.toFixed(1)}${r.unit}` : '—'}</div>
                    <div style={{ fontSize: 9, color: TK.sub, lineHeight: 1.4 }}>{r.note}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 9.5, color: TK.sub8, marginTop: 6 }}>※ 규칙 기반 자동 진단 — 매매 권유가 아니라 비중·분산·구조를 스스로 점검하는 교육용 지표입니다.</div>
          </Sec>

          {/* ⑪ 캘린더 */}
          <Sec no="⑪" title="다음 2주 내 캘린더 — 어닝·배당">
            {m.calendar && m.calendar.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {m.calendar.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, background: TK.bg3, borderRadius: 8, border: `1px solid ${e.dDay <= 3 ? `${TK.amber500}55` : BORDER}`, padding: '6px 11px', fontSize: 11 }}>
                    <span style={{ fontWeight: 900, color: e.dDay <= 3 ? TK.amber500 : TK.slate300, fontFamily: 'monospace', minWidth: 40 }}>D-{e.dDay}</span>
                    <span style={{ color: TK.sub2, fontSize: 10, minWidth: 76 }}>{e.date}</span>
                    <span style={{ color: TK.slate200, fontWeight: 700 }}>{e.name}</span>
                    <span style={{ marginLeft: 'auto', color: TK.sub2, fontSize: 10 }}>{e.type === 'earnings' ? '📊 실적 발표' : e.type === 'exDiv' ? '📅 배당락' : '💵 배당 지급'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: TK.sub2 }}>{m.calendarNote ?? '다음 2주 내 예정된 이벤트가 없습니다.'}</div>
            )}
          </Sec>
        </>
      )}

      <div style={{ fontSize: 10, color: TK.sub8, lineHeight: 1.6 }}>
        ※ 교육용 시뮬레이션이며 투자 추천이 아닙니다. 주간 기준은 직전 금요일 종가(휴장 시 그 이전 거래일)로 전 지표 동일 적용. 헤드라인·요약·전략은 실측 수치만 주입해 생성({ai?.source === 'gemini' ? 'AI 요약' : '규칙 기반'})합니다. 현금(예수금·CMA)은 앱 미등록으로 리스크 점검에서 제외되고, 달러 자산 환차손익은 매입환율 미보유로 현재 환율 근사입니다 — 잰 척하지 않습니다.
      </div>
    </div>
  )
}
