'use client'
// 🏆 2026 상반기 수익률 챔피언십 — 4시장 Top10 랭킹보드 + FOMO 계산기 + 누적수익 차트 + 4지수/대장주 비교
import { useState, useEffect } from 'react'
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { H1ChampResult, ChampStock } from '@/app/api/h1-champions/route'

const CARD = '#12151c', BORDER = '#252a36', GOLD = '#d4af7a'
type MK = 'sp500' | 'nasdaq' | 'kospi' | 'kosdaq'
const MK_META: Record<MK, { ko: string; flag: string; color: string }> = {
  sp500: { ko: 'S&P 500', flag: '🇺🇸', color: '#60a5fa' }, nasdaq: { ko: '나스닥', flag: '🇺🇸', color: '#a78bfa' },
  kospi: { ko: '코스피', flag: '🇰🇷', color: '#4ade80' }, kosdaq: { ko: '코스닥', flag: '🇰🇷', color: '#fb923c' },
}
const MEDAL = ['🥇', '🥈', '🥉']
const fmtWon = (v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(2)}억원` : `${Math.round(v / 1e4).toLocaleString()}만원`

export default function H1Champions() {
  const [d, setD] = useState<H1ChampResult | null>(null)
  const [err, setErr] = useState(false)
  const [mk, setMk] = useState<MK>('kosdaq')
  const [sel, setSel] = useState<ChampStock | null>(null)
  const [amount, setAmount] = useState(1000)   // 만원
  const [cmpMode, setCmpMode] = useState<'index' | 'leader'>('index')

  useEffect(() => {
    fetch('/api/h1-champions', { cache: 'no-store' }).then(r => r.json()).then(x => { if (x?.markets) { setD(x); setSel(x.markets.kosdaq[0]) } else setErr(true) }).catch(() => setErr(true))
  }, [])

  const list = d?.markets[mk] ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, #1a1508, ${CARD})`, borderRadius: 14, border: `1px solid ${GOLD}44`, padding: '16px 20px' }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 20 }}>🏆 2026 상반기 수익률 챔피언십</div>
        <div style={{ color: '#aab6c4', fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          {d?.period ?? '1월~6월'} <b style={{ color: '#e2e8f0' }}>4대 시장(S&P500·나스닥·코스피·코스닥)</b>을 실제 스캔한 진짜 수익률 랭킹. &ldquo;내가 놓친 주도주는 뭐였나?&rdquo; — 다음 투자 아이디어의 힌트.
        </div>
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>상반기 챔피언을 불러오는 중…</div>}

      {d && <>
        {/* 시장 탭 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(MK_META) as MK[]).map(m => {
            const win = d.markets[m][0]
            return (
              <button key={m} onClick={() => { setMk(m); setSel(d.markets[m][0]) }} style={{ flex: 1, minWidth: 130, background: mk === m ? `${MK_META[m].color}20` : '#161b25', border: `1px solid ${mk === m ? MK_META[m].color : '#1e293b'}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ color: mk === m ? '#fff' : '#cdd6e3', fontWeight: 800, fontSize: 12.5 }}>{MK_META[m].flag} {MK_META[m].ko}</div>
                <div style={{ color: MK_META[m].color, fontSize: 11, fontWeight: 700 }}>1위 {win?.name?.slice(0, 8)} +{win?.ret}%</div>
              </button>
            )
          })}
        </div>

        {/* 랭킹보드 + 상세 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.2fr)', gap: 12 }}>
          {/* Top10 랭킹 */}
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 14px' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{MK_META[mk].flag} {MK_META[mk].ko} Top 10</div>
            {list.map((s, i) => {
              const active = sel?.ticker === s.ticker
              return (
                <div key={s.ticker} onClick={() => setSel(s)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: active ? `${MK_META[mk].color}18` : 'transparent', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ width: 24, fontSize: i < 3 ? 15 : 11, color: '#7f93a8', textAlign: 'center' }}>{i < 3 ? MEDAL[i] : i + 1}</span>
                  <span style={{ flex: 1, color: '#e2e8f0', fontSize: 12, fontWeight: active ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name} <span style={{ color: '#7f93a8', fontSize: 9.5 }}>{s.ticker}</span></span>
                  <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>+{s.ret}%</span>
                </div>
              )
            })}
          </div>

          {/* 선택 종목: 차트 + FOMO */}
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 14px' }}>
            {sel && <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{sel.name}</span>
                <span style={{ color: '#8a9aaa', fontSize: 11 }}>{sel.ticker}</span>
                <span style={{ marginLeft: 'auto', color: '#4ade80', fontWeight: 900, fontSize: 18, fontFamily: 'monospace' }}>+{sel.ret}%</span>
              </div>
              <div style={{ height: 170, marginTop: 6 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sel.series.map(p => ({ d: p.d, ret: Math.round((p.c / sel.series[0].c - 1) * 1000) / 10 }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="champG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" /><stop offset="100%" stopColor="#4ade80" stopOpacity="0" /></linearGradient></defs>
                    <XAxis dataKey="d" tick={{ fill: '#7f93a8', fontSize: 8.5 }} minTickGap={40} axisLine={{ stroke: BORDER }} tickLine={false} />
                    <YAxis tick={{ fill: '#7f93a8', fontSize: 8.5 }} axisLine={false} tickLine={false} width={38} tickFormatter={(v: number) => `${v}%`} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`+${v}%`, '누적수익']} />
                    <Area type="monotone" dataKey="ret" stroke="#4ade80" strokeWidth={2} fill="url(#champG)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* FOMO 계산기 */}
              <div style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${GOLD}33`, padding: '9px 12px', marginTop: 8 }}>
                <div style={{ color: GOLD, fontWeight: 800, fontSize: 11.5, marginBottom: 5 }}>😱 FOMO 계산기 — 1월 초에 투자했다면?</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="range" min={100} max={10000} step={100} value={amount} onChange={e => setAmount(+e.target.value)} style={{ flex: 1, minWidth: 120, accentColor: GOLD }} />
                  <span style={{ color: '#cdd6e3', fontSize: 12, fontWeight: 700, minWidth: 76, textAlign: 'right' }}>{fmtWon(amount * 1e4)}</span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
                  투자금 <b>{fmtWon(amount * 1e4)}</b> → 현재 <b style={{ color: '#4ade80', fontSize: 15 }}>{fmtWon(amount * 1e4 * (1 + sel.ret / 100))}</b>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}> ({sel.ret >= 0 ? '+' : ''}{fmtWon(amount * 1e4 * sel.ret / 100)} 수익)</span>
                </div>
              </div>
            </>}
          </div>
        </div>

        {/* 4분할 비교차트 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📊 4대 시장 비교</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setCmpMode('index')} style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: cmpMode === 'index' ? `${GOLD}22` : '#161b25', color: cmpMode === 'index' ? GOLD : '#8a9aaa', border: `1px solid ${cmpMode === 'index' ? `${GOLD}66` : '#1e293b'}` }}>지수 대결</button>
              <button onClick={() => setCmpMode('leader')} style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: cmpMode === 'leader' ? `${GOLD}22` : '#161b25', color: cmpMode === 'leader' ? GOLD : '#8a9aaa', border: `1px solid ${cmpMode === 'leader' ? `${GOLD}66` : '#1e293b'}` }}>대장주 대결</button>
            </div>
            <span style={{ color: '#7f93a8', fontSize: 10 }}>{cmpMode === 'index' ? '어느 시장에 투자했어야 했나' : '각 시장 1위 종목의 상승 궤적'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {(Object.keys(MK_META) as MK[]).map(m => {
              const isIdx = cmpMode === 'index'
              const win = d.markets[m][0]
              const data = isIdx ? d.indices[m].map(p => ({ d: p.d, v: Math.round((p.v / (d.indices[m][0]?.v || 100) - 1) * 1000) / 10 }))
                : (win ? win.series.map(p => ({ d: p.d, v: Math.round((p.c / win.series[0].c - 1) * 1000) / 10 })) : [])
              const ret = isIdx ? d.indexReturns[m] : win?.ret ?? null
              return (
                <div key={m} style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${BORDER}`, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: MK_META[m].color, fontWeight: 800, fontSize: 12 }}>{MK_META[m].flag} {MK_META[m].ko}{!isIdx && win ? ` 1위 ${win.name.slice(0, 6)}` : ''}</span>
                    <span style={{ color: (ret ?? 0) >= 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{ret != null ? `${ret >= 0 ? '+' : ''}${ret}%` : '—'}</span>
                  </div>
                  <div style={{ height: 110, marginTop: 4 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <XAxis dataKey="d" tick={{ fill: '#7f93a8', fontSize: 8 }} minTickGap={40} axisLine={{ stroke: BORDER }} tickLine={false} />
                        <YAxis tick={{ fill: '#7f93a8', fontSize: 8 }} axisLine={false} tickLine={false} width={30} tickFormatter={(v: number) => `${v}`} />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 10.5 }} formatter={(v: any) => [`${v >= 0 ? '+' : ''}${v}%`, '']} />
                        <Line type="monotone" dataKey="v" stroke={MK_META[m].color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ color: '#7f93a8', fontSize: 10, lineHeight: 1.6, padding: '0 4px' }}>
          ⚠️ 유니버스: S&P500 전종목·나스닥100·코스피/코스닥 시총 상위 각 ~290종목(초소형주 제외) 실제 스캔. 수익률=2026년 1월 초 vs 6월 말 종가(네이버·Yahoo). 확정된 과거 실적이며 <b style={{ color: '#cdd6e3' }}>미래 수익 보장이 아닙니다</b> — 이미 급등한 종목의 추격매수는 위험(IPO 하이프 사이클·급락주 가드 참고). 재미·복기용.
        </div>
      </>}
    </div>
  )
}
