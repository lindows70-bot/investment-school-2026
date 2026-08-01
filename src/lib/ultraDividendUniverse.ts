// 🔥 초고배당(초고위험) 유니버스 — 배당 인컴 랩 하단 별도 섹션(안정 배당주와 분리)
//   ⚠️ 큐레이션 '후보 리스트'이지 하드코딩 값이 아님(제1원칙) — 배당률·주기는 전부 실데이터(dividendProfile SSOT).
//   단 커버드콜/옵션 ETF 중 Yahoo가 분배율 0을 주는 미국 YieldMax·Roundhill류는 targetYield(운용사 목표·변동 큼)를 '참고'로 표시.
//   티커·배당률 전부 라이브 dividend-explorer로 실측 검증 완료(2026-07-25).

export type UltraTier = 'high' | 'covered_call'

export interface UltraStock {
  ticker: string
  market: 'US' | 'KR'
  tier: UltraTier
  sector: string          // 섹터/구조 한 줄
  note: string            // 교육용 설명(왜 고배당인지 + 리스크)
  targetYield?: number    // 소수(0.60 = 60%) — 라이브 분배율 미제공(YieldMax류) 시 참고치
  targetLabel?: string    // 운용사 목표/변동 범위 텍스트
}

export const ULTRA_TIER_META: Record<UltraTier, { label: string; icon: string; color: string; desc: string; range: string }> = {
  high: {
    label: '고배당 개별주',
    icon: '🏦',
    color: '#fb923c',
    desc: '금융·리츠·담배·에너지·BDC 등 — 실적으로 버는 진짜 배당(중~고위험)',
    range: '연 4~14%',
  },
  covered_call: {
    label: '커버드콜·옵션 ETF',
    icon: '🎰',
    color: '#f87171',
    desc: '콜옵션 매도 프리미엄으로 분배율 극대화 — 원금(NAV) 갉아먹기 위험(초고위험)',
    range: '연 7~80%+',
  },
}

// ── 고배당 개별주 (5~13%, 실적 배당) ─────────────────────────────────────────
const HIGH: UltraStock[] = [
  // 국내
  { ticker: '481850', market: 'KR', tier: 'high', sector: '리츠(해외 부동산 담보대출)',
    note: '신한글로벌액티브리츠 — 국내 최고 배당률권. ⚠️ 해외 부동산 대출 담보라 부동산·환율·금리 리스크 큼' },
  { ticker: '175330', market: 'KR', tier: 'high', sector: '금융지주',
    note: 'JB금융지주 — 밸류업 프로그램으로 주주환원 급상승. 금융주라 경기·부실채권 민감' },
  { ticker: '029780', market: 'KR', tier: 'high', sector: '카드·소비금융',
    note: '삼성카드 — 삼성 계열 안정성 + 카드 고배당. 소비 둔화·연체율 상승 시 실적 민감' },
  // 미국
  { ticker: 'MO', market: 'US', tier: 'high', sector: '담배',
    note: '알트리아(Altria) — 55년 배당 킹. 담배 수요 감소·규제 리스크를 배당으로 보상' },
  { ticker: 'EPD', market: 'US', tier: 'high', sector: '에너지 인프라(MLP)',
    note: '엔터프라이즈 프로덕츠(EPD) — 송유관 톨게이트형 수익. MLP라 세금 신고(K-1) 복잡' },
  { ticker: 'O', market: 'US', tier: 'high', sector: '월배당 리츠',
    note: '리얼티인컴(O) — 30년 귀족·매달 배당·안정성 높음. 금리 상승기엔 리츠 주가 약세' },
  { ticker: 'AGNC', market: 'US', tier: 'high', sector: '모기지 리츠',
    note: 'AGNC — 월배당 모기지 리츠(13%대). ⚠️ 금리·스프레드에 극도로 민감·배당 삭감 이력 잦음' },
  { ticker: 'NLY', market: 'US', tier: 'high', sector: '모기지 리츠',
    note: 'Annaly(NLY) — 대표 월배당 모기지 리츠(13%대). 금리 역풍 시 원금·배당 동반 하락' },
  { ticker: 'ARCC', market: 'US', tier: 'high', sector: 'BDC(중소기업 대출)',
    note: 'Ares Capital(ARCC) — 중소기업 대출 BDC(10%대). 경기 침체 시 부실채권 급증 리스크' },
  { ticker: 'MPLX', market: 'US', tier: 'high', sector: '에너지 인프라(MLP)',
    note: 'MPLX — 송유관 MLP(7%대). 유가·물동량 민감·MLP라 세금 신고(K-1) 복잡' },
  { ticker: 'ET', market: 'US', tier: 'high', sector: '에너지 인프라(MLP)',
    note: 'Energy Transfer(ET) — 대형 미드스트림 MLP(6~7%). 배당 삭감 이력(2020)·MLP 세금 복잡' },
]

// ── 커버드콜·옵션 ETF (10~50%+, 옵션 프리미엄 분배) ──────────────────────────
//   KR ETF는 Naver etfAnalysis로 라이브 분배율 수신 / US YieldMax·Roundhill류는 Yahoo 0 → targetYield 참고
const COVERED_CALL: UltraStock[] = [
  // 국내 상장 (라이브 분배율)
  { ticker: '494300', market: 'KR', tier: 'covered_call', sector: '나스닥100 데일리 커버드콜',
    note: 'KODEX 미국나스닥100데일리커버드콜OTM — 매일 옵션 매도로 분배율 극대화. 나스닥 급등 시 상승 제한' },
  { ticker: '491620', market: 'KR', tier: 'covered_call', sector: '미국테크100 고정 커버드콜',
    note: 'RISE 미국테크100데일리고정커버드콜 — 고정 프리미엄 분배 목표. 기초자산 하락 리스크 그대로' },
  { ticker: '498410', market: 'KR', tier: 'covered_call', sector: '국내 금융 위클리 커버드콜',
    note: 'KODEX 금융고배당TOP10타겟위클리커버드콜 — 국내 고배당 금융 10종 + 위클리 옵션 매도' },
  // 미국 상장 (Yahoo 분배율 미제공 → 운용사 목표·변동 참고)
  { ticker: 'CONY', market: 'US', tier: 'covered_call', sector: '코인베이스 커버드콜',
    note: 'YieldMax COIN(CONY) — 코인베이스 기반 커버드콜. 분배율 변동 극심·기초자산(코인) 폭락 시 원금 급감',
    targetYield: 0.60, targetLabel: '연 50~100%+ (극심한 변동)' },
  { ticker: 'YMAG', market: 'US', tier: 'covered_call', sector: 'M7 옵션 ETF 묶음',
    note: 'YieldMax M7(YMAG) — 빅테크 7종 커버드콜 ETF들을 한데 묶은 분산형. 개별 YieldMax보단 완만',
    targetYield: 0.45, targetLabel: '연 40~50%대' },
  { ticker: 'PLTW', market: 'US', tier: 'covered_call', sector: '팔란티어 주배당',
    note: 'Roundhill PLTR WeeklyPay(PLTW) — 팔란티어 기반 매주 분배. 단일 종목 집중·변동성 매우 큼',
    targetYield: 0.55, targetLabel: '연 50%+ (주배당)' },
  { ticker: '486290', market: 'KR', tier: 'covered_call', sector: '나스닥100 타겟 커버드콜',
    note: 'TIGER 미국나스닥100+15%프리미엄 — 타겟(부분) 매도형. 데일리 전량형(494300)보다 본주 추종이 나은 편(X-Ray 확인)' },
  { ticker: '482730', market: 'KR', tier: 'covered_call', sector: 'S&P500 타겟 커버드콜',
    note: 'TIGER 미국S&P500+10%프리미엄 — 지수 커버드콜 중 본주(SPY) 추종이 가장 양호한 축(X-Ray 확인)' },
  { ticker: '458760', market: 'KR', tier: 'covered_call', sector: '미국배당다우존스 타겟 커버드콜',
    note: 'TIGER 미국배당+7%프리미엄 — SCHD 계열 + 부분 콜매도. 분배는 낮지만 총수익 손실이 작음(X-Ray 확인)' },
  { ticker: 'MSTY', market: 'US', tier: 'covered_call', sector: '마이크로스트래티지 커버드콜',
    note: 'YieldMax MSTR(MSTY) — 비트코인 대리 MSTR 기반. 분배율 최고 수준이나 변동·원금 침식 극심' },
  { ticker: 'NVDY', market: 'US', tier: 'covered_call', sector: '엔비디아 커버드콜',
    note: 'YieldMax NVDA(NVDY) — 엔비디아 기반 커버드콜. NVDA 급등 시 상승 제한' },
  { ticker: 'TSLY', market: 'US', tier: 'covered_call', sector: '테슬라 커버드콜',
    note: 'YieldMax TSLA(TSLY) — 테슬라 기반. 출시 이후 NAV가 크게 침식된 대표 사례' },
  { ticker: 'QYLD', market: 'US', tier: 'covered_call', sector: '나스닥100 커버드콜(원조)',
    note: 'Global X QYLD — 나스닥100 커버드콜 원조(10%대). YieldMax보단 완만하나 장기 우상향은 못 함' },
  { ticker: 'JEPQ', market: 'US', tier: 'covered_call', sector: 'JPM 나스닥 프리미엄',
    note: 'JPMorgan JEPQ — 나스닥 프리미엄 인컴(9%대). 커버드콜 중 상대적 안정(액티브 운용)' },
  { ticker: 'JEPI', market: 'US', tier: 'covered_call', sector: 'JPM S&P 프리미엄',
    note: 'JPMorgan JEPI — S&P 프리미엄 인컴(7%대). 커버드콜 ETF 중 가장 방어적' },
]

export const ULTRA_UNIVERSE: UltraStock[] = [...HIGH, ...COVERED_CALL]

// ── 초고배당 공통 리스크 (교육 패널) ─────────────────────────────────────────
export const ULTRA_RISKS: { icon: string; title: string; body: string }[] = [
  { icon: '🩸', title: '제 살 깎기 (NAV 침식)',
    body: '주가가 하락·횡보하면 일부 커버드콜 ETF는 원금(자본)을 깎아서 분배합니다. 분배율만 높고 계좌 총자산은 오히려 줄 수 있어요 — 반드시 주가 + 분배를 합친 총수익률(Total Return)을 확인하세요.' },
  { icon: '🔒', title: '상방 제한 (Capped Upside)',
    body: '커버드콜 구조는 콜옵션을 팔았기 때문에 기초자산(엔비디아·코인 등)이 폭등해도 그 상승을 다 따라가지 못합니다. "많이 벌 기회"를 팔아서 "매달 현금"으로 바꾼 상품입니다.' },
  { icon: '🧾', title: '과세 부담 (절세 계좌 활용)',
    body: '초고배당 분배금엔 배당소득세 15.4%가 붙습니다. 일반 계좌보다 ISA·연금저축·IRP 계좌를 쓰면 과세이연·분리과세로 절세할 수 있어요.' },
  { icon: '🎯', title: '섹터 집중·삭감 리스크',
    body: '개별 초고배당주는 금융·리츠·담배·에너지에 몰려 있어 경기·금리·규제 충격에 함께 흔들립니다. 고배당이 지속 불가능해지면 배당 삭감 → 주가·배당 동반 급락도 흔합니다.' },
]
