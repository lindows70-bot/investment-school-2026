// 💵 배당 종목 유니버스 — 배당 포트폴리오 후보 풀(US+KR 큐레이션)
//   ⚠️ 큐레이션 '후보 리스트'이지 하드코딩 값이 아님(제1원칙) — 배당률·성장률·안전성은 전부 실데이터(dividendProfile SSOT).
//   버킷은 전략 템플릿용 1차 분류(실제 style은 계산값으로 정밀화). 티커는 Yahoo 실측 검증 완료.

export type DivBucket = 'income' | 'growth' | 'future'

export interface UniverseStock {
  ticker: string
  market: 'US' | 'KR'
  bucket: DivBucket
  note: string   // 왜 이 버킷인지 한 줄(교육용)
}

export const BUCKET_META: Record<DivBucket, { label: string; icon: string; color: string; desc: string }> = {
  income: { label: '고배당 인컴', icon: '🏦', color: '#fb923c', desc: '지금 당장의 현금흐름 (은퇴 월세형)' },
  growth: { label: '배당 성장', icon: '🌱', color: '#4ade80', desc: '장기 배당 증액·복리 (Yield on Cost)' },
  future: { label: '미래 유망', icon: '🔮', color: '#38bdf8', desc: '낮은 배당성향·큰 인상 여력 (미래의 배당 킹)' },
}

// ── 미국 ────────────────────────────────────────────────────────────────────
const US: UniverseStock[] = [
  // 고배당 인컴
  { ticker: 'VZ', market: 'US', bucket: 'income', note: '통신 과점·저베타 방어주, 22년 연속 인상' },
  { ticker: 'O', market: 'US', bucket: 'income', note: '월배당 리츠 대명사 30년 귀족주' },
  { ticker: 'MO', market: 'US', bucket: 'income', note: '담배 캐시카우, 55년 배당 킹' },
  { ticker: 'MAIN', market: 'US', bucket: 'income', note: '월배당 BDC(중소기업 대출)' },
  { ticker: 'ABBV', market: 'US', bucket: 'income', note: '제약 고배당, 애브비' },
  { ticker: 'PFE', market: 'US', bucket: 'income', note: '제약 고배당, 화이자' },
  { ticker: 'T', market: 'US', bucket: 'income', note: '통신 고배당(2022 삭감 이력·성장성 결여)' },
  // 배당 성장
  { ticker: 'KO', market: 'US', bucket: 'growth', note: '62년 배당 킹, 코카콜라' },
  { ticker: 'PEP', market: 'US', bucket: 'growth', note: '52년 배당 킹, 펩시코' },
  { ticker: 'MDLZ', market: 'US', bucket: 'growth', note: '신흥국 매출·연 10% 배당 성장, 몬델레즈' },
  { ticker: 'SPGI', market: 'US', bucket: 'growth', note: '52년 킹·배당성향 24%(인상 여력 큼)' },
  { ticker: 'ADP', market: 'US', bucket: 'growth', note: '49년 귀족·급여시스템 해자' },
  { ticker: 'PH', market: 'US', bucket: 'growth', note: '69년 배당 킹·AI 인프라 수혜(파커 하니핀)' },
  { ticker: 'TXN', market: 'US', bucket: 'growth', note: '반도체 현금창출·21년 인상' },
  { ticker: 'SCHD', market: 'US', bucket: 'growth', note: '배당 성장 ETF(다우존스 배당 100)' },
  // 미래 유망 (낮은 성향·큰 인상 여력)
  { ticker: 'AVGO', market: 'US', bucket: 'future', note: '반도체 배당 급성장(브로드컴)' },
  { ticker: 'V', market: 'US', bucket: 'future', note: '결제 해자·저배당성향(비자)' },
  { ticker: 'MA', market: 'US', bucket: 'future', note: '결제 해자·저배당성향(마스터카드)' },
  { ticker: 'COST', market: 'US', bucket: 'future', note: '회원제 해자·특별배당(코스트코)' },
  { ticker: 'MSFT', market: 'US', bucket: 'future', note: 'AI·클라우드 성장 배당(마이크로소프트)' },
]

// ── 한국 (전부 Yahoo .KS 배당 데이터 실측 확인) ──────────────────────────────
const KR: UniverseStock[] = [
  // 고배당 인컴 (금융·통신 — 밸류업 고배당)
  { ticker: '024110', market: 'KR', bucket: 'income', note: '기업은행 — 국내 최고 배당률권(5%+)' },
  { ticker: '316140', market: 'KR', bucket: 'income', note: '우리금융 — 금융지주 고배당' },
  { ticker: '030200', market: 'KR', bucket: 'income', note: 'KT — 통신 고배당' },
  { ticker: '086790', market: 'KR', bucket: 'income', note: '하나금융 — 금융지주 고배당' },
  { ticker: '017670', market: 'KR', bucket: 'income', note: 'SK텔레콤 — 통신 안정 배당(분기)' },
  { ticker: '033780', market: 'KR', bucket: 'income', note: 'KT&G — 담배·인삼 캐시카우' },
  { ticker: '055550', market: 'KR', bucket: 'income', note: '신한지주 — 분기배당 도입 금융지주' },
  { ticker: '105560', market: 'KR', bucket: 'income', note: 'KB금융 — 밸류업 대표 금융지주' },
  { ticker: '005490', market: 'KR', bucket: 'income', note: 'POSCO홀딩스 — 소재 고배당' },
  // 배당 성장
  { ticker: '000270', market: 'KR', bucket: 'growth', note: '기아 — 5년 배당성장률 국내 1위권' },
  { ticker: '086280', market: 'KR', bucket: 'growth', note: '현대글로비스 — 배당성향 25%+·매년 5%+ 인상 공시' },
  { ticker: '005930', market: 'KR', bucket: 'growth', note: '삼성전자 — 분기배당·자사주 소각' },
  // 미래 유망 (낮은 성향)
  { ticker: '003230', market: 'KR', bucket: 'future', note: '삼양식품 — 배당성향 9%·불닭 글로벌·ROE 41%(인상 여력 최대)' },
]

export const DIVIDEND_UNIVERSE: UniverseStock[] = [...US, ...KR]

// ── 전략 템플릿 (버킷 비중 + 종목 상한) ──────────────────────────────────────
export interface DivTemplate {
  key: string
  label: string
  icon: string
  desc: string
  mix: Record<DivBucket, number>   // 버킷 목표 비중(합 100)
  krWeight: number                 // 한국 종목 목표 비중(%) — 나머지는 미국
  size: number                     // 편입 종목 수(대략)
  ultra?: boolean                  // 초고배당(초고위험) — 별도 유니버스(ULTRA_UNIVERSE)로 배분
  stat?: string                    // 카드 요약 커스텀(mix가 안 맞는 경우)
}
export const DIV_TEMPLATES: DivTemplate[] = [
  { key: 'income', label: '고배당 인컴형', icon: '🏦', desc: '지금 최대 현금흐름 — 은퇴 후 바로 월세처럼',
    mix: { income: 70, growth: 20, future: 10 }, krWeight: 40, size: 10 },
  { key: 'balanced', label: '균형 바벨형', icon: '⚖️', desc: '고배당(현재)+성장(미래)을 50:50 — 리포트 권장 바벨',
    mix: { income: 45, growth: 40, future: 15 }, krWeight: 35, size: 12 },
  { key: 'growth', label: '성장 스노우볼형', icon: '🌱', desc: '지금 배당은 적어도 장기 복리로 월배당 극대화',
    mix: { income: 25, growth: 45, future: 30 }, krWeight: 30, size: 12 },
  { key: 'ultra', label: '초고배당형', icon: '🔥', desc: '초고위험 — 옵션·레버리지 초고분배 (월배당 극대화·원금 손실 위험)',
    mix: { income: 0, growth: 0, future: 0 }, krWeight: 55, size: 10, ultra: true,
    stat: '커버드콜 ETF + 고배당 REIT·금융 · 🇰🇷 55% · ⚠️ 초고위험' },
]
