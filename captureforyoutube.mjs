/**
 * 2026 투자학교 — 유튜브용 앱 화면 자동 캡처
 * ------------------------------------------------------------
 * 로컬 Claude Code 세션(C:\Users\lindo\investment-school-portfolio)에서 실행하세요.
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 *   # Windows PowerShell
 *   $env:IS_EMAIL="본인이메일"; $env:IS_PW="비밀번호"
 *   node capture-for-youtube.mjs
 *
 *   # 로컬 개발 서버로 찍으려면 (npm run dev 먼저 실행)
 *   $env:IS_URL="http://localhost:3000"
 *
 * 결과: youtube-captures/ 폴더에 1920x1080 PNG
 * ⚠️ 비밀번호는 환경변수로만 받습니다. 이 파일에 직접 적지 마세요.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL   = process.env.IS_URL   || 'https://investment-school-2026.vercel.app'
const EMAIL = process.env.IS_EMAIL
const PW    = process.env.IS_PW
const OUT   = 'youtube-captures'
const MASK  = process.env.IS_MASK !== '0'   // 개인정보 치환 (기본 켜짐)

if (!EMAIL || !PW) {
  console.error('❌ 환경변수 IS_EMAIL / IS_PW 를 설정하세요.')
  process.exit(1)
}

// ── 캡처할 화면 목록 ─────────────────────────────────────────
// waitFor: 이 텍스트가 뜰 때까지 대기 (데이터 로딩 완료 신호)
const SCREENS = [
  { n: '01', route: '/dashboard',      name: '대시보드' },
  { n: '02', route: '/briefing',       name: '오늘의 매매 브리핑' },
  { n: '03', route: '/macro-hub',      name: '매크로 허브' },
  { n: '04', route: '/hi52-radar',     name: '신고가 레이더' },
  { n: '05', route: '/bonds',          name: '듀레이션 나침반(채권)' },
  { n: '06', route: '/real-estate',    name: '부동산 대시보드' },
  { n: '07', route: '/dividend',       name: '배당 인컴 랩' },
  { n: '08', route: '/win-lose',       name: '승패 해부실' },
  { n: '09', route: '/signal-report',  name: '앱 신호 성적표' },
  { n: '10', route: '/guru-portfolio', name: '거인의 포트폴리오' },
  { n: '11', route: '/reco-hub',       name: '추천 지도' },
  { n: '12', route: '/tech-screener',  name: '기술적 검색기' },
]

// ── 개인정보 치환 스크립트 (블러보다 안전 — 원본이 안 남음) ──
const SANITIZE = () => {
  // 1) 사이드바/헤더의 이름·이메일 → 더미
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length) return
    const t = el.textContent
    if (!t) return
    if (/@[\w.-]+\.\w{2,}/.test(t)) el.textContent = t.replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, 'student@example.com')
  })
  // 2) 원화 금액 → 자릿수 유지한 더미 (비율·퍼센트는 그대로 둠)
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const hits = []
  while (walk.nextNode()) {
    const v = walk.currentNode.nodeValue
    if (v && /[\d,]{4,}\s*원|₩\s*[\d,]{4,}/.test(v)) hits.push(walk.currentNode)
  }
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  hits.forEach(node => {
    node.nodeValue = node.nodeValue.replace(/([\d,]{4,})/g, m => {
      const digits = m.replace(/,/g, '').length
      let s = ''
      for (let i = 0; i < digits; i++) s += Math.floor(rnd() * 9) + 1
      return Number(s).toLocaleString('ko-KR')
    })
  })
  // 3) 추가로 가리고 싶은 요소가 있으면 여기에 선택자 추가
  const EXTRA = [/* '.user-profile', '#account-no' */]
  EXTRA.forEach(sel => document.querySelectorAll(sel).forEach(el => { el.style.filter = 'blur(10px)' }))
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'ko-KR',
  })
  const pg = await ctx.newPage()

  // ── 로그인 ────────────────────────────────────────────────
  console.log('▶ 로그인 중…')
  await pg.goto(`${URL}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await pg.fill('input[type="email"]', EMAIL)
  await pg.fill('input[type="password"]', PW)
  await Promise.all([
    pg.waitForURL(u => !u.toString().includes('/login'), { timeout: 60000 }),
    pg.click('button[type="submit"]'),
  ])
  console.log('✅ 로그인 완료 →', pg.url())

  // ── 화면별 캡처 ───────────────────────────────────────────
  const done = []
  for (const s of SCREENS) {
    try {
      process.stdout.write(`  ${s.n} ${s.name} … `)
      await pg.goto(URL + s.route, { waitUntil: 'networkidle', timeout: 60000 })
      await sleep(4500)                      // 차트·API 로딩 여유
      await pg.evaluate(() => window.scrollTo(0, 0))
      if (MASK) await pg.evaluate(SANITIZE)
      await sleep(400)

      const base = path.join(OUT, `${s.n}_${s.route.replace(/\//g, '')}`)
      await pg.screenshot({ path: `${base}_viewport.png` })        // 16:9 그대로 → 영상용
      await pg.screenshot({ path: `${base}_full.png`, fullPage: true }) // 전체 → 크롭용
      console.log('OK')
      done.push(s.name)
    } catch (e) {
      console.log('건너뜀 (' + String(e).slice(0, 60) + ')')
    }
  }

  await browser.close()
  console.log(`\n🎬 완료: ${done.length}/${SCREENS.length}개 → ./${OUT}/`)
  console.log(MASK ? '🔒 개인정보 치환 적용됨 (끄려면 IS_MASK=0)' : '⚠️ 개인정보 치환 꺼짐')
  console.log('\n캡처 후 youtube-captures 폴더를 통째로 압축해서 올려주시면 영상에 반영합니다.')
})()
