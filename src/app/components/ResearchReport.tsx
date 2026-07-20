'use client'
// 📄 종목 리서치 리포트 — Anthropic 금융 에이전트式 3기능(섹터·어닝·액션) 통합 문서 + PDF 다운로드
import { useEffect, useState } from 'react'
import { TK } from '@/lib/theme'
import type { ResearchReport as Report } from '@/app/api/research-report/route'

const CARD = TK.bg4, BORDER = TK.line3
const VCOLOR = { buy: TK.green500, caution: TK.amber500, avoid: TK.red400 } as const
const VKO = { buy: '✅ 매수 적합', caution: '⚖️ 신중(조건부)', avoid: '⛔ 부적합' } as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 새 창에 인쇄용 문서 HTML을 만들어 window.print() → 브라우저 "PDF로 저장"(의존성 0)
function printReport(r: Report) {
  const dt = new Date(r.generatedAt).toLocaleString('ko-KR')
  const vColor = r.action.verdict === 'buy' ? '#16a34a' : r.action.verdict === 'caution' ? '#d97706' : '#dc2626'
  const li = (arr: string[], c: string) => arr.length ? `<ul style="margin:4px 0 0;padding-left:18px">${arr.map(x => `<li style="color:${c};margin:2px 0">${esc(x)}</li>`).join('')}</ul>` : '<div style="color:#888">—</div>'
  const earnBlock = r.earnings.status === 'ok'
    ? `<p><b>🌱 성장 스토리</b><br>${esc(r.earnings.growthStory)}</p>
       <p><b>🎙 경영진 태도</b><br>${esc(r.earnings.managementTone)}</p>
       <p><b>🧭 다음 가이던스</b><br>${esc(r.earnings.guidance)}</p>
       <p><b>낙관도</b> ${r.earnings.sentiment}/100 · <b>추정 리비전</b> ${esc(r.earnings.revision)}</p>`
    : `<p style="color:#888">최근 실적 AI 분석 데이터가 없습니다(무료 티어 한도 또는 뉴스 부족). · 추정 리비전: ${esc(r.earnings.revision)}</p>`
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(r.name)} 리서치 리포트</title>
    <style>@page{margin:18mm}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1a1a1a;line-height:1.6;max-width:800px;margin:0 auto;font-size:13px}
    h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;border-left:4px solid #4f46e5;padding-left:8px;margin:22px 0 8px}
    .sub{color:#666;font-size:11px}.badge{display:inline-block;padding:2px 10px;border-radius:6px;color:#fff;font-weight:700;font-size:13px;background:${vColor}}
    .box{background:#f7f7f9;border:1px solid #e5e5ea;border-radius:8px;padding:10px 14px;margin:8px 0}
    .foot{margin-top:28px;border-top:1px solid #ddd;padding-top:8px;color:#888;font-size:10px}p{margin:6px 0}</style></head>
    <body>
      <h1>${esc(r.name)} <span style="font-size:14px;color:#666">${esc(r.ticker)} · ${r.market}</span></h1>
      <div class="sub">📄 종목 리서치 리포트 · ${r.sectorKo} 섹터 · 생성 ${dt}</div>
      <div class="box"><b>총평</b><br>${esc(r.summary)} &nbsp; <span class="badge">${VKO[r.action.verdict]} ${r.action.score}점</span></div>
      <h2>① 섹터 오버뷰</h2><p>로테이션 국면 <b>${esc(r.sectorSec.phaseLabel)}</b> · 계절 적합 <b>${esc(r.sectorSec.seasonFit)}</b></p><p>${esc(r.sectorSec.narrative)}</p>
      <h2>② 어닝 애널리시스</h2>${earnBlock}
      <h2>③ 액션 (그래서 지금)</h2>
      <p><span class="badge">${VKO[r.action.verdict]} ${r.action.score}점</span> &nbsp; ${esc(r.action.oneLiner)}</p>
      ${r.action.timingLabel ? `<p>🚦 기술 타이밍: <b>${esc(r.action.timingLabel)}</b></p>` : ''}
      <div style="display:flex;gap:20px;flex-wrap:wrap"><div style="flex:1"><b>👍 매수 근거</b>${li(r.action.pros, '#16a34a')}</div><div style="flex:1"><b>⚠️ 주의</b>${li(r.action.cons, '#dc2626')}</div></div>
      <div class="foot">투자학교 포트폴리오 · 무료 공개데이터(Yahoo·Naver·FRED·DART) 기반 교육용 리포트 · 투자 권유 아님. 점수·판정은 앱 SSOT, 서술은 AI 합성(데이터 근거).</div>
    </body></html>`
  const w = window.open('', '_blank', 'width=880,height=1000')
  if (!w) { alert('팝업이 차단되었습니다. 팝업을 허용해 주세요.'); return }
  w.document.write(html); w.document.close()
  w.onload = () => { w.focus(); w.print() }
  setTimeout(() => { try { w.focus(); w.print() } catch { /* onload가 처리 */ } }, 600)
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

  if (state === 'unsupported') return <div style={{ color: TK.sub, fontSize: 12, padding: 14, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>개별 주식 전용 리포트입니다(ETF·코인·원자재 제외).</div>
  if (state === 'error') return <div style={{ color: TK.sub, fontSize: 12, padding: 14, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>리포트를 생성하지 못했습니다(재무 데이터 부족).</div>
  if (state === 'loading' || !rep) return (
    <div style={{ color: TK.sub5, fontSize: 12.5, padding: 20, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
      📄 <b style={{ color: TK.slate200 }}>{name}</b> 리서치 리포트를 생성 중입니다… <span style={{ color: TK.sub }}>(섹터·어닝·판정 합성 — 최대 약 40초)</span>
    </div>
  )

  const vc = VCOLOR[rep.action.verdict]
  const Section = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5, borderLeft: `3px solid ${TK.indigo400}`, paddingLeft: 8 }}>
        <span style={{ color: TK.indigo300, fontWeight: 800, fontSize: 13 }}>{n}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>{title}</span>
      </div>
      <div style={{ color: TK.sub8, fontSize: 11.5, lineHeight: 1.65, paddingLeft: 11 }}>{children}</div>
    </div>
  )

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      {/* 헤더 + PDF 버튼 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>📄 {rep.name}</span>
            <span style={{ color: TK.sub, fontSize: 11, fontFamily: 'monospace' }}>{rep.ticker} · {rep.market}</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>· {rep.sectorKo} 섹터 리서치 리포트</span>
          </div>
          <div style={{ color: TK.sub3, fontSize: 9.5, marginTop: 1 }}>생성 {new Date(rep.generatedAt).toLocaleString('ko-KR')} · 앱 SSOT 데이터 + AI 합성 서술</div>
        </div>
        <button onClick={() => printReport(rep)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', background: TK.indigo400, color: '#fff', fontSize: 11.5, fontWeight: 800 }}>
          🖨️ PDF 다운로드
        </button>
      </div>

      {/* 총평 */}
      <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${vc}44`, padding: '10px 13px', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>총평</span>
          <span style={{ marginLeft: 'auto', background: vc, color: '#fff', fontWeight: 800, fontSize: 11.5, borderRadius: 6, padding: '2px 10px' }}>{VKO[rep.action.verdict]} {rep.action.score}점</span>
        </div>
        <div style={{ color: TK.sub8, fontSize: 12, lineHeight: 1.6 }}>{rep.summary}</div>
      </div>

      {/* ① 섹터 오버뷰 */}
      <Section n="①" title="섹터 오버뷰">
        <div style={{ marginBottom: 3 }}>로테이션 국면 <b style={{ color: TK.slate300 }}>{rep.sectorSec.phaseLabel}</b> · 계절 적합 <b style={{ color: rep.sectorSec.seasonFit === '유리' ? TK.green400 : rep.sectorSec.seasonFit === '불리' ? TK.red400 : TK.sub5 }}>{rep.sectorSec.seasonFit}</b></div>
        {rep.sectorSec.narrative}
      </Section>

      {/* ② 어닝 애널리시스 */}
      <Section n="②" title="어닝 애널리시스">
        {rep.earnings.status === 'ok' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><b style={{ color: TK.green400 }}>🌱 성장 스토리</b> — {rep.earnings.growthStory}</div>
            <div><b style={{ color: TK.blue300 }}>🎙 경영진 태도</b> — {rep.earnings.managementTone}</div>
            <div><b style={{ color: TK.amber400 }}>🧭 다음 가이던스</b> — {rep.earnings.guidance}</div>
            <div style={{ color: TK.sub5 }}>낙관도 <b style={{ color: TK.slate300 }}>{rep.earnings.sentiment}/100</b> · 추정 리비전 <b style={{ color: TK.slate300 }}>{rep.earnings.revision}</b></div>
          </div>
        ) : (
          <div style={{ color: TK.sub }}>최근 실적 AI 분석 데이터가 없습니다(무료 티어 한도/뉴스 부족). · 추정 리비전 {rep.earnings.revision}</div>
        )}
      </Section>

      {/* ③ 액션 */}
      <Section n="③" title="액션 — 그래서 지금">
        <div style={{ marginBottom: 4 }}>{rep.action.oneLiner}</div>
        {rep.action.timingLabel && <div style={{ marginBottom: 4 }}>🚦 기술 타이밍: <b style={{ color: TK.slate300 }}>{rep.action.timingLabel}</b></div>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}><b style={{ color: TK.green400, fontSize: 11 }}>👍 매수 근거</b>{rep.action.pros.length ? <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>{rep.action.pros.map((p, i) => <li key={i} style={{ color: TK.sub8, margin: '1px 0' }}>{p}</li>)}</ul> : <div style={{ color: TK.sub }}> —</div>}</div>
          <div style={{ flex: '1 1 180px' }}><b style={{ color: TK.red400, fontSize: 11 }}>⚠️ 주의</b>{rep.action.cons.length ? <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>{rep.action.cons.map((p, i) => <li key={i} style={{ color: TK.sub8, margin: '1px 0' }}>{p}</li>)}</ul> : <div style={{ color: TK.sub }}> —</div>}</div>
        </div>
      </Section>

      <div style={{ color: TK.sub, fontSize: 9, marginTop: 10, lineHeight: 1.5 }}>ⓘ 점수·판정은 앱 SSOT(종합 매수 판정과 동일값), 서술은 넘겨준 데이터 근거의 AI 합성입니다. 교육용이며 투자 권유가 아닙니다. Anthropic 금융 에이전트의 Sector Overview·Earnings Analysis·Morning Note를 무료 데이터로 재구성.</div>
    </div>
  )
}
