// 🔔 타점 전환 워처 크론 — 전 학생 보유 종목(KR/US)의 매수/매도 타점 신호를 매일 스캔해 전일 대비 '전환'만 감지.
//    신호등(EMA·구름) + 🎼라쉬케(첫눌림목·하락다이버전스) + 🔥스퀴즈(분출) + 📊매물·평단(지지 전환)을 한 번에(전부 entryTiming SSOT·추가 fetch 0).
//    매일 08:30 KST(미 장 마감 후·한국 개장 전). "기다리는 것도 전략"이 실제로 작동하게 만드는 마감재. ⛔ 점수·추천 미반영(알림만).
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { getEntryTimings, type TimingLight, type EntryTiming } from '@/lib/entryTiming'
import { getSector } from '@/lib/schoolIndex'
import type { RotationResult } from '@/app/api/sector-rotation/route'

type SupportState = 'strong' | 'ext' | 'weak' | 'mixed' | null
type RotQuad = 'leading' | 'weakening' | 'lagging' | 'improving'
interface SigState { light: TimingLight | null; rkStage: number | null; bearDiv: boolean; sqFired: 'up' | 'down' | null; support: SupportState; sectorQuad?: RotQuad | null }
interface WatchSnap { date: string; snap: Record<string, SigState>; names: Record<string, string> }

// Yahoo assetProfile.sector → 섹터 로테이션 GICS 키(#3 섹터 자금 이탈 매도신호용)
const YSEC_TO_ROT: Record<string, string> = {
  'Technology': 'infotech', 'Financial Services': 'financials', 'Energy': 'energy', 'Healthcare': 'healthcare',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Industrials': 'industrials',
  'Basic Materials': 'materials', 'Communication Services': 'communication', 'Utilities': 'utilities', 'Real Estate': 'realestate',
}

export type WatchKind = 'buy' | 'sell'
export interface WatchSig { ticker: string; name: string; market: 'KR' | 'US'; kind: WatchKind; icon: string; label: string; detail: string }
export interface WatchResult { asOf: string; prevDate: string | null; scanned: number; sigs: WatchSig[] }

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** entryTiming → 압축 신호 상태(전일 대비 diff용) */
function toState(t: EntryTiming | null | undefined): SigState {
  const sup = t?.supply
  const support: SupportState = !sup ? null
    : sup.supportStrong ? (sup.overExtended ? 'ext' : 'strong')
    : sup.supportWeak ? 'weak' : 'mixed'
  return { light: t?.light ?? null, rkStage: t?.raschke?.stage ?? null, bearDiv: !!t?.raschke?.bearDiv, sqFired: t?.supply?.squeezeFired ?? null, support }
}

/** 전일→오늘 상태 전환 중 '행동 가치 있는' 것 하나만(우선순위: 매도 방어 먼저 → 매수 기회). 미변화면 null */
function diffSig(p: SigState, c: SigState): Omit<WatchSig, 'ticker' | 'name' | 'market'> | null {
  // 🔴 매도·경계(자본 방어 우선)
  if (p.light === 'green' && c.light === 'red') return { kind: 'sell', icon: '🔴', label: '최후 방어선 붕괴', detail: 'EMA 역배열+구름 이탈 — 장기 추세까지 꺾임. 재무 좋아도 기회비용 주의' }
  if (!p.bearDiv && c.bearDiv) return { kind: 'sell', icon: '📉', label: '하락 다이버전스', detail: '주가 신고점↑ vs RSI↓ — 상승 에너지 소진, 분할 익절 조기 신호' }
  if (p.support === 'strong' && c.support === 'weak') return { kind: 'sell', icon: '📊', label: '지지 상실', detail: '기관평단(VWAP)·매물대(POC) 아래로 이탈 — 지지 얇아짐, 되돌림 리스크' }
  if (c.sqFired === 'down' && p.sqFired !== 'down') return { kind: 'sell', icon: '🔥', label: '변동성 하방 분출', detail: '스퀴즈 해제 하방 — 신규 매수 보류' }
  // 🍂 섹터 자금 이탈(#3) — 보유 섹터가 로테이션 주도/태동 → 과열/이탈로 전환(가장 느린 sell, 최하 우선순위)
  if ((p.sectorQuad === 'leading' || p.sectorQuad === 'improving') && (c.sectorQuad === 'weakening' || c.sectorQuad === 'lagging'))
    return { kind: 'sell', icon: '🍂', label: '섹터 자금 이탈', detail: '보유 섹터가 로테이션 과열/이탈 국면으로 전환 — 익절·비중축소 검토(신규 매수는 자금 유입 섹터 ETF 우선)' }
  // 🟢 매수 기회
  if ((p.light === 'yellow' || p.light === 'red') && c.light === 'green') return { kind: 'buy', icon: '🟢', label: '진입 적기 돌파', detail: '정배열+구름 위 안착 — 추세·매물대 둘 다 확인' }
  if ((p.rkStage ?? 0) < 4 && c.rkStage === 4) return { kind: 'buy', icon: '🎼', label: '첫 눌림목 도달(타점)', detail: '라쉬케 추세 확립 후 첫 되돌림 — 최적 1차/추가 진입 타점' }
  if (c.sqFired === 'up' && p.sqFired !== 'up') return { kind: 'buy', icon: '🔥', label: '변동성 상방 분출', detail: '스퀴즈 해제 상방 — 돌파 초입(과한 추격은 금물)' }
  if ((p.support === 'weak' || p.support === 'mixed') && c.support === 'strong') return { kind: 'buy', icon: '📊', label: '지지 전환(탄탄)', detail: '기관평단·매물대 위로 안착 — 눌림 지지 확보' }
  return null
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: rows, error } = await admin.from('investments').select('ticker,name,market')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 전 학생 보유 KR/US 종목 dedup(크립토 제외 — 캔들 미지원)
  const uniq = new Map<string, { ticker: string; name: string; market: 'KR' | 'US' }>()
  for (const r of rows ?? []) {
    const mkt = String(r.market ?? '').toUpperCase()
    if (mkt !== 'KR' && mkt !== 'US') continue
    if (getAssetType(r.ticker, r.name, mkt) === 'CRYPTO') continue
    uniq.set(`${r.ticker}:${mkt}`, { ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: mkt as 'KR' | 'US' })
  }
  const list = Array.from(uniq.values())

  const tmap = await getEntryTimings(list, 4)
  const snap: Record<string, SigState> = {}
  const names: Record<string, string> = {}
  for (const it of list) {
    const key = `${it.ticker}:${it.market}`
    snap[key] = toState(tmap.get(key))
    names[key] = it.name
  }

  // 🍂 섹터 국면(#3) — 로테이션 캐시(오늘)가 있을 때만. 보유 종목 GICS 섹터(getSector 7일 캐시·대부분 히트) → 로테이션 국면 매핑
  const rot = await getCache<RotationResult>(`sector-rotation-v11:${kstDate()}`, 12 * 3600_000)
  if (rot?.items?.length) {
    const quadByKey: Record<string, RotQuad> = {}
    for (const it of rot.items) quadByKey[it.key] = it.quadrant as RotQuad
    // 동시성 5로 섹터 조회(캐시 히트 위주)
    const queue = [...list]
    await Promise.all(Array.from({ length: 5 }, async () => {
      for (;;) {
        const it = queue.shift(); if (!it) break
        try {
          const rotKey = YSEC_TO_ROT[await getSector(it.ticker, it.market)]
          const q = rotKey ? quadByKey[rotKey] : null
          if (q) snap[`${it.ticker}:${it.market}`].sectorQuad = q
        } catch { /* graceful */ }
      }
    }))
  }

  // 전일 스냅과 비교 → 전환 감지(같은 날 재실행이면 비교 스킵·스냅만 갱신).
  // ⚠️ v2: 신규 SigState 포맷 — 옛 v1(TimingLight 문자열) 스냅과 diff하면 undefined 필드가 '신규 전환'으로 오탐되므로 키 분리(첫 실행=깨끗한 베이스라인)
  const prev = await getCache<WatchSnap>('timing-watch-latest-v2', 7 * 86400_000)
  const today = kstDate()
  const sigs: WatchSig[] = []
  if (prev && prev.date !== today) {
    for (const key of Object.keys(snap)) {
      const p = prev.snap[key], c = snap[key]
      if (!p || !c || typeof p !== 'object') continue   // 옛 포맷·결손 방어
      const d = diffSig(p, c)
      if (!d) continue
      const [ticker, market] = key.split(':')
      sigs.push({ ticker, name: names[key] ?? ticker, market: market as 'KR' | 'US', ...d })
    }
    // 🔴 매도·경계 먼저(방어), 🟢 매수 다음
    sigs.sort((a, b) => (a.kind === 'sell' ? 0 : 1) - (b.kind === 'sell' ? 0 : 1))
    await setCache('timing-watch-changes-v2', { asOf: new Date().toISOString(), prevDate: prev.date, scanned: list.length, sigs } satisfies WatchResult)
  }
  await setCache('timing-watch-latest-v2', { date: today, snap, names } satisfies WatchSnap)

  return NextResponse.json({
    ok: true, scanned: list.length, resolved: Object.values(snap).filter(v => v.light != null).length,
    prevDate: prev?.date ?? null, sigs: sigs.map(s => `${s.name} ${s.icon}${s.label}`),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
