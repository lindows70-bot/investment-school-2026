// 🔬 ETF 분산 대안 SSOT — 개별주 추천에 '같은 GICS 섹터를 ETF로 분산 진입'하는 대안을 붙인다.
//    점수·선정 절대 불변(배지·병기만). 합산 PEG=etfLookThrough SSOT, 타점=entryTiming SSOT 재사용.
import { getEntryTiming, type EntryTiming } from '@/lib/entryTiming'
import { getBlendedPeg } from '@/lib/etfLookThrough'

export interface EtfAlt {
  ticker: string
  name: string
  market: 'US' | 'KR'
  sectorLabel: string        // 한글 섹터(또는 하위: 증권·보험)
  isFallback: boolean        // KR 종목인데 KR 대응 ETF 없어 US로 폴백
  blendedPeg: number | null
  pegCoverage: number | null
  timing: EntryTiming | null
}

type Stub = Omit<EtfAlt, 'blendedPeg' | 'pegCoverage' | 'timing'>

// GICS(Yahoo 표기) → 광의 섹터 ETF. US=S&P SPDR 공식 섹터지수 / KR=대표 프록시(완전 GICS 아님).
// ⚠️ season-sector route에 동일 티커 데이터 존재(정적 참조 — 티커 수정 시 동기화). 세부 소섹터 ETF는 v2.
// 키는 unified-reco `SECTOR_TO_ROT`와 동일한 Yahoo GICS 문자열이어야 함.
const GICS_SECTOR_ETF: Record<string, { ko: string; us?: { t: string; name: string }; kr?: { code: string; name: string } }> = {
  'Energy':                 { ko: '에너지',       us: { t: 'XLE',  name: 'SPDR 에너지' },   kr: { code: '117460', name: 'KODEX 에너지화학' } },
  'Basic Materials':        { ko: '소재',         us: { t: 'XLB',  name: 'SPDR 소재' },     kr: { code: '117680', name: 'KODEX 철강' } },
  'Industrials':            { ko: '산업재',       us: { t: 'XLI',  name: 'SPDR 산업재' },   kr: { code: '117700', name: 'KODEX 건설' } },
  'Consumer Cyclical':      { ko: '자유소비재',   us: { t: 'XLY',  name: 'SPDR 자유소비재' }, kr: { code: '091180', name: 'KODEX 자동차' } },
  'Consumer Defensive':     { ko: '필수소비재',   us: { t: 'XLP',  name: 'SPDR 필수소비재' }, kr: { code: '227560', name: 'TIGER 생활소비재' } },
  'Healthcare':             { ko: '헬스케어',     us: { t: 'XLV',  name: 'SPDR 헬스케어' }, kr: { code: '266420', name: 'KODEX 헬스케어' } },
  'Financial Services':     { ko: '금융',         us: { t: 'XLF',  name: 'SPDR 금융' },     kr: { code: '091170', name: 'KODEX 은행' } },
  'Technology':             { ko: '기술',         us: { t: 'XLK',  name: 'SPDR 기술' },     kr: { code: '091160', name: 'KODEX 반도체' } },
  'Communication Services': { ko: '커뮤니케이션', us: { t: 'XLC',  name: 'SPDR 커뮤니케이션' }, kr: { code: '266360', name: 'KODEX 미디어&엔터' } },
  'Utilities':              { ko: '유틸리티',     us: { t: 'XLU',  name: 'SPDR 유틸리티' } },   // KR 깨끗한 유틸 ETF 없음 → US 폴백
  'Real Estate':            { ko: '부동산',       us: { t: 'XLRE', name: 'SPDR 부동산' },   kr: { code: '329200', name: 'TIGER 리츠부동산' } },
}

/** GICS 섹터 + 시장(+종목명) → 매칭 섹터 ETF 스텁(타점·PEG 계산 전).
 *  금융(광의: 은행+증권+보험)은 KR 종목명으로 하위 ETF를 정교화(증권/보험 별도 ETF 존재). KR 대응 없으면 US 폴백. */
export function etfAltStub(gicsSector: string, market: string, name = ''): Stub | null {
  const isKr = (market ?? '').toUpperCase() === 'KR'
  // 🏦 금융 하위 정교화(KR) — GICS 'Financial Services'는 은행·증권·보험 혼합이라 종목명으로 세분(각 전용 ETF 존재)
  if (gicsSector === 'Financial Services' && isKr) {
    if (/증권/.test(name)) return { ticker: '102970', name: 'KODEX 증권', market: 'KR', sectorLabel: '증권', isFallback: false }
    if (/보험|생명|화재|손해/.test(name)) return { ticker: '140700', name: 'KODEX 보험', market: 'KR', sectorLabel: '보험', isFallback: false }
    // 은행·금융지주·기타 → 은행 ETF(광의)로 폴백(아래 공통 처리)
  }
  const g = GICS_SECTOR_ETF[gicsSector]
  if (!g) return null
  if (isKr && g.kr) return { ticker: g.kr.code, name: g.kr.name, market: 'KR', sectorLabel: g.ko, isFallback: false }
  if (g.us) return { ticker: g.us.t, name: g.us.name, market: 'US', sectorLabel: g.ko, isFallback: isKr }   // KR 대응 없으면 US 폴백
  return null
}

/** 추천 아이템(티커·섹터·시장·이름) → 종목별 ETF 대안 계산 → Map(stockTicker → EtfAlt).
 *  타점·합산 PEG는 유니크 ETF(ticker+market)마다 1회씩만 계산(여러 종목이 같은 ETF면 중복 제거). */
export async function buildEtfAltMap(items: { ticker: string; sector: string; market: string; name: string }[], base: string): Promise<Map<string, EtfAlt>> {
  // 1) 종목별 스텁(종목명 정교화 반영)
  const stubByStock = new Map<string, Stub | null>()
  for (const it of items) if (!stubByStock.has(it.ticker)) stubByStock.set(it.ticker, etfAltStub(it.sector, it.market, it.name))
  // 2) 유니크 ETF(ticker+market) → 타점·합산 PEG 1회씩만 계산
  const etfKeys = new Map<string, { ticker: string; market: 'US' | 'KR' }>()
  for (const s of Array.from(stubByStock.values())) if (s) etfKeys.set(`${s.ticker}:${s.market}`, { ticker: s.ticker, market: s.market })
  const computed = new Map<string, { timing: EntryTiming | null; blendedPeg: number | null; pegCoverage: number | null }>()
  await Promise.all(Array.from(etfKeys.values()).map(async e => {
    const [timing, bp] = await Promise.all([
      getEntryTiming(e.ticker, e.market).catch(() => null),
      getBlendedPeg(e.ticker, e.market, base).catch(() => null),
    ])
    computed.set(`${e.ticker}:${e.market}`, { timing, blendedPeg: bp?.peg ?? null, pegCoverage: bp?.coverage ?? null })
  }))
  // 3) 종목 티커 기준 Map으로 결합
  const out = new Map<string, EtfAlt>()
  for (const [stockTicker, s] of Array.from(stubByStock.entries())) {
    if (!s) continue
    const c = computed.get(`${s.ticker}:${s.market}`)
    out.set(stockTicker, { ...s, timing: c?.timing ?? null, blendedPeg: c?.blendedPeg ?? null, pegCoverage: c?.pegCoverage ?? null })
  }
  return out
}
