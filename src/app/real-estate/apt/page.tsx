'use client'
// 🔍 아파트 단지 리서치 — 부동산 Phase 3(실거래 추이 + 밸류 3축: 전세가율·고점대비·지역 국면). ?lawd= 딥링크 지원(2040 서울플랜 중심지 연결)
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AptResearch from '@/app/components/AptResearch'
import { TK } from '@/lib/theme'

function AptResearchWithParams() {
  const sp = useSearchParams()
  return <AptResearch initialLawd={sp.get('lawd') ?? undefined} />
}

export default function AptResearchPage() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg,#1a1410,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>🔍 아파트 단지 리서치</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55 }}>
          주식의 종목 리서치처럼 — 단지별 <b style={{ color: TK.orange400 }}>실거래(호가 아님) 추이 × 전세가율(사용가치) × 고점 대비 × 지역 국면</b>을 한 화면에.
          국토교통부 실거래가 공개시스템 실데이터.
        </div>
      </div>
      <Suspense fallback={<div style={{ color: TK.sub, fontSize: 12 }}>로딩…</div>}>
        <AptResearchWithParams />
      </Suspense>
    </div>
  )
}
