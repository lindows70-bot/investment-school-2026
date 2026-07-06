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
  { ticker: 'SNDK', name: 'SanDisk',       market: 'US', sub: 'memory', tags: ['NAND 플래시'],       purePlay: true,  note: 'NAND 플래시 메모리 전문(2025 WD 분사)' },
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
  { ticker: 'VICR', name: 'Vicor',         market: 'US', sub: 'infra', tags: ['고밀도 전력모듈'],     purePlay: true,  note: 'AI GPU 전원공급 고밀도 전력변환 모듈(PoP)' },
  // 🔬 신소재·기판·패키징 (차세대 확장)
  { ticker: '011070', name: 'LG이노텍',     market: 'KR', sub: 'material', tags: ['FC-BGA 기판', '카메라'], purePlay: false, note: '플립칩 기판(AI 칩 패키징) 성장 — 단 매출 대부분 애플 카메라' },
  { ticker: '009150', name: '삼성전기',     market: 'KR', sub: 'material', tags: ['FC-BGA', 'MLCC'],   purePlay: false, note: '서버용 FC-BGA·고용량 MLCC(다각화)' },
  { ticker: '353200', name: '대덕전자',     market: 'KR', sub: 'material', tags: ['FC-BGA 기판'],      purePlay: true,  note: 'AI 가속기용 FC-BGA 기판' },
  { ticker: '007660', name: '이수페타시스', market: 'KR', sub: 'material', tags: ['MLB 고다층 PCB'],    purePlay: true,  note: 'AI 가속기·스위치용 고다층 기판(MLB) — 엔비디아·구글 공급' },
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

// ── 💰 금융 (Financials) — GICS 11섹터 中 첫 전통 산업 섹터 ──────────────────
const FIN_SUB: Record<string, SubMeta> = {
  bank:      { label: '은행·금융지주', emoji: '🏦', color: '#60a5fa', desc: '예대마진(NIM)·금리 수혜 (섹터 핵심)' },
  insurance: { label: '보험',          emoji: '🛡️', color: '#34d399', desc: '생명·손해보험 — 운용수익·금리 민감' },
  broker:    { label: '증권·자산운용',  emoji: '📈', color: '#f59e0b', desc: '브로커리지·IB·자산운용 수수료' },
  payment:   { label: '카드·결제',      emoji: '💳', color: '#ec4899', desc: '카드·결제 네트워크·캐피탈' },
}
const FIN_STOCKS: SectorStock[] = [
  // 🏦 은행·금융지주
  { ticker: 'JPM',  name: 'JPMorgan',       market: 'US', sub: 'bank', tags: ['글로벌 1위 은행'], purePlay: true,  note: '미 최대 은행·IB(섹터 대장주)' },
  { ticker: 'BAC',  name: 'Bank of America', market: 'US', sub: 'bank', tags: ['상업은행'],       purePlay: true,  note: '미 2위 소매·상업은행' },
  { ticker: 'WFC',  name: 'Wells Fargo',     market: 'US', sub: 'bank', tags: ['소매은행'],       purePlay: true,  note: '미 대형 소매은행' },
  { ticker: '055550', name: '신한지주',      market: 'KR', sub: 'bank', tags: ['금융지주'],       purePlay: true,  note: '국내 대표 금융지주' },
  { ticker: '105560', name: 'KB금융',        market: 'KR', sub: 'bank', tags: ['금융지주'],       purePlay: true,  note: '국내 최대 금융지주(리딩뱅크)' },
  { ticker: '086790', name: '하나금융지주',   market: 'KR', sub: 'bank', tags: ['금융지주'],       purePlay: true,  note: '국내 대형 금융지주' },
  { ticker: '316140', name: '우리금융지주',   market: 'KR', sub: 'bank', tags: ['금융지주'],       purePlay: true,  note: '국내 금융지주(은행 비중 큼)' },
  // 🛡️ 보험
  { ticker: '032830', name: '삼성생명',      market: 'KR', sub: 'insurance', tags: ['생명보험'],   purePlay: true,  note: '국내 1위 생명보험(자산운용)' },
  { ticker: '000810', name: '삼성화재',      market: 'KR', sub: 'insurance', tags: ['손해보험'],   purePlay: true,  note: '국내 1위 손해보험' },
  { ticker: '138040', name: '메리츠금융지주', market: 'KR', sub: 'insurance', tags: ['보험·금융'], purePlay: true,  note: '보험 중심 금융지주(고ROE)' },
  { ticker: 'BRK-B', name: 'Berkshire',      market: 'US', sub: 'insurance', tags: ['보험·복합'], purePlay: false, note: '버핏 보험+복합기업(투자지주)' },
  { ticker: 'PGR',  name: 'Progressive',     market: 'US', sub: 'insurance', tags: ['자동차보험'], purePlay: true,  note: '미 자동차보험 강자' },
  { ticker: 'CB',   name: 'Chubb',           market: 'US', sub: 'insurance', tags: ['손해보험'],   purePlay: true,  note: '글로벌 손해보험' },
  { ticker: 'MET',  name: 'MetLife',         market: 'US', sub: 'insurance', tags: ['생명보험'],   purePlay: true,  note: '미 대형 생명보험' },
  // 📈 증권·자산운용
  { ticker: 'GS',   name: 'Goldman Sachs',   market: 'US', sub: 'broker', tags: ['IB'],           purePlay: true,  note: '글로벌 투자은행 1위' },
  { ticker: 'MS',   name: 'Morgan Stanley',  market: 'US', sub: 'broker', tags: ['IB·WM'],        purePlay: true,  note: 'IB+자산관리' },
  { ticker: 'SCHW', name: 'Charles Schwab',  market: 'US', sub: 'broker', tags: ['브로커리지'],   purePlay: true,  note: '미 최대 리테일 브로커' },
  { ticker: 'BLK',  name: 'BlackRock',       market: 'US', sub: 'broker', tags: ['자산운용'],     purePlay: true,  note: '세계 1위 자산운용(ETF iShares)' },
  { ticker: '006800', name: '미래에셋증권',   market: 'KR', sub: 'broker', tags: ['증권'],         purePlay: true,  note: '국내 대형 증권사' },
  { ticker: '071050', name: '한국금융지주',   market: 'KR', sub: 'broker', tags: ['증권지주'],     purePlay: true,  note: '한국투자증권 지주' },
  { ticker: '039490', name: '키움증권',      market: 'KR', sub: 'broker', tags: ['리테일 증권'],   purePlay: true,  note: '리테일 브로커리지 1위' },
  // 💳 카드·결제
  { ticker: 'V',    name: 'Visa',            market: 'US', sub: 'payment', tags: ['결제 네트워크'], purePlay: true, note: '글로벌 결제 네트워크 1위' },
  { ticker: 'MA',   name: 'Mastercard',      market: 'US', sub: 'payment', tags: ['결제 네트워크'], purePlay: true, note: '글로벌 결제 네트워크 2위' },
  { ticker: 'AXP',  name: 'American Express', market: 'US', sub: 'payment', tags: ['카드·결제'],    purePlay: true, note: '프리미엄 카드(버핏 보유)' },
  { ticker: '029780', name: '삼성카드',      market: 'KR', sub: 'payment', tags: ['카드'],         purePlay: true,  note: '국내 카드사' },
]
const FIN_CONFIG: SectorConfig = {
  key: 'financials', label: '금융 (은행·보험·증권)', emoji: '💰',
  tagline: 'GICS 11섹터 中 금융 — ‘꿈의 테마’와 달리 실적·자본이 탄탄한 전통 가치주. 은행(NIM·금리 수혜)·보험(운용수익)·증권(거래대금)·카드(결제). ⚠️ PER·총마진·이자보상배율 등 일반 지표가 구조적으로 부적합 → ROE·PBR·내재가치(EV)로 본다. 모멘텀·업종 내 상대강도로 봅니다. 교육용.',
  anchor: 'JPM', tagHeader: '업종', subMeta: FIN_SUB,
  stocks: FIN_STOCKS, overlayTickers: ['JPM', 'BAC', 'GS', 'V', '105560'],
}

// ── ⚡ 에너지 (Energy) ─────────────────────────────────────────────────────────
const ENERGY_SUB: Record<string, SubMeta> = {
  integrated: { label: '통합 에너지', emoji: '🛢️', color: '#60a5fa', desc: '탐사~정유 수직계열 (대형)' },
  ep:         { label: 'E&P 탐사·생산', emoji: '⛏️', color: '#f59e0b', desc: '상류 원유·가스 생산' },
  service:    { label: '서비스·장비', emoji: '🔧', color: '#34d399', desc: '시추·유전 서비스' },
  refine:     { label: '정유·미드스트림', emoji: '🏭', color: '#ec4899', desc: '정제·파이프라인·저장' },
}
const ENERGY_STOCKS: SectorStock[] = [
  { ticker: 'XOM', name: 'ExxonMobil',  market: 'US', sub: 'integrated', tags: ['통합'],   purePlay: true,  note: '미 최대 통합 에너지(대장주)' },
  { ticker: 'CVX', name: 'Chevron',     market: 'US', sub: 'integrated', tags: ['통합'],   purePlay: true,  note: '미 2위 통합 에너지' },
  { ticker: 'SHEL', name: 'Shell',      market: 'US', sub: 'integrated', tags: ['통합'],   purePlay: true,  note: '유럽 통합 메이저' },
  { ticker: '096770', name: 'SK이노베이션', market: 'KR', sub: 'integrated', tags: ['정유·배터리'], purePlay: false, note: '국내 정유+배터리(다각화)' },
  { ticker: 'COP', name: 'ConocoPhillips', market: 'US', sub: 'ep', tags: ['E&P'],         purePlay: true,  note: '미 최대 순수 E&P' },
  { ticker: 'EOG', name: 'EOG Resources', market: 'US', sub: 'ep', tags: ['셰일'],         purePlay: true,  note: '셰일 E&P 효율 1위' },
  { ticker: 'OXY', name: 'Occidental',  market: 'US', sub: 'ep', tags: ['E&P'],            purePlay: true,  note: '버핏 보유 E&P' },
  { ticker: 'DVN', name: 'Devon Energy', market: 'US', sub: 'ep', tags: ['셰일'],          purePlay: true,  note: '셰일 가스·원유' },
  { ticker: 'SLB', name: 'Schlumberger', market: 'US', sub: 'service', tags: ['유전서비스'], purePlay: true, note: '세계 1위 유전 서비스' },
  { ticker: 'HAL', name: 'Halliburton', market: 'US', sub: 'service', tags: ['시추'],       purePlay: true,  note: '유전 서비스·시추' },
  { ticker: 'MPC', name: 'Marathon Petroleum', market: 'US', sub: 'refine', tags: ['정유'], purePlay: true,  note: '미 대형 정유' },
  { ticker: 'PSX', name: 'Phillips 66', market: 'US', sub: 'refine', tags: ['정유'],        purePlay: true,  note: '정유·화학·미드스트림' },
  { ticker: 'KMI', name: 'Kinder Morgan', market: 'US', sub: 'refine', tags: ['파이프라인'], purePlay: true,  note: '북미 최대 미드스트림' },
  { ticker: '010950', name: 'S-Oil',    market: 'KR', sub: 'refine', tags: ['정유'],        purePlay: true,  note: '국내 정유사' },
  // 🆕 3:3 보강
  { ticker: '078930', name: 'GS',       market: 'KR', sub: 'integrated', tags: ['정유·유통'], purePlay: false, note: 'GS칼텍스(정유) 지주' },
  { ticker: '267250', name: 'HD현대',   market: 'KR', sub: 'integrated', tags: ['정유·조선'], purePlay: false, note: 'HD현대오일뱅크(정유) 지주' },
  { ticker: 'BKR',  name: 'Baker Hughes', market: 'US', sub: 'service', tags: ['유전서비스'], purePlay: true, note: '유전 서비스·장비 빅3' },
  { ticker: '018670', name: 'SK가스',   market: 'KR', sub: 'ep', tags: ['LPG·가스'],        purePlay: true,  note: 'LPG 수입·유통(국내 상류 E&P 부재 → 가스로 대체)' },
]
const ENERGY_CONFIG: SectorConfig = {
  key: 'energy', label: '에너지', emoji: '⚡',
  tagline: 'GICS 에너지 — 유가에 이익이 좌우되는 대표 경기순환주. 통합 메이저·E&P(상류)·유전서비스·정유/미드스트림 밸류체인. ⚠️ 저PER이 정점 신호일 수 있는 시클리컬 함정 주의. 모멘텀·유가 사이클로 봅니다. 교육용.',
  anchor: 'XOM', tagHeader: '업종', subMeta: ENERGY_SUB,
  stocks: ENERGY_STOCKS, overlayTickers: ['XOM', 'CVX', 'COP', 'SLB', '010950'],
}

// ── 🧱 소재 (Materials) ────────────────────────────────────────────────────────
const MAT_SUB: Record<string, SubMeta> = {
  chemical: { label: '화학·산업가스', emoji: '⚗️', color: '#60a5fa', desc: '기초·정밀화학·산업가스 (대형)' },
  metal:    { label: '철강·비철금속', emoji: '🔩', color: '#f59e0b', desc: '철강·구리·알루미늄' },
  mining:   { label: '광물·귀금속',   emoji: '⛰️', color: '#34d399', desc: '금·동·리튬 채굴' },
  build:    { label: '건축자재·도료', emoji: '🧱', color: '#ec4899', desc: '시멘트·도료·포장재' },
}
const MAT_STOCKS: SectorStock[] = [
  { ticker: 'LIN', name: 'Linde',       market: 'US', sub: 'chemical', tags: ['산업가스'], purePlay: true,  note: '세계 1위 산업용 가스(대장주)' },
  { ticker: 'APD', name: 'Air Products', market: 'US', sub: 'chemical', tags: ['산업가스'], purePlay: true, note: '산업가스·수소' },
  { ticker: 'DOW', name: 'Dow',         market: 'US', sub: 'chemical', tags: ['기초화학'], purePlay: true,  note: '기초 화학 소재' },
  { ticker: 'DD',  name: 'DuPont',      market: 'US', sub: 'chemical', tags: ['정밀화학'], purePlay: true,  note: '정밀·전자소재 화학' },
  { ticker: '051910', name: 'LG화학',   market: 'KR', sub: 'chemical', tags: ['화학·배터리소재'], purePlay: false, note: '석유화학+배터리 소재(다각화)' },
  { ticker: '011170', name: '롯데케미칼', market: 'KR', sub: 'chemical', tags: ['석유화학'], purePlay: true, note: '국내 석유화학' },
  { ticker: '011780', name: '금호석유',  market: 'KR', sub: 'chemical', tags: ['합성고무'], purePlay: true,  note: '합성고무·정밀화학' },
  { ticker: 'NUE', name: 'Nucor',       market: 'US', sub: 'metal', tags: ['철강'],        purePlay: true,  note: '미 최대 전기로 철강' },
  { ticker: 'FCX', name: 'Freeport',    market: 'US', sub: 'metal', tags: ['구리'],        purePlay: true,  note: '세계적 구리 광산' },
  { ticker: '005490', name: 'POSCO홀딩스', market: 'KR', sub: 'metal', tags: ['철강·리튬'], purePlay: false, note: '국내 1위 철강+2차전지 소재' },
  { ticker: '010130', name: '고려아연',  market: 'KR', sub: 'metal', tags: ['비철금속'],   purePlay: true,  note: '아연·연 제련 1위' },
  { ticker: 'NEM', name: 'Newmont',     market: 'US', sub: 'mining', tags: ['금'],         purePlay: true,  note: '세계 최대 금광' },
  { ticker: 'SHW', name: 'Sherwin-Williams', market: 'US', sub: 'build', tags: ['도료'],   purePlay: true,  note: '미 1위 페인트·도료' },
  { ticker: 'ECL', name: 'Ecolab',      market: 'US', sub: 'build', tags: ['위생화학'],    purePlay: true,  note: '물·위생 특수화학' },
  // 🆕 3:3 보강
  { ticker: '004020', name: '현대제철', market: 'KR', sub: 'metal', tags: ['철강'],        purePlay: true,  note: '국내 2위 철강(자동차강판)' },
  { ticker: '103140', name: '풍산',     market: 'KR', sub: 'metal', tags: ['구리·비철'],   purePlay: true,  note: '동·신동·방산 소재' },
  { ticker: 'VMC',  name: 'Vulcan Materials', market: 'US', sub: 'build', tags: ['골재'],  purePlay: true,  note: '미 1위 건설 골재' },
  { ticker: 'MLM',  name: 'Martin Marietta', market: 'US', sub: 'build', tags: ['골재'],   purePlay: true,  note: '건설 골재·시멘트' },
  { ticker: '300720', name: '한일시멘트', market: 'KR', sub: 'build', tags: ['시멘트'],     purePlay: true,  note: '국내 시멘트' },
  { ticker: '038500', name: '삼표시멘트', market: 'KR', sub: 'build', tags: ['시멘트'],     purePlay: true,  note: '국내 시멘트' },
  { ticker: '183190', name: '아세아시멘트', market: 'KR', sub: 'build', tags: ['시멘트'],   purePlay: true,  note: '국내 시멘트' },
  { ticker: 'STLD', name: 'Steel Dynamics', market: 'US', sub: 'metal', tags: ['철강'],     purePlay: true,  note: '미 전기로 철강' },
  { ticker: 'WPM',  name: 'Wheaton',     market: 'US', sub: 'mining', tags: ['귀금속 스트리밍'], purePlay: true, note: '금·은 스트리밍(로열티)' },
  { ticker: 'SCCO', name: 'Southern Copper', market: 'US', sub: 'mining', tags: ['구리광산'], purePlay: true, note: '세계적 구리 광산(국내 광산 부재)' },
]
const MAT_CONFIG: SectorConfig = {
  key: 'materials', label: '소재', emoji: '🧱',
  tagline: 'GICS 소재 — 화학·금속·광물·건축자재. 경기 초입에 강한 시클리컬. 원자재 가격·중국 수요에 민감. ⚠️ 철강·화학은 이익 정점에서 저PER 함정 주의. 모멘텀·원자재 사이클로 봅니다. 교육용.',
  anchor: 'LIN', tagHeader: '업종', subMeta: MAT_SUB,
  stocks: MAT_STOCKS, overlayTickers: ['LIN', 'APD', 'NUE', '005490', 'SHW'],
}

// ── 🏗️ 산업재 (Industrials) ────────────────────────────────────────────────────
const IND_SUB: Record<string, SubMeta> = {
  machinery: { label: '기계·중장비',   emoji: '⚙️', color: '#60a5fa', desc: '건설·농기계·산업기계 (대형)' },
  aero:      { label: '항공·방산',     emoji: '✈️', color: '#f59e0b', desc: '항공기·엔진·방산' },
  transport: { label: '운송·물류',     emoji: '🚚', color: '#34d399', desc: '철도·항공화물·택배' },
  electrical: { label: '전기장비·복합', emoji: '🔌', color: '#ec4899', desc: '전력관리·자동화·복합기업' },
}
const IND_STOCKS: SectorStock[] = [
  { ticker: 'CAT', name: 'Caterpillar', market: 'US', sub: 'machinery', tags: ['중장비'], purePlay: true,  note: '세계 1위 건설중장비(대장주)' },
  { ticker: 'DE',  name: 'Deere',       market: 'US', sub: 'machinery', tags: ['농기계'], purePlay: true,  note: '농기계 1위' },
  { ticker: '034020', name: '두산에너빌리티', market: 'KR', sub: 'machinery', tags: ['발전기자재·SMR'], purePlay: true, note: '발전 기자재·원전(테마 중복)' },
  { ticker: 'GE',  name: 'GE Aerospace', market: 'US', sub: 'aero', tags: ['항공엔진'],   purePlay: true,  note: '세계 1위 항공 엔진' },
  { ticker: 'RTX', name: 'RTX',         market: 'US', sub: 'aero', tags: ['방산·엔진'],    purePlay: true,  note: '방산+항공엔진(방산테마 중복)' },
  { ticker: 'BA',  name: 'Boeing',      market: 'US', sub: 'aero', tags: ['항공기'],       purePlay: false, note: '민항기+방산' },
  { ticker: '012450', name: '한화에어로스페이스', market: 'KR', sub: 'aero', tags: ['방산'], purePlay: true, note: 'K방산 대표(방산테마 중복)' },
  { ticker: 'UNP', name: 'Union Pacific', market: 'US', sub: 'transport', tags: ['철도'],  purePlay: true,  note: '미 최대 화물 철도' },
  { ticker: 'UPS', name: 'UPS',         market: 'US', sub: 'transport', tags: ['택배'],    purePlay: true,  note: '글로벌 물류·택배' },
  { ticker: 'HON', name: 'Honeywell',   market: 'US', sub: 'electrical', tags: ['복합'],   purePlay: true,  note: '항공·자동화 복합기업' },
  { ticker: 'ETN', name: 'Eaton',       market: 'US', sub: 'electrical', tags: ['전력관리'], purePlay: true, note: '전력관리(전력망 테마 중복)' },
  { ticker: 'MMM', name: '3M',          market: 'US', sub: 'electrical', tags: ['복합소재'], purePlay: false, note: '다각화 복합기업' },
  { ticker: '329180', name: 'HD현대중공업', market: 'KR', sub: 'machinery', tags: ['조선'], purePlay: true,  note: '국내 조선 빅3' },
  // 🆕 3:3 보강
  { ticker: 'IR',   name: 'Ingersoll Rand', market: 'US', sub: 'machinery', tags: ['산업기계'], purePlay: true, note: '유체·압축 산업기계' },
  { ticker: '267270', name: 'HD현대건설기계', market: 'KR', sub: 'machinery', tags: ['건설기계'], purePlay: true, note: '굴착기 등 건설기계' },
  { ticker: '241560', name: '두산밥캣', market: 'KR', sub: 'machinery', tags: ['소형건설기계'], purePlay: true, note: '북미 소형건설장비 강자' },
  { ticker: '079550', name: 'LIG넥스원', market: 'KR', sub: 'aero', tags: ['방산·미사일'], purePlay: true, note: '유도무기 등 K방산' },
  { ticker: '047810', name: '한국항공우주', market: 'KR', sub: 'aero', tags: ['항공기·KAI'], purePlay: true, note: '국내 항공기 제조(KAI)' },
  { ticker: 'FDX',  name: 'FedEx',       market: 'US', sub: 'transport', tags: ['특송·물류'], purePlay: true, note: '글로벌 특송 물류' },
  { ticker: '011200', name: 'HMM',      market: 'KR', sub: 'transport', tags: ['해운'],     purePlay: true,  note: '국내 1위 컨테이너 해운' },
  { ticker: '003490', name: '대한항공', market: 'KR', sub: 'transport', tags: ['항공'],     purePlay: true,  note: '국내 1위 항공(화물·여객)' },
  { ticker: '000120', name: 'CJ대한통운', market: 'KR', sub: 'transport', tags: ['택배·물류'], purePlay: true, note: '국내 1위 택배·물류' },
  { ticker: '010120', name: 'LS ELECTRIC', market: 'KR', sub: 'electrical', tags: ['전력기기'], purePlay: true, note: '전력기기·자동화(전력망 테마 중복)' },
  { ticker: '267260', name: 'HD현대일렉트릭', market: 'KR', sub: 'electrical', tags: ['변압기'], purePlay: true, note: '변압기 등 전력기기(수출 호황)' },
  { ticker: '298040', name: '효성중공업', market: 'KR', sub: 'electrical', tags: ['변압기·중전기'], purePlay: true, note: '초고압 변압기·중전기' },
]
const IND_CONFIG: SectorConfig = {
  key: 'industrials', label: '산업재', emoji: '🏗️',
  tagline: 'GICS 산업재 — 기계·항공/방산·운송·전기장비. 경기 회복·인프라 투자 수혜. ⚠️ 일부 종목은 AI 전력망·방산 테마와 겹침(같은 종목이 GICS와 테마 양쪽에 — 분류 차이 학습). 모멘텀·경기 사이클로 봅니다. 교육용.',
  anchor: 'CAT', tagHeader: '업종', subMeta: IND_SUB,
  stocks: IND_STOCKS, overlayTickers: ['CAT', 'GE', 'HON', '012450', 'UNP'],
}

// ── 🛒 자유소비재 (Consumer Discretionary) ────────────────────────────────────
const DISC_SUB: Record<string, SubMeta> = {
  retail:  { label: '소매·이커머스', emoji: '🛍️', color: '#60a5fa', desc: '이커머스·대형 소매 (대형)' },
  auto:    { label: '자동차',        emoji: '🚗', color: '#f59e0b', desc: '완성차·부품' },
  apparel: { label: '의류·명품',     emoji: '👟', color: '#34d399', desc: '스포츠·패션·럭셔리' },
  leisure: { label: '여행·외식',     emoji: '🍔', color: '#ec4899', desc: '호텔·여행·레스토랑' },
}
const DISC_STOCKS: SectorStock[] = [
  { ticker: 'AMZN', name: 'Amazon',     market: 'US', sub: 'retail', tags: ['이커머스'],  purePlay: false, note: '이커머스+클라우드(대장주)' },
  { ticker: 'HD',  name: 'Home Depot',  market: 'US', sub: 'retail', tags: ['홈임프로브'], purePlay: true,  note: '미 1위 주택건자재 소매' },
  { ticker: 'LOW', name: "Lowe's",      market: 'US', sub: 'retail', tags: ['홈임프로브'], purePlay: true,  note: '주택 리모델링 소매' },
  { ticker: 'TSLA', name: 'Tesla',      market: 'US', sub: 'auto', tags: ['EV'],          purePlay: false, note: 'EV 대장(피지컬AI 테마 중복)' },
  { ticker: '005380', name: '현대차',    market: 'KR', sub: 'auto', tags: ['완성차'],      purePlay: true,  note: '국내 1위 완성차' },
  { ticker: '000270', name: '기아',      market: 'KR', sub: 'auto', tags: ['완성차'],      purePlay: true,  note: '국내 2위 완성차' },
  { ticker: 'GM',  name: 'General Motors', market: 'US', sub: 'auto', tags: ['완성차'],    purePlay: true,  note: '미 완성차' },
  { ticker: 'NKE', name: 'Nike',        market: 'US', sub: 'apparel', tags: ['스포츠'],    purePlay: true,  note: '글로벌 스포츠웨어 1위' },
  { ticker: 'LULU', name: 'Lululemon',  market: 'US', sub: 'apparel', tags: ['애슬레저'],  purePlay: true,  note: '프리미엄 애슬레저' },
  { ticker: 'MCD', name: "McDonald's",  market: 'US', sub: 'leisure', tags: ['외식'],      purePlay: true,  note: '글로벌 패스트푸드 1위' },
  { ticker: 'SBUX', name: 'Starbucks',  market: 'US', sub: 'leisure', tags: ['커피'],      purePlay: true,  note: '글로벌 커피 체인' },
  { ticker: 'BKNG', name: 'Booking',    market: 'US', sub: 'leisure', tags: ['여행예약'],  purePlay: true,  note: '글로벌 여행 예약 1위' },
  { ticker: '008770', name: '호텔신라',  market: 'KR', sub: 'leisure', tags: ['면세·호텔'], purePlay: true,  note: '국내 면세·호텔' },
  // 🆕 3:3 보강
  { ticker: 'F',    name: 'Ford',       market: 'US', sub: 'auto', tags: ['완성차'],       purePlay: true,  note: '미 완성차(픽업·EV)' },
  { ticker: '012330', name: '현대모비스', market: 'KR', sub: 'auto', tags: ['자동차부품'], purePlay: true,  note: '국내 1위 자동차 부품·모듈' },
  { ticker: 'DECK', name: 'Deckers',    market: 'US', sub: 'apparel', tags: ['신발'],       purePlay: true,  note: '호카·어그(프리미엄 신발)' },
  { ticker: '105630', name: '한세실업', market: 'KR', sub: 'apparel', tags: ['OEM 의류'],   purePlay: true,  note: '글로벌 의류 OEM' },
  { ticker: '111770', name: '영원무역', market: 'KR', sub: 'apparel', tags: ['아웃도어 OEM'], purePlay: true, note: '노스페이스 등 OEM·브랜드' },
  { ticker: '035250', name: '강원랜드', market: 'KR', sub: 'leisure', tags: ['카지노·리조트'], purePlay: true, note: '국내 유일 내국인 카지노' },
  { ticker: '039130', name: '하나투어', market: 'KR', sub: 'leisure', tags: ['여행'],       purePlay: true,  note: '국내 1위 여행사' },
  { ticker: '023530', name: '롯데쇼핑', market: 'KR', sub: 'retail', tags: ['백화점·마트'], purePlay: true,  note: '롯데 백화점·마트' },
  { ticker: '069960', name: '현대백화점', market: 'KR', sub: 'retail', tags: ['백화점'],     purePlay: true,  note: '국내 백화점' },
  { ticker: '004170', name: '신세계',   market: 'KR', sub: 'retail', tags: ['백화점·면세'], purePlay: true,  note: '신세계 백화점·면세' },
  { ticker: '081660', name: '미스토홀딩스', market: 'KR', sub: 'apparel', tags: ['신발·패션'], purePlay: true, note: '휠라 등 패션(구 휠라홀딩스)' },
]
const DISC_CONFIG: SectorConfig = {
  key: 'discretionary', label: '자유소비재', emoji: '🛒',
  tagline: 'GICS 자유소비재(경기소비재) — 이커머스·자동차·의류·여행/외식. 경기 좋을 때 지갑을 여는 소비. 금리·고용에 민감. ⚠️ 테슬라 등은 AI 테마와 겹침. 모멘텀·소비 사이클로 봅니다. 교육용.',
  anchor: 'AMZN', tagHeader: '업종', subMeta: DISC_SUB,
  stocks: DISC_STOCKS, overlayTickers: ['AMZN', 'HD', '005380', 'NKE', 'MCD'],
}

// ── 🥫 필수소비재 (Consumer Staples) ──────────────────────────────────────────
const STAP_SUB: Record<string, SubMeta> = {
  retail:  { label: '필수 유통',     emoji: '🏪', color: '#60a5fa', desc: '대형마트·창고형 (방어)' },
  food:    { label: '음식료·음료',   emoji: '🥤', color: '#f59e0b', desc: '식품·음료 제조' },
  house:   { label: '생활용품',      emoji: '🧴', color: '#34d399', desc: 'household·퍼스널케어' },
  tobacco: { label: '담배',          emoji: '🚬', color: '#ec4899', desc: '담배·고배당' },
}
const STAP_STOCKS: SectorStock[] = [
  { ticker: 'COST', name: 'Costco',     market: 'US', sub: 'retail', tags: ['창고형'],     purePlay: true,  note: '창고형 유통 1위(대장주)' },
  { ticker: 'WMT', name: 'Walmart',     market: 'US', sub: 'retail', tags: ['대형마트'],   purePlay: true,  note: '미 최대 유통' },
  { ticker: 'KO',  name: 'Coca-Cola',   market: 'US', sub: 'food', tags: ['음료'],         purePlay: true,  note: '글로벌 음료 1위(버핏)' },
  { ticker: 'PEP', name: 'PepsiCo',     market: 'US', sub: 'food', tags: ['음료·스낵'],    purePlay: true,  note: '음료+스낵' },
  { ticker: 'MDLZ', name: 'Mondelez',   market: 'US', sub: 'food', tags: ['제과'],         purePlay: true,  note: '글로벌 제과(오레오)' },
  { ticker: '097950', name: 'CJ제일제당', market: 'KR', sub: 'food', tags: ['식품'],        purePlay: true,  note: '국내 1위 종합식품' },
  { ticker: '271560', name: '오리온',    market: 'KR', sub: 'food', tags: ['제과'],         purePlay: true,  note: '국내 제과(중국 비중)' },
  { ticker: 'PG',  name: 'P&G',         market: 'US', sub: 'house', tags: ['생활용품'],     purePlay: true,  note: '글로벌 생활용품 1위' },
  { ticker: 'CL',  name: 'Colgate',     market: 'US', sub: 'house', tags: ['퍼스널케어'],   purePlay: true,  note: '구강·생활용품' },
  { ticker: '051900', name: 'LG생활건강', market: 'KR', sub: 'house', tags: ['화장품·생활'], purePlay: true,  note: '국내 화장품·생활용품' },
  { ticker: '090430', name: '아모레퍼시픽', market: 'KR', sub: 'house', tags: ['화장품'],    purePlay: true,  note: 'K뷰티 대표' },
  { ticker: 'PM',  name: 'Philip Morris', market: 'US', sub: 'tobacco', tags: ['담배'],     purePlay: true,  note: '글로벌 담배(IQOS)' },
  { ticker: '033780', name: 'KT&G',     market: 'KR', sub: 'tobacco', tags: ['담배·홍삼'],  purePlay: true,  note: '국내 담배+홍삼(고배당)' },
  // 🆕 3:3 보강
  { ticker: 'TGT',  name: 'Target',     market: 'US', sub: 'retail', tags: ['대형마트'],    purePlay: true,  note: '미 대형 종합소매' },
  { ticker: '139480', name: '이마트',   market: 'KR', sub: 'retail', tags: ['대형마트'],    purePlay: true,  note: '국내 1위 대형마트' },
  { ticker: '282330', name: 'BGF리테일', market: 'KR', sub: 'retail', tags: ['편의점 CU'],  purePlay: true,  note: '편의점 CU 운영' },
  { ticker: '007070', name: 'GS리테일', market: 'KR', sub: 'retail', tags: ['편의점 GS25'], purePlay: true,  note: '편의점 GS25·수퍼' },
  { ticker: '003230', name: '삼양식품', market: 'KR', sub: 'food', tags: ['라면·불닭'],     purePlay: true,  note: '불닭 수출 급성장' },
  { ticker: '004370', name: '농심',     market: 'KR', sub: 'food', tags: ['라면'],          purePlay: true,  note: '국내 1위 라면(신라면)' },
  { ticker: 'MO',   name: 'Altria',     market: 'US', sub: 'tobacco', tags: ['담배·고배당'], purePlay: true,  note: '미 담배(말보로·고배당)' },
  { ticker: '278470', name: '에이피알', market: 'KR', sub: 'house', tags: ['뷰티·디바이스'], purePlay: true,  note: '뷰티 디바이스·화장품(고성장)' },
  { ticker: 'KMB',  name: 'Kimberly-Clark', market: 'US', sub: 'house', tags: ['생활용품'], purePlay: true,  note: '기저귀·티슈(크리넥스)' },
  { ticker: 'BTI',  name: 'British American Tobacco', market: 'US', sub: 'tobacco', tags: ['담배'], purePlay: true, note: '글로벌 담배(국내는 KT&G 1사)' },
]
const STAP_CONFIG: SectorConfig = {
  key: 'staples', label: '필수소비재', emoji: '🥫',
  tagline: 'GICS 필수소비재 — 식품·음료·생활용품·담배·필수유통. 경기와 무관하게 사는 방어주(저베타·고배당). 불황·인플레 국면에 강함. 안정 실적 기반 — ROE·배당으로 봅니다. 교육용.',
  anchor: 'COST', tagHeader: '업종', subMeta: STAP_SUB,
  stocks: STAP_STOCKS, overlayTickers: ['COST', 'WMT', 'KO', 'PG', '033780'],
}

// ── 💊 헬스케어 (Health Care) ──────────────────────────────────────────────────
const HLTH_SUB: Record<string, SubMeta> = {
  pharma:  { label: '제약', emoji: '💊', color: '#60a5fa', desc: '빅파마·신약 (대형)' },
  biotech: { label: '바이오', emoji: '🧬', color: '#f59e0b', desc: '바이오·유전자 치료' },
  device:  { label: '의료기기', emoji: '🩺', color: '#34d399', desc: '진단·수술·의료장비' },
  payer:   { label: '의료서비스·보험', emoji: '🏥', color: '#ec4899', desc: '의료보험·병원·유통' },
}
const HLTH_STOCKS: SectorStock[] = [
  { ticker: 'LLY', name: 'Eli Lilly',   market: 'US', sub: 'pharma', tags: ['GLP-1'],      purePlay: true,  note: '비만치료제 1위(대장주)' },
  { ticker: 'JNJ', name: 'J&J',         market: 'US', sub: 'pharma', tags: ['제약·기기'],  purePlay: true,  note: '제약+의료기기 복합' },
  { ticker: 'MRK', name: 'Merck',       market: 'US', sub: 'pharma', tags: ['항암'],       purePlay: true,  note: '키트루다 항암제' },
  { ticker: 'NVO', name: 'Novo Nordisk', market: 'US', sub: 'pharma', tags: ['GLP-1'],     purePlay: true,  note: '오젬픽·위고비' },
  { ticker: 'AMGN', name: 'Amgen',      market: 'US', sub: 'biotech', tags: ['바이오'],    purePlay: true,  note: '대형 바이오' },
  { ticker: 'VRTX', name: 'Vertex',     market: 'US', sub: 'biotech', tags: ['희귀질환'],  purePlay: true,  note: '낭포성섬유증 독점' },
  { ticker: '207940', name: '삼성바이오로직스', market: 'KR', sub: 'biotech', tags: ['CDMO'], purePlay: true, note: '바이오 위탁생산 1위' },
  { ticker: '068270', name: '셀트리온',  market: 'KR', sub: 'biotech', tags: ['바이오시밀러'], purePlay: true, note: '바이오시밀러 대표' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', market: 'US', sub: 'device', tags: ['수술로봇'], purePlay: true, note: '다빈치 수술로봇(피지컬AI 중복)' },
  { ticker: 'ABT', name: 'Abbott',      market: 'US', sub: 'device', tags: ['진단·기기'],  purePlay: true,  note: '진단·의료기기' },
  { ticker: 'MDT', name: 'Medtronic',   market: 'US', sub: 'device', tags: ['의료기기'],   purePlay: true,  note: '세계 1위 의료기기' },
  { ticker: 'UNH', name: 'UnitedHealth', market: 'US', sub: 'payer', tags: ['의료보험'],   purePlay: true,  note: '미 최대 의료보험' },
  // 🆕 3:3 보강
  { ticker: '000100', name: '유한양행', market: 'KR', sub: 'pharma', tags: ['제약·항암'],   purePlay: true,  note: '렉라자 등 국내 제약 대표' },
  { ticker: '128940', name: '한미약품', market: 'KR', sub: 'pharma', tags: ['신약·기술수출'], purePlay: true, note: '신약 R&D·기술수출' },
  { ticker: '069620', name: '대웅제약', market: 'KR', sub: 'pharma', tags: ['제약'],        purePlay: true,  note: '국내 제약(나보타 등)' },
  { ticker: 'REGN', name: 'Regeneron',  market: 'US', sub: 'biotech', tags: ['바이오'],     purePlay: true,  note: '대형 바이오(아일리아)' },
  { ticker: '196170', name: '알테오젠', market: 'KR', sub: 'biotech', tags: ['제형·플랫폼'], purePlay: true, note: 'SC 제형 변환 기술수출' },
  { ticker: '214150', name: '클래시스', market: 'KR', sub: 'device', tags: ['미용의료기기'], purePlay: true, note: '미용 의료기기(슈링크)' },
  { ticker: '145020', name: '휴젤',     market: 'KR', sub: 'device', tags: ['보톡스·필러'], purePlay: true,  note: '보툴리눔 톡신·필러' },
  { ticker: '145720', name: '덴티움',   market: 'KR', sub: 'device', tags: ['임플란트'],    purePlay: true,  note: '치과 임플란트' },
  { ticker: 'CI',   name: 'Cigna',      market: 'US', sub: 'payer', tags: ['의료보험'],     purePlay: true,  note: '미 대형 의료보험·PBM' },
  { ticker: 'ELV',  name: 'Elevance',   market: 'US', sub: 'payer', tags: ['의료보험'],     purePlay: true,  note: '미 대형 의료보험' },
]
const HLTH_CONFIG: SectorConfig = {
  key: 'healthcare', label: '헬스케어', emoji: '💊',
  tagline: 'GICS 헬스케어 — 제약·바이오·의료기기·의료서비스. 고령화 구조적 성장 + 경기방어. 빅파마(안정)와 바이오(임상 리스크) 양극단. ⚠️ 임상 실패 변동성. 모멘텀·파이프라인으로 봅니다. 교육용.',
  anchor: 'LLY', tagHeader: '업종', subMeta: HLTH_SUB,
  stocks: HLTH_STOCKS, overlayTickers: ['LLY', 'JNJ', 'MRK', '207940', 'UNH'],
}

// ── 💻 정보기술 (Information Technology) ───────────────────────────────────────
const IT_SUB: Record<string, SubMeta> = {
  software: { label: '소프트웨어', emoji: '🖥️', color: '#60a5fa', desc: 'OS·클라우드·SaaS (대형)' },
  semi:     { label: '반도체', emoji: '🔲', color: '#f59e0b', desc: '설계·메모리·파운드리' },
  hardware: { label: '하드웨어·기기', emoji: '📱', color: '#34d399', desc: '디바이스·서버·부품' },
}
const IT_STOCKS: SectorStock[] = [
  { ticker: 'MSFT', name: 'Microsoft',  market: 'US', sub: 'software', tags: ['클라우드·OS'], purePlay: true, note: 'SW·클라우드 1위(대장주)' },
  { ticker: 'ORCL', name: 'Oracle',     market: 'US', sub: 'software', tags: ['DB·클라우드'], purePlay: true, note: 'DB·엔터프라이즈 클라우드' },
  { ticker: 'CRM', name: 'Salesforce',  market: 'US', sub: 'software', tags: ['SaaS·CRM'],   purePlay: true,  note: 'CRM SaaS 1위' },
  { ticker: 'ADBE', name: 'Adobe',      market: 'US', sub: 'software', tags: ['크리에이티브'], purePlay: true, note: '크리에이티브 SW' },
  { ticker: 'NVDA', name: 'NVIDIA',     market: 'US', sub: 'semi', tags: ['GPU'],            purePlay: true,  note: 'AI 가속기(AI반도체 테마 중복)' },
  { ticker: 'AVGO', name: 'Broadcom',   market: 'US', sub: 'semi', tags: ['ASIC·네트워크'],  purePlay: true,  note: '맞춤 ASIC·네트워크 칩' },
  { ticker: 'AMD', name: 'AMD',         market: 'US', sub: 'semi', tags: ['CPU·GPU'],        purePlay: true,  note: 'CPU·AI GPU' },
  { ticker: '000660', name: 'SK하이닉스', market: 'KR', sub: 'semi', tags: ['HBM'],          purePlay: true,  note: 'HBM 1위(AI반도체 테마 중복)' },
  { ticker: 'AAPL', name: 'Apple',      market: 'US', sub: 'hardware', tags: ['스마트폰'],    purePlay: true,  note: '아이폰·디바이스 생태계' },
  { ticker: 'DELL', name: 'Dell',       market: 'US', sub: 'hardware', tags: ['서버·PC'],     purePlay: true,  note: 'AI 서버·PC' },
  { ticker: '005930', name: '삼성전자',  market: 'KR', sub: 'semi', tags: ['반도체·폰'],      purePlay: false, note: '메모리+폰+가전(다각화)' },
  // 🆕 3:3 보강
  { ticker: '042700', name: '한미반도체', market: 'KR', sub: 'semi', tags: ['HBM 본더'],     purePlay: true,  note: 'HBM TC본더(AI반도체 테마 중복)' },
  { ticker: '012510', name: '더존비즈온', market: 'KR', sub: 'software', tags: ['ERP·클라우드'], purePlay: true, note: '국내 ERP·기업용 SW' },
  { ticker: '053800', name: '안랩',      market: 'KR', sub: 'software', tags: ['보안 SW'],   purePlay: true,  note: '국내 보안 소프트웨어' },
  { ticker: '030520', name: '한글과컴퓨터', market: 'KR', sub: 'software', tags: ['오피스 SW'], purePlay: true, note: '국내 오피스 SW·AI' },
  { ticker: '009150', name: '삼성전기',  market: 'KR', sub: 'hardware', tags: ['MLCC·기판'], purePlay: true,  note: 'MLCC·FC-BGA 기판' },
  { ticker: '011070', name: 'LG이노텍',  market: 'KR', sub: 'hardware', tags: ['카메라·기판'], purePlay: true, note: '카메라모듈·FC-BGA' },
  { ticker: '353200', name: '대덕전자',  market: 'KR', sub: 'hardware', tags: ['PCB·기판'],  purePlay: true,  note: 'AI 가속기용 FC-BGA 기판' },
  { ticker: '007660', name: '이수페타시스', market: 'KR', sub: 'hardware', tags: ['MLB 고다층 PCB'], purePlay: true, note: 'AI 가속기·스위치용 고다층 기판(MLB) — 엔비디아·구글 공급' },
  { ticker: 'SMCI', name: 'Super Micro', market: 'US', sub: 'hardware', tags: ['AI 서버'],   purePlay: true,  note: 'AI 서버·랙 시스템' },
]
const IT_CONFIG: SectorConfig = {
  key: 'infotech', label: '정보기술(IT)', emoji: '💻',
  tagline: 'GICS 정보기술 — 소프트웨어·반도체·하드웨어. 시장을 이끄는 최대 섹터(성장 주도). ⚠️ NVDA·SK하이닉스 등은 AI반도체 테마와 겹침 — 같은 종목이 표준 분류(IT)와 현대 테마 양쪽에 있는 걸 비교. 모멘텀·실적으로 봅니다. 교육용.',
  anchor: 'MSFT', tagHeader: '업종', subMeta: IT_SUB,
  stocks: IT_STOCKS, overlayTickers: ['MSFT', 'NVDA', 'AVGO', '000660', 'AAPL'],
}

// ── 📡 커뮤니케이션 서비스 (Communication Services) ───────────────────────────
const COMM_SUB: Record<string, SubMeta> = {
  internet: { label: '인터넷·플랫폼', emoji: '🌐', color: '#60a5fa', desc: '검색·SNS·포털 (대형)' },
  media:    { label: '미디어·엔터', emoji: '🎬', color: '#f59e0b', desc: 'OTT·콘텐츠·게임' },
  telecom:  { label: '통신', emoji: '📶', color: '#34d399', desc: '이동통신·고배당 방어' },
}
const COMM_STOCKS: SectorStock[] = [
  { ticker: 'GOOGL', name: 'Alphabet',  market: 'US', sub: 'internet', tags: ['검색·AI'],  purePlay: true,  note: '검색·유튜브·클라우드(대장주)' },
  { ticker: 'META', name: 'Meta',       market: 'US', sub: 'internet', tags: ['SNS'],       purePlay: true,  note: '페북·인스타 광고' },
  { ticker: '035420', name: 'NAVER',    market: 'KR', sub: 'internet', tags: ['포털·커머스'], purePlay: true, note: '국내 검색·커머스 1위' },
  { ticker: '035720', name: '카카오',    market: 'KR', sub: 'internet', tags: ['메신저·플랫폼'], purePlay: true, note: '국내 메신저 플랫폼' },
  { ticker: 'NFLX', name: 'Netflix',    market: 'US', sub: 'media', tags: ['OTT'],          purePlay: true,  note: '글로벌 OTT 1위' },
  { ticker: 'DIS', name: 'Disney',      market: 'US', sub: 'media', tags: ['콘텐츠'],       purePlay: true,  note: '콘텐츠·테마파크' },
  { ticker: '259960', name: '크래프톤',  market: 'KR', sub: 'media', tags: ['게임'],         purePlay: true,  note: '배틀그라운드 게임' },
  { ticker: '352820', name: '하이브',    market: 'KR', sub: 'media', tags: ['엔터'],         purePlay: true,  note: 'K팝 엔터(BTS)' },
  { ticker: 'TMUS', name: 'T-Mobile',   market: 'US', sub: 'telecom', tags: ['이동통신'],   purePlay: true,  note: '미 이동통신' },
  { ticker: 'VZ',  name: 'Verizon',     market: 'US', sub: 'telecom', tags: ['통신·고배당'], purePlay: true,  note: '미 통신(고배당)' },
  { ticker: '017670', name: 'SK텔레콤',  market: 'KR', sub: 'telecom', tags: ['통신·AI'],   purePlay: true,  note: '국내 1위 통신(고배당)' },
  { ticker: '030200', name: 'KT',       market: 'KR', sub: 'telecom', tags: ['통신'],       purePlay: true,  note: '국내 유무선 통신' },
  // 🆕 3:3 보강
  { ticker: 'EA',   name: 'Electronic Arts', market: 'US', sub: 'media', tags: ['게임'],    purePlay: true,  note: '글로벌 게임 퍼블리셔(FIFA)' },
  { ticker: '036570', name: '엔씨소프트', market: 'KR', sub: 'media', tags: ['게임'],       purePlay: true,  note: '리니지 등 MMORPG' },
  { ticker: 'T',    name: 'AT&T',       market: 'US', sub: 'telecom', tags: ['통신·고배당'], purePlay: true,  note: '미 통신(고배당)' },
  { ticker: '032640', name: 'LG유플러스', market: 'KR', sub: 'telecom', tags: ['통신'],     purePlay: true,  note: '국내 3위 이동통신' },
  { ticker: 'PINS', name: 'Pinterest',  market: 'US', sub: 'internet', tags: ['SNS·이미지'], purePlay: true, note: '이미지 기반 SNS 광고(국내 플랫폼은 NAVER·카카오 2사)' },
]
const COMM_CONFIG: SectorConfig = {
  key: 'communication', label: '커뮤니케이션', emoji: '📡',
  tagline: 'GICS 커뮤니케이션 서비스 — 인터넷 플랫폼·미디어/엔터·통신. 광고 성장주(GOOGL·META)와 고배당 통신 방어주가 한 섹터에 공존(양극단). 모멘텀·광고 사이클·배당으로 봅니다. 교육용.',
  anchor: 'GOOGL', tagHeader: '업종', subMeta: COMM_SUB,
  stocks: COMM_STOCKS, overlayTickers: ['GOOGL', 'META', 'NFLX', '035420', '017670'],
}

// ── 🔌 유틸리티 (Utilities) ────────────────────────────────────────────────────
const UTIL_SUB: Record<string, SubMeta> = {
  electric: { label: '전력', emoji: '💡', color: '#60a5fa', desc: '전기 발전·송배전 (대형)' },
  multi:    { label: '복합·가스', emoji: '🔥', color: '#f59e0b', desc: '전기+가스 복합' },
  water:    { label: '수도·신재생', emoji: '💧', color: '#34d399', desc: '수도·재생에너지' },
}
const UTIL_STOCKS: SectorStock[] = [
  { ticker: 'NEE', name: 'NextEra',     market: 'US', sub: 'electric', tags: ['전력·재생'], purePlay: true,  note: '미 최대 전력+재생에너지(대장주)' },
  { ticker: 'DUK', name: 'Duke Energy', market: 'US', sub: 'electric', tags: ['전력'],      purePlay: true,  note: '미 대형 전력' },
  { ticker: 'SO',  name: 'Southern Co', market: 'US', sub: 'electric', tags: ['전력'],      purePlay: true,  note: '미 남부 전력' },
  { ticker: 'AEP', name: 'American Electric', market: 'US', sub: 'electric', tags: ['송배전'], purePlay: true, note: '대형 송배전 전력' },
  { ticker: '015760', name: '한국전력',  market: 'KR', sub: 'electric', tags: ['전력'],      purePlay: true,  note: '국내 전력 독점(규제)' },
  { ticker: 'D',   name: 'Dominion',    market: 'US', sub: 'multi', tags: ['전기·가스'],    purePlay: true,  note: '전기+가스 복합 유틸' },
  { ticker: 'SRE', name: 'Sempra',      market: 'US', sub: 'multi', tags: ['가스·전력'],    purePlay: true,  note: '가스·전력·LNG' },
  { ticker: '036460', name: '한국가스공사', market: 'KR', sub: 'multi', tags: ['가스'],      purePlay: true,  note: '국내 천연가스 독점' },
  { ticker: 'AWK', name: 'American Water', market: 'US', sub: 'water', tags: ['수도'],       purePlay: true,  note: '미 최대 상수도' },
  // 🆕 3:3 보강
  { ticker: '052690', name: '한전기술', market: 'KR', sub: 'electric', tags: ['원전 설계'], purePlay: true,  note: '원전·발전 설계(한전 자회사)' },
  { ticker: '051600', name: '한전KPS',  market: 'KR', sub: 'electric', tags: ['발전 정비'], purePlay: true,  note: '발전설비 정비(한전 자회사)' },
  { ticker: 'ATO',  name: 'Atmos Energy', market: 'US', sub: 'multi', tags: ['가스'],       purePlay: true,  note: '미 천연가스 유틸리티' },
  { ticker: '017390', name: '서울가스', market: 'KR', sub: 'multi', tags: ['도시가스'],     purePlay: true,  note: '수도권 도시가스 공급' },
  { ticker: 'WTRG', name: 'Essential Utilities', market: 'US', sub: 'water', tags: ['수도·가스'], purePlay: true, note: '미 상수도·가스 유틸리티' },
  { ticker: '004690', name: '삼천리',   market: 'KR', sub: 'multi', tags: ['도시가스'],     purePlay: true,  note: '수도권 도시가스·집단에너지' },
  { ticker: 'AWR',  name: 'American States Water', market: 'US', sub: 'water', tags: ['수도'], purePlay: true, note: '미 상수도(국내 수도는 국영 비상장)' },
]
const UTIL_CONFIG: SectorConfig = {
  key: 'utilities', label: '유틸리티', emoji: '🔌',
  tagline: 'GICS 유틸리티 — 전력·가스·수도. 규제 기반 안정 현금흐름·고배당의 대표 방어주(저베타). 금리에 민감(채권 대용). ⚠️ AI 데이터센터 전력 수요로 재평가 중. 배당·금리로 봅니다. 교육용.',
  anchor: 'NEE', tagHeader: '업종', subMeta: UTIL_SUB,
  stocks: UTIL_STOCKS, overlayTickers: ['NEE', 'DUK', 'SO', '015760', 'D'],
}

// ── 🏢 부동산 (Real Estate / REITs) ────────────────────────────────────────────
const RE_SUB: Record<string, SubMeta> = {
  infra:   { label: '인프라·데이터센터', emoji: '📡', color: '#60a5fa', desc: '통신타워·데이터센터 (대형)' },
  logi:    { label: '물류·산업', emoji: '🏭', color: '#f59e0b', desc: '물류창고·산업용' },
  retail:  { label: '리테일·주거', emoji: '🏬', color: '#34d399', desc: '쇼핑몰·임대주택' },
  health:  { label: '헬스케어·기타', emoji: '🏥', color: '#ec4899', desc: '요양시설·특수 리츠' },
}
const RE_STOCKS: SectorStock[] = [
  { ticker: 'AMT', name: 'American Tower', market: 'US', sub: 'infra', tags: ['통신타워'],  purePlay: true,  note: '세계 1위 통신타워 리츠(대장주)' },
  { ticker: 'EQIX', name: 'Equinix',    market: 'US', sub: 'infra', tags: ['데이터센터'],  purePlay: true,  note: '글로벌 데이터센터 리츠(AI 수혜)' },
  { ticker: 'DLR', name: 'Digital Realty', market: 'US', sub: 'infra', tags: ['데이터센터'], purePlay: true, note: '데이터센터 리츠' },
  { ticker: 'PLD', name: 'Prologis',    market: 'US', sub: 'logi', tags: ['물류창고'],      purePlay: true,  note: '세계 1위 물류 리츠' },
  { ticker: 'O',   name: 'Realty Income', market: 'US', sub: 'retail', tags: ['월배당'],     purePlay: true,  note: '월배당 리테일 리츠' },
  { ticker: 'SPG', name: 'Simon Property', market: 'US', sub: 'retail', tags: ['쇼핑몰'],    purePlay: true,  note: '미 최대 쇼핑몰 리츠' },
  { ticker: 'AVB', name: 'AvalonBay',   market: 'US', sub: 'retail', tags: ['임대주택'],     purePlay: true,  note: '임대 아파트 리츠' },
  { ticker: 'WELL', name: 'Welltower',  market: 'US', sub: 'health', tags: ['요양시설'],     purePlay: true,  note: '고령자 주거·요양 리츠' },
  { ticker: '395400', name: 'SK리츠',    market: 'KR', sub: 'health', tags: ['오피스·인프라'], purePlay: true, note: '국내 대형 리츠' },
  { ticker: '330590', name: '롯데리츠',  market: 'KR', sub: 'retail', tags: ['리테일'],      purePlay: true,  note: '국내 리테일 리츠' },
  // 🆕 3:3 보강
  { ticker: 'VTR',  name: 'Ventas',      market: 'US', sub: 'health', tags: ['요양시설'],    purePlay: true,  note: '고령자 주거·요양 리츠' },
  { ticker: 'EGP',  name: 'EastGroup',   market: 'US', sub: 'logi', tags: ['물류창고'],      purePlay: true,  note: '물류·산업용 리츠' },
  { ticker: '293940', name: '신한알파리츠', market: 'KR', sub: 'retail', tags: ['오피스'],   purePlay: true,  note: '국내 오피스·리테일 리츠' },
  { ticker: 'OHI',  name: 'Omega Healthcare', market: 'US', sub: 'health', tags: ['요양시설'], purePlay: true, note: '요양시설 리츠(국내 헬스 리츠는 SK리츠 등 소수)' },
  { ticker: '348950', name: '제이알글로벌리츠', market: 'KR', sub: 'retail', tags: ['해외오피스'], purePlay: true, note: '해외 오피스 리츠' },
]
const RE_CONFIG: SectorConfig = {
  key: 'realestate', label: '부동산(리츠)', emoji: '🏢',
  tagline: 'GICS 부동산 — 리츠(REITs). 임대 현금흐름·배당 중심, 금리에 가장 민감(금리↑=할인율↑로 약세). ⚠️ 데이터센터·물류 리츠는 AI·이커머스 구조적 성장. 배당수익률·금리로 봅니다. 교육용.',
  anchor: 'PLD', tagHeader: '업종', subMeta: RE_SUB,
  stocks: RE_STOCKS, overlayTickers: ['AMT', 'EQIX', 'PLD', 'O', 'WELL'],
}

export const SECTORS: Record<string, SectorConfig> = {
  quantum: QUANTUM_CONFIG,
  'ai-semi': AISEMI_CONFIG,
  power: POWER_CONFIG,
  'phys-ai': PHYS_CONFIG,
  'ai-bio': BIO_CONFIG,
  defense: DEF_CONFIG,
  // 🏛️ GICS 11 전통 산업 섹터
  energy: ENERGY_CONFIG,
  materials: MAT_CONFIG,
  industrials: IND_CONFIG,
  discretionary: DISC_CONFIG,
  staples: STAP_CONFIG,
  healthcare: HLTH_CONFIG,
  financials: FIN_CONFIG,
  infotech: IT_CONFIG,
  communication: COMM_CONFIG,
  utilities: UTIL_CONFIG,
  realestate: RE_CONFIG,
}
export const SECTOR_LIST = Object.values(SECTORS).map(s => ({ key: s.key, label: s.label, emoji: s.emoji }))

// 💰 소섹터 대표 ETF — 돈 몰리는 소섹터를 개별주 대신 ETF로 태우기 위한 매핑(전수 실측 검증됨).
//    조회: `${sectorKey}:${subKey}` 우선 → 없으면 `${sectorKey}` 섹터 폴백. 없으면 개별종목 참고(정직).
export interface SectorEtf { us?: { t: string; name: string }; kr?: { t: string; name: string } }
export const SECTOR_ETF: Record<string, SectorEtf> = {
  // 금융
  'financials:bank':      { us: { t: 'KBWB', name: 'KBW 은행' },       kr: { t: '091170', name: 'KODEX 은행' } },
  'financials:insurance': { us: { t: 'KIE',  name: 'SPDR 보험' },      kr: { t: '140700', name: 'KODEX 보험' } },
  'financials:broker':    { us: { t: 'IAI',  name: 'iShares 증권' },   kr: { t: '102970', name: 'KODEX 증권' } },
  'financials:payment':   { us: { t: 'IPAY', name: 'Amplify 결제' } },
  // 에너지
  'energy:integrated': { us: { t: 'XLE', name: '에너지 섹터' }, kr: { t: '117460', name: 'KODEX 에너지화학' } },
  'energy:ep':         { us: { t: 'XOP', name: 'SPDR E&P' } },
  'energy:service':    { us: { t: 'OIH', name: 'VanEck 유전서비스' } },
  'energy:refine':     { us: { t: 'XLE', name: '에너지 섹터' } },
  // 소재
  'materials:chemical': { us: { t: 'XLB', name: '소재 섹터' }, kr: { t: '117460', name: 'KODEX 에너지화학' } },
  'materials:metal':    { us: { t: 'SLX', name: 'VanEck 철강' }, kr: { t: '117680', name: 'KODEX 철강' } },
  'materials:mining':   { us: { t: 'GDX', name: 'VanEck 금광' } },
  'materials:build':    { us: { t: 'XLB', name: '소재 섹터' }, kr: { t: '117700', name: 'KODEX 건설' } },
  // 산업재
  'industrials:machinery':  { us: { t: 'XLI', name: '산업재 섹터' } },
  'industrials:aero':       { us: { t: 'ITA', name: 'iShares 방산' }, kr: { t: '449450', name: 'PLUS K방산' } },
  'industrials:transport':  { us: { t: 'IYT', name: 'iShares 운송' } },
  'industrials:electrical': { us: { t: 'GRID', name: 'First Trust 전력망' } },
  // 자유소비재
  'discretionary:retail': { us: { t: 'XRT',  name: 'SPDR 소매' } },
  'discretionary:auto':   { us: { t: 'CARZ', name: 'First Trust 자동차' }, kr: { t: '091180', name: 'KODEX 자동차' } },
  // 필수소비재
  'staples:retail': { us: { t: 'XLP', name: '필수소비 섹터' } },
  'staples:food':   { us: { t: 'XLP', name: '필수소비 섹터' } },
  'staples:house':  { us: { t: 'XLP', name: '필수소비 섹터' } },
  // 헬스케어
  'healthcare:pharma':  { us: { t: 'PPH', name: 'VanEck 제약' }, kr: { t: '266420', name: 'KODEX 헬스케어' } },
  'healthcare:biotech': { us: { t: 'XBI', name: 'SPDR 바이오' }, kr: { t: '244580', name: 'KODEX 바이오' } },
  'healthcare:device':  { us: { t: 'IHI', name: 'iShares 의료기기' } },
  'healthcare:payer':   { us: { t: 'IHF', name: 'iShares 의료서비스' } },
  // IT
  'infotech:software': { us: { t: 'IGV',  name: 'iShares SW' } },
  'infotech:semi':     { us: { t: 'SOXX', name: 'iShares 반도체' }, kr: { t: '091160', name: 'KODEX 반도체' } },
  'infotech:hardware': { us: { t: 'SMH',  name: 'VanEck 반도체' }, kr: { t: '139260', name: 'TIGER 200 IT' } },
  // 커뮤니케이션
  'communication:internet': { us: { t: 'FDN', name: 'First Trust 인터넷' } },
  'communication:media':    { us: { t: 'XLC', name: '커뮤니 섹터' }, kr: { t: '266360', name: 'KODEX K콘텐츠' } },
  'communication:telecom':  { us: { t: 'XLC', name: '커뮤니 섹터' } },
  // 유틸리티
  'utilities:electric': { us: { t: 'XLU', name: '유틸리티 섹터' } },
  'utilities:multi':    { us: { t: 'XLU', name: '유틸리티 섹터' } },
  'utilities:water':    { us: { t: 'PHO', name: 'Invesco 수도' } },
  // 부동산
  'realestate:infra':  { us: { t: 'SRVR', name: 'Pacer 데이터센터' }, kr: { t: '329200', name: 'TIGER 리츠' } },
  'realestate:logi':   { us: { t: 'INDS', name: 'Pacer 산업물류' } },
  'realestate:retail': { kr: { t: '329200', name: 'TIGER 리츠' } },
  // 테마 (섹터 폴백 + 일부 소섹터 override)
  quantum:  { us: { t: 'QTUM', name: 'Defiance 양자' } },
  'ai-semi': { us: { t: 'SOXX', name: 'iShares 반도체' }, kr: { t: '091160', name: 'KODEX 반도체' } },
  power:    { us: { t: 'GRID', name: 'First Trust 전력망' } },
  'power:nuclear': { us: { t: 'NLR', name: 'VanEck 원전' } },
  'phys-ai': { us: { t: 'BOTZ', name: 'Global X 로봇' } },
  'phys-ai:auto': { us: { t: 'CARZ', name: 'First Trust 자동차' }, kr: { t: '091180', name: 'KODEX 자동차' } },
  'ai-bio': { us: { t: 'ARKG', name: 'ARK 게놈' } },
  defense:  { us: { t: 'ITA', name: 'iShares 방산' }, kr: { t: '449450', name: 'PLUS K방산' } },
  'defense:space': { us: { t: 'UFO', name: 'Procure 우주' } },
}
export const etfFor = (sectorKey: string, subKey: string): SectorEtf | null =>
  SECTOR_ETF[`${sectorKey}:${subKey}`] ?? SECTOR_ETF[sectorKey] ?? null
