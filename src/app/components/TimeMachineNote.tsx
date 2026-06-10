'use client'

/**
 * TimeMachineNote — 👻 타임머신 복기 노트 (비밀병기 2단계)
 *
 * 매도 당시 자동 보존된 블랙박스 스냅샷(PEG·성장률·분류)과
 * 현재 주가를 비교하여 매도 타이밍을 복기하고 기회비용을 시각화한다.
 *
 * 데이터: transactions(type='sell' + snapshot_data) + priceMap(실시간 현재가)
 */

import { useMemo } from 'react'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface SnapshotData {
  peg?:          number | null
  growth_rate?:  number | null
  category?:     string | null
  price_at_record?: number | null
  recorded_at?:  string | null
}

interface SoldTransaction {
  id:               string
  ticker:           string
  name?:            string
  currency:         'USD' | 'KRW'
  price:            number   // 매도 단가
  quantity:         number
  transaction_date: string
  realized_pnl?:    number | null
  snapshot_data?:   SnapshotData | null
}

interface Props {
  sellHistory: SoldTransaction[]
  priceMap:    Record<string, number>   // 키: ticker.toUpperCase()
}

const LYNCH_KR: Record<string, string> = {
  slow_grower: '저성장주', stalwart: '대형 우량주', fast_grower: '빠른 성장주',
  cyclical: '경기 순환주', turnaround: '회생주', asset_play: '자산 보유주', na: '해당없음',
}

const N = '#1b1e2e'

export default function TimeMachineNote({ sellHistory, priceMap }: Props) {
  // 스냅샷이 있는 매도만 (블랙박스 기록된 거래)
  const records = useMemo(
    () => sellHistory.filter(tx => tx.snapshot_data && (tx.snapshot_data.peg != null || tx.snapshot_data.category)),
    [sellHistory]
  )

  // ── 팩트 폭행 코멘트 생성기 ──────────────────────────────────────────────────
  const factBomb = (snap: SnapshotData | null | undefined, missed: boolean): string => {
    const peg = snap?.peg
    if (peg == null) return '당시 기록된 PEG 지표가 없어 정밀 복기는 어렵지만, 분류·성장률 기록은 보존되어 있습니다.'
    if (missed && peg < 1.0)
      return `[뼈 아픈 실책] 매도 당시 PEG ${peg.toFixed(2)}로 저평가 구간이었습니다. 가치의 열매가 맺히기 전에 섣부른 매도로 큰 수익을 놓쳤습니다.`
    if (!missed && peg > 1.5)
      return `[나이스 타이밍] 당시 PEG ${peg.toFixed(2)}로 상당한 고평가(버블) 구간이었습니다. 욕심을 버리고 기막힌 타이밍에 매도하여 하락을 방어해냈습니다!`
    if (missed && peg > 1.5)
      return `[결과론적 아쉬움] 팔고 나서 더 올랐지만, 당시 PEG ${peg.toFixed(2)}로 꽤 고평가였습니다. 원칙을 지킨 매도였으니 너무 배아파하지 마세요.`
    if (!missed && peg < 1.0)
      return `[저평가에 매도] 당시 PEG ${peg.toFixed(2)}로 저평가였지만 결과적으로 하락을 피했습니다. 운이 따른 매도일 수 있으니 다음엔 가치 판단을 더 신뢰하세요.`
    return `당시 PEG ${peg.toFixed(2)} 기준, 무난한 비중 조절 성격의 매도였습니다.`
  }

  if (records.length === 0) return null

  // 통화 포맷
  const fmt = (n: number, cur: 'USD' | 'KRW') =>
    cur === 'KRW' ? `₩${Math.round(n).toLocaleString('ko-KR')}`
                  : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ background: N, boxShadow: '7px 7px 18px #0e1020, -4px -4px 12px #282c44', borderRadius: 14, padding: '20px 22px',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>👻</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#dde4f0' }}>타임머신 복기 노트</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', fontWeight: 700 }}>SECRET</span>
        </div>
        <div style={{ fontSize: 12, color: '#9aa0b8', marginTop: 4 }}>
          매도 당시 블랙박스 스냅샷(지표)과 현재 주가를 비교하여 매도 타이밍을 복기합니다 · {records.length}건
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {records.map(tx => {
          const cur     = tx.currency
          const nowPrice = priceMap[tx.ticker.toUpperCase()] ?? tx.price
          const diff    = nowPrice - tx.price
          const missed  = diff > 0                          // 팔고 올랐으면 기회비용
          const cost    = Math.abs(diff * tx.quantity)
          const diffPct = tx.price > 0 ? (diff / tx.price) * 100 : 0
          const accent  = missed ? '#f87171' : '#34d399'
          const snap    = tx.snapshot_data

          return (
            <div key={tx.id} style={{
              background: '#0a0e1a', boxShadow: 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44',
              borderRadius: 12, padding: '16px 18px',
            }}>
              {/* 상단: 결과 요약 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#dde4f0' }}>{tx.name || tx.ticker}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#8b92b8', background: '#1b1e2e', padding: '2px 8px', borderRadius: 5 }}>
                      {tx.transaction_date.split('T')[0]} 매도
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9aa0b8', marginTop: 5, fontFamily: 'monospace' }}>
                    매도가 {fmt(tx.price, cur)} → 현재가 <span style={{ color: accent, fontWeight: 700 }}>{fmt(nowPrice, cur)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 13, fontWeight: 800, color: accent }}>
                    {missed ? '📈 기회비용 발생' : '🛡 하락 방어 성공'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginTop: 3, fontFamily: 'monospace' }}>
                    {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, color: '#9aa0b8', marginTop: 1 }}>
                    {missed ? '놓친 수익' : '방어한 손실'} {fmt(cost, cur)}
                  </div>
                </div>
              </div>

              {/* 하단: 블랙박스 스냅샷 + AI 코멘트 */}
              <div style={{ background: N, borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>📸</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#a5b4fc' }}>매도 당시 블랙박스 스냅샷</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9aa0b8', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span>분류 <strong style={{ color: '#dde4f0' }}>{snap?.category ? (LYNCH_KR[snap.category] ?? snap.category) : '—'}</strong></span>
                  <span>당시 PEG <strong style={{ color: snap?.peg != null ? (snap.peg < 1 ? '#34d399' : '#f87171') : '#9aa0b8' }}>{snap?.peg != null ? snap.peg.toFixed(2) : '—'}</strong></span>
                  <span>예상성장률 <strong style={{ color: '#fbbf24' }}>{snap?.growth_rate != null ? `${snap.growth_rate.toFixed(1)}%` : '—'}</strong></span>
                </div>
                <div style={{ fontSize: 12, color: '#b8c0d8', lineHeight: 1.7, borderLeft: '2px solid #6366f1', paddingLeft: 12, fontStyle: 'italic' }}>
                  &ldquo;{factBomb(snap, missed)}&rdquo;
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: '#7a8599', lineHeight: 1.6 }}>
        ℹ️ 매도 시점에 자동 보존된 PEG·성장률 스냅샷 기준입니다. 스냅샷 도입(2026-05-31) 이전 매도는 표시되지 않습니다.
      </div>
    </div>
  )
}
