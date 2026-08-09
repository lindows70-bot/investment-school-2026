// 💰 부동산 세금 지도 API — 취득·보유·양도 3단계 세율을 **법령 원문 그대로**
//   왜 원문인가: 조문 하나에 기본·중과·단기 표가 섞여 있어 우리가 골라서 요약하면 오설명이 되고,
//   세금은 틀리면 실질 피해다. 원문을 그대로 보여주고 해석은 학생·세무사에게 맡긴다.
//   ⛔ 개인 세액 계산 없음(세무 조언 금지) · ⛔ 세율 하드코딩 없음(제1원칙 — 법이 바뀌면 자동 반영)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getLawDoc, LAW_OC_IS_SAMPLE, type LawArticle } from '@/lib/lawApi'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface TaxStage {
  key: 'acquire' | 'hold' | 'transfer'
  emoji: string
  label: string          // 학생 언어(취득할 때 / 갖고 있을 때 / 팔 때)
  lawName: string
  effective: string      // 시행일 YYYYMMDD
  link: string           // 원문 링크
  articles: LawArticle[] // 세율 조문 원문(표 포함)
  note: string           // 이 세목이 언제 문제가 되는지 한 줄
}
export interface ReTaxResult {
  asOf: string
  stages: TaxStage[]
  lawSample: boolean
  failed: string[]       // 조회 실패한 법령 — 조용히 빠지지 않게
}

// ⚠️ Phase 0 실측으로 확정한 조문 위치(추측 금지):
//   종합부동산세법 제9조 = **주택분** 세율 / 제14조 = **토지분** 세율(장 구조로 확인)
//   소득세법 제104조 = 양도소득세 세율 / 지방세법 제11조 = 부동산 취득 세율
const TARGETS: { key: TaxStage['key']; emoji: string; label: string; law: string; arts: string[]; note: string }[] = [
  { key: 'acquire', emoji: '🏠', label: '살 때 — 취득세', law: '지방세법', arts: ['11', '13'],
    note: '집을 사는 순간 한 번 냅니다. 다주택·조정지역이면 중과될 수 있어요.' },
  { key: 'hold', emoji: '📅', label: '갖고 있을 때 — 종부세', law: '종합부동산세법', arts: ['9', '14'],
    note: '매년 6월 1일 소유자 기준. 요즘 개편 논의가 가장 뜨거운 세목입니다.' },
  { key: 'transfer', emoji: '💸', label: '팔 때 — 양도세', law: '소득세법', arts: ['104', '95'],
    note: '판 가격이 아니라 **차익**에 붙습니다. 보유·거주 기간에 따라 크게 달라져요.' },
]

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const cacheKey = `re-tax-v2:${kstDate()}`   // v2: 조문 파싱 교정(항·호 맥락 보존)
  if (!refresh) {
    const cached = await getCache<ReTaxResult>(cacheKey, 24 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  const stages: TaxStage[] = []
  const failed: string[] = []
  for (const t of TARGETS) {
    const doc = await getLawDoc(t.law, (title, no) => t.arts.includes(no) && /세율/.test(title))
    if (!doc || !doc.articles.length) { failed.push(t.law); continue }
    stages.push({
      key: t.key, emoji: t.emoji, label: t.label, lawName: doc.name,
      effective: doc.effective, link: doc.link, articles: doc.articles, note: t.note,
    })
  }

  const result: ReTaxResult = { asOf: new Date().toISOString(), stages, lawSample: LAW_OC_IS_SAMPLE, failed }
  // ⛔ 전멸이면 캐시하지 않는다(한 번의 장애를 24시간 박제하지 않는다)
  if (stages.length) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
