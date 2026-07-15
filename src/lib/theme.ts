// 🎨 디자인 토큰 SSOT — 앱 전체 색상의 단일 출처(2026-07-16 코드모드로 162파일 6,200+곳 통합).
//    여기 값을 바꾸면 전 화면에 일괄 반영됩니다(JS 상수라 Recharts·lightweight-charts(캔버스)·SVG 전부 호환).
//    ⚠️ 이름 규칙: Tailwind 표준값은 표준 이름(red400 등), 앱 고유값은 역할 이름(card·border·sub 등).
//    ⚠️ sub2~sub15는 가독성 개선 과정에서 파편화된 유사 그레이 — 리디자인 시 sub·slate 계열로 수렴할 후보(값만 바꾸면 됨).
//    ⚠️ tailwind.config.ts의 ink/zinc 토큰은 별도 시스템(클래스용) — 여기 값과 어긋나지 않게 함께 관리.

export const TK = {
  // ── 배경·보더(앱 고유 다크 스킨) — 어두운 순 ──────────────────
  slate950: '#020617',   // 최심 배경
  bg0: '#0a0e1a',        // 딥 배경
  bg1: '#0d1017',        // 페이지 배경 · 액센트 위 어두운 글자
  bg2: '#0e1020',
  bg3: '#0f1117',        // 인풋·내부 카드 배경(최다 사용)
  gray900: '#111827',
  bg4: '#12151c',
  bg5: '#141720',
  card: '#141824',       // 표준 카드 배경
  slate900: '#0f172a',
  bg6: '#161b25',
  bg7: '#1a1d27',        // 구 대시보드 기준 배경(WCAG 대비 기준점)
  bg8: '#1b1e2e',
  grid: '#1c2434',       // 차트 그리드
  flat2: '#1e1e1e',
  bg9: '#1e2140',
  border: '#1e293b',     // 표준 카드 보더(=slate800)
  bg10: '#1e2535',
  gray800: '#1f2937',
  line3: '#252a36',
  line2: '#282c44',
  flat1: '#2a2a2a',
  line1: '#2a2d3a',
  line4: '#4a5070',

  // ── 텍스트 램프(밝은 순) ──────────────────────────────────────
  slate100: '#f1f5f9',   // 최상위 강조 텍스트
  slate200: '#e2e8f0',   // 본문 텍스트
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  gray500: '#6b7280',
  // 서브텍스트(앱 고유 — 가독성 패스 산물, 리디자인 수렴 후보)
  sub: '#8a9aaa',        // 표준 서브 텍스트(최다)
  sub2: '#7f93a8',
  sub3: '#8599ae',
  sub4: '#9aa0b8',
  sub5: '#aab6c4',
  sub6: '#7a8fa3',
  sub7: '#8a96a8',
  sub8: '#9aa7b5',
  sub9: '#a8b5c2',
  sub10: '#7a8599',
  sub11: '#cdd6e3',
  sub12: '#dde4f0',
  sub13: '#9aa7b4',
  sub14: '#8b92b8',
  sub15: '#dbe3ec',

  // ── 액센트(Tailwind 표준) ─────────────────────────────────────
  red300: '#fca5a5', red400: '#f87171', red500: '#ef4444', red600: '#dc2626',
  orange400: '#fb923c',
  amber400: '#fbbf24', amber500: '#f59e0b', amber700: '#b45309', amber800: '#92400e',
  yellow500: '#eab308',
  green300: '#86efac', green400: '#4ade80', green500: '#22c55e',
  emerald300: '#6ee7b7', emerald400: '#34d399', emerald500: '#10b981',
  teal400: '#2dd4bf', cyan400: '#22d3ee', sky400: '#38bdf8',
  blue300: '#93c5fd', blue400: '#60a5fa', blue500: '#3b82f6', blue600: '#2563eb', blue700: '#1d4ed8',
  indigo300: '#a5b4fc', indigo400: '#818cf8',
  violet300: '#c4b5fd', violet400: '#a78bfa', purple400: '#c084fc', purple500: '#a855f7',
  fuchsia300: '#f0abfc', pink400: '#f472b6', pink500: '#ec4899',
  lime400: '#a3e635',
  neonLime: '#deff9a',   // 대시보드 시그니처 네온 라임
  btcOrange: '#f7931a',  // 비트코인 공식 오렌지

  // ── 🪙 골드 코인('내 보유' 3D 시각 언어 — 승패 해부실에서 시작) ──
  coinLight: '#ffe9a3', coinDark: '#a3690b', coinEdge: '#7c4f06', coinText: '#5c3a04',
}
// ⚠️ as const 금지 — 리터럴 타입이 되면 기본 파라미터(border = TK.line1 등) 추론이 그 리터럴로 좁아져 호출부가 깨짐

export type TokenName = keyof typeof TK
