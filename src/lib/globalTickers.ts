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

// 🇪🇺 유럽 시총 상위 메이저(검색 전용 — 칩 미노출·과밀 방지). 원칙: 미국 ADR이 유동성 있으면 ADR(달러·펀더멘탈 풍부),
//    없으면 현지 접미사 티커. ⚠️ 별칭에 미국 티커와 충돌하는 짧은 약어 금지(BA=보잉, AI=C3.ai, EL=에스티로더, DTE=DTE에너지 등).
export const EU_MAJORS: GlobalAlias[] = [
  // 헬스케어·제약
  put('NVO', '노보노디스크', 'NOVO', 'NOVO NORDISK', '노보노디스크', '노보'),
  put('NVS', '노바티스', 'NOVARTIS', '노바티스'),
  put('SNY', '사노피', 'SANOFI', '사노피'),
  put('AZN', '아스트라제네카', 'ASTRAZENECA', '아스트라제네카'),
  put('RO.SW', '로슈', 'ROCHE', '로슈'),
  put('BAYN.DE', '바이엘', 'BAYER', '바이엘'),
  put('LONN.SW', '론자', 'LONZA', '론자'),
  put('ALC', '알콘', 'ALCON', '알콘'),
  put('SHL.DE', '지멘스 헬시니어스', 'HEALTHINEERS', '헬시니어스'),
  // 에너지·소재
  put('SHEL', '쉘', 'SHELL', '쉘'),
  put('TTE', '토탈에너지', 'TOTAL', 'TOTALENERGIES', '토탈'),
  put('EQNR', '에퀴노르', 'EQUINOR', '에퀴노르'),
  put('E', '에니(이탈리아)', 'ENI', '에니'),
  put('RIO', '리오틴토', 'RIO TINTO', 'RIOTINTO', '리오틴토'),
  put('GLEN.L', '글렌코어', 'GLENCORE', '글렌코어'),
  put('LIN', '린데', 'LINDE', '린데'),
  put('BAS.DE', '바스프', 'BASF', '바스프'),
  put('AI.PA', '에어리퀴드', 'AIR LIQUIDE', 'AIRLIQUIDE', '에어리퀴드'),
  put('SIKA.SW', '시카', 'SIKA', '시카'),
  // 금융
  put('SAN', '산탄데르', 'SANTANDER', '산탄데르'),
  put('DB', '도이치뱅크', 'DEUTSCHE BANK', '도이치뱅크'),
  put('BCS', '바클레이스', 'BARCLAYS', '바클레이스'),
  put('CS.PA', 'AXA(악사)', 'AXA', '악사'),
  put('ALV.DE', '알리안츠', 'ALLIANZ', '알리안츠'),
  put('MUV2.DE', '뮌헨 재보험', 'MUNICH RE', '뮌헨재보험', '뮌헨리'),
  put('ZURN.SW', '취리히 보험', 'ZURICH', '취리히보험'),
  put('BNP.PA', 'BNP파리바', 'BNP', 'BNP PARIBAS', '파리바'),
  put('ISP.MI', '인테사 산파올로', 'INTESA', '인테사'),
  put('UCG.MI', '유니크레딧', 'UNICREDIT', '유니크레딧'),
  put('LSEG.L', '런던증권거래소', 'LSEG', '런던증권거래소'),
  // 소비재
  put('NESN.SW', '네슬레', 'NESTLE', '네슬레'),
  put('UL', '유니레버', 'UNILEVER', '유니레버'),
  put('DEO', '디아지오', 'DIAGEO', '디아지오'),
  put('BUD', 'AB인베브(버드와이저)', 'ABINBEV', 'AB INBEV', '버드와이저', '인베브'),
  put('HEIA.AS', '하이네켄', 'HEINEKEN', '하이네켄'),
  put('BN.PA', '다논', 'DANONE', '다논'),
  put('ITX.MC', '인디텍스(자라)', 'INDITEX', 'ZARA', '자라', '인디텍스'),
  put('EL.PA', '에실로룩소티카', 'ESSILORLUXOTTICA', 'ESSILOR', '룩소티카', '에실로'),
  put('UHR.SW', '스와치', 'SWATCH', '스와치'),
  put('PHG', '필립스', 'PHILIPS', '필립스'),
  // 테크
  put('NOK', '노키아', 'NOKIA', '노키아'),
  put('ERIC', '에릭슨', 'ERICSSON', '에릭슨'),
  put('STM', 'ST마이크로', 'STMICRO', 'STMICROELECTRONICS', '에스티마이크로'),
  put('IFX.DE', '인피니언', 'INFINEON', '인피니언'),
  put('ADYEN.AS', '아디옌', 'ADYEN', '아디옌'),
  put('PRX.AS', '프로수스', 'PROSUS', '프로수스'),
  put('DSY.PA', '다쏘시스템', 'DASSAULT', '다쏘'),
  put('SPOT', '스포티파이', 'SPOTIFY', '스포티파이'),
  // 산업재·방산
  put('SIE.DE', '지멘스', 'SIEMENS', '지멘스'),
  put('ENR.DE', '지멘스 에너지', 'SIEMENS ENERGY', '지멘스에너지'),
  put('SU.PA', '슈나이더 일렉트릭', 'SCHNEIDER', '슈나이더'),
  put('AIR.PA', '에어버스', 'AIRBUS', '에어버스'),
  put('SAF.PA', '사프란', 'SAFRAN', '사프란'),
  put('HO.PA', '탈레스', 'THALES', '탈레스'),
  put('RHM.DE', '라인메탈', 'RHEINMETALL', '라인메탈'),
  put('BA.L', 'BAE시스템즈', 'BAE', 'BAE SYSTEMS'),
  put('RR.L', '롤스로이스', 'ROLLSROYCE', 'ROLLS ROYCE', '롤스로이스'),
  put('LDO.MI', '레오나르도(방산)', 'LEONARDO', '레오나르도'),
  put('ATCO-A.ST', '아틀라스콥코', 'ATLAS COPCO', 'ATLASCOPCO', '아틀라스콥코'),
  put('VOLV-B.ST', '볼보', 'VOLVO', '볼보'),
  put('VWS.CO', '베스타스(풍력)', 'VESTAS', '베스타스'),
  put('MAERSK-B.CO', '머스크(해운)', 'MAERSK', '머스크'),
  put('DHL.DE', 'DHL(도이치포스트)', 'DHL', '도이치포스트'),
  put('DTE.DE', '도이치텔레콤', 'DEUTSCHE TELEKOM', '도이치텔레콤'),
  put('VOD', '보다폰', 'VODAFONE', '보다폰'),
  // 자동차
  put('MBG.DE', '메르세데스-벤츠', 'MERCEDES', 'BENZ', '벤츠', '메르세데스'),
  put('BMW.DE', 'BMW', 'BMW', '비엠더블유'),
  put('VOW3.DE', '폭스바겐', 'VOLKSWAGEN', '폭스바겐'),
  put('P911.DE', '포르쉐', 'PORSCHE', '포르쉐'),
  put('STLA', '스텔란티스', 'STELLANTIS', '스텔란티스'),
  // 유틸리티
  put('IBE.MC', '이베르드롤라', 'IBERDROLA', '이베르드롤라'),
  put('ENEL.MI', '에넬', 'ENEL', '에넬'),
]

/** 검색어(한글/영문 이름·별칭·티커) → 야후 티커 해석. 미등록이면 null(입력 그대로 사용) */
export const resolveGlobalTicker = (q: string): GlobalAlias | null => M[q.trim().toUpperCase()] ?? null

/** 야후 접미사 → 통화 기호. ⚠️ .L(런던)은 펜스(GBp) 단위 호가 — £로 표기하면 100배 오해라 GBp 그대로 표기 */
export const curSymbol = (ticker: string, market: 'KR' | 'US'): string => {
  if (market === 'KR') return '₩'
  const t = ticker.toUpperCase()
  if (/\.(PA|DE|MI|AS|BR|F|MC|HE)$/.test(t)) return '€'
  if (t.endsWith('.SW')) return 'CHF '
  if (t.endsWith('.L')) return 'GBp '
  if (t.endsWith('.HK')) return 'HK$'
  if (t.endsWith('.CO')) return 'DKK '
  if (t.endsWith('.ST')) return 'SEK '
  if (t.endsWith('.OL')) return 'NOK '
  return '$'
}

// ⚡ 레버리지·인버스 ETF — 변동성 드래그 경고 대상(언더스탠딩 켈리 영상: 횡보만 해도 원금이 녹는 구조)
const LEVERAGED = new Set([
  // US 2·3배·인버스
  'TQQQ', 'SQQQ', 'QLD', 'QID', 'SSO', 'SDS', 'UPRO', 'SPXU', 'SPXL', 'SPXS',
  'SOXL', 'SOXS', 'TMF', 'TMV', 'FNGU', 'FNGD', 'BULZ', 'NVDL', 'TSLL', 'TSLQ',
  'LABU', 'LABD', 'YINN', 'YANG', 'UVXY', 'TNA', 'TZA', 'ERX', 'ERY', 'DPST',
  // KR 레버리지·인버스(6자리)
  '122630', '252670', '233740', '251340', '123320', '114800',
])
/** 레버리지·인버스 ETF 여부(목록 + 이름 패턴은 호출부에서 보완) */
export const isLeveragedTicker = (ticker: string): boolean => LEVERAGED.has(ticker.trim().toUpperCase())

/** 야후 접미사 → 통화 코드(stock-info 등 서버 응답용 — 비KR 'USD' 하드코딩 대체) */
export const curCodeFromTicker = (ticker: string): string => {
  const t = ticker.toUpperCase()
  if (/\.(PA|DE|MI|AS|BR|F|MC|HE)$/.test(t)) return 'EUR'
  if (t.endsWith('.SW')) return 'CHF'
  if (t.endsWith('.L')) return 'GBp'
  if (t.endsWith('.HK')) return 'HKD'
  if (t.endsWith('.CO')) return 'DKK'
  if (t.endsWith('.ST')) return 'SEK'
  if (t.endsWith('.OL')) return 'NOK'
  return 'USD'
}

/** 야후 통화 코드 → 기호(리서치 등 stock-info.currency 기반 화면용 — 야후 공식 통화가 접미사 추정보다 우선) */
export const curFromCode = (code?: string | null): string => {
  const m: Record<string, string> = { KRW: '₩', USD: '$', EUR: '€', CHF: 'CHF ', GBP: '£', GBp: 'GBp ', HKD: 'HK$', JPY: '¥', DKK: 'DKK ', SEK: 'SEK ', NOK: 'NOK ' }
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
  if (t.endsWith('.MC')) return '스페인'
  if (t.endsWith('.CO')) return '덴마크'
  if (t.endsWith('.ST')) return '스웨덴'
  if (t.endsWith('.OL')) return '노르웨이'
  if (t.endsWith('.HE')) return '핀란드'
  return '미국'
}
