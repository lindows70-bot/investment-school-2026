'use client'
// 🚨 DART 희석 경보 배너 — 보유 KR 종목의 유상증자·CB·BW·EB·감자 공시(180일)를 대시보드 상단에.
//    경보 없으면 렌더 0(조용). 칩 클릭 = DART 원문. ⛔ 매도 지시 아님(용도·규모는 원문 확인 — 성장 투자용 증자도 있음).
import { useEffect, useState } from 'react'
import type { DilutionResult, DilutionAlert } from '@/app/api/dilution-alert/route'
import { TK } from '@/lib/theme'

const TYPE_META: Record<DilutionAlert['type'], { color: string; hint: string }> = {
  '유상증자': { color: TK.red400, hint: '신주 발행 = 기존 주주 지분 희석(주주배정/3자배정 성격·용도는 원문 확인)' },
  'CB': { color: TK.orange400, hint: '전환사채 — 주식 전환 시 잠재 물량(오버행)' },
  'BW': { color: TK.orange400, hint: '신주인수권부사채 — 행사 시 잠재 물량(오버행)' },
  'EB': { color: TK.orange400, hint: '교환사채 — 교환 시 잠재 물량' },
  '감자': { color: TK.amber400, hint: '감자 — 유상(주주환원)/무상(결손 보전) 구분을 원문에서 확인' },
}

export default function DilutionAlertBanner() {
  const [data, setData] = useState<DilutionResult | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/dilution-alert').then(r => r.ok ? r.json() : null).then(j => { if (j?.alerts?.length) setData(j) }).catch(() => {})
  }, [])

  if (!data?.alerts.length || dismissed) return null
  const hasRecent = data.alerts.some(a => a.recent)

  return (
    <div style={{ background: `linear-gradient(135deg,#2a1215,${TK.bg1})`, border: `1px solid ${TK.red400}55`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.red400 }}>🚨 희석 경보</span>
      <span style={{ fontSize: 10.5, color: TK.sub4 }}>보유 종목 DART 공시(180일) — 유상증자·주식관련사채·감자</span>
      {data.alerts.slice(0, 6).map((a, i) => {
        const m = TYPE_META[a.type]
        return (
          <a key={a.rcpNo + i} href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${a.rcpNo}`} target="_blank" rel="noreferrer"
            title={`${a.title} · ${m.hint} · 클릭=DART 원문`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#7f1d1d22', border: `1px solid ${m.color}55`, borderRadius: 7, padding: '3px 9px', fontSize: 11, whiteSpace: 'nowrap', textDecoration: 'none' }}>
            {a.recent && <b style={{ color: TK.red400, fontSize: 9.5 }}>NEW</b>}
            <b style={{ color: m.color, fontSize: 10 }}>{a.type}</b>
            <b style={{ color: TK.slate200 }}>{a.name}</b>
            <span style={{ color: TK.sub2, fontSize: 9.5, fontFamily: 'monospace' }}>{a.date.slice(5)}</span>
            <span style={{ color: TK.sub4, fontSize: 9.5 }}>원문↗</span>
          </a>
        )
      })}
      <span style={{ fontSize: 10, color: TK.sub2 }}>{hasRecent ? '30일 내 공시 포함 — ' : ''}매도 지시 아님 · 용도·규모는 원문 확인</span>
      <button onClick={() => setDismissed(true)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TK.sub, cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}
