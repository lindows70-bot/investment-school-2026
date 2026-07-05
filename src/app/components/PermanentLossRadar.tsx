'use client'
// 🛡️ 막스 리스크 재정의 — 내 종목: 견뎌야 할 변동성 vs 잘라야 할 영구손실 (막스 페이지 하단)
import { useEffect, useState } from 'react'
import type { PermanentLossResult, LossEntry } from '@/app/api/permanent-loss/route'

const BORDER = '#2a2f3a'

export default function PermanentLossRadar() {
  const [data, setData] = useState<PermanentLossResult | null>(null)
  const [state, setState] = useState<'loading' | 'guest' | 'ready' | 'empty'>('loading')

  useEffect(() => {
    fetch('/api/permanent-loss')
      .then(r => r.status === 401 ? { guest: true } : r.json())
      .then(j => {
        if (j.guest) { setState('guest'); return }
        setData(j); setState((j.entries?.length ?? 0) === 0 ? 'empty' : 'ready')
      })
      .catch(() => setState('empty'))
  }, [])

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: 'linear-gradient(135deg,#141824,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>🛡️ 리스크 재정의 — 내 종목: 변동성 vs 영구손실</div>
      <div style={{ fontSize: 11.5, color: '#8599ae', marginTop: 4, lineHeight: 1.5 }}>
        막스: <b style={{ color: '#cbd5e1' }}>리스크 = 가격 변동성이 아니라 영구적 원금 손실.</b> 무서워서 투매하면 손실을 확정한다.
        펀더멘탈이 멀쩡한 하락은 <b style={{ color: '#22c55e' }}>견디는 것</b>, thesis가 훼손된 하락은 <b style={{ color: '#ef4444' }}>잘라내는 것</b>.
      </div>
      {children}
    </div>
  )

  if (state === 'loading') return <Wrap><div style={{ color: '#8599ae', fontSize: 12, marginTop: 12 }}>내 종목 리스크 분류 중…</div></Wrap>
  if (state === 'guest') return <Wrap><div style={{ color: '#8599ae', fontSize: 12, marginTop: 12 }}>🔒 로그인하면 내 보유 종목을 &lsquo;견뎌야 할 변동성&rsquo;과 &lsquo;잘라야 할 영구손실&rsquo;로 분류해 드립니다.</div></Wrap>
  if (state === 'empty' || !data) return <Wrap><div style={{ color: '#8599ae', fontSize: 12, marginTop: 12 }}>분류할 개별 주식 보유가 없습니다(ETF·코인 제외).</div></Wrap>

  const permanent = data.entries.filter(e => e.category === 'permanent')
  const volatility = data.entries.filter(e => e.category === 'volatility')

  const Card = (e: LossEntry) => (
    <div key={e.ticker} style={{ background: '#0f1117', borderRadius: 8, padding: '9px 11px', borderLeft: `3px solid ${e.category === 'permanent' ? '#ef4444' : '#22c55e'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12.5 }}>{e.market === 'KR' ? e.name.slice(0, 12) : e.ticker}</span>
        {e.priceTrend === 'down' && <span style={{ fontSize: 9.5, color: '#f59e0b', fontWeight: 700 }}>🔻 하락 중</span>}
      </div>
      {e.reasons.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {e.reasons.map((r, i) => <span key={i} style={{ fontSize: 10, color: '#fca5a5', background: '#3f1d1d', borderRadius: 4, padding: '1px 6px' }}>{r}</span>)}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.45 }}>{e.note}</div>
    </div>
  )

  return (
    <Wrap>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {/* 잘라야 할 영구손실 */}
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ef4444', marginBottom: 7 }}>🔴 잘라야 할 영구손실 <span style={{ color: '#8599ae', fontWeight: 600 }}>({permanent.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {permanent.length ? permanent.map(Card) : <div style={{ fontSize: 11, color: '#6e7f8f', padding: '8px 0' }}>✓ thesis 훼손 종목 없음 — 펀더멘탈 기준 영구손실 위험 신호 없음.</div>}
          </div>
        </div>
        {/* 견뎌야 할 변동성 */}
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#22c55e', marginBottom: 7 }}>🟢 견뎌야 할 변동성 <span style={{ color: '#8599ae', fontWeight: 600 }}>({volatility.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {volatility.length ? volatility.map(Card) : <div style={{ fontSize: 11, color: '#6e7f8f', padding: '8px 0' }}>해당 종목 없음.</div>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#6e7f8f', marginTop: 10 }}>
        영구손실 신호 = 적자·FCF적자·좀비·해자붕괴·ROE부풀림·재고적체(펀더멘탈 훼손). 이 신호가 없으면 하락은 변동성(노이즈)이지 리스크가 아니다. · 교육용, 투자 추천 아님.
      </div>
    </Wrap>
  )
}
