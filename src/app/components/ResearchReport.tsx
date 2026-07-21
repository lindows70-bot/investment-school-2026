'use client'
// 📄 종목 리서치 리포트 — 앱 SSOT 총동원 풀 리포트(섹터·경쟁사·밸류·1년주가·어닝·전망·액션) + PDF 다운로드
import { useEffect, useState } from 'react'
import { TK } from '@/lib/theme'
import type { ResearchReport as Report } from '@/app/api/research-report/route'

const CARD = TK.bg4, BORDER = TK.line3
const VCOLOR = { buy: TK.green500, caution: TK.amber500, avoid: TK.red400 } as const
const VKO = { buy: '✅ 매수 적합', caution: '⚖️ 신중(조건부)', avoid: '⛔ 부적합' } as const
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmtMcap = (v: number | null) => { if (v == null) return '—'; const usd = v < 1e6 ? v * 1e9 : v; return usd >= 1e12 ? `$${(usd / 1e12).toFixed(2)}T` : usd >= 1e9 ? `$${Math.round(usd / 1e9)}B` : `$${Math.round(usd / 1e6)}M` }
const ymd = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` }

// 종가 배열 → SVG 라인 path(0~W,0~H). 상승=초록/하락=빨강
function linePath(closes: number[], w: number, h: number, pad = 2) {
  if (closes.length < 2) return { d: '', area: '', up: true }
  const min = Math.min(...closes), max = Math.max(...closes), range = max - min || 1
  const x = (i: number) => pad + i / (closes.length - 1) * (w - pad * 2)
  const y = (c: number) => pad + (1 - (c - min) / range) * (h - pad * 2)
  const d = closes.map((c, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(c).toFixed(1)}`).join(' ')
  const area = `${d} L ${x(closes.length - 1).toFixed(1)} ${h} L ${x(0).toFixed(1)} ${h} Z`
  return { d, area, up: closes[closes.length - 1] >= closes[0] }
}

// 새 창에 인쇄용 문서 → window.print()(브라우저 'PDF로 저장'). 파일명=티커_리서치리포트_날짜(document.title)
function printReport(r: Report) {
  const dt = new Date(r.generatedAt).toLocaleString('ko-KR')
  const vColor = r.action.verdict === 'buy' ? '#16a34a' : r.action.verdict === 'caution' ? '#d97706' : '#dc2626'
  const li = (arr: string[], c: string) => arr.length ? `<ul style="margin:3px 0 0;padding-left:16px">${arr.map(x => `<li style="color:${c};margin:1px 0">${esc(x)}</li>`).join('')}</ul>` : '<span style="color:#888">—</span>'
  const closes = r.chart.points.map(p => p.c).filter(c => c > 0)
  const lp = linePath(closes, 640, 130)
  const chartSvg = closes.length >= 2 ? `<svg viewBox="0 0 640 130" style="width:100%;height:auto;border:1px solid #e5e5ea;border-radius:6px;background:#fafafa">
    <path d="${lp.area}" fill="${lp.up ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)'}"/><path d="${lp.d}" fill="none" stroke="${lp.up ? '#16a34a' : '#dc2626'}" stroke-width="1.6"/></svg>` : '<div style="color:#888">주가 데이터 부족</div>'
  const peerRows = r.peers.map(p => `<tr style="${p.isTarget ? 'background:#eef2ff;font-weight:700' : ''}">
    <td style="padding:3px 6px;border-bottom:1px solid #eee">${p.isTarget ? '⭐ ' : ''}${esc(p.name)}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right">${p.peg ?? '—'}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right">${p.opMargin != null ? p.opMargin + '%' : '—'}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right">${p.psr ?? '—'}</td>
    <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right">${fmtMcap(p.mcapUsd)}</td></tr>`).join('')
  const earnBlock = r.earnings.status === 'ok'
    ? `<p><b>🌱 성장 스토리</b><br>${esc(r.earnings.growthStory)}</p><p><b>🎙 경영진 태도</b><br>${esc(r.earnings.managementTone)}</p><p><b>🧭 다음 가이던스</b><br>${esc(r.earnings.guidance)}</p><p><b>낙관도</b> ${r.earnings.sentiment}/100 · <b>추정 리비전</b> ${esc(r.earnings.revision)}</p>`
    : `<p style="color:#888">최근 실적 AI 분석 데이터 없음(무료 티어 한도/뉴스 부족). · 추정 리비전: ${esc(r.earnings.revision)}</p>`
  const val = r.valuation
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(r.ticker)}_리서치리포트_${ymd(r.generatedAt)}</title>
    <style>@page{margin:16mm}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1a1a1a;line-height:1.55;max-width:820px;margin:0 auto;font-size:12.5px}
    h1{font-size:21px;margin:0 0 2px}h2{font-size:14px;border-left:4px solid #4f46e5;padding-left:8px;margin:18px 0 6px;page-break-after:avoid}
    .sub{color:#666;font-size:11px}.badge{display:inline-block;padding:2px 9px;border-radius:6px;color:#fff;font-weight:700;font-size:12px;background:${vColor}}
    .box{background:#f7f7f9;border:1px solid #e5e5ea;border-radius:8px;padding:9px 13px;margin:7px 0}
    table{border-collapse:collapse;width:100%;font-size:11.5px;margin-top:4px}th{text-align:right;padding:3px 6px;border-bottom:2px solid #ddd;color:#555}th:first-child{text-align:left}
    .kpi{display:inline-block;margin:2px 12px 2px 0}.kpi b{color:#111}.foot{margin-top:22px;border-top:1px solid #ddd;padding-top:7px;color:#888;font-size:9.5px}p{margin:5px 0}
    h2{break-after:avoid}</style></head><body>
      <h1>${esc(r.name)} <span style="font-size:14px;color:#666">${esc(r.ticker)} · ${r.market}</span></h1>
      <div class="sub">📄 종목 리서치 리포트 · ${r.sectorKo} 섹터 · 생성 ${dt}</div>
      <div class="box"><b>총평</b> &nbsp;<span class="badge">${VKO[r.action.verdict]} ${r.action.score}점</span><br>${esc(r.summary)}</div>
      <h2>① 섹터 & 경쟁사 대시보드</h2>
      <p>로테이션 <b>${esc(r.sectorSec.phaseLabel)}</b> · 계절 적합 <b>${esc(r.sectorSec.seasonFit)}</b><br>${esc(r.sectorSec.narrative)}</p>
      ${r.peers.length ? `<table><tr><th>종목(⭐=대상)</th><th>PEG</th><th>영업이익률</th><th>PSR</th><th>시총</th></tr>${peerRows}</table><p style="color:#666;font-size:11px">${esc(r.peersComment)}</p>` : ''}
      <h2>② 밸류에이션 스냅샷</h2>
      <p><span class="kpi">PEG <b>${val.peg ?? '—'}</b></span><span class="kpi">PER <b>${val.pe ?? '—'}</b></span><span class="kpi">PSR <b>${val.psr ?? '—'}</b></span><span class="kpi">ROIC <b>${val.roic != null ? val.roic + '%' : '—'}</b></span><span class="kpi">ROE <b>${val.roe != null ? Math.round(val.roe * 100) + '%' : '—'}</b></span><span class="kpi">역-DCF <b>${esc(val.dcfVerdict || '—')}</b></span></p>
      <h2>③ 1년 주가 추이</h2>
      ${chartSvg}
      <p style="font-size:11px">1년 수익률 <b>${r.chart.pct1y != null ? r.chart.pct1y + '%' : '—'}</b> · 52주 위치 <b>${r.chart.pos52 != null ? r.chart.pos52 + '%' : '—'}</b>(0=저점·100=고점)</p>
      <h2>④ 어닝 애널리시스</h2>${earnBlock}
      <h2>⑤ 현재 상황 & 향후 전망</h2><p>${esc(r.outlook)}</p>
      <h2>⑥ 액션 — 그래서 지금</h2>
      <p><span class="badge">${VKO[r.action.verdict]} ${r.action.score}점</span> &nbsp;${esc(r.action.oneLiner)}</p>
      ${r.action.timingLabel ? `<p>🚦 기술 타이밍: <b>${esc(r.action.timingLabel)}</b></p>` : ''}
      ${r.action.flags.length ? `<p style="color:#dc2626">⚑ 리스크 플래그: ${r.action.flags.map(esc).join(' · ')}</p>` : ''}
      <div style="display:flex;gap:20px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>👍 매수 근거</b>${li(r.action.pros, '#16a34a')}</div><div style="flex:1;min-width:220px"><b>⚠️ 주의</b>${li(r.action.cons, '#dc2626')}</div></div>
      <div class="foot">투자학교 포트폴리오 · 무료 공개데이터(Yahoo·Naver·FRED·DART) 기반 교육용 리포트 · 투자 권유 아님. 점수·판정은 앱 SSOT(종합 매수 판정과 동일), 서술은 데이터 근거 AI 합성. Anthropic 금융 에이전트의 Sector·Earnings·Morning Note를 무료 데이터로 재구성.</div>
    </body></html>`
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) { alert('팝업이 차단되었습니다. 팝업을 허용해 주세요.'); return }
  w.document.write(html); w.document.close()
  w.onload = () => { w.focus(); w.print() }
  setTimeout(() => { try { w.focus(); w.print() } catch { /* onload 처리 */ } }, 700)
}

export default function ResearchReport({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [rep, setRep] = useState<Report | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'unsupported' | 'error'>('loading')

  useEffect(() => {
    setState('loading'); setRep(null)
    fetch(`/api/research-report?ticker=${encodeURIComponent(ticker)}&market=${market}&name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (d?.unsupported) setState('unsupported'); else if (d?.error || !d?.action) setState('error'); else { setRep(d); setState('ok') } })
      .catch(() => setState('error'))
  }, [ticker, market, name])

  if (state === 'unsupported') return <Note>개별 주식 전용 리포트입니다(ETF·코인·원자재 제외).</Note>
  if (state === 'error') return <Note>리포트를 생성하지 못했습니다(재무 데이터 부족).</Note>
  if (state === 'loading' || !rep) return (
    <div style={{ color: TK.sub5, fontSize: 12.5, padding: 20, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
      📄 <b style={{ color: TK.slate200 }}>{name}</b> 풀 리서치 리포트 생성 중… <span style={{ color: TK.sub }}>(섹터·경쟁사·밸류·1년주가·어닝·전망 합성 — 최대 약 50초)</span>
    </div>
  )

  const vc = VCOLOR[rep.action.verdict]
  const closes = rep.chart.points.map(p => p.c).filter(c => c > 0)
  const lp = linePath(closes, 640, 120)

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      {/* 헤더 + PDF */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>📄 {rep.name}</span>
            <span style={{ color: TK.sub, fontSize: 11, fontFamily: 'monospace' }}>{rep.ticker} · {rep.market}</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>· {rep.sectorKo} 섹터 풀 리서치 리포트</span>
          </div>
          <div style={{ color: TK.sub3, fontSize: 9.5, marginTop: 1 }}>생성 {new Date(rep.generatedAt).toLocaleString('ko-KR')} · 앱 SSOT 총동원 + AI 합성 서술</div>
        </div>
        <button onClick={() => printReport(rep)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', background: TK.indigo400, color: '#fff', fontSize: 11.5, fontWeight: 800 }}>🖨️ PDF 다운로드</button>
      </div>

      {/* 총평 */}
      <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${vc}44`, padding: '10px 13px', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>총평</span>
          <span style={{ marginLeft: 'auto', background: vc, color: '#fff', fontWeight: 800, fontSize: 11.5, borderRadius: 6, padding: '2px 10px' }}>{VKO[rep.action.verdict]} {rep.action.score}점</span>
        </div>
        <div style={{ color: TK.sub8, fontSize: 12, lineHeight: 1.6 }}>{rep.summary}</div>
      </div>

      {/* ① 섹터 & 경쟁사 */}
      <Sec n="①" title="섹터 & 경쟁사 대시보드">
        <div style={{ marginBottom: 4 }}>로테이션 <b style={{ color: TK.slate300 }}>{rep.sectorSec.phaseLabel}</b> · 계절 적합 <b style={{ color: rep.sectorSec.seasonFit === '유리' ? TK.green400 : rep.sectorSec.seasonFit === '불리' ? TK.red400 : TK.sub5 }}>{rep.sectorSec.seasonFit}</b></div>
        <div style={{ marginBottom: 6 }}>{rep.sectorSec.narrative}</div>
        {rep.peers.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10.5 }}>
              <thead><tr style={{ color: TK.sub5 }}><th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>종목(⭐대상)</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>PEG</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>영업익</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>PSR</th><th style={{ textAlign: 'right', padding: '3px 6px', borderBottom: `1px solid ${BORDER}` }}>시총</th></tr></thead>
              <tbody>{rep.peers.map((p, i) => (
                <tr key={i} style={{ background: p.isTarget ? 'rgba(99,102,241,0.14)' : 'transparent', fontWeight: p.isTarget ? 800 : 400, color: p.isTarget ? TK.slate200 : TK.sub8 }}>
                  <td style={{ padding: '3px 6px', borderBottom: `1px solid ${TK.line4}` }}>{p.isTarget ? '⭐ ' : ''}{p.name}</td>
                  <td style={{ padding: '3px 6px', borderBottom: `1px solid ${TK.line4}`, textAlign: 'right', fontFamily: 'monospace' }}>{p.peg ?? '—'}</td>
                  <td style={{ padding: '3px 6px', borderBottom: `1px solid ${TK.line4}`, textAlign: 'right', fontFamily: 'monospace' }}>{p.opMargin != null ? p.opMargin + '%' : '—'}</td>
                  <td style={{ padding: '3px 6px', borderBottom: `1px solid ${TK.line4}`, textAlign: 'right', fontFamily: 'monospace' }}>{p.psr ?? '—'}</td>
                  <td style={{ padding: '3px 6px', borderBottom: `1px solid ${TK.line4}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtMcap(p.mcapUsd)}</td>
                </tr>))}</tbody>
            </table>
            <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 3 }}>{rep.peersComment}</div>
          </div>
        )}
      </Sec>

      {/* ② 밸류에이션 */}
      <Sec n="②" title="밸류에이션 스냅샷">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Kpi label="PEG" v={rep.valuation.peg} />
          <Kpi label="PER" v={rep.valuation.pe} />
          <Kpi label="PSR" v={rep.valuation.psr} />
          <Kpi label="ROIC" v={rep.valuation.roic != null ? rep.valuation.roic + '%' : null} />
          <Kpi label="ROE" v={rep.valuation.roe != null ? Math.round(rep.valuation.roe * 100) + '%' : null} />
          {rep.valuation.dcfVerdict && <Kpi label="역-DCF" v={rep.valuation.dcfVerdict} />}
        </div>
      </Sec>

      {/* ③ 1년 주가 */}
      <Sec n="③" title="1년 주가 추이">
        {closes.length >= 2 ? (
          <>
            <svg viewBox="0 0 640 120" style={{ width: '100%', height: 'auto', display: 'block', background: TK.bg3, borderRadius: 6, border: `1px solid ${BORDER}` }}>
              <path d={lp.area} fill={lp.up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'} />
              <path d={lp.d} fill="none" stroke={lp.up ? TK.green400 : TK.red400} strokeWidth={1.6} />
            </svg>
            <div style={{ color: TK.sub5, fontSize: 10.5, marginTop: 3 }}>1년 수익률 <b style={{ color: (rep.chart.pct1y ?? 0) >= 0 ? TK.green400 : TK.red400 }}>{rep.chart.pct1y != null ? (rep.chart.pct1y > 0 ? '+' : '') + rep.chart.pct1y + '%' : '—'}</b> · 52주 위치 <b style={{ color: TK.slate300 }}>{rep.chart.pos52 != null ? rep.chart.pos52 + '%' : '—'}</b> <span style={{ color: TK.sub }}>(0=저점·100=고점)</span></div>
          </>
        ) : <div style={{ color: TK.sub }}>주가 데이터 부족</div>}
      </Sec>

      {/* ④ 어닝 */}
      <Sec n="④" title="어닝 애널리시스">
        {rep.earnings.status === 'ok' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><b style={{ color: TK.green400 }}>🌱 성장 스토리</b> — {rep.earnings.growthStory}</div>
            <div><b style={{ color: TK.blue300 }}>🎙 경영진 태도</b> — {rep.earnings.managementTone}</div>
            <div><b style={{ color: TK.amber400 }}>🧭 다음 가이던스</b> — {rep.earnings.guidance}</div>
            <div style={{ color: TK.sub5 }}>낙관도 <b style={{ color: TK.slate300 }}>{rep.earnings.sentiment}/100</b> · 추정 리비전 <b style={{ color: TK.slate300 }}>{rep.earnings.revision}</b></div>
          </div>
        ) : <div style={{ color: TK.sub }}>최근 실적 AI 분석 데이터 없음(무료 티어 한도/뉴스 부족). · 추정 리비전 {rep.earnings.revision}</div>}
      </Sec>

      {/* ⑤ 향후 전망 */}
      <Sec n="⑤" title="현재 상황 & 향후 전망">
        {rep.outlook}
      </Sec>

      {/* ⑥ 액션 */}
      <Sec n="⑥" title="액션 — 그래서 지금">
        <div style={{ marginBottom: 4 }}>{rep.action.oneLiner}</div>
        {rep.action.timingLabel && <div style={{ marginBottom: 4 }}>🚦 기술 타이밍: <b style={{ color: TK.slate300 }}>{rep.action.timingLabel}</b></div>}
        {rep.action.flags.length > 0 && <div style={{ marginBottom: 4, color: TK.red400 }}>⚑ 리스크 플래그: {rep.action.flags.join(' · ')}</div>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}><b style={{ color: TK.green400, fontSize: 11 }}>👍 매수 근거</b>{rep.action.pros.length ? <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>{rep.action.pros.map((p, i) => <li key={i} style={{ color: TK.sub8, margin: '1px 0' }}>{p}</li>)}</ul> : <div style={{ color: TK.sub }}> —</div>}</div>
          <div style={{ flex: '1 1 180px' }}><b style={{ color: TK.red400, fontSize: 11 }}>⚠️ 주의</b>{rep.action.cons.length ? <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>{rep.action.cons.map((p, i) => <li key={i} style={{ color: TK.sub8, margin: '1px 0' }}>{p}</li>)}</ul> : <div style={{ color: TK.sub }}> —</div>}</div>
        </div>
      </Sec>

      <div style={{ color: TK.sub, fontSize: 9, marginTop: 10, lineHeight: 1.5 }}>ⓘ 점수·판정은 앱 SSOT(종합 매수 판정과 동일값), 서술은 넘겨준 데이터 근거의 AI 합성입니다. 교육용이며 투자 권유가 아닙니다. Anthropic 금융 에이전트의 Sector·Earnings·Morning Note를 무료 데이터로 재구성.</div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ color: TK.sub, fontSize: 12, padding: 14, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>{children}</div>
}
function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5, borderLeft: `3px solid ${TK.indigo400}`, paddingLeft: 8 }}>
        <span style={{ color: TK.indigo300, fontWeight: 800, fontSize: 13 }}>{n}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>{title}</span>
      </div>
      <div style={{ color: TK.sub8, fontSize: 11.5, lineHeight: 1.65, paddingLeft: 11 }}>{children}</div>
    </div>
  )
}
function Kpi({ label, v }: { label: string; v: string | number | null }) {
  return <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}><span style={{ color: TK.sub, fontSize: 10 }}>{label}</span><span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5, fontFamily: 'monospace' }}>{v ?? '—'}</span></span>
}
