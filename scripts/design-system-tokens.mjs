// 🎨 theme.ts → 디자인 시스템 tokens.json 생성기 — 클로드 디자인 시스템 아티팩트('투자학교 디자인 시스템')의 토큰 파일을
//    src/lib/theme.ts(SSOT)에서 뽑는다. 손으로 옮기면 값이 어긋나므로 코드로 읽는다(제2원칙). 재동기화도 이 스크립트 한 번.
//    실행: node scripts/design-system-tokens.mjs <출력 디렉토리>   → <dir>/project/tokens.json
//    ⚠️ 색 이름은 TK 키 그대로(bg3·card·sub·red400) — 디자인 캔버스에서 고른 토큰 이름이 곧 코드의 TK 키다.
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2]
if (!outDir) { console.error('사용법: node scripts/design-system-tokens.mjs <출력 디렉토리>'); process.exit(1) }

const src = readFileSync(join(ROOT, 'src/lib/theme.ts'), 'utf8').replace(/\r\n/g, '\n')
const tkBody = src.slice(src.indexOf('export const TK = {'), src.indexOf('export const FS'))
const fsBody = src.slice(src.indexOf('export const FS = {'), src.indexOf('export const FONT_STACK'))
const fontStack = src.match(/export const FONT_STACK =\s*'([^']+)'/)[1]
const radBody = src.match(/export const RAD = \{([^}]+)\}/)[1]
const spBody = src.match(/export const SP = \{([^}]+)\}/)[1]

// ── 색: 한 줄에 여러 토큰이 올 수 있고(red300: …, red400: …), 줄 끝 주석이 usage 다 ──
const GROUP_USAGE = [
  [/^(slate950|bg\d+|card|slate900|gray900|grid|flat\d|border|gray800|line\d)$/, '배경·보더 램프(다크 스킨). 어두운 순으로 나열 — 겹칠 때 한 단계 밝은 값을 위에.'],
  [/^slate[1-6]00$/, '텍스트 램프(Tailwind slate). 밝을수록 상위 위계.'],
  [/^gray500$/, '보조 텍스트(Tailwind gray).'],
  [/^sub\d*$/, '서브 텍스트(앱 고유). 가독성 패스 산물 — 설명 문단에도 쓸 수 있는 밝기(대비 7:1 이상). 리디자인 시 sub·slate 계열로 수렴 후보.'],
  [/^(red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|lime)\d+$/, 'Tailwind 표준 액센트.'],
]
const NAMED_USAGE = {
  red400: '🇰🇷 주가 등락·내 손익의 **상승** 색(한국식 빨강=상승). 경보 최상위 램프에도 쓰이므로 같은 화면에서 등락과 경보를 나란히 두지 말 것.',
  blue400: '🇰🇷 주가 등락·내 손익의 **하락** 색(한국식 파랑=하락). `red400` 과 짝.',
  green400: '좋다/나쁘다 지표의 "좋다"(내부자 매수 인원·edge·절세 여유) — 등락에는 쓰지 않는다(미국식과 혼동).',
  amber400: '주의 램프 1단(코인 비중 5~10% 등). 위험은 orange400 → red400 순으로 한 칸씩.',
  orange400: '경고 램프 2단. ⚠️ 대시보드에선 Satellite 진영색으로도 쓰여 같은 위젯에서 경고와 겹치지 않게.',
  blue600: '앱 로고 바탕(logo-icon.svg) · 주요 버튼.',
  slate100: '최상위 강조 텍스트 · 히어로 수치.',
  slate200: '본문 텍스트 기본값.',
  sub: '표준 서브 텍스트(최다 사용). 설명 문단 기본색.',
  coinLight: '🪙 골드 코인 하이라이트 — "내 보유" 3D 시각 언어(승패 해부실에서 시작).',
  coinDark: '🪙 골드 코인 본체.', coinEdge: '🪙 골드 코인 테두리.', coinText: '🪙 코인 위 글자(어두운 갈색).',
  neonLime: '대시보드 시그니처 네온 라임 — 강조 한 곳에만.',
  btcOrange: '비트코인 공식 오렌지 — 코인 자산 표시 전용.',
}
const colorTokens = []
for (const line of tkBody.split('\n')) {
  const comment = (line.match(/\/\/\s*(.+)$/)?.[1] ?? '').trim()
  const code = line.replace(/\/\/.*$/, '')
  for (const m of code.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)) {
    const [, name, hex] = m
    const group = GROUP_USAGE.find(([re]) => re.test(name))?.[1] ?? ''
    const usage = [NAMED_USAGE[name], comment && !NAMED_USAGE[name] ? comment : '', group].filter(Boolean).join(' ')
    colorTokens.push({ name, value: hex.toLowerCase(), usage: usage || '앱 고유 색.' })
  }
}

// ── 타이포: FS 7단 — 줄 끝 주석이 용도, 행간은 theme.ts 에 없으므로 적지 않는다(지어내지 않음) ──
const FS_SAMPLE = { micro: '출처: 네이버 · 기준일 2026-09-17', tiny: '20일 평균 대비 2.1배 · 손절 −3.5%', body: '판정 기준일 종가로 조건을 채운 종목이 없습니다.', lg: '최근 추천 내역', xl: '스윙 타점', h2: '이번 주 성적표', h1: '+12.4%' }
const styles = []
for (const line of fsBody.split('\n')) {
  const m = line.match(/^\s*(\w+):\s*(\d+),\s*\/\/\s*(.+)$/)
  if (!m) continue
  const [, name, px, note] = m
  // 굵기·행간은 theme.ts 에 정의가 없으므로 적지 않는다(화면마다 인라인) — 지어내지 않음
  styles.push({ name: `fs-${name}`, fontSize: `${px}px`, usage: note.replace(/\s+/g, ' ').trim(), sample: FS_SAMPLE[name] })
}

const lengths = (body, prefix, usage) => Array.from(body.matchAll(/(\w+):\s*(\d+)/g)).map(([, k, v]) => ({ name: `${prefix}-${k}`, value: `${v}px`, usage: usage(k, +v) }))
const radius = lengths(radBody, 'radius', (k, v) => v === 999 ? '알약(pill) — 칩·배지.' : ({ xs: '작은 칩·인풋.', sm: '버튼·내부 카드.', md: '표준 카드.', lg: '패널·모달.' }[k]))
const spacing = lengths(spBody, 'space', (k, v) => `${v}px — 4px 그리드. ` + ({ xs: '칩 안 여백·아이콘 간격.', sm: '요소 간 기본 간격.', md: '카드 안 여백.', lg: '카드 사이·섹션 안.', xl: '섹션 사이.' }[k]))

const head = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
const tokens = {
  name: '투자학교', version: 1,
  meta: { source: 'github', repo: 'lindows70-bot/investment-school-2026', ref: `main@${head}`, package: '.', paths: { tokens: ['src/lib/theme.ts'], fonts: ['public/fonts/pretendard/pretendard.css'], assets: ['public/logo-icon.svg', 'public/logo-header.svg', 'public/favicon.svg'], docs: ['CLAUDE.md'] }, components: {}, synced: new Date().toISOString().slice(0, 10), generator: 'scripts/design-system-tokens.mjs' },
  color: { themes: [{ id: 'dark', name: 'Dark (유일)' }], tokens: colorTokens },
  type: {
    fonts: [],   // Pretendard 는 unicode-range 동적 서브셋 92파일(public/fonts/pretendard) — 단일 파일이 없어 여기 못 싣는다. families 의 폴백 스택으로 렌더.
    families: { sans: fontStack },
    groups: [{ name: 'FS 램프 (7단 · 인접 1.15배 이상)', family: 'sans', styles }],
  },
  spacing: { note: 'SP — 4px 그리드 5단.', tokens: spacing },
  radius: { note: 'RAD — 실측 20종에서 구분 가능한 5단.', tokens: radius },
}
mkdirSync(join(outDir, 'project'), { recursive: true })
writeFileSync(join(outDir, 'project/tokens.json'), JSON.stringify(tokens, null, 2))
console.log(`tokens.json: 색 ${colorTokens.length} · 글자 ${styles.length} · 간격 ${spacing.length} · 라운드 ${radius.length} → ${join(outDir, 'project/tokens.json')} (theme.ts @ ${head})`)
