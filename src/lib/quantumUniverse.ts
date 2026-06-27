// 🛰️ 양자컴퓨팅 테마 유니버스 SSOT — 종목 분류·모달리티·퓨어플레이·정책·Pre-IPO (정적 큐레이션 = 분류 메타라 하드코딩 허용)
// 가격·수익률·베타 등 '값'은 /api/quantum-sector가 라이브 산출. 이 파일은 '분류·사실' 메타만.
// 티커는 2026-06 production stock-price API로 전수 검증(US+KR 라이브 확인).

export type QSub = 'hw' | 'sec' | 'equip'
export type Modality = '이온트랩' | '초전도' | '중성원자' | '광학' | '실리콘스핀' | '어닐링' | 'PQC'

export interface QuantumStock {
  ticker: string
  name: string
  market: 'US' | 'KR'
  sub: QSub                 // 서브섹터: 하드웨어/보안·통신/장비
  modality: Modality[]      // 채택 기술 방식
  purePlay: boolean         // 양자 순수주(매출·정체성 100% 양자) — false=대형주(양자 비중 미미)
  govAwardUsdM?: number     // 미정부 보조금($M, 상장사만) — 정책 촉매
  note: string              // 한 줄 사업 개요
}

export const QSUB_META: Record<QSub, { label: string; emoji: string; color: string; desc: string }> = {
  hw:    { label: '양자 하드웨어',   emoji: '🖥️', color: '#a78bfa', desc: '큐비트 칩·시스템 (대장 테마)' },
  sec:   { label: '양자 보안·통신',  emoji: '🔐', color: '#22d3ee', desc: '양자내성암호(PQC)·QKD·양자통신' },
  equip: { label: '핵심 장비·부품',  emoji: '🔧', color: '#f59e0b', desc: '계측·극저온·파운드리·광부품' },
}

// ── 상장 유니버스 (US+KR 라이브) ──────────────────────────────────────────────
export const QUANTUM: QuantumStock[] = [
  // 🖥️ 하드웨어
  { ticker: 'IONQ', name: 'IonQ',            market: 'US', sub: 'hw', modality: ['이온트랩'],   purePlay: true,  note: '이온트랩 양자컴퓨터 선도(테마 대장주)' },
  { ticker: 'QBTS', name: 'D-Wave Quantum',  market: 'US', sub: 'hw', modality: ['어닐링'],     purePlay: true,  govAwardUsdM: 100, note: '양자 어닐링 상업화 선두' },
  { ticker: 'RGTI', name: 'Rigetti',         market: 'US', sub: 'hw', modality: ['초전도'],     purePlay: true,  govAwardUsdM: 100, note: '초전도 풀스택 양자컴퓨터' },
  { ticker: 'QUBT', name: 'Quantum Computing Inc', market: 'US', sub: 'hw', modality: ['광학'], purePlay: true,  note: '광학(포토닉스) 기반 양자' },
  { ticker: 'IBM',  name: 'IBM',             market: 'US', sub: 'hw', modality: ['초전도'],     purePlay: false, govAwardUsdM: 1000, note: '초전도 양자 로드맵 선도(단 양자 매출 비중 미미)' },
  // 🔐 보안·통신
  { ticker: 'LAES', name: 'SEALSQ',          market: 'US', sub: 'sec', modality: ['PQC'],       purePlay: true,  note: '양자내성 암호칩(PQC) 반도체' },
  { ticker: 'ARQQ', name: 'Arqit Quantum',   market: 'US', sub: 'sec', modality: ['PQC'],       purePlay: true,  note: '대칭키 양자암호 SaaS' },
  { ticker: 'BTQ',  name: 'BTQ Technologies', market: 'US', sub: 'sec', modality: ['PQC'],      purePlay: true,  note: '포스트양자 보안·블록체인' },
  { ticker: '030200', name: 'KT',            market: 'KR', sub: 'sec', modality: ['PQC'],        purePlay: false, note: '양자암호통신 국가망(양자 비중 미미)' },
  { ticker: '017670', name: 'SK텔레콤',       market: 'KR', sub: 'sec', modality: ['PQC'],        purePlay: false, note: '양자암호통신·QKD 상용(양자 비중 미미)' },
  { ticker: '115440', name: '우리넷',         market: 'KR', sub: 'sec', modality: ['PQC'],        purePlay: true,  note: '양자암호통신 전송장비' },
  { ticker: '203650', name: '드림시큐리티',    market: 'KR', sub: 'sec', modality: ['PQC'],        purePlay: true,  note: '양자내성암호(PQC) 솔루션' },
  { ticker: '046970', name: '우리로',         market: 'KR', sub: 'sec', modality: ['광학', 'PQC'], purePlay: true,  note: 'QKD 양자암호 광부품' },
  // 🔧 장비·부품
  { ticker: 'KEYS', name: 'Keysight',        market: 'US', sub: 'equip', modality: [],            purePlay: false, note: '양자 제어·계측 1위(양자 비중 일부)' },
  { ticker: 'FORM', name: 'FormFactor',      market: 'US', sub: 'equip', modality: [],            purePlay: false, note: '극저온 프로브·테스트(양자 후방)' },
  { ticker: 'SKYT', name: 'SkyWater',        market: 'US', sub: 'equip', modality: [],            purePlay: false, note: '양자칩 파운드리(미정부 PsiQuantum 파트너)' },
  { ticker: 'IFNNY', name: 'Infineon(ADR)',  market: 'US', sub: 'equip', modality: ['이온트랩'],   purePlay: false, note: '이온트랩 칩 제조(Quantinuum 파트너)' },
  { ticker: 'GFS',  name: 'GlobalFoundries', market: 'US', sub: 'equip', modality: ['광학'],       purePlay: false, govAwardUsdM: 375, note: 'PsiQuantum 광양자칩 파운드리' },
]

export const QUANTUM_ANCHOR = 'IONQ'   // 테마 대장주(베타·상관 기준)

// ── 미정부 양자 정책 촉매 (DARPA/상무부 투자 — 사실 메타, 발표 시 갱신) ────────────
export interface PolicyAward { name: string; modality: Modality | string; usdM: number; cap?: boolean; listed?: string; structure: string }
export const QUANTUM_POLICY: PolicyAward[] = [
  { name: 'IBM',            modality: '초전도',   usdM: 1000, listed: 'IBM',   structure: '신설법인 공동출자(Anderon JV)' },
  { name: 'GlobalFoundries', modality: '파운드리', usdM: 375,  listed: 'GFS',   structure: '본체 직접(GF 신주)' },
  { name: 'D-Wave',         modality: '어닐링',   usdM: 100, cap: true, listed: 'QBTS', structure: '모회사 신주·시가발행' },
  { name: 'Rigetti',        modality: '초전도',   usdM: 100, cap: true, listed: 'RGTI', structure: '최저종가×85% 사모(3년)' },
  { name: 'Quantinuum',     modality: '이온트랩', usdM: 100, structure: '사모(비상장) — proxy: HON·IFNNY' },
  { name: 'PsiQuantum',     modality: '광학',     usdM: 100, structure: '사모(비상장) — proxy: GFS' },
  { name: 'Atom Computing', modality: '중성원자', usdM: 100, structure: 'LOI(세부 미공개)' },
  { name: 'Inflection',     modality: '중성원자', usdM: 100, structure: '사모(비상장)' },
  { name: 'Diraq',          modality: '실리콘스핀', usdM: 38, cap: true, structure: '사모(비상장)' },
]

// ── Pre-IPO 비상장사 (가격 없음 → 메타 + 상장 대용주 proxy) ──────────────────────
export interface PreIpoCompany { name: string; modality: Modality; govAwardUsdM?: number; proxy: { ticker: string; name: string }[]; note: string }
export const QUANTUM_PREIPO: PreIpoCompany[] = [
  { name: 'Quantinuum',     modality: '이온트랩',   govAwardUsdM: 100, proxy: [{ ticker: 'IFNNY', name: '인피니언(칩 파트너)' }], note: '하니웰 계열·이온트랩 1위. IPO 추진설' },
  { name: 'PsiQuantum',     modality: '광학',       govAwardUsdM: 100, proxy: [{ ticker: 'GFS', name: 'GlobalFoundries(파운드리)' }], note: '광양자 100만 큐비트 목표' },
  { name: 'Atom Computing', modality: '중성원자',   govAwardUsdM: 100, proxy: [{ ticker: 'MSFT', name: 'Microsoft(협업)' }], note: '중성원자 1000큐비트' },
  { name: 'Diraq',          modality: '실리콘스핀', govAwardUsdM: 38,  proxy: [{ ticker: 'GFS', name: 'GlobalFoundries(CMOS)' }], note: '실리콘 스핀(반도체 공정 호환)' },
]
