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
  material: { label: '신소재·기판·패키징', emoji: '🔬', color: '#60a5fa', desc: 'FC-BGA 기판·첨단 패키징·소재' },
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
  // 🔬 신소재·기판·패키징 (차세대 확장)
  { ticker: '011070', name: 'LG이노텍',     market: 'KR', sub: 'material', tags: ['FC-BGA 기판', '카메라'], purePlay: false, note: '플립칩 기판(AI 칩 패키징) 성장 — 단 매출 대부분 애플 카메라' },
  { ticker: '009150', name: '삼성전기',     market: 'KR', sub: 'material', tags: ['FC-BGA', 'MLCC'],   purePlay: false, note: '서버용 FC-BGA·고용량 MLCC(다각화)' },
  { ticker: '353200', name: '대덕전자',     market: 'KR', sub: 'material', tags: ['FC-BGA 기판'],      purePlay: true,  note: 'AI 가속기용 FC-BGA 기판' },
  { ticker: '014680', name: '한솔케미칼',   market: 'KR', sub: 'material', tags: ['HBM 소재'],         purePlay: true,  note: 'HBM·반도체 소재(과산화수소·QD)' },
  { ticker: '005290', name: '동진쎄미켐',   market: 'KR', sub: 'material', tags: ['EUV 포토레지스트'],  purePlay: true,  note: 'EUV 포토레지스트 국산화' },
  { ticker: 'AMKR', name: 'Amkor',          market: 'US', sub: 'material', tags: ['첨단 패키징'],       purePlay: true,  note: 'OSAT 첨단 패키징(2.5D)' },
  { ticker: 'ASX',  name: 'ASE Technology', market: 'US', sub: 'material', tags: ['OSAT 패키징'],       purePlay: true,  note: '세계 1위 OSAT 후공정' },
  { ticker: 'GLW',  name: 'Corning',        market: 'US', sub: 'material', tags: ['유리기판·광섬유'],   purePlay: false, note: '차세대 유리기판·광섬유(다각화)' },
  { ticker: '4062', name: 'Ibiden',         market: 'JP', yahoo: '4062.T', sub: 'material', tags: ['ABF 기판'], purePlay: true, note: 'ABF 기판 1위(엔비디아·인텔 공급)' },
  { ticker: 'ENTG', name: 'Entegris',       market: 'US', sub: 'material', tags: ['반도체 소재'],       purePlay: true,  note: '첨단 소재·정밀화학·필터' },
]

const AISEMI_CONFIG: SectorConfig = {
  key: 'ai-semi', label: '차세대 AI 반도체 & 신소재 인텔리전스', emoji: '🧠',
  tagline: 'AI 붐의 ‘곡괭이와 삽’ — GPU→HBM→파운드리→장비→인프라→신소재·기판·패키징 밸류체인. 칩 성능 한계를 소재·패키징(FC-BGA·유리기판)이 돌파. 실적 있는 종목 多라 모멘텀+밸류체인 위치를 함께 봅니다. 교육용.',
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

// ── 피지컬 AI (Physical AI) ───────────────────────────────────────────────────
const PHYS_SUB: Record<string, SubMeta> = {
  humanoid: { label: '휴머노이드·로봇', emoji: '🤖', color: '#a78bfa', desc: '휴머노이드·협동/산업로봇 (대장 테마)' },
  auto:     { label: '자율주행',       emoji: '🚗', color: '#22d3ee', desc: 'FSD·ADAS·로보택시' },
  vision:   { label: '비전·센서·엣지', emoji: '👁️', color: '#f59e0b', desc: '머신비전·라이다·엣지 AI 칩' },
  motion:   { label: '구동·정밀부품',  emoji: '⚙️', color: '#34d399', desc: '감속기·액추에이터·정밀구동' },
  medbot:   { label: '의료·서비스 로봇', emoji: '🩺', color: '#ec4899', desc: '수술·배송 로봇' },
}
const PHYS_STOCKS: SectorStock[] = [
  { ticker: 'TSLA', name: 'Tesla',          market: 'US', sub: 'humanoid', tags: ['휴머노이드(옵티머스)', 'FSD'], purePlay: false, note: '옵티머스 휴머노이드(단 EV 비중 큼)' },
  { ticker: '277810', name: '레인보우로보틱스', market: 'KR', sub: 'humanoid', tags: ['휴머노이드'], purePlay: true, note: '국내 휴머노이드·협동로봇(삼성 지분)' },
  { ticker: '454910', name: '두산로보틱스', market: 'KR', sub: 'humanoid', tags: ['협동로봇'],   purePlay: true,  note: '협동로봇(코봇)' },
  { ticker: '056080', name: '유진로봇',     market: 'KR', sub: 'humanoid', tags: ['자율주행 로봇'], purePlay: true, note: '자율주행 물류·청소 로봇' },
  { ticker: 'FANUY', name: 'Fanuc(ADR)',    market: 'US', sub: 'humanoid', tags: ['산업로봇'],   purePlay: true,  note: '세계 1위 산업용 로봇·CNC' },
  { ticker: '6506', name: '야스카와전기',   market: 'JP', yahoo: '6506.T', sub: 'humanoid', tags: ['산업로봇·서보'], purePlay: true, note: '서보모터·산업로봇' },
  { ticker: 'MBLY', name: 'Mobileye',       market: 'US', sub: 'auto', tags: ['ADAS·자율주행'], purePlay: true,  note: '자율주행 비전 칩·소프트웨어' },
  { ticker: 'PONY', name: 'Pony.ai',        market: 'US', sub: 'auto', tags: ['로보택시'],     purePlay: true,  note: '중국 로보택시' },
  { ticker: 'AUR',  name: 'Aurora',         market: 'US', sub: 'auto', tags: ['자율주행 트럭'], purePlay: true,  note: '자율주행 트럭(적자 꿈주)' },
  { ticker: 'CGNX', name: 'Cognex',         market: 'US', sub: 'vision', tags: ['머신비전'],   purePlay: true,  note: '머신비전 1위' },
  { ticker: 'OUST', name: 'Ouster',         market: 'US', sub: 'vision', tags: ['라이다'],     purePlay: true,  note: '디지털 라이다 센서' },
  { ticker: 'AMBA', name: 'Ambarella',      market: 'US', sub: 'vision', tags: ['엣지 AI 비전칩'], purePlay: true, note: '엣지 AI 영상처리 SoC' },
  { ticker: '011070', name: 'LG이노텍',     market: 'KR', sub: 'vision', tags: ['카메라모듈', 'ToF·3D센싱'], purePlay: false, note: '로봇·차량용 카메라·센싱 광학(단 매출 대부분 애플 폰 카메라)' },
  { ticker: '6324', name: '하모닉드라이브', market: 'JP', yahoo: '6324.T', sub: 'motion', tags: ['정밀 감속기'], purePlay: true, note: '휴머노이드 핵심 정밀 감속기 1위' },
  { ticker: '6268', name: '나브테스코',     market: 'JP', yahoo: '6268.T', sub: 'motion', tags: ['감속기'],     purePlay: true,  note: '산업로봇 감속기' },
  { ticker: '6481', name: 'THK',           market: 'JP', yahoo: '6481.T', sub: 'motion', tags: ['LM 가이드·액추에이터'], purePlay: true, note: '직선운동 가이드·액추에이터' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', market: 'US', sub: 'medbot', tags: ['수술로봇'], purePlay: true, note: '다빈치 수술로봇 독점' },
  { ticker: 'SERV', name: 'Serve Robotics', market: 'US', sub: 'medbot', tags: ['배송로봇'],    purePlay: true,  note: '자율 배송 로봇(엔비디아 투자)' },
]
const PHYS_CONFIG: SectorConfig = {
  key: 'phys-ai', label: '피지컬 AI 인텔리전스', emoji: '🦾',
  tagline: 'AI가 몸을 얻는다 — 휴머노이드·자율주행·로봇. 소프트웨어 AI 다음 메가테마. 적자 꿈주(Aurora·Serve) 多 → 모멘텀·밸류체인(두뇌→눈→관절)으로 봅니다. 교육용.',
  anchor: 'TSLA', tagHeader: '역할', subMeta: PHYS_SUB,
  stocks: PHYS_STOCKS, overlayTickers: ['TSLA', 'ISRG', 'MBLY', '277810', 'FANUY'],
}

// ── AI 바이오 (AI Bio) ────────────────────────────────────────────────────────
const BIO_SUB: Record<string, SubMeta> = {
  discovery: { label: 'AI 신약개발',   emoji: '🧬', color: '#a78bfa', desc: 'AI로 후보물질 발굴·설계 (대장 테마)' },
  dx:        { label: 'AI 진단·데이터', emoji: '🩺', color: '#22d3ee', desc: 'AI 영상진단·정밀의료 데이터' },
  genomics:  { label: '유전체·툴',     emoji: '🧪', color: '#f59e0b', desc: '시퀀싱·연구 장비' },
  pharma:    { label: '빅파마·K바이오', emoji: '💊', color: '#ec4899', desc: 'GLP-1·전통 신약(AI 도입)' },
}
const BIO_STOCKS: SectorStock[] = [
  { ticker: 'TEM',  name: 'Tempus AI',      market: 'US', sub: 'dx',        tags: ['AI 정밀의료 데이터'], purePlay: true,  note: 'AI 진단·임상 데이터 플랫폼(테마 대장주)' },
  { ticker: 'RXRX', name: 'Recursion',      market: 'US', sub: 'discovery', tags: ['AI 신약'],      purePlay: true,  note: 'AI 신약 발굴 플랫폼(엔비디아 투자)' },
  { ticker: 'SDGR', name: 'Schrödinger',    market: 'US', sub: 'discovery', tags: ['분자 시뮬'],    purePlay: true,  note: '물리기반 분자 설계 SW' },
  { ticker: 'ABCL', name: 'AbCellera',      market: 'US', sub: 'discovery', tags: ['AI 항체발굴'],  purePlay: true,  note: 'AI 항체 신약 발굴' },
  { ticker: 'GH',   name: 'Guardant Health', market: 'US', sub: 'dx',       tags: ['액체생검'],    purePlay: true,  note: 'AI 액체생검 암 진단' },
  { ticker: 'NTRA', name: 'Natera',         market: 'US', sub: 'dx',        tags: ['유전자 진단'],  purePlay: true,  note: 'cfDNA 정밀 진단' },
  { ticker: '328130', name: '루닛',         market: 'KR', sub: 'dx',        tags: ['AI 영상진단'],  purePlay: true,  note: 'AI 의료영상 진단(국내 대표)' },
  { ticker: 'ILMN', name: 'Illumina',       market: 'US', sub: 'genomics',  tags: ['시퀀싱'],      purePlay: false, note: '유전체 시퀀싱 1위(AI는 일부)' },
  { ticker: 'TXG',  name: '10x Genomics',   market: 'US', sub: 'genomics',  tags: ['단일세포 분석'], purePlay: false, note: '단일세포 유전체 툴' },
  { ticker: 'LLY',  name: 'Eli Lilly',      market: 'US', sub: 'pharma',    tags: ['GLP-1'],       purePlay: false, note: '비만치료제 1위(AI 신약은 일부)' },
  { ticker: 'NVO',  name: 'Novo Nordisk',   market: 'US', sub: 'pharma',    tags: ['GLP-1'],       purePlay: false, note: '오젬픽·위고비(다각화)' },
  { ticker: '196170', name: '알테오젠',     market: 'KR', sub: 'pharma',    tags: ['SC제형 플랫폼'], purePlay: false, note: '바이오 플랫폼(AI-native 아님)' },
  { ticker: '145020', name: '휴젤',         market: 'KR', sub: 'pharma',    tags: ['보툴리눔'],     purePlay: false, note: '톡신·필러(AI 무관)' },
]
const BIO_CONFIG: SectorConfig = {
  key: 'ai-bio', label: 'AI 바이오 인텔리전스', emoji: '🧬',
  tagline: 'AI가 신약·진단을 가속 — 후보물질 발굴·AI 영상진단·정밀의료. AI-native(Tempus·Recursion)와 전통 바이오(빅파마·K바이오)를 베타로 구분. 임상 실패 리스크 多, 교육용.',
  anchor: 'TEM', tagHeader: '역할', subMeta: BIO_SUB,
  stocks: BIO_STOCKS, overlayTickers: ['TEM', 'RXRX', 'LLY', '196170', '328130'],
}

// ── 우주항공 & 방산 (Aerospace & Defense) ─────────────────────────────────────
const DEF_SUB: Record<string, SubMeta> = {
  prime:   { label: '방산 프라임',     emoji: '🛡️', color: '#a78bfa', desc: '전투기·미사일·함정 (대장 테마)' },
  space:   { label: '우주·발사·위성',  emoji: '🚀', color: '#22d3ee', desc: '발사체·위성·달탐사(적자 꿈주 多)' },
  deftech: { label: '방산 AI·드론',    emoji: '🤖', color: '#f59e0b', desc: '국방 AI·무인기·드론' },
  aero:    { label: '항공·엔진·부품',  emoji: '✈️', color: '#34d399', desc: '항공 엔진·정밀부품·MRO' },
  kdef:    { label: 'K-방산',          emoji: '🇰🇷', color: '#ec4899', desc: '한국 방산 수출 호황' },
}
const DEF_STOCKS: SectorStock[] = [
  // 🛡️ 방산 프라임
  { ticker: 'RTX',  name: 'RTX(레이시온)',  market: 'US', sub: 'prime', tags: ['미사일·방공·엔진'], purePlay: true,  note: '미사일·방공+항공엔진(테마 대장주)' },
  { ticker: 'LMT',  name: 'Lockheed Martin', market: 'US', sub: 'prime', tags: ['F-35·미사일'],     purePlay: true,  note: 'F-35 전투기·미사일 1위' },
  { ticker: 'NOC',  name: 'Northrop Grumman', market: 'US', sub: 'prime', tags: ['폭격기·우주'],    purePlay: true,  note: 'B-21 폭격기·우주·핵' },
  { ticker: 'GD',   name: 'General Dynamics', market: 'US', sub: 'prime', tags: ['잠수함·전차'],    purePlay: true,  note: '핵잠수함·전차·걸프스트림' },
  { ticker: 'BA',   name: 'Boeing',         market: 'US', sub: 'prime', tags: ['항공기·방산'],      purePlay: false, note: '민항기+방산(상업 항공 부진)' },
  // 🚀 우주·발사·위성
  { ticker: 'SPCX', name: 'SpaceX',         market: 'US', sub: 'space', tags: ['발사체·스타링크'], purePlay: true,  note: '우주 발사·스타링크 절대강자(2026.6 상장, 우주 대장주)' },
  { ticker: 'RKLB', name: 'Rocket Lab',     market: 'US', sub: 'space', tags: ['소형 발사체'],     purePlay: true,  note: '소형 로켓·위성(스페이스X 대항마)' },
  { ticker: 'ASTS', name: 'AST SpaceMobile', market: 'US', sub: 'space', tags: ['위성통신'],       purePlay: true,  note: '위성-스마트폰 직접 통신(적자 꿈주)' },
  { ticker: 'LUNR', name: 'Intuitive Machines', market: 'US', sub: 'space', tags: ['달 착륙선'],   purePlay: true,  note: '민간 달 착륙(NASA 계약)' },
  { ticker: 'RDW',  name: 'Redwire',        market: 'US', sub: 'space', tags: ['우주 인프라'],      purePlay: true,  note: '우주 제조·구조물' },
  { ticker: 'PL',   name: 'Planet Labs',    market: 'US', sub: 'space', tags: ['지구관측 위성'],    purePlay: true,  note: '위성 영상·지구관측 데이터' },
  // 🤖 방산 AI·드론
  { ticker: 'PLTR', name: 'Palantir',       market: 'US', sub: 'deftech', tags: ['국방 AI SW'],    purePlay: false, note: '국방 AI 데이터 분석(상업 비중도 큼)' },
  { ticker: 'AVAV', name: 'AeroVironment',  market: 'US', sub: 'deftech', tags: ['군용 드론'],     purePlay: true,  note: '군용 무인기·자폭드론(스위치블레이드)' },
  { ticker: 'KTOS', name: 'Kratos',         market: 'US', sub: 'deftech', tags: ['무인기·표적기'], purePlay: true,  note: '무인 전투기·표적 드론' },
  { ticker: 'RCAT', name: 'Red Cat',        market: 'US', sub: 'deftech', tags: ['군용 드론'],     purePlay: true,  note: '군용 소형 드론(적자 꿈주)' },
  // ✈️ 항공·엔진·부품
  { ticker: 'GE',   name: 'GE Aerospace',   market: 'US', sub: 'aero', tags: ['항공 엔진'],        purePlay: true,  note: '세계 1위 항공 엔진(LEAP)' },
  { ticker: 'HWM',  name: 'Howmet',         market: 'US', sub: 'aero', tags: ['엔진 부품'],        purePlay: true,  note: '항공 엔진 정밀 부품·합금' },
  { ticker: 'TDG',  name: 'TransDigm',      market: 'US', sub: 'aero', tags: ['항공 부품'],        purePlay: true,  note: '항공 부품 독점·고마진' },
  { ticker: 'HEI',  name: 'Heico',          market: 'US', sub: 'aero', tags: ['항공 부품·MRO'],    purePlay: true,  note: '항공 부품·정비(MRO)' },
  { ticker: 'SAF',  name: 'Safran',         market: 'EU', yahoo: 'SAF.PA', sub: 'aero', tags: ['항공 엔진'], purePlay: true, note: 'CFM 엔진(GE 합작)·랜딩기어' },
  { ticker: 'RR',   name: 'Rolls-Royce',    market: 'EU', yahoo: 'RR.L', sub: 'aero', tags: ['항공 엔진'],  purePlay: true,  note: '와이드바디 항공 엔진' },
  // 🇰🇷 K-방산
  { ticker: '012450', name: '한화에어로스페이스', market: 'KR', sub: 'kdef', tags: ['자주포·우주발사체'], purePlay: true, note: 'K9 자주포·누리호 엔진(수출 호황)' },
  { ticker: '047810', name: '한국항공우주(KAI)', market: 'KR', sub: 'kdef', tags: ['전투기·발사체'], purePlay: true, note: 'FA-50 경전투기·우주발사체' },
  { ticker: '079550', name: 'LIG넥스원',    market: 'KR', sub: 'kdef', tags: ['유도미사일'],       purePlay: true,  note: '천궁·현궁 유도미사일(중동 수출)' },
  { ticker: '064350', name: '현대로템',     market: 'KR', sub: 'kdef', tags: ['전차·철도'],        purePlay: false, note: 'K2 전차+철도차량(다각화)' },
  { ticker: '272210', name: '한화시스템',   market: 'KR', sub: 'kdef', tags: ['방산전자·위성'],    purePlay: true,  note: '레이더·방산 전자·위성통신' },
]
const DEF_CONFIG: SectorConfig = {
  key: 'defense', label: '우주항공 & 방산 인텔리전스', emoji: '🚀',
  tagline: '지정학 긴장 + 우주 상업화 + 국방 AI 3대 축. 프라임(안정 실적)·우주SPAC(적자 꿈주)·K방산(수출 호황)이 양극단 공존 — 모멘텀·하위테마 위치를 함께 봅니다. 교육용.',
  anchor: 'RTX', tagHeader: '역할', subMeta: DEF_SUB,
  stocks: DEF_STOCKS, overlayTickers: ['RTX', 'LMT', 'SPCX', 'PLTR', '012450'],
}

export const SECTORS: Record<string, SectorConfig> = {
  quantum: QUANTUM_CONFIG,
  'ai-semi': AISEMI_CONFIG,
  power: POWER_CONFIG,
  'phys-ai': PHYS_CONFIG,
  'ai-bio': BIO_CONFIG,
  defense: DEF_CONFIG,
}
export const SECTOR_LIST = Object.values(SECTORS).map(s => ({ key: s.key, label: s.label, emoji: s.emoji }))
