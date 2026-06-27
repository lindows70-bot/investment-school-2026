// 🧬 테마·섹터 분석 설정 레지스트리 — 섹터별 유니버스+서브섹터+앵커. 엔진(computeSector)이 공통 처리.
import type { SectorConfig, SectorStock, SubMeta } from '@/lib/sectorEngine'
import { QUANTUM, QSUB_META, QUANTUM_POLICY, QUANTUM_PREIPO, QUANTUM_ANCHOR } from '@/lib/quantumUniverse'

// 양자: 기존 quantumUniverse 데이터를 SectorStock으로 어댑터(modality→tags)
const QUANTUM_STOCKS: SectorStock[] = QUANTUM.map(s => ({
  ticker: s.ticker, name: s.name, market: s.market, yahoo: s.yahoo, sub: s.sub,
  purePlay: s.purePlay, tags: s.modality, govAwardUsdM: s.govAwardUsdM, note: s.note,
}))

const QUANTUM_CONFIG: SectorConfig = {
  key: 'quantum', label: '양자 테마 인텔리전스', emoji: '🛰️',
  tagline: '이익이 거의 없는 ‘꿈의 테마’ — PER·PEG 무의미. 추세·테마동조화·정책촉매로 봅니다. 고위험·−70% 드로다운 정상, 소액·분산. 교육용.',
  anchor: QUANTUM_ANCHOR, tagHeader: '모달리티', subMeta: QSUB_META as Record<string, SubMeta>,
  stocks: QUANTUM_STOCKS, overlayTickers: ['IONQ', 'QBTS', 'RGTI', 'QUBT', '046970'],
  policy: QUANTUM_POLICY, preIpo: QUANTUM_PREIPO,
}

// ── AI 반도체 ─────────────────────────────────────────────────────────────────
const AISEMI_SUB: Record<string, SubMeta> = {
  design:  { label: 'AI 가속기·설계', emoji: '🧠', color: '#a78bfa', desc: 'GPU·ASIC·IP (대장 테마)' },
  memory:  { label: 'HBM·메모리',     emoji: '💾', color: '#22d3ee', desc: '고대역폭메모리 — AI의 병목' },
  foundry: { label: '파운드리',       emoji: '🏭', color: '#f59e0b', desc: '첨단 미세공정 위탁생산' },
  equip:   { label: '장비',           emoji: '🔧', color: '#34d399', desc: 'EUV·증착·본딩·검사 장비' },
  infra:   { label: '네트워킹·인프라', emoji: '🌐', color: '#ec4899', desc: '데이터센터 연결·전력·쿨링' },
}
const AISEMI_STOCKS: SectorStock[] = [
  // 🧠 설계
  { ticker: 'NVDA', name: 'NVIDIA',        market: 'US', sub: 'design', tags: ['GPU', '데이터센터'], purePlay: true,  note: 'AI 가속기 절대강자(테마 대장주)' },
  { ticker: 'AMD',  name: 'AMD',           market: 'US', sub: 'design', tags: ['GPU', 'CPU'],       purePlay: true,  note: 'MI 시리즈로 AI GPU 추격' },
  { ticker: 'AVGO', name: 'Broadcom',      market: 'US', sub: 'design', tags: ['ASIC', '네트워킹'], purePlay: true,  note: '맞춤형 AI ASIC(구글 TPU 등) + 네트워크' },
  { ticker: 'MRVL', name: 'Marvell',       market: 'US', sub: 'design', tags: ['ASIC', '광인터커넥트'], purePlay: true, note: '커스텀 AI 실리콘·옵틱스' },
  { ticker: 'ARM',  name: 'Arm Holdings',  market: 'US', sub: 'design', tags: ['IP'],               purePlay: true,  note: 'AI 칩 설계 IP 코어 라이선스' },
  // 💾 메모리
  { ticker: '000660', name: 'SK하이닉스',  market: 'KR', sub: 'memory', tags: ['HBM'],              purePlay: true,  note: 'HBM 1위 — AI 메모리 핵심' },
  { ticker: '005930', name: '삼성전자',    market: 'KR', sub: 'memory', tags: ['HBM', '파운드리'],  purePlay: false, note: 'HBM·파운드리(단 폰·가전 비중 커 AI 비중 희석)' },
  { ticker: 'MU',   name: 'Micron',        market: 'US', sub: 'memory', tags: ['HBM'],              purePlay: true,  note: 'HBM 3사 중 하나' },
  // 🏭 파운드리
  { ticker: 'TSM',  name: 'TSMC',          market: 'US', sub: 'foundry', tags: ['파운드리', 'CoWoS'], purePlay: true, note: 'AI 칩 위탁생산 독점적 1위' },
  { ticker: 'INTC', name: 'Intel',         market: 'US', sub: 'foundry', tags: ['파운드리', 'CPU'],  purePlay: false, note: 'IFS 파운드리 재건 중(다각화·부진)' },
  { ticker: 'GFS',  name: 'GlobalFoundries', market: 'US', sub: 'foundry', tags: ['특수공정'],      purePlay: false, note: '성숙·특수 공정(AI 직접 비중 작음)' },
  // 🔧 장비
  { ticker: 'ASML', name: 'ASML',          market: 'US', sub: 'equip', tags: ['EUV'],               purePlay: true,  note: 'EUV 노광 독점 — 첨단공정 관문' },
  { ticker: 'AMAT', name: 'Applied Materials', market: 'US', sub: 'equip', tags: ['증착·식각'],     purePlay: true,  note: '종합 반도체 장비 1위' },
  { ticker: 'LRCX', name: 'Lam Research',  market: 'US', sub: 'equip', tags: ['식각', '증착'],      purePlay: true,  note: '식각·증착 장비(HBM 수혜)' },
  { ticker: 'KLAC', name: 'KLA',           market: 'US', sub: 'equip', tags: ['검사·계측'],         purePlay: true,  note: '공정 검사·계측 1위' },
  { ticker: '8035', name: '도쿄일렉트론',  market: 'JP', yahoo: '8035.T', sub: 'equip', tags: ['코터·식각'], purePlay: true, note: '일본 종합 반도체 장비' },
  { ticker: '042700', name: '한미반도체',  market: 'KR', sub: 'equip', tags: ['HBM 본더'],          purePlay: true,  note: 'HBM TC본더 — SK하이닉스 핵심 협력' },
  { ticker: '240810', name: '원익IPS',     market: 'KR', sub: 'equip', tags: ['증착'],              purePlay: true,  note: '반도체 증착 장비' },
  { ticker: '403870', name: 'HPSP',        market: 'KR', sub: 'equip', tags: ['고압어닐링'],        purePlay: true,  note: '고압수소 어닐링 독점' },
  { ticker: '036930', name: '주성엔지니어링', market: 'KR', sub: 'equip', tags: ['증착(ALD)'],      purePlay: true,  note: 'ALD 증착 장비' },
  // 🌐 인프라
  { ticker: 'ANET', name: 'Arista Networks', market: 'US', sub: 'infra', tags: ['데이터센터 스위치'], purePlay: true, note: 'AI 데이터센터 고속 네트워킹' },
  { ticker: 'CRDO', name: 'Credo',         market: 'US', sub: 'infra', tags: ['AEC 케이블'],         purePlay: true,  note: '액티브 전기 케이블(AI 연결)' },
  { ticker: 'ALAB', name: 'Astera Labs',   market: 'US', sub: 'infra', tags: ['커넥티비티'],         purePlay: true,  note: 'AI 서버 커넥티비티 칩' },
  { ticker: 'VRT',  name: 'Vertiv',        market: 'US', sub: 'infra', tags: ['전력·쿨링'],          purePlay: false, note: 'AI 데이터센터 전력·냉각(반도체 아님)' },
]

const AISEMI_CONFIG: SectorConfig = {
  key: 'ai-semi', label: 'AI 반도체 인텔리전스', emoji: '🧠',
  tagline: 'AI 붐의 ‘곡괭이와 삽’ — GPU→HBM→파운드리→장비→인프라 밸류체인. 실적 있는 종목 多라 모멘텀+밸류체인 위치를 함께 봅니다. 교육용.',
  anchor: 'NVDA', tagHeader: '역할', subMeta: AISEMI_SUB,
  stocks: AISEMI_STOCKS, overlayTickers: ['NVDA', 'AMD', 'AVGO', '000660', 'TSM'],
}

// ── AI 전력망 & 원전(SMR) ─────────────────────────────────────────────────────
const POWER_SUB: Record<string, SubMeta> = {
  grid:    { label: '전력기기·그리드',   emoji: '⚡', color: '#f59e0b', desc: '변압기·차단기·송배전 (대장 테마)' },
  nuclear: { label: '원전·SMR',          emoji: '☢️', color: '#34d399', desc: '소형모듈원전·우라늄·원전 운영' },
  cable:   { label: '전선·케이블',       emoji: '🔌', color: '#22d3ee', desc: '초고압 전선·해저케이블' },
  dcpower: { label: '데이터센터 전력·발전', emoji: '🔋', color: '#ec4899', desc: '온사이트 발전·전력·쿨링' },
}
const POWER_STOCKS: SectorStock[] = [
  // ⚡ 전력기기·그리드
  { ticker: 'GEV',  name: 'GE Vernova',     market: 'US', sub: 'grid', tags: ['전력기기', '가스터빈'], purePlay: true, note: 'AI 전력 인프라 대장(그리드+가스+원전)' },
  { ticker: 'ETN',  name: 'Eaton',          market: 'US', sub: 'grid', tags: ['전력관리'],          purePlay: true,  note: '데이터센터 전력관리 핵심' },
  { ticker: 'PWR',  name: 'Quanta Services', market: 'US', sub: 'grid', tags: ['송배전 건설'],      purePlay: true,  note: '전력망 구축·EPC 1위' },
  { ticker: 'POWL', name: 'Powell',         market: 'US', sub: 'grid', tags: ['배전반'],            purePlay: true,  note: '전력 배전 시스템(데이터센터 수혜)' },
  { ticker: 'HUBB', name: 'Hubbell',        market: 'US', sub: 'grid', tags: ['전력부품'],          purePlay: true,  note: '전력 송배전 부품' },
  { ticker: '010120', name: 'LS ELECTRIC',  market: 'KR', sub: 'grid', tags: ['전력기기'],          purePlay: true,  note: '국내 전력기기·초고압 변압기' },
  { ticker: '267260', name: 'HD현대일렉트릭', market: 'KR', sub: 'grid', tags: ['변압기'],          purePlay: true,  note: '초고압 변압기 수출 호황' },
  { ticker: '298040', name: '효성중공업',    market: 'KR', sub: 'grid', tags: ['변압기'],            purePlay: true,  note: '변압기·STATCOM' },
  { ticker: 'SIE',  name: 'Siemens',        market: 'EU', yahoo: 'SIE.DE', sub: 'grid', tags: ['전력·자동화'], purePlay: false, note: '거대 복합기업(전력 비중 일부)' },
  { ticker: 'SU',   name: 'Schneider Electric', market: 'EU', yahoo: 'SU.PA', sub: 'grid', tags: ['전력관리'], purePlay: true, note: '데이터센터 전력관리(유럽)' },
  // ☢️ 원전·SMR
  { ticker: 'OKLO', name: 'Oklo',           market: 'US', sub: 'nuclear', tags: ['SMR'],            purePlay: true,  note: '차세대 SMR(샘 올트먼 후원·적자 꿈주)' },
  { ticker: 'SMR',  name: 'NuScale Power',  market: 'US', sub: 'nuclear', tags: ['SMR'],            purePlay: true,  note: 'SMR 설계 인증 선두' },
  { ticker: 'NNE',  name: 'Nano Nuclear',   market: 'US', sub: 'nuclear', tags: ['초소형원전'],     purePlay: true,  note: '마이크로 원자로(초기 단계)' },
  { ticker: 'LEU',  name: 'Centrus Energy', market: 'US', sub: 'nuclear', tags: ['농축우라늄'],     purePlay: true,  note: 'HALEU 우라늄 농축(SMR 연료)' },
  { ticker: 'CEG',  name: 'Constellation',  market: 'US', sub: 'nuclear', tags: ['원전 운영'],      purePlay: true,  note: '미 최대 원전 운영(MS 데이터센터 계약)' },
  { ticker: 'VST',  name: 'Vistra',         market: 'US', sub: 'nuclear', tags: ['원전·발전'],      purePlay: true,  note: '원전+가스 발전(AI 전력 수혜)' },
  { ticker: 'TLN',  name: 'Talen Energy',   market: 'US', sub: 'nuclear', tags: ['원전'],           purePlay: true,  note: '원전(아마존 데이터센터 직결)' },
  { ticker: '034020', name: '두산에너빌리티', market: 'KR', sub: 'nuclear', tags: ['SMR 주조'],      purePlay: true,  note: 'SMR 주단조·원전 기자재' },
  { ticker: '052690', name: '한전기술',      market: 'KR', sub: 'nuclear', tags: ['원전 설계'],      purePlay: true,  note: '원전 설계 엔지니어링' },
  // 🔌 전선·케이블
  { ticker: '001440', name: '대한전선',      market: 'KR', sub: 'cable', tags: ['초고압 전선'],      purePlay: true,  note: '초고압·해저 전선' },
  { ticker: '103590', name: '일진전기',      market: 'KR', sub: 'cable', tags: ['전선·중전기'],      purePlay: true,  note: '전선·변압기' },
  { ticker: 'PRY',  name: 'Prysmian',       market: 'EU', yahoo: 'PRY.MI', sub: 'cable', tags: ['해저케이블'], purePlay: true, note: '세계 1위 전선·해저케이블' },
  { ticker: 'NEX',  name: 'Nexans',         market: 'EU', yahoo: 'NEX.PA', sub: 'cable', tags: ['케이블'],     purePlay: true,  note: '전력 케이블(유럽)' },
  // 🔋 데이터센터 전력·발전
  { ticker: 'VRT',  name: 'Vertiv',         market: 'US', sub: 'dcpower', tags: ['전력·쿨링'],       purePlay: true,  note: 'AI 데이터센터 전력·냉각 핵심' },
  { ticker: 'BE',   name: 'Bloom Energy',   market: 'US', sub: 'dcpower', tags: ['연료전지'],        purePlay: true,  note: '온사이트 연료전지 발전' },
  { ticker: 'NRG',  name: 'NRG Energy',     market: 'US', sub: 'dcpower', tags: ['발전·소매'],       purePlay: false, note: '발전+전력 소매(다각화)' },
  { ticker: 'GNRC', name: 'Generac',        market: 'US', sub: 'dcpower', tags: ['백업 발전'],       purePlay: false, note: '백업 발전기(주거 비중 큼)' },
]
const POWER_CONFIG: SectorConfig = {
  key: 'power', label: 'AI 전력망 & 원전 인텔리전스', emoji: '⚡',
  tagline: 'AI 데이터센터 전력 폭증 → 전력망·원전(SMR) 르네상스. 전력기기·원전·전선·발전 밸류체인. 일부는 유틸리티(저성장)·일부는 SMR(적자 꿈주)로 양극단 공존 — 모멘텀+밸류체인 위치를 함께 봅니다. 교육용.',
  anchor: 'GEV', tagHeader: '역할', subMeta: POWER_SUB,
  stocks: POWER_STOCKS, overlayTickers: ['GEV', 'VST', 'OKLO', 'CEG', '034020'],
}

export const SECTORS: Record<string, SectorConfig> = {
  quantum: QUANTUM_CONFIG,
  'ai-semi': AISEMI_CONFIG,
  power: POWER_CONFIG,
}
export const SECTOR_LIST = Object.values(SECTORS).map(s => ({ key: s.key, label: s.label, emoji: s.emoji }))
