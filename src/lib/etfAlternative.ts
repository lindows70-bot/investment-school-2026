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

// 🔎 소섹터 정밀화 — 종목명 키워드로 세부 ETF. ⚠️ **동일 업종을 일관되게 가를 수 있는 '신뢰 가능한' 키워드만** 넣는다.
//    금융 증권/보험·산업재 항공 = 종목명에 업종어가 항상 포함(대한항공·Air Lines·○○증권·○○화재) → 일관 분류 가능.
//    반도체·방산 등은 영문명이 키워드를 안 담아(TSMC엔 'Semiconductor'가 있지만 Qualcomm엔 없음) 같은 업종이
//    갈리면 오히려 학생이 헷갈림 → 광의 섹터 ETF 유지. 티커는 전부 실측 검증(SECTOR_ETF 재사용 + JETS/IAI/KIE 확인).
const NAME_REFINE: Record<string, { re: RegExp; label: string; us?: { t: string; name: string }; kr?: { code: string; name: string } }[]> = {
  'Financial Services': [
    { re: /증권|금융투자|한국금융지주|한국투자/, label: '증권', us: { t: 'IAI', name: 'iShares 증권' }, kr: { code: '102970', name: 'KODEX 증권' } },
    { re: /보험|생명|화재|손해|메리츠금융/, label: '보험', us: { t: 'KIE', name: 'SPDR 보험' }, kr: { code: '140700', name: 'KODEX 보험' } },
    // 그 외(은행·KB/신한/하나 금융지주) → 광의 폴백(KODEX 은행 / XLF)
  ],
  'Industrials': [
    { re: /항공(?!우주)|Airlines?|Air ?Lines/i, label: '항공', us: { t: 'JETS', name: 'US Global 항공' } },   // 항공사(대한항공·Delta Air Lines). '항공우주'(방산)는 제외
    // 방산·조선·운송 등은 영문명이 업종어를 안 담는 경우가 많아(Lockheed·RTX) 광의(XLI) 유지 — 동일 업종 불일치 방지
  ],
}

/** GICS 섹터 + 시장(+종목명) → 매칭 섹터 ETF 스텁(타점·PEG 계산 전).
 *  ① 신뢰 가능한 소섹터 키워드(NAME_REFINE)로 세부 ETF → ② 없으면 광의 GICS 섹터 ETF. KR 대응 없으면 US 폴백. */
export function etfAltStub(gicsSector: string, market: string, name = ''): Stub | null {
  const isKr = (market ?? '').toUpperCase() === 'KR'
  // ① 소섹터 정밀화(신뢰 키워드만)
  const refine = NAME_REFINE[gicsSector]?.find(r => r.re.test(name))
  if (refine) {
    if (isKr && refine.kr) return { ticker: refine.kr.code, name: refine.kr.name, market: 'KR', sectorLabel: refine.label, isFallback: false }
    if (refine.us) return { ticker: refine.us.t, name: refine.us.name, market: 'US', sectorLabel: refine.label, isFallback: isKr }
  }
  // ② 광의 GICS 섹터 폴백
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
