'use client'
// 🛰️ 양자 테마 인텔리전스 — 서브섹터 히트맵 + 대장주(IONQ) 베타·상관 + 퓨어플레이 토글 + 정책/Pre-IPO
import { useState, useEffect } from 'react'
import type { QuantumSectorResult, QStockOut } from '@/app/api/quantum-sector/route'

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
