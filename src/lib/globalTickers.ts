// 유럽·글로벌 명품주 별칭 사전 — 한글/영문 이름을 야후 접미사 티커로 해석(검색 확장) + 접미사 기반 통화·시장 라벨
//  야후 v8 차트·quoteSummary는 접미사 티커(MC.PA 등)를 그대로 지원 → 기존 US(글로벌) 파이프라인 재사용, 별도 시장 타입 불필요.
export interface GlobalAlias { ticker: string; name: string }

const M: Record<string, GlobalAlias> = {}
const put = (ticker: string, name: string, ...aliases: string[]): GlobalAlias => {
  const e = { ticker, name }
  M[ticker.toUpperCase()] = e
  for (const a of aliases) M[a.toUpperCase()] = e
  return e
}

// 퀵칩 노출 순서 그대로 — 명품·럭셔리 대표 종목(야후 접미사 티커)
export const GLOBAL_LUXURY: GlobalAlias[] = [
  put('MC.PA', 'LVMH(루이비통)', 'LVMH', '루이비통', 'LOUIS VUITTON', 'LOUISVUITTON'),
  put('RMS.PA', '에르메스', 'HERMES', '에르메스'),
  put('CFR.SW', '리치몬트(까르띠에)', 'RICHEMONT', '리치몬트', '까르띠에', 'CARTIER'),
  put('RACE', '페라리(NYSE)', 'FERRARI', '페라리'),
  put('ADS.DE', '아디다스', 'ADIDAS', '아디다스'),
  put('KER.PA', '케링(구찌)', 'KERING', '케링', '구찌', 'GUCCI'),
  put('OR.PA', '로레알', 'LOREAL', "L'OREAL", '로레알'),
  put('CDI.PA', '크리스챤 디올', 'DIOR', '디올', '크리스챤디올'),
  put('MONC.MI', '몽클레르', 'MONCLER', '몽클레르'),
  put('PUM.DE', '푸마', 'PUMA', '푸마'),
  put('BRBY.L', '버버리(런던·GBp)', 'BURBERRY', '버버리'),
  put('1913.HK', '프라다(홍콩)', 'PRADA', '프라다'),
]

/** 검색어(한글/영문 이름·별칭·티커) → 야후 티커 해석. 미등록이면 null(입력 그대로 사용) */
export const resolveGlobalTicker = (q: string): GlobalAlias | null => M[q.trim().toUpperCase()] ?? null

/** 야후 접미사 → 통화 기호. ⚠️ .L(런던)은 펜스(GBp) 단위 호가 — £로 표기하면 100배 오해라 GBp 그대로 표기 */
export const curSymbol = (ticker: string, market: 'KR' | 'US'): string => {
  if (market === 'KR') return '₩'
  const t = ticker.toUpperCase()
  if (/\.(PA|DE|MI|AS|BR|F)$/.test(t)) return '€'
  if (t.endsWith('.SW')) return 'CHF '
  if (t.endsWith('.L')) return 'GBp '
  if (t.endsWith('.HK')) return 'HK$'
  return '$'
}

/** 야후 접미사 → 통화 코드(stock-info 등 서버 응답용 — 비KR 'USD' 하드코딩 대체) */
export const curCodeFromTicker = (ticker: string): string => {
  const t = ticker.toUpperCase()
  if (/\.(PA|DE|MI|AS|BR|F)$/.test(t)) return 'EUR'
  if (t.endsWith('.SW')) return 'CHF'
  if (t.endsWith('.L')) return 'GBp'
  if (t.endsWith('.HK')) return 'HKD'
  return 'USD'
}

/** 야후 통화 코드 → 기호(리서치 등 stock-info.currency 기반 화면용 — 야후 공식 통화가 접미사 추정보다 우선) */
export const curFromCode = (code?: string | null): string => {
  const m: Record<string, string> = { KRW: '₩', USD: '$', EUR: '€', CHF: 'CHF ', GBP: '£', GBp: 'GBp ', HKD: 'HK$', JPY: '¥' }
  return m[code ?? ''] ?? (code ? `${code} ` : '$')
}

/** 접미사 기반 시장 라벨(헤더 표기용) */
export const marketLabel = (ticker: string, market: 'KR' | 'US'): string => {
  if (market === 'KR') return '한국'
  const t = ticker.toUpperCase()
  if (t.endsWith('.PA')) return '프랑스'
  if (/\.(DE|F)$/.test(t)) return '독일'
  if (t.endsWith('.MI')) return '이탈리아'
  if (t.endsWith('.SW')) return '스위스'
  if (t.endsWith('.L')) return '영국'
  if (t.endsWith('.HK')) return '홍콩'
  if (t.endsWith('.AS')) return '네덜란드'
  return '미국'
}
