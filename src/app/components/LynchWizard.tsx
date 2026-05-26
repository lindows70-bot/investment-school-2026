'use client'

/**
 * LynchWizard — 피터 린치 종목 인터랙티브 진단 툴
 *
 * ◆ 흐름
 *  STEP 1 → 정량 데이터 진단 (PER · EPS 성장률 · 순현금 → PEG 실시간 계산)
 *  STEP 2 → 피터 린치식 정성 체크리스트 (선호 속성 / 기피 속성 분리)
 *  STEP 3 → 최종 처방전 (6대 유형 판정 + 매도 타이밍 카드)
 *
 * ◆ 분류 알고리즘
 *  정량 점수(EPS 성장률 구간·PEG 구간·순현금 유무) +
 *  정성 점수(체크리스트 가중치 합산) → 6개 유형별 누적 점수 → argmax
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  RotateCcw, TrendingUp, AlertTriangle, Award,
  DollarSign, Activity, ShieldCheck, Zap, Sparkles,
} from 'lucide-react'

// ── 디자인 토큰 (리서치 페이지 뉴모피즘 팔레트 계승) ──────────
const T = {
  bg:     '#1b1e2e',         // 카드 배경
  deep:   '#13162a',         // 인풋·인셋 배경
  border: '#252840',         // 보더
  text:   '#dde4f0',         // 본문
  muted:  '#454868',         // 보조
  dim:    '#363855',         // 비활성
  // 유형별 컬러
  fast:   '#a3e635',         // 고성장주 — 네온그린
  stalw:  '#38bdf8',         // 대형우량주 — 스카이블루
  slow:   '#fbbf24',         // 저성장주 — 앰버
  cycl:   '#fb923c',         // 경기변동주 — 오렌지
  asset:  '#c084fc',         // 자산주 — 퍼플
  turn:   '#f87171',         // 턴어라운드 — 레드
  // PEG
  pegGood: '#4ade80',
  pegOk:   '#60a5fa',
  pegBad:  '#f87171',
}
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

// ── 주요 종목 재무 데이터베이스 (Mock, 2025-2026 기준) ─────────
// API에서 데이터를 가져오지 못했을 때 폴백으로 사용됩니다.
// per: 주가수익비율  epsGrowth: 연간 예상 EPS 성장률(%)  hasCash: 순현금 보유 여부
interface StockFinancialRecord {
  name:      string
  per:       number
  epsGrowth: number
  hasCash:   boolean
  note?:     string  // 데이터 기준 메모
}

const STOCK_DB: Record<string, StockFinancialRecord> = {
  // ── 미국 테크 ─────────────────────────────────────────────
  'NVDA':  { name: 'NVIDIA',            per: 36,  epsGrowth: 40, hasCash: true,  note: 'AI 반도체 고성장 지속' },
  'PLTR':  { name: 'Palantir',          per: 68,  epsGrowth: 32, hasCash: true,  note: '정부·기업 AI 플랫폼' },
  'AAPL':  { name: 'Apple',             per: 28,  epsGrowth: 12, hasCash: true,  note: '대형 우량주. 자사주 매입 활발' },
  'TSLA':  { name: 'Tesla',             per: 75,  epsGrowth: 22, hasCash: true,  note: 'EV·에너지·로봇 복합 성장' },
  'GOOGL': { name: 'Alphabet (Google)', per: 22,  epsGrowth: 18, hasCash: true,  note: '클라우드·광고·AI 안정 성장' },
  'MSFT':  { name: 'Microsoft',         per: 32,  epsGrowth: 16, hasCash: true,  note: 'Azure 클라우드 중심 성장' },
  'META':  { name: 'Meta Platforms',    per: 24,  epsGrowth: 28, hasCash: true,  note: 'AI 광고 효율·Reels 성장' },
  'AMZN':  { name: 'Amazon',            per: 42,  epsGrowth: 30, hasCash: false, note: 'AWS 이익 폭발, 고capex' },
  'AMD':   { name: 'AMD',               per: 38,  epsGrowth: 28, hasCash: true,  note: 'AI GPU·데이터센터 성장' },
  'GEV':   { name: 'GE Vernova',        per: 52,  epsGrowth: 38, hasCash: true,  note: '에너지 전환 수혜주' },
  'TEM':   { name: 'Tempus AI',         per: 120, epsGrowth: 50, hasCash: false, note: '의료 AI. 초기 성장주, 적자 주의' },
  'PSLV':  { name: 'Sprott Silver',     per: 0,   epsGrowth: 0,  hasCash: false, note: '실물 은 ETF (PEG 분석 무의미)' },
  'IBB':   { name: 'iShares Biotech',   per: 18,  epsGrowth: 12, hasCash: false, note: '바이오 ETF (바스켓)' },
  'XBI':   { name: 'SPDR Biotech ETF',  per: 16,  epsGrowth: 10, hasCash: false, note: '스몰캡 바이오 ETF' },
  'ETN':   { name: 'Eaton Corporation', per: 28,  epsGrowth: 14, hasCash: false, note: '전력 인프라 우량주' },
  // ── 한국 주요 종목 ─────────────────────────────────────────
  '005930': { name: '삼성전자',           per: 13,  epsGrowth: 22, hasCash: true,  note: 'HBM·파운드리 사이클 회복' },
  '000660': { name: 'SK하이닉스',         per: 10,  epsGrowth: 35, hasCash: false, note: 'HBM 초과 수요, 고capex' },
  '012450': { name: '한화에어로스페이스',  per: 28,  epsGrowth: 25, hasCash: true,  note: 'K방산 수출 고성장' },
  '329180': { name: 'HD현대중공업',        per: 18,  epsGrowth: 20, hasCash: false, note: 'LNG·해양 수주 사이클' },
  '010120': { name: 'LS ELECTRIC',        per: 20,  epsGrowth: 18, hasCash: true,  note: '전력 인프라 수혜' },
  '449450': { name: 'PLUS K방산',         per: 25,  epsGrowth: 20, hasCash: true,  note: 'K방산 ETF' },
  '278470': { name: '에이피알',            per: 22,  epsGrowth: 18, hasCash: true,  note: '뷰티테크 글로벌 성장' },
  '010140': { name: '삼성중공업',          per: 14,  epsGrowth: 25, hasCash: false, note: '해양플랜트 수주 회복' },
  '034020': { name: '두산에너빌리티',      per: 20,  epsGrowth: 22, hasCash: false, note: 'SMR·원전 성장주' },
  '032830': { name: '삼성생명',            per: 8,   epsGrowth: 8,  hasCash: true,  note: '금융주, 배당 중심' },
}

// ── 컴포넌트 Props ────────────────────────────────────────────
interface LynchWizardProps {
  /** 현재 리서치 중인 티커 (연동 자동 채움 트리거) */
  autoTicker?:    string | null
  /** API에서 받아온 종목명 */
  autoName?:      string | null
  /** API에서 받아온 PER */
  autoPer?:       number | null
  /** API에서 받아온 EPS 성장률 (%) */
  autoEpsGrowth?: number | null
}

// ── 6대 유형 메타 ─────────────────────────────────────────────
type LynchType = 'fast_grower' | 'stalwart' | 'slow_grower' | 'cyclical' | 'asset_play' | 'turnaround'

const TYPE_META: Record<LynchType, {
  label:      string
  emoji:      string
  color:      string
  desc:       string
  sellTip:    string
  watchPoints: string[]
}> = {
  fast_grower: {
    label: '고성장주',
    emoji: '🚀',
    color: T.fast,
    desc:  '연 20% 이상 이익 성장을 지속하는 작고 민첩한 기업. 린치의 가장 선호 유형. 10배거(Ten-Bagger)의 원천.',
    sellTip:
      '성장이 둔화되거나 2차 확장(체인점·신시장)이 실패 신호를 보낼 때 매도하세요. PEG가 1.5를 지속 상회하면 성장 프리미엄이 이미 가격에 반영된 것입니다.',
    watchPoints: [
      'PEG가 1.5를 초과하기 시작하면 경고',
      '핵심 시장 포화도를 분기마다 체크',
      '2차 성장 스토리(신사업) 진행 상황 점검',
      '매출 성장률이 이익 성장률을 밑돌기 시작하면 주의',
    ],
  },
  stalwart: {
    label: '대형우량주',
    emoji: '🛡️',
    color: T.stalw,
    desc:  '연 10~12% 안정 성장하는 대형 우량 기업. 폭발적 수익보다 방어적 자산 역할. 경기 침체에 강함.',
    sellTip:
      'PEG가 1.2~1.4 이상으로 올라가면 일부 비중을 줄이고 더 저평가된 우량주로 교체하는 전략을 씁니다. 20~30% 수익 시 분할 매도 후 재진입 타이밍을 노리세요.',
    watchPoints: [
      'PEG 1.2 이상 진입 시 비중 축소 검토',
      '무분별한 M&A 시작 시 경계 신호',
      '시장 점유율 정체 또는 하락 여부 확인',
      '20~30% 수익 구간에서 차익 실현 고려',
    ],
  },
  slow_grower: {
    label: '저성장주',
    emoji: '🐢',
    color: T.slow,
    desc:  '연 2~5% 저성장, 성숙 산업의 대형주. 배당이 투자 수익의 핵심. 린치는 특별한 이유 없으면 비선호.',
    sellTip:
      '배당이 삭감되거나 성장 명목으로 인수·합병을 시작하면 즉시 재검토하세요. 린치는 저성장주의 무리한 다각화를 "diworsification(악화 다각화)"라 부르며 경계했습니다.',
    watchPoints: [
      '배당 감소 또는 배당 동결 여부 매분기 확인',
      '무관한 업종 인수 시작 → 린치의 최대 경고 신호',
      '시장 점유율 2% 이상 연속 하락 시 매도 검토',
      '배당수익률 대비 리스크 재산정',
    ],
  },
  cyclical: {
    label: '경기변동주',
    emoji: '🔄',
    color: T.cycl,
    desc:  '경기 사이클과 동행하는 산업(자동차·철강·반도체·항공 등). 사이클 저점 매수·정점 매도가 핵심. 타이밍 싸움.',
    sellTip:
      '재고가 급증하거나 경쟁사가 새로 시장에 진입하면 경기 정점 신호입니다. 모두가 "이번엔 다르다"고 낙관할 때 오히려 매도를 준비하세요. PER이 역설적으로 낮아지는 시점이 팔 때입니다.',
    watchPoints: [
      '재고 수준 증가 및 수주잔고(Backlog) 감소 확인',
      '원자재 가격 상승 → 마진 압박 초기 신호',
      '신규 경쟁사 시장 진입 공시 주시',
      '애널리스트 목표가 상향 러시가 나올 때 경계',
    ],
  },
  asset_play: {
    label: '자산주',
    emoji: '💎',
    color: T.asset,
    desc:  '시장이 미처 인식하지 못한 숨겨진 자산(부동산·특허·브랜드·현금)을 보유한 기업. 자산 재평가가 트리거.',
    sellTip:
      '숨겨진 자산이 시장에 완전히 인식되거나(주가 급등), 회사가 해당 자산을 실제로 처분·활용했을 때 매도 타이밍입니다. 자산 가치 대비 주가가 80% 이상 수렴했다면 기대 수익이 크지 않습니다.',
    watchPoints: [
      '부동산·특허 등 자산 매각/처분 공시 후 주가 반응 확인',
      '경영진이 자사 부동산 재평가 작업 착수 여부',
      '행동주의 투자자 지분 취득 → 촉매 발생 가능',
      '자산 대비 주가 할인율이 20% 이내로 좁혀지면 이익 실현 고려',
    ],
  },
  turnaround: {
    label: '회생기업주',
    emoji: '🔥',
    color: T.turn,
    desc:  '적자·위기에서 탈출 중인 기업. 구조조정·부채 감축이 진행 중일 때가 기회. 성공 시 폭발적 수익 가능.',
    sellTip:
      '구조조정이 완료되고 2~3분기 연속 흑자 전환이 확인되면 첫 번째 매도 시점입니다. 원래 문제(부채·적자)가 해소되었다면 스토리는 끝난 것입니다. "회복 완료 = 매도 준비".',
    watchPoints: [
      '3분기 연속 흑자 전환 확인 후 차익 실현 검토',
      '부채비율 정상화(업종 평균 이하) 시 스토리 마무리',
      '핵심 사업부 매각이 완료된 이후 성장 동력 재점검',
      '구조조정 비용이 사라진 분기 실적이 본격 반영될 때',
    ],
  },
}

// ── 정성 체크리스트 문항 ──────────────────────────────────────
type CheckKey =
  | 'boring_name' | 'no_analyst' | 'boring_industry' | 'insider_buying'
  | 'niche_monopoly' | 'repeat_purchase' | 'restructuring' | 'hidden_assets'
  | 'spinoff' | 'recession_proof'
  | 'hot_industry' | 'no_barrier' | 'random_acquisition' | 'customer_concentration'

interface CheckItem {
  key:      CheckKey
  label:    string
  detail:   string
  positive: boolean   // true = 린치 선호(가산), false = 린치 기피(주의)
  // 각 유형에 부여되는 가중치 점수
  weights:  Partial<Record<LynchType, number>>
}

const CHECKLIST: CheckItem[] = [
  // ── 린치 선호 속성 ────────────────────────────────────────
  {
    key:      'boring_name',
    label:    '회사 이름이 따분하거나 우스꽝스럽다',
    detail:   '폐기물 처리, 장례, 해충 방제처럼 대중이 관심 없어하는 이름. 린치가 가장 좋아하는 첫인상.',
    positive: true,
    weights:  { fast_grower: 2, stalwart: 1 },
  },
  {
    key:      'no_analyst',
    label:    '기관투자자·애널리스트가 거의 관심 없다',
    detail:   '커버리지 리포트가 전무하거나 1~2개 수준. 시장이 아직 발굴하지 못한 "숨겨진 진주" 신호.',
    positive: true,
    weights:  { fast_grower: 3, stalwart: 1 },
  },
  {
    key:      'boring_industry',
    label:    '대중이 기피하거나 혐오하는 사양 업종이다',
    detail:   '누구도 투자하고 싶지 않은 산업 — 경쟁자가 진입하지 않는 이유이기도 함. 린치의 "꿀 도메인".',
    positive: true,
    weights:  { stalwart: 2, turnaround: 1, slow_grower: 1 },
  },
  {
    key:      'insider_buying',
    label:    '내부자(임원)가 최근 장내 매수 또는 자사주 매입 중이다',
    detail:   '회사를 가장 잘 아는 사람들이 돈을 쓰는 행위. 린치가 꼽는 가장 강력한 신뢰 신호.',
    positive: true,
    weights:  { fast_grower: 2, turnaround: 3, stalwart: 1 },
  },
  {
    key:      'niche_monopoly',
    label:    '틈새 시장을 사실상 독점하고 있다',
    detail:   '경쟁자가 복제하기 어려운 규제·특허·입지·브랜드로 독점적 지위 보유.',
    positive: true,
    weights:  { fast_grower: 3, stalwart: 2 },
  },
  {
    key:      'repeat_purchase',
    label:    '소비자가 반복 구매하는 소비재 성격이다',
    detail:   '면도기, 의약품, 음료 등 — 한 번 습관이 되면 꾸준히 구매. 예측 가능한 현금흐름.',
    positive: true,
    weights:  { stalwart: 3, slow_grower: 1 },
  },
  {
    key:      'restructuring',
    label:    '현재 구조조정·사업 재편·비용 절감이 진행 중이다',
    detail:   '불필요한 자산 매각, 인력 감축, 부채 탕감 등 — 턴어라운드의 핵심 촉매.',
    positive: true,
    weights:  { turnaround: 5 },
  },
  {
    key:      'hidden_assets',
    label:    '부동산·특허·브랜드 등 숨겨진 자산이 있다',
    detail:   '장부가 이상의 실물 자산이 시장에 제대로 반영되지 않은 상황.',
    positive: true,
    weights:  { asset_play: 5 },
  },
  {
    key:      'spinoff',
    label:    '최근 모기업으로부터 스핀오프(분사)된 기업이다',
    detail:   '린치는 스핀오프 기업을 매우 선호 — 모기업이 원치 않는 사업부를 독립시키면 주가 저평가 구간 발생.',
    positive: true,
    weights:  { fast_grower: 2, turnaround: 2, asset_play: 1 },
  },
  {
    key:      'recession_proof',
    label:    '불경기에도 수요가 거의 변하지 않는 제품/서비스다',
    detail:   '식품, 의약품, 담배, 공공요금 등 — 경기 하락기에 방어적 역할.',
    positive: true,
    weights:  { stalwart: 3, slow_grower: 2 },
  },
  // ── 린치 기피 속성 (⚠️ 체크 시 경고 & 경기변동주 점수 가산) ──
  {
    key:      'hot_industry',
    label:    '매스컴에서 매일 떠드는 핫한 인기 업종이다',
    detail:   '⚠️ 린치 기피 신호. 언론이 극찬하는 업종은 이미 기대가 주가에 반영된 경우가 많음.',
    positive: false,
    weights:  { cyclical: 3, fast_grower: -2 },
  },
  {
    key:      'no_barrier',
    label:    '경쟁사가 난립하고 진입장벽이 거의 없다',
    detail:   '⚠️ 린치 기피 신호. 누구나 진입 가능한 시장은 마진 압박과 가격 경쟁으로 이어짐.',
    positive: false,
    weights:  { cyclical: 2, slow_grower: 1 },
  },
  {
    key:      'random_acquisition',
    label:    '무분별한 타 업종 인수·합병(M&A)을 진행 중이다',
    detail:   '⚠️ 린치 최대 기피 신호 — "diworsification(악화 다각화)". 핵심 역량과 무관한 M&A는 가치 파괴.',
    positive: false,
    weights:  { slow_grower: 2, stalwart: -1, cyclical: 1 },
  },
  {
    key:      'customer_concentration',
    label:    '주요 고객 1~2개사에 매출의 50% 이상이 집중된다',
    detail:   '⚠️ 거래처 집중 리스크. 핵심 고객 이탈 시 실적 급변.',
    positive: false,
    weights:  { turnaround: 1, cyclical: 1 },
  },
]

// ── 6대 유형 분류 알고리즘 ────────────────────────────────────
function classifyLynch(
  epsGrowth: number | null,
  peg:       number | null,
  hasCash:   boolean,
  checks:    Record<CheckKey, boolean>,
): LynchType {
  const s: Record<LynchType, number> = {
    fast_grower: 0, stalwart: 0, slow_grower: 0,
    cyclical: 0, asset_play: 0, turnaround: 0,
  }

  // ① EPS 성장률 구간 점수
  if (epsGrowth !== null) {
    if (epsGrowth >= 25)      { s.fast_grower += 5 }
    else if (epsGrowth >= 15) { s.fast_grower += 3; s.stalwart += 2 }
    else if (epsGrowth >= 10) { s.stalwart    += 4; s.fast_grower += 1 }
    else if (epsGrowth >= 5)  { s.stalwart    += 2; s.slow_grower += 1 }
    else if (epsGrowth >= 0)  { s.slow_grower += 3 }
    else                      { s.turnaround  += 5 }   // 적자·역성장
  }

  // ② PEG 구간 점수
  if (peg !== null && peg > 0) {
    if (peg < 0.5)      { s.fast_grower += 2; s.asset_play += 1 }
    else if (peg < 1.0) { s.fast_grower += 1; s.stalwart   += 1 }
    else if (peg > 2.0) { s.slow_grower += 1; s.cyclical   += 1 }
  }

  // ③ 순현금 보유 여부
  if (hasCash) s.asset_play += 3

  // ④ 정성 체크리스트 가중치 합산
  for (const item of CHECKLIST) {
    if (!checks[item.key]) continue
    for (const [type, w] of Object.entries(item.weights) as [LynchType, number][]) {
      s[type] = (s[type] ?? 0) + w
    }
  }

  // ⑤ argmax (점수 최고 유형 반환)
  return (Object.entries(s) as [LynchType, number][])
    .sort(([, a], [, b]) => b - a)[0][0]
}

// ── PEG 배지 ─────────────────────────────────────────────────
function pegBadge(peg: number | null) {
  if (peg === null || !isFinite(peg) || peg <= 0)
    return { label: '—', color: T.muted, bg: `${T.muted}20`, emoji: '' }
  if (peg <= 0.5)  return { label: '적정 이하 (매우 매력적)', color: T.pegGood, bg: `${T.pegGood}20`, emoji: '🟢' }
  if (peg <= 1.0)  return { label: '적정 수준',               color: T.pegOk,   bg: `${T.pegOk}20`,   emoji: '🔵' }
  if (peg <= 1.5)  return { label: '다소 부담',               color: T.slow,    bg: `${T.slow}20`,    emoji: '🟡' }
  return                  { label: '고평가 구간',             color: T.pegBad,  bg: `${T.pegBad}20`,  emoji: '🔴' }
}

// ── 공통 카드 래퍼 ────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bg, boxShadow: SHO, borderRadius: 16, padding: '20px 24px', ...style }}>
      {children}
    </div>
  )
}

// ── 스텝 인디케이터 ───────────────────────────────────────────
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: '정량 진단', icon: <Activity size={14} /> },
    { n: 2, label: '정성 체크', icon: <CheckCircle2 size={14} /> },
    { n: 3, label: '처방전',    icon: <Award size={14} /> },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done    = s.n < current
        const active  = s.n === current
        const color   = done ? T.fast : active ? '#fbbf24' : T.muted
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'unset' }}>
            {/* 원 */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: done ? `${T.fast}22` : active ? 'rgba(251,191,36,0.15)' : T.deep,
              boxShadow: active ? `0 0 16px rgba(251,191,36,0.3)` : SHI,
              border: `2px solid ${color}`,
              color, fontSize: 13, fontWeight: 800, transition: 'all 0.25s',
            }}>
              {done ? '✓' : s.n}
            </div>
            {/* 라벨 */}
            <div style={{ marginLeft: 8, marginRight: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{s.label}</div>
            </div>
            {/* 연결선 */}
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, borderRadius: 1,
                background: done ? T.fast : T.border, transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════
export default function LynchWizard({
  autoTicker,
  autoName,
  autoPer,
  autoEpsGrowth,
}: LynchWizardProps = {}) {
  // ── 스텝 상태 ─────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── STEP 1: 정량 입력 ─────────────────────────────────────
  const [stockName, setStockName] = useState('')
  const [perInput,  setPerInput]  = useState('')
  const [epsInput,  setEpsInput]  = useState('')
  const [hasCash,   setHasCash]   = useState(false)

  // ── 자동 채움 상태 ────────────────────────────────────────
  // autoFillSource: 'api' = API 데이터, 'db' = Mock DB, null = 미채움
  const [autoFillSource, setAutoFillSource] = useState<'api' | 'db' | null>(null)
  const [autoFillLabel,  setAutoFillLabel]  = useState<string>('')
  // 마지막으로 자동 채움한 티커를 기억 — 같은 티커면 중복 실행 방지
  const lastAutoTickerRef = useRef<string | null>(null)

  // ── 종목 변경 시 자동 채움 (API 데이터 우선, DB 폴백) ─────
  useEffect(() => {
    const tk = autoTicker?.toUpperCase().trim()
    if (!tk) return
    // 이미 이 티커로 자동 채움한 경우 재실행 방지
    if (tk === lastAutoTickerRef.current) return
    lastAutoTickerRef.current = tk

    const dbEntry = STOCK_DB[tk]

    // ① API 데이터가 하나라도 있으면 API 우선
    const hasApiPer  = autoPer       != null && isFinite(autoPer)       && autoPer       > 0
    const hasApiGrow = autoEpsGrowth != null && isFinite(autoEpsGrowth) && autoEpsGrowth !== 0

    if (hasApiPer || hasApiGrow) {
      // 종목명: API > DB > 티커 그대로
      setStockName(autoName || dbEntry?.name || tk)
      if (hasApiPer)  setPerInput(autoPer!.toFixed(1))
      if (hasApiGrow) setEpsInput(autoEpsGrowth!.toFixed(1))
      // 순현금: API가 제공하지 않으므로 DB에서 보완
      if (dbEntry) setHasCash(dbEntry.hasCash)
      setAutoFillSource('api')
      setAutoFillLabel(`${autoName || tk} API 데이터 자동 로드`)
      return
    }

    // ② API 데이터 없으면 Mock DB 폴백
    if (dbEntry) {
      setStockName(dbEntry.name)
      setPerInput(dbEntry.per > 0 ? dbEntry.per.toFixed(1) : '')
      setEpsInput(dbEntry.epsGrowth > 0 ? dbEntry.epsGrowth.toFixed(1) : '')
      setHasCash(dbEntry.hasCash)
      setAutoFillSource('db')
      setAutoFillLabel(`${dbEntry.name} 참조 데이터 자동 로드`)
      return
    }

    // ③ DB에도 없으면 종목명만 채움
    if (autoName) {
      setStockName(autoName)
      setAutoFillSource(null)  // 숫자 데이터 없음
    }
  // autoTicker가 바뀔 때만 실행 — autoPer/autoEpsGrowth는 비동기로 나중에 올 수 있으므로
  // 두 번째 useEffect로 API 데이터가 도착하면 보완 채움
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTicker])

  // ── API 데이터가 나중에 도착했을 때 보완 채움 ─────────────
  // (네이버/Yahoo Finance API가 느릴 경우 대비)
  useEffect(() => {
    const tk = autoTicker?.toUpperCase().trim()
    if (!tk || tk !== lastAutoTickerRef.current) return
    // 이미 API 소스로 채워졌으면 무시
    if (autoFillSource === 'api') return

    const hasApiPer  = autoPer       != null && isFinite(autoPer)       && autoPer       > 0
    const hasApiGrow = autoEpsGrowth != null && isFinite(autoEpsGrowth) && autoEpsGrowth !== 0
    if (!hasApiPer && !hasApiGrow) return

    if (hasApiPer)  setPerInput(autoPer!.toFixed(1))
    if (hasApiGrow) setEpsInput(autoEpsGrowth!.toFixed(1))
    setAutoFillSource('api')
    setAutoFillLabel(`${autoName || tk} API 데이터 자동 로드`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPer, autoEpsGrowth])

  const per       = parseFloat(perInput)
  const epsGrowth = parseFloat(epsInput)

  // PEG 실시간 계산
  const computedPeg: number | null = useMemo(() => {
    if (!isFinite(per) || !isFinite(epsGrowth) || epsGrowth <= 0 || per <= 0) return null
    return parseFloat((per / epsGrowth).toFixed(2))
  }, [per, epsGrowth])

  const badge = pegBadge(computedPeg)

  // ── STEP 2: 체크리스트 ────────────────────────────────────
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>(
    () => Object.fromEntries(CHECKLIST.map(c => [c.key, false])) as Record<CheckKey, boolean>
  )
  const toggleCheck = (key: CheckKey) =>
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))

  const positiveCount = CHECKLIST.filter(c => c.positive && checks[c.key]).length
  const negativeCount = CHECKLIST.filter(c => !c.positive && checks[c.key]).length

  // ── STEP 3: 분류 결과 ─────────────────────────────────────
  const resultType = useMemo<LynchType | null>(() => {
    if (step < 3) return null
    return classifyLynch(
      isFinite(epsGrowth) ? epsGrowth : null,
      computedPeg,
      hasCash,
      checks,
    )
  }, [step, epsGrowth, computedPeg, hasCash, checks])

  const resultMeta = resultType ? TYPE_META[resultType] : null

  // ── 초기화 ────────────────────────────────────────────────
  const reset = () => {
    setStep(1)
    // 자동 채움 기록도 초기화 — 같은 종목 재진단 허용
    lastAutoTickerRef.current = null
    setAutoFillSource(null)
    setStockName(''); setPerInput(''); setEpsInput(''); setHasCash(false)
    setChecks(Object.fromEntries(CHECKLIST.map(c => [c.key, false])) as Record<CheckKey, boolean>)
  }

  // ── 공통 입력 스타일 ──────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.deep, boxShadow: SHI, color: T.text,
    fontSize: 15, fontWeight: 600, outline: 'none',
    fontFamily: 'monospace', boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 860 }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(163,230,53,0.15)', boxShadow: SHO,
          }}>
            <TrendingUp size={18} color={T.fast} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.text, letterSpacing: '-0.3px' }}>
              피터 린치 종목 진단 위저드
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              정량 + 정성 데이터를 종합하여 6대 유형으로 정밀 분류합니다
            </div>
          </div>
        </div>
      </div>

      <Card>
        {/* 스텝 인디케이터 */}
        <StepBar current={step} />

        {/* ════════════════════════════════════════════════════
            STEP 1: 정량 데이터 진단
        ════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              📊 STEP 1 · 정량 지표 입력
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: autoFillSource ? 10 : 20 }}>
              분석할 종목의 핵심 재무 지표를 입력해주세요. PEG 비율이 실시간으로 계산됩니다.
            </div>

            {/* ── 자동 채움 배지 ────────────────────────────── */}
            {autoFillSource && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 10, marginBottom: 16,
                background: autoFillSource === 'api'
                  ? 'rgba(163,230,53,0.12)' : 'rgba(96,165,250,0.12)',
                border: `1px solid ${autoFillSource === 'api' ? T.fast : T.stalw}40`,
              }}>
                <Sparkles size={14} color={autoFillSource === 'api' ? T.fast : T.stalw} />
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: autoFillSource === 'api' ? T.fast : T.stalw,
                }}>
                  ⚡ {autoFillLabel} 완료
                </span>
                <span style={{ fontSize: 11, color: T.muted, marginLeft: 4 }}>
                  {autoFillSource === 'api' ? '(실시간 API)' : '(참조 데이터 · 수정 가능)'}
                </span>
                {/* 수동 초기화 버튼 */}
                <button
                  onClick={() => {
                    setPerInput(''); setEpsInput(''); setHasCash(false)
                    setAutoFillSource(null)
                    lastAutoTickerRef.current = null
                  }}
                  style={{
                    marginLeft: 'auto', fontSize: 10, color: T.muted, background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                  }}
                  title="자동 채움 초기화"
                >
                  ✕ 초기화
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 종목명 */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  종목명 / 티커
                </label>
                <input
                  style={{
                    ...inputStyle,
                    borderColor: autoFillSource ? `${autoFillSource === 'api' ? T.fast : T.stalw}60` : T.border,
                  }}
                  value={stockName}
                  onChange={e => { setStockName(e.target.value); setAutoFillSource(null) }}
                  placeholder="예: NVIDIA, 삼성전자, 한화에어로스페이스"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* PER */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    현재 PER (주가수익비율)
                  </label>
                  <input
                    type="number" min="0" step="0.1"
                    value={perInput}
                    onChange={e => { setPerInput(e.target.value); setAutoFillSource(null) }}
                    placeholder="예: 25.4"
                    style={{
                      ...inputStyle,
                      borderColor: autoFillSource && perInput
                        ? `${autoFillSource === 'api' ? T.fast : T.stalw}60` : T.border,
                    }}
                  />
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                    현재 주가 ÷ 주당순이익(EPS)
                  </div>
                </div>

                {/* EPS 성장률 */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    예상 EPS 성장률 (%, 연간)
                  </label>
                  <input
                    type="number" step="0.1"
                    value={epsInput}
                    onChange={e => { setEpsInput(e.target.value); setAutoFillSource(null) }}
                    placeholder="예: 18.5"
                    style={{
                      ...inputStyle,
                      borderColor: autoFillSource && epsInput
                        ? `${autoFillSource === 'api' ? T.fast : T.stalw}60` : T.border,
                    }}
                  />
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                    향후 1~3년 예상 연간 이익 성장률
                  </div>
                </div>
              </div>

              {/* 순현금 토글 */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
                  순현금 자산 보유 여부
                </label>
                <button
                  onClick={() => setHasCash(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 10,
                    border: `2px solid ${hasCash ? T.asset : T.border}`,
                    background: hasCash ? `${T.asset}18` : T.deep,
                    boxShadow: hasCash ? `0 0 12px ${T.asset}30` : SHI,
                    color: hasCash ? T.asset : T.muted,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    transition: 'all 0.2s', width: '100%',
                  }}
                >
                  <DollarSign size={16} color={hasCash ? T.asset : T.muted} />
                  {hasCash
                    ? '✅ 순현금 보유 (부채 < 현금·유동자산)'
                    : '○ 순현금 해당 없음 (부채가 현금보다 많음)'}
                </button>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                  현금 + 단기투자자산이 총부채를 초과하면 활성화하세요
                </div>
              </div>

              {/* PEG 실시간 결과 카드 */}
              <div style={{
                padding: '16px 20px', borderRadius: 12,
                background: badge.bg,
                border: `1.5px solid ${badge.color}40`,
                transition: 'all 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      실시간 PEG (주가수익성장비율)
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: badge.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                      {computedPeg !== null ? computedPeg.toFixed(2) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: badge.color, marginTop: 4 }}>
                      {badge.emoji} {badge.label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: T.dim, maxWidth: 200, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: T.muted, marginBottom: 4 }}>PEG = PER ÷ EPS 성장률</div>
                    PEG {'<'} 1.0 → 린치의 &ldquo;강력 매수 신호&rdquo;<br />
                    PEG = 1.0 → 성장이 가격에 적정 반영<br />
                    PEG {'>'} 1.5 → 성장 대비 고평가 경계
                  </div>
                </div>
              </div>
            </div>

            {/* 다음 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setStep(2)}
                disabled={!stockName.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 24px', borderRadius: 10, border: 'none', cursor: stockName.trim() ? 'pointer' : 'not-allowed',
                  background: stockName.trim() ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : T.deep,
                  boxShadow: stockName.trim() ? '0 4px 12px rgba(251,191,36,0.3)' : SHI,
                  color: stockName.trim() ? '#1b1e2e' : T.dim,
                  fontSize: 14, fontWeight: 800, transition: 'all 0.2s',
                }}
              >
                정성 체크리스트로 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 2: 정성 체크리스트
        ════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
                🧠 STEP 2 · 피터 린치식 정성 체크리스트
              </div>
              <div style={{ fontSize: 12, color: T.muted, textAlign: 'right' }}>
                <span style={{ color: T.fast }}>선호 {positiveCount}</span>
                {' · '}
                <span style={{ color: T.turn }}>경고 {negativeCount}</span>
                {' / 14항목'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
              <b style={{ color: '#fbbf24' }}>{stockName}</b>에 해당하는 항목을 모두 체크하세요.
              각 항목은 최종 유형 판정에 가중치로 반영됩니다.
            </div>

            {/* 선호 속성 섹션 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <ShieldCheck size={14} color={T.fast} />
                <span style={{ fontSize: 11, fontWeight: 800, color: T.fast, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  린치 선호 속성 — 체크할수록 긍정 신호
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST.filter(c => c.positive).map(item => {
                  const checked = checks[item.key]
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleCheck(item.key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${checked ? T.fast : T.border}`,
                        background: checked ? `${T.fast}12` : T.deep,
                        boxShadow: checked ? `0 0 8px ${T.fast}25` : SHI,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        width: '100%',
                      }}
                    >
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        {checked
                          ? <CheckCircle2 size={18} color={T.fast} />
                          : <Circle size={18} color={T.muted} />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? T.fast : T.text, marginBottom: 2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{item.detail}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 기피 속성 섹션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <AlertTriangle size={14} color={T.turn} />
                <span style={{ fontSize: 11, fontWeight: 800, color: T.turn, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  린치 기피 속성 — 체크할수록 주의 신호
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST.filter(c => !c.positive).map(item => {
                  const checked = checks[item.key]
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleCheck(item.key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${checked ? T.turn : T.border}`,
                        background: checked ? `${T.turn}12` : T.deep,
                        boxShadow: checked ? `0 0 8px ${T.turn}25` : SHI,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        width: '100%',
                      }}
                    >
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        {checked
                          ? <CheckCircle2 size={18} color={T.turn} />
                          : <Circle size={18} color={T.muted} />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? T.turn : T.text, marginBottom: 2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{item.detail}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 네비게이션 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 20px', borderRadius: 10, border: `1px solid ${T.border}`,
                  background: T.deep, boxShadow: SHI, color: T.muted,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <ChevronLeft size={15} /> 이전
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                  boxShadow: '0 4px 12px rgba(251,191,36,0.3)',
                  color: '#1b1e2e', fontSize: 14, fontWeight: 800,
                }}
              >
                최종 처방전 받기 <Zap size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 3: 최종 진단 처방전
        ════════════════════════════════════════════════════ */}
        {step === 3 && resultMeta && resultType && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              🏥 STEP 3 · 피터 린치 처방전
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
              <b style={{ color: '#fbbf24' }}>{stockName}</b> 종합 진단 완료
            </div>

            {/* ── 유형 판정 메인 카드 ────────────────────────── */}
            <div style={{
              padding: '24px', borderRadius: 16,
              background: `${resultMeta.color}15`,
              border: `2px solid ${resultMeta.color}50`,
              boxShadow: `0 0 32px ${resultMeta.color}20`,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 48, lineHeight: 1 }}>{resultMeta.emoji}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    피터 린치 최종 판정
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: resultMeta.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    {resultMeta.label}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: T.text, lineHeight: 1.7, margin: 0 }}>
                {resultMeta.desc}
              </p>
            </div>

            {/* ── 진단 요약 지표 배지들 ──────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
              {/* PEG */}
              <div style={{ background: T.deep, boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${badge.color}` }}>
                <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>PEG 비율</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: badge.color }}>
                  {computedPeg !== null ? computedPeg.toFixed(2) : '미입력'}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{badge.label}</div>
              </div>
              {/* EPS 성장률 */}
              <div style={{ background: T.deep, boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${isFinite(epsGrowth) && epsGrowth >= 15 ? T.fast : isFinite(epsGrowth) && epsGrowth >= 5 ? T.stalw : T.turn}` }}>
                <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>EPS 성장률</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>
                  {isFinite(epsGrowth) ? `${epsGrowth}%` : '미입력'}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>연간 예상 성장률</div>
              </div>
              {/* 순현금 */}
              <div style={{ background: T.deep, boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${hasCash ? T.asset : T.border}` }}>
                <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>순현금</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: hasCash ? T.asset : T.muted }}>
                  {hasCash ? '✅ 보유' : '✗ 없음'}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>현금 {'>'} 부채 여부</div>
              </div>
              {/* 정성 점수 */}
              <div style={{ background: T.deep, boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${T.fast}` }}>
                <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>정성 체크</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>
                  {positiveCount}<span style={{ fontSize: 14, color: T.muted }}>+</span> / {negativeCount}<span style={{ fontSize: 14, color: T.turn }}>-</span>
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>선호 / 기피 항목 수</div>
              </div>
            </div>

            {/* ── 매도 타이밍 처방 카드 ──────────────────────── */}
            <div style={{
              padding: '20px', borderRadius: 12,
              background: T.deep, boxShadow: SHI,
              borderLeft: `4px solid ${resultMeta.color}`,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <AlertTriangle size={14} color={resultMeta.color} />
                <span style={{ fontSize: 12, fontWeight: 800, color: resultMeta.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  ⏰ {resultMeta.label} — 매도 타이밍 핵심 처방
                </span>
              </div>
              <p style={{ fontSize: 13, color: T.text, lineHeight: 1.7, margin: '0 0 14px 0' }}>
                {resultMeta.sellTip}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {resultMeta.watchPoints.map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 11, color: resultMeta.color, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 체크된 정성 속성 요약 ──────────────────────── */}
            {(positiveCount > 0 || negativeCount > 0) && (
              <div style={{
                padding: '16px', borderRadius: 12, background: T.deep, boxShadow: SHI, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  📋 체크된 정성 속성 요약
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CHECKLIST.filter(c => checks[c.key]).map(c => (
                    <span key={c.key} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: c.positive ? `${T.fast}18` : `${T.turn}18`,
                      color: c.positive ? T.fast : T.turn,
                      border: `1px solid ${c.positive ? T.fast : T.turn}40`,
                    }}>
                      {c.positive ? '✓' : '⚠️'} {c.label.split('·')[0].substring(0, 20)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── 다시 진단하기 ──────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 20px', borderRadius: 10, border: `1px solid ${T.border}`,
                  background: T.deep, boxShadow: SHI, color: T.muted,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <ChevronLeft size={15} /> 체크리스트 수정
              </button>
              <button
                onClick={reset}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '12px', borderRadius: 10, cursor: 'pointer',
                  background: `${resultMeta.color}20`,
                  border: `1px solid ${resultMeta.color}40`,
                  color: resultMeta.color, fontSize: 13, fontWeight: 800,
                }}
              >
                <RotateCcw size={15} /> 다시 진단하기
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
