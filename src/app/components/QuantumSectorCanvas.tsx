'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
// 🛰️ 양자 테마 인텔리전스 — 서브섹터 히트맵 + 테마지수·MDD + 대장주(IONQ) 베타·상관 + 퓨어플레이 토글 + 정책/Pre-IPO
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { QuantumSectorResult, QStockOut } from '@/app/api/quantum-sector/route'
import { QMARKET_FLAG } from '@/lib/quantumUniverse'

const LINE_COLORS: Record<string, string> = { theme: '#fbbf24', IONQ: '#a78bfa', QBTS: '#22d3ee', RGTI: '#34d399', QUBT: '#f59e0b', '046970': '#ec4899' }

const CARD = '#161b25', BORDER = '#1e293b'
const UP = '#34d399', DN = '#f87171'   // 수익률: 초록=+ / 빨강=−
const pctCol = (v: number | null) => v == null ? '#8a9aaa' : v > 0 ? UP : v < 0 ? DN : '#8a9aaa'
const fmtPct = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`

function Ret({ v, w = 56 }: { v: number | null; w?: number }) {
  return <span style={{ width: w, textAlign: 'right', color: pctCol(v), fontWeight: 800, fontFamily: 'monospace', fontSize: 12 }}>{fmtPct(v)}</span>
}

export default function QuantumSectorCanvas() {
  const [d, setD] = useState<QuantumSectorResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [pureOnly, setPureOnly] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/quantum-sector', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const Wrap = (child: React.ReactNode) => (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🛰️</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>양자 테마 인텔리전스</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(167,139,250,0.18)', color: '#a78bfa', fontWeight: 700 }}>Quantum</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
        ⚠️ 이익이 거의 없는 &lsquo;꿈의 테마&rsquo; — PER·PEG 무의미. <b style={{ color: '#cbd5e1' }}>추세·테마동조화·정책촉매</b>로 봅니다. 고위험·−70% 드로다운 정상, 소액·분산. 교육용.
      </div>
      {child}
    </div>
  )

  if (loading) return Wrap(<div style={{ color: '#8a9aaa', fontSize: 12.5, padding: '12px 0' }}>🛰️ 양자 테마 데이터를 모으는 중…</div>)
  if (!d) return Wrap(<div style={{ color: '#8a9aaa', fontSize: 12.5, padding: '12px 0' }}>데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>)

  const stocks = pureOnly ? d.stocks.filter(s => s.purePlay) : d.stocks
  const maxBeta = Math.max(2, ...d.stocks.map(s => s.beta ?? 0))

  return Wrap(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ① 서브섹터 히트맵 카드 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {d.subsectors.map(s => (
          <div key={s.key} style={{ flex: '1 1 200px', minWidth: 190, background: '#0f1117', borderRadius: 12, border: `1px solid ${s.color}44`, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 15 }}>{s.emoji}</span>
              <span style={{ color: s.color, fontWeight: 800, fontSize: 13.5 }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 10 }}>{s.count}종목</span>
            </div>
            <div style={{ color: '#7f93a8', fontSize: 10, marginBottom: 8 }}>{s.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {([['1주', s.ret1w], ['1개월', s.ret1m], ['1년', s.ret1y]] as const).map(([lab, v]) => (
                <div key={lab} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ color: '#7f93a8', fontSize: 9.5, marginBottom: 2 }}>{lab}</div>
                  <div style={{ color: pctCol(v), fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{fmtPct(v)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ②-A 테마 지수 + 낙폭(MDD) + 모멘텀 오버레이 */}
      {d.themeChart && (() => {
        const tc = d.themeChart
        const data = Array.from({ length: tc.len }, (_, i) => {
          const row: Record<string, number> = { i, theme: tc.theme[i] }
          for (const o of tc.overlay) row[o.ticker] = o.norm[i]
          return row
        })
        const tipFmt = ((v: any, n: string): [string, string] => [`${v}`, n === 'theme' ? '테마지수' : n]) as any
        return (
          <div style={{ background: '#0f1117', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 13 }}>📈 양자 테마 지수 &amp; 모멘텀</span>
              <span style={{ color: '#7f93a8', fontSize: 10 }}>퓨어플레이 동일가중 · 최근 {tc.len}주봉 · 로그스케일(시작=100)</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: pctCol(tc.fromPeak), fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>고점대비 {fmtPct(tc.fromPeak)}</span>
                <span style={{ color: '#f87171', fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>MDD {tc.mdd}%</span>
              </span>
            </div>
            <div style={{ color: '#6e7f8f', fontSize: 9.5, marginBottom: 6 }}>금색=테마 지수 · 색선=대장주 5종(IONQ·QBTS·RGTI·QUBT·우리로). 이익 없는 테마라 −70% 드로다운은 정상.</div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
                <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${tc.len - v}주전`} interval={Math.floor(tc.len / 6)} />
                <YAxis scale="log" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}`} width={40} />
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, fontSize: 11, padding: '6px 10px' }}
                  formatter={tipFmt} labelFormatter={(l => `${tc.len - (l as number)}주 전`)} />
                <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
                {tc.overlay.map(o => <Line key={o.ticker} type="monotone" dataKey={o.ticker} stroke={LINE_COLORS[o.ticker] ?? '#64748b'} strokeWidth={1.3} dot={false} opacity={0.75} />)}
                <Line type="monotone" dataKey="theme" stroke={LINE_COLORS.theme} strokeWidth={2.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {[['theme', '테마지수'], ...tc.overlay.map(o => [o.ticker, o.name] as [string, string])].map(([k, lab]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9aa7b4' }}>
                  <span style={{ width: 10, height: 3, background: LINE_COLORS[k] ?? '#64748b', borderRadius: 2 }} />{lab}
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ②-B 실적 발표 D-day (임박순) */}
      {(() => {
        const now = Date.now(), DAY = 86400000
        const list = d.stocks
          .filter(s => s.earningsTs != null && s.earningsTs > now - 2 * DAY)
          .sort((a, b) => (a.earningsTs as number) - (b.earningsTs as number))
          .slice(0, 12)
        if (!list.length) return null
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📅 실적 발표 D-day</span>
              <span style={{ color: '#7f93a8', fontSize: 10 }}>양자주는 실적 전후 변동성 극대 — 임박순 · D-7 이내 강조</span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {list.map(s => {
                const dd = Math.ceil(((s.earningsTs as number) - now) / DAY)
                const urgent = dd <= 7
                const date = new Date(s.earningsTs as number)
                const md = `${date.getMonth() + 1}/${date.getDate()}`
                return (
                  <div key={s.ticker} style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${urgent ? '#f59e0b66' : BORDER}`, padding: '7px 11px', minWidth: 96 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12 }}>{s.ticker}</span>
                      {s.purePlay && <span style={{ color: '#34d399', fontSize: 8 }}>퓨어</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
                      <span style={{ color: urgent ? '#fbbf24' : '#a78bfa', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{dd <= 0 ? '오늘·발표' : `D-${dd}`}</span>
                      <span style={{ color: '#7f93a8', fontSize: 9.5, fontFamily: 'monospace' }}>{md}</span>
                    </div>
                    <div style={{ fontSize: 9, color: pctCol(s.ret1w), fontFamily: 'monospace', marginTop: 1 }}>1주 {fmtPct(s.ret1w)}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ color: '#6e7f8f', fontSize: 9, marginTop: 6 }}>※ Yahoo 추정 실적일(US·해외) · 변동될 수 있음 · KR은 미제공.</div>
          </div>
        )
      })()}

      {/* ② 대장주 베타·상관 + 퓨어플레이 토글 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🧲 테마 동조화 — {d.anchor}(대장주) 베타·상관</span>
          <button onClick={() => setPureOnly(p => !p)}
            style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: pureOnly ? 'rgba(167,139,250,0.2)' : '#0f1117', color: pureOnly ? '#a78bfa' : '#8a9aaa', border: `1px solid ${pureOnly ? '#a78bfa66' : BORDER}` }}>
            {pureOnly ? '✓ 퓨어플레이만' : '전체 종목'}
          </button>
        </div>
        <div style={{ color: '#7f93a8', fontSize: 10, marginBottom: 8 }}>베타↑ = 테마에 더 레버리지(IONQ 1배 기준) · 상관↓ = 테마와 따로 노는 종목 · ⚠️ 비퓨어+저베타 = &lsquo;무늬만 양자&rsquo;</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
            <thead><tr style={{ color: '#7f93a8', fontSize: 10 }}>
              <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px' }}>종목</th>
              <th style={{ textAlign: 'center', fontWeight: 700, padding: '0 6px 7px' }}>모달리티</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1주</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1개월</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 56 }}>1년</th>
              <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px', width: 120 }}>베타(테마연동)</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 44 }}>상관</th>
            </tr></thead>
            <tbody>
              {stocks.map(s => <StockRow key={s.ticker} s={s} maxBeta={maxBeta} anchor={d.anchor} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* ③ 정책 촉매 바스켓 (모달리티별) + Pre-IPO proxy */}
      <div>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🇺🇸 미정부 양자 투자 바스켓 (모달리티별)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {d.policy.map((p, i) => (
            <div key={i} style={{ flex: '1 1 150px', minWidth: 145, background: '#0f1117', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '9px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5 }}>{p.name}</span>
                {p.listed && <span style={{ color: '#a78bfa', fontSize: 9.5, fontWeight: 700 }}>{p.listed}</span>}
              </div>
              <div style={{ color: '#34d399', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', margin: '2px 0' }}>{p.cap ? '최대 ' : ''}${p.usdM >= 1000 ? `${p.usdM / 1000}B` : `${p.usdM}M`}</div>
              <div style={{ color: '#7f93a8', fontSize: 9.5 }}>#{p.modality} · {p.structure}</div>
            </div>
          ))}
        </div>

        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🚀 Pre-IPO 비상장사 — 상장 대용주(proxy)로 노출</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {d.preIpo.map((p, i) => (
            <div key={i} style={{ flex: '1 1 230px', minWidth: 220, background: '#0f1117', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5 }}>{p.name}</span>
                <span style={{ background: 'rgba(167,139,250,0.14)', color: '#a78bfa', borderRadius: 5, padding: '0 6px', fontSize: 9.5, fontWeight: 700 }}>#{p.modality}</span>
                {p.govAwardUsdM && <span style={{ color: '#34d399', fontSize: 9.5, fontWeight: 700 }}>미정부 ${p.govAwardUsdM}M</span>}
              </div>
              <div style={{ color: '#9aa7b4', fontSize: 10, margin: '3px 0 5px' }}>{p.note}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ color: '#7f93a8', fontSize: 10 }}>대용주:</span>
                {p.proxy.map((px, j) => (
                  <span key={j} style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{px.ticker} · {px.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.6 }}>
        ※ 수익률·베타=주봉 기준(US Yahoo·KR 네이버) · 서브섹터=동일가중 평균(시총가중 아님, 테마 폭 측정) · 정부 Award·모달리티=공개자료 큐레이션(발표 시 갱신) · 비상장사는 직접 투자 불가, 대용주는 기술 노출 참고용 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}

function StockRow({ s, maxBeta, anchor }: { s: QStockOut; maxBeta: number; anchor: string }) {
  const fakeQuantum = !s.purePlay && (s.beta == null || s.beta < 0.5)
  const betaW = s.beta != null ? Math.min(100, Math.max(4, (s.beta / maxBeta) * 100)) : 0
  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td style={{ padding: '7px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11 }}>{QMARKET_FLAG[s.market]}</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12.5 }}>{s.name}</span>
          <span style={{ color: '#7f93a8', fontSize: 9.5 }}>{s.ticker}</span>
          {s.ticker === anchor && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>대장주</span>}
          {s.purePlay
            ? <span style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>퓨어</span>
            : <span style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>대형주</span>}
          {s.govAwardUsdM && <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>🇺🇸${s.govAwardUsdM >= 1000 ? `${s.govAwardUsdM / 1000}B` : `${s.govAwardUsdM}M`}</span>}
          {fakeQuantum && <span title="대형주 + 테마 연동 낮음(베타<0.5) — 양자 비중 미미 가능" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', borderRadius: 4, padding: '0 5px', fontSize: 8.5, fontWeight: 700 }}>⚠️무늬만</span>}
        </div>
        <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 1 }}>{s.note}</div>
      </td>
      <td style={{ textAlign: 'center', padding: '7px 6px', fontSize: 9.5, color: '#9aa7b4' }}>{s.modality.join('·') || '—'}</td>
      <td style={{ padding: '7px 6px' }}><Ret v={s.ret1w} /></td>
      <td style={{ padding: '7px 6px' }}><Ret v={s.ret1m} /></td>
      <td style={{ padding: '7px 6px' }}><Ret v={s.ret1y} /></td>
      <td style={{ padding: '7px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 7, background: '#0f1117', borderRadius: 4, overflow: 'hidden', minWidth: 50 }}>
            <div style={{ width: `${betaW}%`, height: '100%', background: s.beta != null && s.beta >= 1.5 ? '#a78bfa' : '#60a5fa', borderRadius: 4 }} />
          </div>
          <span style={{ color: s.beta != null && s.beta >= 1.5 ? '#a78bfa' : '#cbd5e1', fontWeight: 800, fontFamily: 'monospace', fontSize: 11.5, width: 30, textAlign: 'right' }}>{s.beta == null ? '—' : s.beta.toFixed(1)}</span>
        </div>
      </td>
      <td style={{ textAlign: 'right', padding: '7px 6px', fontFamily: 'monospace', fontSize: 11, color: s.corr == null ? '#8a9aaa' : Math.abs(s.corr) < 0.3 ? '#fbbf24' : '#9aa7b4' }}>{s.corr == null ? '—' : s.corr.toFixed(2)}</td>
    </tr>
  )
}
