'use client'
// 💰 현금 포지션 카드 — 예수금·CMA를 등록해 실제 현금 비중을 막스 권장 밴드와 비교(자산 관리 상단)
//    앱이 알아낼 수 없는 유일한 자산이라 직접 입력. ⛔ 현금 조절 지시 아님 — 밴드 대비 위치 관측만.
import { useEffect, useState, useCallback } from 'react'
import { TK } from '@/lib/theme'
import type { CashPosition } from '@/lib/cashPosition'

type Api = Partial<CashPosition> & { needsSetup?: boolean; asOf?: string; error?: string }

const won = (n: number) => n >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString()}만` : `${Math.round(n).toLocaleString()}`

const VERDICT: Record<NonNullable<CashPosition['verdict']>, { label: string; color: string; note: string }> = {
  aggressive: { label: '권장보다 적음(공격적)', color: TK.amber400, note: '현금이 권장 밴드보다 적습니다 — 조정 시 살 실탄이 부족할 수 있습니다(현금을 늘리라는 지시가 아니라 위치 관측입니다).' },
  inband: { label: '권장 밴드 안', color: TK.green400, note: '현재 사이클 위치에 맞는 현금 수준입니다.' },
  defensive: { label: '권장보다 많음(보수적)', color: TK.sky400, note: '현금이 권장 밴드보다 많습니다 — 기회 비용을 감수하는 방어적 포지션입니다.' },
}

export default function CashPositionCard() {
  const [d, setD] = useState<Api | null>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const [krw, setKrw] = useState('')
  const [usd, setUsd] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/cash-position').then(r => r.ok ? r.json() : null)
      .then((j: Api | null) => {
        setD(j?.error ? null : j)
        if (j && !j.needsSetup) { setKrw(String(j.krw ?? 0)); setUsd(String(j.usd ?? 0)); setMemo(j.memo ?? '') }
      })
      .catch(() => setD(null))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/cash-position', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ krw: Number(krw.replace(/,/g, '')) || 0, usd: Number(usd.replace(/,/g, '')) || 0, memo }),
      })
      if (r.ok) { setEdit(false); load() }
    } finally { setSaving(false) }
  }

  if (loading) return null
  if (!d) return null

  if (d.needsSetup) return (
    <div style={{ background: '#12151f', border: `1px solid ${TK.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 11.5, color: TK.sub2 }}>
      💰 현금 등록 기능이 준비되지 않았습니다 — 관리자가 <code style={{ color: TK.slate300 }}>supabase/user_cash.sql</code>을 1회 실행하면 활성화됩니다.
    </div>
  )

  const has = (d.cashKrw ?? 0) > 0
  const v = d.verdict ? VERDICT[d.verdict] : null
  const pct = d.cashPct ?? 0
  const band = d.band

  return (
    <div style={{ background: '#12151f', border: `1px solid ${TK.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: TK.slate100 }}>💰 현금 포지션</span>
        <span style={{ fontSize: 11, color: TK.sub2 }}>예수금·CMA·파킹통장 — 막스 권장 밴드와 비교</span>
        <button onClick={() => setEdit(e => !e)} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: TK.indigo400, background: 'none', border: `1px solid ${TK.border}`, borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}>
          {edit ? '취소' : has ? '수정' : '현금 등록'}
        </button>
      </div>

      {edit ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <label style={{ fontSize: 11, color: TK.sub2 }}>원화 ₩
            <input value={krw} onChange={e => setKrw(e.target.value)} inputMode="numeric" placeholder="0"
              style={{ marginLeft: 6, width: 130, background: TK.bg3, border: `1px solid ${TK.border}`, borderRadius: 6, padding: '5px 8px', color: TK.slate100, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 11, color: TK.sub2 }}>달러 $
            <input value={usd} onChange={e => setUsd(e.target.value)} inputMode="decimal" placeholder="0"
              style={{ marginLeft: 6, width: 100, background: TK.bg3, border: `1px solid ${TK.border}`, borderRadius: 6, padding: '5px 8px', color: TK.slate100, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 11, color: TK.sub2 }}>메모
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 증권사 예수금+파킹통장"
              style={{ marginLeft: 6, width: 190, background: TK.bg3, border: `1px solid ${TK.border}`, borderRadius: 6, padding: '5px 8px', color: TK.slate100, fontSize: 12 }} />
          </label>
          <button onClick={save} disabled={saving} style={{ fontSize: 11.5, fontWeight: 800, color: TK.bg0, background: TK.green400, border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      ) : !has ? (
        <div style={{ fontSize: 11.5, color: TK.sub2, marginTop: 8, lineHeight: 1.6 }}>
          아직 등록된 현금이 없습니다. 증권사 예수금·CMA·파킹통장 잔고를 넣으면 <b style={{ color: TK.slate300 }}>내 실제 현금 비중</b>이 계산되어 막스 시계추의 권장 밴드와 비교됩니다.
          <br />앱은 계좌에 접속하지 않으므로 현금만은 직접 입력해야 합니다(자동 연동 없음).
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: v?.color ?? TK.slate100 }}>{pct}%</span>
            <span style={{ fontSize: 11.5, color: TK.sub2 }}>현금 비중</span>
            {band && <span style={{ fontSize: 11, color: TK.sub2 }}>· 권장 <b style={{ color: TK.violet300 }}>{band.min}~{band.max}%</b>{d.temp != null && <span style={{ color: TK.sub3 }}> (탐욕 온도 {d.temp})</span>}</span>}
            {v && <span style={{ fontSize: 11, fontWeight: 800, color: v.color, background: `${v.color}18`, borderRadius: 6, padding: '2px 8px' }}>{v.label}</span>}
          </div>

          {/* 비중 바 + 권장 밴드 구간 */}
          <div style={{ position: 'relative', height: 12, background: TK.bg3, borderRadius: 6, marginTop: 10, overflow: 'hidden' }}>
            {band && <div style={{ position: 'absolute', left: `${band.min}%`, width: `${Math.max(1, band.max - band.min)}%`, top: 0, bottom: 0, background: `${TK.violet300}44` }} />}
            <div style={{ position: 'absolute', left: 0, width: `${Math.min(100, pct)}%`, top: 0, bottom: 0, background: v?.color ?? TK.slate300, opacity: 0.85 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: TK.sub3, marginTop: 2 }}>
            <span>0%</span><span>보라 구간 = 지금 국면의 권장 현금 밴드</span><span>100%</span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Chip label="현금" value={`₩${won(d.cashKrw ?? 0)}`} />
            {(d.usd ?? 0) > 0 && <Chip label="(달러분)" value={`$${(d.usd ?? 0).toLocaleString()}`} />}
            <Chip label="투자 자산" value={`₩${won(d.assetKrw ?? 0)}`} />
            <Chip label="총자산" value={`₩${won(d.totalKrw ?? 0)}`} color={TK.slate100} />
          </div>

          {v && <div style={{ fontSize: 11.5, color: TK.sub2, marginTop: 8, lineHeight: 1.55 }}>{v.note}</div>}

          <div style={{ fontSize: 9.5, color: TK.sub3, marginTop: 8, lineHeight: 1.5 }}>
            내가 입력한 값 기준(자동 연동 없음{d.updatedAt ? ` · 갱신 ${String(d.updatedAt).slice(0, 10)}` : ''}){d.memo ? ` · ${d.memo}` : ''} · 환율 ₩{Math.round(d.usdKrw ?? 0).toLocaleString()}
            {(d.costFallback ?? 0) > 0 && ` · 시세 미수신 ${d.costFallback}종은 매입가로 평가`}
            <br />부동산·연금 등 앱에 없는 자산은 포함되지 않습니다 · 권장 밴드는 사이클 위치 가이드이며 강제가 아닙니다.
          </div>
        </>
      )}
    </div>
  )
}

const Chip = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <span style={{ fontSize: 10.5, background: '#1b2130', borderRadius: 6, padding: '3px 8px', color: TK.sub2 }}>
    {label} <b style={{ color: color ?? TK.slate300 }}>{value}</b>
  </span>
)
