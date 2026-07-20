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

// 🔎 소섹터 정밀화 — **Yahoo `industry`(정확한 소업종 카테고리 필드)로** 세부 ETF에 매핑. 이름 추측이 아니라
//    카테고리 필드라 같은 업종은 항상 같은 ETF(TSMC·Qualcomm 둘 다 industry='Semiconductors'→SOXX = 일관·학생 혼동 없음).
//    industry가 없으면(KR 일부) 종목명 폴백(KR 금융·항공은 이름에 업종어 포함). 티커는 전부 실측 검증(SECTOR_ETF 재사용 + JETS).
//    ⚠️ 순서 중요: 증권(자본시장)→보험→은행 / 항공→방산(Aerospace보다 Airlines 먼저·상호 배타).
const SUB_ETF: { re: RegExp; label: string; us?: { t: string; name: string }; kr?: { code: string; name: string } }[] = [
  // 산업재
  { re: /Airlines|Air ?Lines|항공(?!우주)/i,              label: '항공',       us: { t: 'JETS', name: 'US Global 항공' } },
  { re: /Aerospace|Defense|방산|항공우주/i,               label: '방산·우주',  us: { t: 'ITA',  name: 'iShares 방산' },     kr: { code: '449450', name: 'PLUS K방산' } },
  { re: /Railroad|Freight|Trucking|Logistics|운송|물류/i,  label: '운송·물류', us: { t: 'IYT',  name: 'iShares 운송' } },
  // 금융 (증권→보험→은행 순 — 상호 배타)
  { re: /Capital Markets|Asset Management|Stock Exchange|증권|금융투자|한국금융지주|한국투자/i, label: '증권·자본시장', us: { t: 'IAI', name: 'iShares 증권' }, kr: { code: '102970', name: 'KODEX 증권' } },
  { re: /Insurance|보험|생명|화재|손해|메리츠금융/i,       label: '보험',      us: { t: 'KIE',  name: 'SPDR 보험' },       kr: { code: '140700', name: 'KODEX 보험' } },
  { re: /\bBanks?\b|은행/i,                               label: '은행',      us: { t: 'KBWB', name: 'KBW 은행' },         kr: { code: '091170', name: 'KODEX 은행' } },
  // IT
  { re: /Semiconductor|반도체|파운드리/i,                 label: '반도체',    us: { t: 'SOXX', name: 'iShares 반도체' },   kr: { code: '091160', name: 'KODEX 반도체' } },
  { re: /Software/i,                                      label: '소프트웨어', us: { t: 'IGV',  name: 'iShares SW' } },
  // 헬스케어
  { re: /Biotechnolog|바이오/i,                           label: '바이오',    us: { t: 'XBI',  name: 'SPDR 바이오' },     kr: { code: '244580', name: 'KODEX 바이오' } },
  { re: /Drug Manufactur|Pharmaceutic|제약/i,             label: '제약',      us: { t: 'PPH',  name: 'VanEck 제약' } },
  { re: /Medical (Device|Instrument)|의료기기/i,          label: '의료기기',  us: { t: 'IHI',  name: 'iShares 의료기기' } },
  { re: /Healthcare Plans/i,                              label: '의료서비스', us: { t: 'IHF',  name: 'iShares 의료서비스' } },
  // 에너지
  { re: /Oil & Gas E&P|Exploration/i,                     label: 'E&P',       us: { t: 'XOP',  name: 'SPDR E&P' } },
  { re: /Oil & Gas Equipment|유전/i,                      label: '유전서비스', us: { t: 'OIH',  name: 'VanEck 유전서비스' } },
  // 자유소비재
  { re: /Auto Manufactur|Auto Parts|자동차/i,             label: '자동차',    us: { t: 'CARZ', name: 'First Trust 자동차' }, kr: { code: '091180', name: 'KODEX 자동차' } },
  { re: /Specialty Retail|Internet Retail/i,              label: '소매·유통', us: { t: 'XRT',  name: 'SPDR 소매' } },
  // 소재
  { re: /\bSteel\b|철강|제철/i,                           label: '철강',      us: { t: 'SLX',  name: 'VanEck 철강' },     kr: { code: '117680', name: 'KODEX 철강' } },
  { re: /\bGold\b|Precious Metals/i,                      label: '금·귀금속', us: { t: 'GDX',  name: 'VanEck 금광' } },
  // 커뮤니케이션
  { re: /Internet Content/i,                              label: '인터넷',    us: { t: 'FDN',  name: 'First Trust 인터넷' } },
]

/** GICS 섹터 + 시장 + (종목명·소업종) → 매칭 ETF 스텁(타점·PEG 계산 전).
 *  ① Yahoo industry(신뢰)로 소섹터 ETF → ② industry 없으면 종목명 폴백 → ③ 광의 GICS 섹터 ETF. KR 대응 없으면 US 폴백. */
export function etfAltStub(gicsSector: string, market: string, name = '', industry = ''): Stub | null {
  const isKr = (market ?? '').toUpperCase() === 'KR'
  // ① 소업종 정밀화 — industry(정확) 우선, 없으면 종목명
  const probe = (industry || name || '').trim()
  const sub = probe ? SUB_ETF.find(r => r.re.test(probe)) : undefined
  if (sub) {
    if (isKr && sub.kr) return { ticker: sub.kr.code, name: sub.kr.name, market: 'KR', sectorLabel: sub.label, isFallback: false }
    if (sub.us) return { ticker: sub.us.t, name: sub.us.name, market: 'US', sectorLabel: sub.label, isFallback: isKr }
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
export async function buildEtfAltMap(items: { ticker: string; sector: string; market: string; name: string; industry?: string | null }[], base: string): Promise<Map<string, EtfAlt>> {
  // 1) 종목별 스텁(소업종 industry 우선 정밀화)
  const stubByStock = new Map<string, Stub | null>()
  for (const it of items) if (!stubByStock.has(it.ticker)) stubByStock.set(it.ticker, etfAltStub(it.sector, it.market, it.name, it.industry ?? ''))
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
