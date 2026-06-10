/**
 * scripts/dev.js — 안전한 Next.js 개발 서버 (v5 최종)
 *
 * 근본 원인 분석:
 *   - npm run build 를 로컬에서 실행하면 .next 를 덮어써서
 *     실행 중인 dev 서버의 webpack 청크가 깨짐
 *   - fork() 방식이 Windows에서 불안정 → execSync로 교체
 *   - 해결: 로컬에서 npm run build 절대 실행 안 함 (Vercel이 원격 빌드)
 *           dev 시작 전 .next 완전 삭제 + 3초 대기
 */

const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const ROOT   = path.join(__dirname, '..')
const NEXT   = path.join(ROOT, '.next')
const IS_WIN = process.platform === 'win32'

console.log('\n🛠️  투자학교 개발 서버 시작\n')

// ── Step 1: 포트 3000 점유 프로세스만 종료 (현재 스크립트 PID 제외) ─────
console.log('① 포트 3000 정리...')
try {
  if (IS_WIN) {
    const out  = execSync('netstat -ano', { encoding: 'utf8', shell: 'cmd.exe' })
    const pids = new Set(
      out.split('\n')
        .map(l => { const m = l.match(/:3000\s+\S+\s+LISTENING\s+(\d+)/i); return m ? m[1] : null })
        .filter(p => !!p && p !== String(process.pid))
    )
    for (const pid of pids) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', shell: 'cmd.exe' }); console.log(`   killed PID ${pid}`) } catch (_) {}
    }
    if (!pids.size) console.log('   ✓ 없음')
  } else {
    try { execSync("fuser -k 3000/tcp 2>/dev/null || true", { stdio: 'ignore', shell: true }) } catch (_) {}
    console.log('   ✓ 완료')
  }
} catch (_) { console.log('   ✓ (프로세스 없음)') }

// ── Step 2: .next 완전 삭제 ──────────────────────────────────────────────
console.log('② .next 캐시 삭제...')
try {
  if (fs.existsSync(NEXT)) {
    fs.rmSync(NEXT, { recursive: true, force: true })
    // Windows 락 파일 대응 — rd /s /q 재시도
    if (fs.existsSync(NEXT)) {
      try { execSync(`rd /s /q "${NEXT}"`, { shell: 'cmd.exe', stdio: 'ignore' }) } catch (_) {}
    }
    console.log('   ✓ 삭제 완료')
  } else {
    console.log('   ✓ 이미 깨끗함')
  }
} catch (_) { console.log('   ⚠ 삭제 실패 (계속)') }

// ── Step 3: 3초 안정화 대기 ──────────────────────────────────────────────
console.log('③ 안정화 대기 (3초)...')

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function start() {
  await wait(3000)
  console.log('   ✓ 완료\n')

  // ── Step 4: next 바이너리 경로 확인 ──────────────────────────────────
  let nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
  if (!fs.existsSync(nextBin)) {
    console.error('❌ next 바이너리를 찾을 수 없습니다. npm install 을 실행해주세요.')
    process.exit(1)
  }

  console.log('④ Next.js dev 서버 시작 → http://localhost:3000\n')
  console.log('─'.repeat(50))

  // ── Step 5: execSync 로 직접 실행 (blocking, fork/spawn EINVAL 우회) ──
  // Windows: cmd.exe 없이 node 로 직접 실행 → 가장 안정적
  try {
    execSync(
      `node "${nextBin}" dev`,
      { stdio: 'inherit', cwd: ROOT, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } }
    )
  } catch (e) {
    // Ctrl+C 정상 종료는 에러가 아님
    if (e.signal !== 'SIGINT' && e.status !== 0 && e.status != null) {
      console.error('\n❌ 서버 종료:', e.message)
      process.exit(e.status ?? 1)
    }
    process.exit(0)
  }
}

start()
