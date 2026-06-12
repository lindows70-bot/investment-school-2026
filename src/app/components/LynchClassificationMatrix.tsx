'use client'
// 🧬 피터 린치 7대 종목 분류 Matrix & 함정 레이더 — 진단 탭 시각화(도넛 + 인터랙티브 분포표 + 기저효과 경고)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { LynchMatrixResult } from '@/app/api/lynch-matrix/route'

const CARD = '#161b25', BORDER = '#1e293b'

// 카테고리별 고정 색(7대) — 어느 화면에서든 동일 색 = 동일 카테고리
const CAT_COLOR: Record<string, string> = {
  fast_grower: '#4ade80',   // 고성장주 — 초록
  stalwart:    '#60a5fa',   // 대형우량주 — 파랑
  slow_grower: '#94a3b8',   // 저성장주 — 회색
  cyclical:    '#fb923c',   // 경기순환주 — 주황
  turnaround:  '#a78bfa',   // 턴어라운드주 — 보라
  asset_play:  '#fbbf24',   // 자산주 — 노랑
  na:          '#475569',   // 미분류 — 어두운 회색
}
const CAT_DESC: Record<string, string> = {
  fast_grower: '이익 20%+ 성장 — 린치의 10루타 후보. 단, PEG 2 초과면 비싸게 산 것',
  stalwart:    '10~20% 안정 성장 대형주 — 30~50% 수익 후 교체가 린치 방식',
  slow_grower: '성장 한 자릿수 — 배당이 핵심. 시세차익 기대는 금물',
  cyclical:    '경기 사이클 따라 이익이 출렁 — PER가 낮아 보일 때가 오히려 고점 위험',
  turnaround:  '실적 붕괴 후 회복 베팅 — 성공 시 크지만 회생 실패 리스크 동반',
  asset_play:  '숨은 자산(부동산·현금·지분) 대비 저평가 — 시장이 가치를 알아챌 때까지 인내',
  na:          '분류 정보 부족 — 자산 추가 시 린치 카테고리를 지정하면 진단 해상도가 올라갑니다',
}

export default function LynchClassificationMatrix() {
  const [d, setD] = useState<LynchMatrixResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [openTrap, setOpenTrap] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/lynch-matrix', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
        .catch(() => { if (alive) setD(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🧬 피터 린치 분류 매트릭스를 그리는 중…</div>
  if (!d || d.totalStocks === 0) return null   // 주식 미보유면 자동 숨김

  const pieData = d.categories.map(c => ({ name: c.label, key: c.key, value: c.weightPct }))

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🧬 피터 린치 7대 분류 Matrix</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>한 종목 = 단 하나의 정체성(상호배타 분류) · 주식 {d.totalStocks}종목</span>
      </div>

      {/* ⚠️ 함정 레이더 — 기저효과 저PEG(린치의 경기순환주 경고). 해당 없으면 미표시 */}
      {d.traps.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444455', borderRadius: 9, padding: '9px 12px', marginBottom: 10 }}>
          <div style={{ color: '#fca5a5', fontWeight: 800, fontSize: 11.5, marginBottom: 5 }}>🚨 함정 레이더 — 린치의 경고: 고점 매수 위험 (기저효과 저PEG)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.traps.map(t => (
              <button key={t.ticker} onClick={() => setOpenTrap(o => o === t.ticker ? null : t.ticker)}
                style={{ background: '#0f1117', border: '1px solid #ef444466', borderRadius: 6, padding: '3px 9px', fontSize: 10.5, color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}>
                ⚠️ {t.name} <span style={{ color: '#8a9aaa', fontWeight: 400 }}>{t.categoryLabel} · PEG {t.peg ?? '—'} · 성장 +{t.growthPct}%</span>
              </button>
            ))}
          </div>
          {openTrap && (() => {
            const t = d.traps.find(x => x.ticker === openTrap)
            return t ? (
              <div style={{ marginTop: 8, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 12px', color: '#dbe3ec', fontSize: 11, lineHeight: 1.7 }}>
                🎓 <b style={{ color: '#fbbf24' }}>왜 이 낮은 PEG를 믿으면 안 되나요?</b> — {t.reason}
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* 도넛 + 분포표 (좌우 배치, 좁으면 세로 랩) */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '0 1 200px', minWidth: 180, height: 190, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0}
                onClick={(_: unknown, idx: number) => { const k = pieData[idx]?.key; if (k) setOpenCat(o => o === k ? null : k) }}>
                {pieData.map(p => <Cell key={p.key} fill={CAT_COLOR[p.key] ?? '#475569'} cursor="pointer" />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={v => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ color: '#8a9aaa', fontSize: 9.5 }}>최대 비중</span>
            <span style={{ color: CAT_COLOR[d.categories[0]?.key] ?? '#e2e8f0', fontWeight: 800, fontSize: 12 }}>{d.categories[0]?.label}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 900, fontSize: 15, fontFamily: 'monospace' }}>{d.categories[0]?.weightPct}%</span>
          </div>
        </div>

        {/* 카테고리 분포표 — 클릭 시 종목 리스트 펼침 */}
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {d.categories.map(c => {
            const col = CAT_COLOR[c.key] ?? '#475569'
            const open = openCat === c.key
            return (
              <div key={c.key}>
                <button onClick={() => setOpenCat(o => o === c.key ? null : c.key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: open ? `${col}14` : '#0f1117', border: `1px solid ${open ? col + '66' : BORDER}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11.5 }}>{c.label}</span>
                  <span style={{ color: '#8a9aaa', fontSize: 10 }}>{c.items.length}종목</span>
                  {c.items.some(x => x.trap) && <span style={{ color: '#f87171', fontSize: 10 }}>⚠️</span>}
                  <span style={{ marginLeft: 'auto', color: col, fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{c.weightPct}%</span>
                  <span style={{ color: '#6e7f8f', fontSize: 9 }}>{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div style={{ margin: '4px 0 2px', padding: '7px 10px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                    <div style={{ color: '#9aa7b5', fontSize: 10, lineHeight: 1.55, marginBottom: 6 }}>{CAT_DESC[c.key]}</div>
                    {c.items.map(it => (
                      <div key={it.ticker} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: 10.5, borderTop: `1px solid ${BORDER}` }}>
                        <span>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
                        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{it.name}</span>
                        {it.trap && <span style={{ color: '#f87171', fontWeight: 700 }}>⚠️ 기저효과</span>}
                        {it.source === 'user' && <span style={{ color: '#6e7f8f', fontSize: 9 }}>내 지정</span>}
                        <span style={{ marginLeft: 'auto', color: '#8a9aaa' }}>PEG {it.peg ?? '—'} · 성장 {it.growthPct != null ? `${it.growthPct > 0 ? '+' : ''}${it.growthPct}%` : '—'}</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 700, fontFamily: 'monospace' }}>{it.weightPct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
        ※ 분류 우선순위: 내가 지정한 카테고리 &gt; 펀더멘탈 자동 분류(성장률·섹터) · 한 종목은 단 1개 카테고리에만 속합니다(MECE) ·
        함정 레이더는 섹터 피어 X-Ray와 동일한 기저효과 기준(PEG&lt;0.3 & 성장+100%↑)을 사용합니다 · 교육용.
      </div>
    </div>
  )
}
