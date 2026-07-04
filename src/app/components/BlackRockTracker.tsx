'use client'
// 🏛️ BlackRockTracker — 세계 1위 운용사 블랙록(래리 핑크) 13F 트래커
//  ① Top 보유(시장 복제 교육) ② 분기별 스마트머니 무브(QoQ) ③ 섹터 집중도 ④ 하우스 뷰 교육
//  데이터: /api/blackrock (SEC 13F-HR, CIK 2012383, 30일 캐시). ⚠️ 대부분 iShares 인덱스=시장 복제.
import { useState, useEffect } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { BlackRockResult } from '@/app/api/blackrock/route'

const CARD = '#12151c', BORDER = '#252a36', GOLD = '#d4af7a'
const SEC_COLOR: Record<string, string> = { IT: '#60a5fa', '커뮤니케이션': '#a78bfa', '자유소비재': '#fb923c', '금융': '#4ade80', '헬스케어': '#f472b6', '필수소비재': '#22d3ee', '에너지': '#f59e0b', '산업재': '#94a3b8', '소재': '#c084fc', 'ETF(자체)': '#64748b', '기타': '#475569' }
const fmtB = (v: number) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(1)}B`)

export default function BlackRockTracker() {
  const [d, setD] = useState<BlackRockResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/blackrock', { cache: 'no-store' }).then(r => r.json()).then(x => (x?.top ? setD(x) : setErr(true))).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* INTRO */}
      <div style={{ background: `linear-gradient(135deg, #1a1410, ${CARD})`, borderRadius: 14, border: `1px solid ${GOLD}44`, padding: '16px 20px' }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 19 }}>🏛️ 블랙록 — 세계 1위 운용사의 장바구니</div>
        <div style={{ color: '#aab6c4', fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          래리 핑크의 <b style={{ color: '#e2e8f0' }}>블랙록</b>은 운용자산 <b style={{ color: GOLD }}>약 $12조</b>(세계 최대)로 iShares ETF 제국을 굴립니다.
          {d && <> SEC 13F 공시분 <b style={{ color: '#e2e8f0' }}>{fmtB(d.totalValue)}</b>·<b style={{ color: '#e2e8f0' }}>{d.holdingCount.toLocaleString()}종목</b>({d.period}).</>}
        </div>
        <div style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}33`, borderRadius: 9, padding: '8px 12px', marginTop: 10, color: '#cdd6e3', fontSize: 11, lineHeight: 1.6 }}>
          💡 <b style={{ color: GOLD }}>핵심</b>: 보유 대부분이 iShares 인덱스라 <b>시장 전체를 시총가중으로 복제</b>합니다. 그래서 &ldquo;무엇을 보유하나&rdquo;(=시장 그 자체)보다 <b style={{ color: '#e2e8f0' }}>&ldquo;분기별로 무엇을 늘리고 줄였나&rdquo;</b>가 진짜 신호입니다. 래리 핑크: &ldquo;우리는 시장을 이기지 않는다 — 시장이 된다.&rdquo;
        </div>
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>블랙록 13F 데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>SEC 13F 공시(5만+ 종목)를 분석 중입니다…</div>}

      {d && <>
        {/* ① Top 보유 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>① Top 보유 종목 — {d.period}</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 10 }}>순위가 곧 시총 순서 = 시장 복제. iShares 자체 ETF도 포함(패시브 지배의 증거).</div>
          {d.top.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
              <span style={{ width: 20, color: '#7f93a8', fontSize: 11, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ width: 210, color: '#e2e8f0', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.ticker && <b style={{ color: GOLD }}>{h.ticker}</b>} {h.name}
              </span>
              <span style={{ background: `${SEC_COLOR[h.sector] ?? '#475569'}22`, color: SEC_COLOR[h.sector] ?? '#94a3b8', borderRadius: 5, padding: '1px 7px', fontSize: 9.5, flexShrink: 0 }}>{h.sector}</span>
              <div style={{ flex: 1, background: '#0f1117', borderRadius: 4, height: 13, overflow: 'hidden', minWidth: 40 }}>
                <div style={{ width: `${Math.min(100, h.pct / d.top[0].pct * 100)}%`, height: '100%', background: SEC_COLOR[h.sector] ?? '#60a5fa', borderRadius: 4 }} />
              </div>
              <span style={{ width: 92, textAlign: 'right', color: '#cdd6e3', fontSize: 11, fontFamily: 'monospace' }}>{fmtB(h.value)}</span>
              <span style={{ width: 46, textAlign: 'right', color: '#e2e8f0', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{h.pct}%</span>
            </div>
          ))}
        </div>

        {/* ② 분기별 스마트머니 무브 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>② 분기별 스마트머니 무브 — {d.prevPeriod} → {d.period}</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 10 }}>직전 분기 대비 주식수를 크게 늘리고/줄인 곳. 패시브 지배 속에서도 순유입·액티브 결정이 드러나는 유일한 신호(단, 인덱스 리밸런싱 영향 포함).</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <MoveList title="📈 크게 늘린 종목" color="#4ade80" rows={d.added} />
            <MoveList title="📉 크게 줄인 종목" color="#f87171" rows={d.reduced} />
          </div>
          {(d.newBuys.length > 0 || d.exited.length > 0) && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 11 }}>
              {d.newBuys.length > 0 && <div><span style={{ color: '#60a5fa', fontWeight: 700 }}>🆕 신규 편입:</span> <span style={{ color: '#cdd6e3' }}>{d.newBuys.map(m => `${m.ticker ?? m.name.slice(0, 16)}`).join(' · ')}</span></div>}
              {d.exited.length > 0 && <div><span style={{ color: '#8a9aaa', fontWeight: 700 }}>🗑️ 전량 청산:</span> <span style={{ color: '#9aa7b5' }}>{d.exited.map(m => `${m.ticker ?? m.name.slice(0, 16)}`).join(' · ')}</span></div>}
            </div>
          )}
        </div>

        {/* ③ 섹터 집중도 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>③ 섹터 집중도 (Top 100 기준)</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>세계 1위 투자자도 AI·테크에 쏠려 있습니다 — 시장 자체가 메가캡 테크에 편중된 결과.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.sectors} dataKey="value" nameKey="sector" cx="50%" cy="50%" innerRadius={42} outerRadius={78} paddingAngle={1.5}>
                    {d.sectors.map((s, i) => <Cell key={i} fill={SEC_COLOR[s.sector] ?? '#475569'} stroke="#0f1117" strokeWidth={1} />)}
                  </Pie>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any, n: any) => [fmtB(v as number), n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {d.sectors.map(s => (
                <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: SEC_COLOR[s.sector] ?? '#475569', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#cdd6e3' }}>{s.sector}</span>
                  <span style={{ color: '#9aa7b5', fontFamily: 'monospace' }}>{fmtB(s.value)}</span>
                  <span style={{ width: 44, textAlign: 'right', color: '#e2e8f0', fontWeight: 700, fontFamily: 'monospace' }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ④ 하우스 뷰 교육 */}
        <div style={{ background: 'rgba(212,175,122,0.06)', border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🎓 13F(보유) vs 래리 핑크의 하우스 뷰(전망) — 다른 것</div>
          <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.7 }}>
            위 13F는 블랙록이 <b style={{ color: '#e2e8f0' }}>실제 보유한 것</b>(대부분 고객 자금의 패시브 인덱스)입니다. 반면 <b style={{ color: '#e2e8f0' }}>BlackRock Investment Institute</b>가 발표하는 전술적 자산배분(주식 비중확대·AI 메가포스·인컴 전략 등)은 래리 핑크 팀의 <b style={{ color: '#e2e8f0' }}>미래 전망</b>이라 별개입니다 — 보유는 시장을 따라가고, 전망은 앞을 봅니다. 이 페이지는 &lsquo;보유&rsquo;를 추적합니다.
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.55 }}>
            ⚠️ 13F는 45일 공시지연 + 롱 온리(공매도·채권·해외주식 미포함). iShares 자체 ETF 보유분 포함. 세계 1위라 시장을 복제 — 개별 종목 매매 지시가 아닌 &lsquo;거인의 자금 흐름&rsquo; 교육용. 데이터: SEC EDGAR 13F-HR.
          </div>
        </div>
      </>}
    </div>
  )
}

function MoveList({ title, color, rows }: { title: string; color: string; rows: { name: string; ticker: string | null; deltaValue: number; deltaPct: number }[] }) {
  return (
    <div style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${BORDER}`, padding: '9px 12px' }}>
      <div style={{ color, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>{title}</div>
      {rows.length ? rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '3px 0' }}>
          <span style={{ flex: 1, color: '#cdd6e3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ticker && <b style={{ color: '#e2e8f0' }}>{r.ticker}</b>} {r.name.slice(0, 22)}</span>
          <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{r.deltaPct > 0 ? '+' : ''}{r.deltaPct}%</span>
          <span style={{ width: 78, textAlign: 'right', color: '#9aa7b5', fontFamily: 'monospace' }}>{r.deltaValue > 0 ? '+' : '−'}{fmtB(Math.abs(r.deltaValue))}</span>
        </div>
      )) : <div style={{ color: '#5a6b7c', fontSize: 11 }}>해당 없음</div>}
    </div>
  )
}
