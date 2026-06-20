'use client'
// 🎯 의사결정 적중률 — 매수 시점 다신호 스냅샷 × 현재가로 '어떤 신호에서 산 결정이 맞았나'를 채점(calibration)
//  진단을 넘어 '내 판단 품질'을 데이터로. 신규 fetch 0(기존 거래+priceMap 재사용).
import { useMemo } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Tx { ticker: string; name: string; type: 'buy' | 'sell'; price: number; snapshot_data?: any }

const CARD = '#1b1e2e', SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'

// 신호 차원 정의 — 스냅샷 필드에서 거래를 버킷으로 분류
const DIMS: { dim: string; icon: string; of: (s: any) => string | null }[] = [   // eslint-disable-line @typescript-eslint/no-explicit-any
  { dim: '밸류에이션 (PEG)', icon: '💰', of: s => s?.peg == null ? null : s.peg < 1 ? '저PEG (<1·저평가)' : '고PEG (≥1)' },
  { dim: '수급', icon: '📡', of: s => ({ INFLOW: '유입', CROWDED: '이탈·과열', NEGLECTED: '소외', NEUTRAL: '중립' } as Record<string, string>)[s?.flow] ?? null },
  { dim: '계절 (거시 방향)', icon: '🌦️', of: s => ({ favored: '계절 유리', unfavored: '계절 불리', neutral: '계절 중립' } as Record<string, string>)[s?.seasonTag] ?? null },
  { dim: 'FOMC 기조', icon: '🏛️', of: s => ({ hawkish: '매파장에서 매수', dovish: '비둘기장에서 매수', neutral: '중립장에서 매수' } as Record<string, string>)[s?.fomcStance] ?? null },
]

export default function DecisionCalibration({ transactions, priceMap }: { transactions: Tx[]; priceMap: Record<string, number> }) {
  const { rows, overall, best, worst, n } = useMemo(() => {
    // 실제 신호가 담긴 매수만 채점 — 빈 {}·전부 null(과거 초기매수·가상 퀀트 티커)은 제외해
    //  '신호 기반 적중률'이 단순 보유 승률로 오염되지 않게(중요)
    const hasSignal = (s: any) => s && (s.peg != null || s.flow != null || s.seasonTag != null || s.fomcStance != null)   // eslint-disable-line @typescript-eslint/no-explicit-any
    const buys = transactions
      .filter(t => t.type === 'buy' && hasSignal(t.snapshot_data) && priceMap[t.ticker.toUpperCase()] > 0)
      .map(t => {
        const s = t.snapshot_data
        const entry = (typeof s.price_at_record === 'number' && s.price_at_record > 0) ? s.price_at_record : t.price
        const cur = priceMap[t.ticker.toUpperCase()]
        const ret = entry > 0 ? (cur - entry) / entry : 0
        return { s, ret, win: ret > 0 }
      })

    const overall = buys.length ? { n: buys.length, win: buys.filter(b => b.win).length, avg: buys.reduce((a, b) => a + b.ret, 0) / buys.length } : null

    // 차원별 버킷 집계
    type Agg = { dim: string; icon: string; buckets: { label: string; n: number; winRate: number; avgRet: number }[] }
    const rows: Agg[] = []
    const flat: { label: string; n: number; winRate: number }[] = []
    for (const D of DIMS) {
      const map = new Map<string, { n: number; win: number; ret: number }>()
      for (const b of buys) {
        const lab = D.of(b.s); if (!lab) continue
        const m = map.get(lab) ?? { n: 0, win: 0, ret: 0 }
        m.n++; if (b.win) m.win++; m.ret += b.ret; map.set(lab, m)
      }
      if (!map.size) continue
      const buckets = Array.from(map.entries()).map(([label, m]) => ({ label, n: m.n, winRate: Math.round((m.win / m.n) * 100), avgRet: Math.round((m.ret / m.n) * 1000) / 10 }))
        .sort((a, b) => b.winRate - a.winRate)
      rows.push({ dim: D.dim, icon: D.icon, buckets })
      for (const bk of buckets) if (bk.n >= 2) flat.push({ label: `${D.icon} ${bk.label}`, n: bk.n, winRate: bk.winRate })
    }
    const ranked = flat.sort((a, b) => b.winRate - a.winRate)
    return { rows, overall, best: ranked[0] ?? null, worst: ranked.length > 1 ? ranked[ranked.length - 1] : null, n: buys.length }
  }, [transactions, priceMap])

  if (n === 0) return (
    <div style={{ background: CARD, boxShadow: SHO, borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>🎯</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#dde4f0', marginBottom: 8 }}>신호가 박제된 매수가 아직 없습니다</div>
      <div style={{ fontSize: 12.5, color: '#8b92b8', lineHeight: 1.8, maxWidth: 480, margin: '0 auto' }}>
        이제부터 종목을 매수하면 그 순간의 <b style={{ color: '#a5b4fc' }}>PEG·수급·계절·FOMC 신호</b>가 자동 박제됩니다.<br />
        거래가 쌓이면 &quot;어떤 신호에서 산 결정이 맞았나&quot;를 적중률로 채점해 드립니다.
        <br /><span style={{ fontSize: 11, color: '#9aa0b8' }}>※ 다신호 스냅샷 도입(2026-06-19) <b>이후 매수</b>부터 집계됩니다. 과거 거래는 신호가 기록돼 있지 않아(단순 보유 승률과 구분) 제외됩니다.</span>
      </div>
    </div>
  )

  const wColor = (w: number) => w >= 60 ? '#34d399' : w >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 전체 적중률 */}
      {overall && (
        <div style={{ background: CARD, boxShadow: SHO, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#9aa0b8', fontSize: 11, marginBottom: 2 }}>내 매수 결정 적중률 ({overall.n}건)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: wColor(Math.round(overall.win / overall.n * 100)), fontWeight: 900, fontSize: 30, fontFamily: 'monospace' }}>{Math.round(overall.win / overall.n * 100)}%</span>
              <span style={{ color: '#8b92b8', fontSize: 12 }}>{overall.win}/{overall.n} 수익 · 평균 <b style={{ color: overall.avg >= 0 ? '#34d399' : '#f87171' }}>{overall.avg >= 0 ? '+' : ''}{Math.round(overall.avg * 1000) / 10}%</b></span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {best && <div style={{ background: '#0e2a1e', border: '1px solid #34d39955', borderRadius: 10, padding: '7px 12px' }}>
              <div style={{ color: '#34d399', fontSize: 10, fontWeight: 700 }}>💪 내 강점</div>
              <div style={{ color: '#dde4f0', fontSize: 12, fontWeight: 700 }}>{best.label} <span style={{ color: '#34d399' }}>{best.winRate}%</span></div>
            </div>}
            {worst && <div style={{ background: '#2a0e14', border: '1px solid #f8717155', borderRadius: 10, padding: '7px 12px' }}>
              <div style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }}>⚠️ 내 약점</div>
              <div style={{ color: '#dde4f0', fontSize: 12, fontWeight: 700 }}>{worst.label} <span style={{ color: '#f87171' }}>{worst.winRate}%</span></div>
            </div>}
          </div>
        </div>
      )}

      {/* 차원별 적중률 */}
      {rows.map(r => (
        <div key={r.dim} style={{ background: CARD, boxShadow: SHO, borderRadius: 14, padding: '13px 18px' }}>
          <div style={{ color: '#dde4f0', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{r.icon} {r.dim}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {r.buckets.map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#c4cae0', fontSize: 12, minWidth: 130 }}>{b.label}</span>
                <span style={{ color: '#8b92b8', fontSize: 10.5, minWidth: 32 }}>{b.n}건</span>
                <div style={{ flex: 1, height: 14, background: '#0e1020', borderRadius: 7, overflow: 'hidden', minWidth: 80 }}>
                  <div style={{ width: `${b.winRate}%`, height: '100%', background: wColor(b.winRate), borderRadius: 7 }} />
                </div>
                <span style={{ color: wColor(b.winRate), fontWeight: 800, fontSize: 12, fontFamily: 'monospace', minWidth: 38, textAlign: 'right' }}>{b.winRate}%</span>
                <span style={{ color: b.avgRet >= 0 ? '#34d399' : '#f87171', fontSize: 11, fontFamily: 'monospace', minWidth: 50, textAlign: 'right' }}>{b.avgRet >= 0 ? '+' : ''}{b.avgRet}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 매수 시점 신호 스냅샷 × 현재가로 채점 — 표본이 적을수록(특히 2~3건) 통계적 신뢰도는 낮습니다. 운과 실력을 분리해 &apos;내 의사결정 패턴&apos;을 보는 교육용 지표입니다.
      </div>
    </div>
  )
}
