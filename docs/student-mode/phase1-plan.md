# 학생 간단 모드 1단계 구현 계획 — 기반 + 내 자산 + 종목 상세 + 기록하기

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생 전용 주소(`/s/...`)에 접속 기록·계산 공용화·이름 검색을 깔고, 캔버스 7판의 '내 자산(히트맵)'·'종목 상세'·'기록하기'를 실제 화면으로 만든다.

**Architecture:** 계산과 DB 쓰기 규칙은 순수 함수 lib(`portfolioSummary`·`tradeWrite`·`stockSearch`·`treemap`)로 뽑아 검증 스크립트로 먼저 고정한다. 학생 화면은 `/s` 아래에 두고 기존 셸(`SidebarLayout`) 대신 학생 셸(하단 탭·PC 왼쪽 메뉴)을 쓴다. **1단계에서는 로그인 착지를 바꾸지 않는다** — 학생에게 공개하는 착지 전환은 4단계 마지막에 한 번에 한다(그 전엔 선생님이 `/s/assets` 로 직접 들어가 확인).

**Tech Stack:** Next.js 14 App Router · Supabase(`@/lib/supabase/client`·`server`) · 인라인 스타일 + 디자인 토큰(`TK`·`FS`·`RAD`·`SP` from `@/lib/theme`) · 검증은 프로젝트 관례인 "실제 lib 을 tsc 로 컴파일해 require" 스크립트(`scripts/backtest-gate.mjs` 1~23행 방식).

**설계 근거:** `docs/student-mode/plan.md`(확정 설계) · `context-notes.md`(Phase 0 판정표·기각 안) · 캔버스 https://claude.ai/artifact/4THDHoK28RNSPeCjAcVvsa

---

## 전체 단계 (이 문서는 1단계만 상세)

| 단계 | 내용 | 문서 |
|---|---|---|
| **1** | 접속 기록 · 계산 공용화 · 쓰기 규칙 · 이름 검색 · 학생 셸 · 내 자산 · 종목 상세 · 기록하기 | 이 문서 |
| 2 | 홈(한눈 시황·지수·공포탐욕·일정·뉴스·거장) · 내 자산에 자산 성장 차트·이달 배당 | 1단계 끝나면 작성 |
| 3 | 리그 · 배우기(명언·오늘 알려드려요 4종 순환) | 명언 목록 확정 뒤 작성 |
| 4 | PWA · 간편/분석 모드 쿠키 · **로그인 착지 전환(학생 공개)** · 4주 측정 | 3단계 뒤 작성 |

## 지켜야 할 것 (CLAUDE.md 에서 이 작업에 걸리는 것만)

- **신규 파일은 커밋 훅이 hex 색·`fontSize` 숫자 리터럴을 막는다.** 색은 `TK.*`, 투명도는 `` `${TK.red500}99` `` 처럼 토큰 뒤에 알파 두 자리를 붙인다. 글자는 `FS.micro(11)·tiny(13)·body(15)·lg(18)·xl(22)·h2(28)·h1(36)`.
- 등락색 한국식: 상승 `TK.red400`, 하락 `TK.blue400`, 보합 `TK.sub`.
- 외부·supabase GET 에 `cache: 'no-store'`, 무인자 GET 라우트는 `export const dynamic = 'force-dynamic'`.
- `upsert` 금지(`investments` NOT NULL 보호) — `update().eq()`.
- 검증 명령은 `&&` 로 잇는다(파이프 금지). 로컬 `npm run build` 금지 → `npm run check:build`.
- `git add -A` 금지 — 파일을 명시한다.
- 검증 스크립트 마지막 줄은 `✅ 전부 통과 (…)` 문구 + `process.exit(fail ? 1 : 0)`.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/student_visits.sql` (신규) | 접속 기록 테이블 DDL — 사용자가 SQL Editor 에서 1회 실행 |
| `src/app/api/visit/route.ts` (신규) | 로그인 사용자의 오늘(KST) 접속 1행 기록. 테이블 없으면 조용히 `needsSetup` |
| `src/app/components/VisitBeacon.tsx` (신규) | 앱을 열 때 하루 한 번 `/api/visit` 호출 |
| `src/lib/portfolioSummary.ts` (신규) | 보유 → 평가·손익·오늘 등락·코어/위성 비중·투자 체크 문구 (순수) |
| `src/lib/tradeWrite.ts` (신규) | 매수·매도 → DB 쓰기 계획(순수) + 실행기. 기존 두 모달과 같은 규칙 |
| `src/lib/stockSearch.ts` (신규) | 네이버 자동완성·업비트 목록 → 검색 결과(순수), 한글 ETF 브랜드 별칭 |
| `src/lib/treemap.ts` (신규) | 히트맵 칸 배치(squarify, 순수) + 등락 → 칸 색 |
| `src/app/api/stock-search/route.ts` (신규) | `?q=` 이름 검색 API |
| `src/app/s/layout.tsx` · `src/app/components/student/StudentShell.tsx` (신규) | 학생 셸 — 폰·태블릿 하단 탭 4개, PC 왼쪽 메뉴 |
| `src/app/components/student/Heatmap.tsx` (신규) | 코어/위성 두 묶음 히트맵 |
| `src/app/components/student/useMyPortfolio.ts` (신규) | 내 보유·시세·환율 불러오기 → `summarizePortfolio` |
| `src/app/s/page.tsx` · `s/assets/page.tsx` · `s/stock/[ticker]/page.tsx` · `s/record/page.tsx` (신규) | 화면 |
| `src/app/components/Layout/SidebarLayout.tsx` (수정) | `/s` 아래에선 기존 셸을 그리지 않는다 |
| `src/middleware.ts` (수정) | `/s` 를 로그인 필요 경로에 추가 |
| `src/app/layout.tsx` (수정) | `VisitBeacon` 장착 |
| `scripts/verify-portfolio-summary.mjs` · `verify-trade-write.mjs` · `verify-stock-search.mjs` · `verify-treemap.mjs` (신규) | 순수 lib 검증 |

---

### Task 1: 접속 기록 (기준선이 먼저다)

**Files:**
- Create: `supabase/student_visits.sql`
- Create: `src/app/api/visit/route.ts`
- Create: `src/app/components/VisitBeacon.tsx`
- Modify: `src/app/layout.tsx:38-41`

- [ ] **Step 1: DDL 작성**

```sql
-- 학생 접속 기록 — 사용자당 하루 1행(학생 간단 모드 효과 측정의 기준선)
create table if not exists public.student_visits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  visit_date date not null,
  first_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, visit_date)
);
alter table public.student_visits enable row level security;
create policy "student_visits insert own" on public.student_visits for insert with check (auth.uid() = user_id);
create policy "student_visits read own"   on public.student_visits for select using (auth.uid() = user_id);
```

- [ ] **Step 2: API 작성**

```ts
// 로그인 사용자의 오늘(KST) 첫 접속을 하루 1행으로 남기는 API — 테이블이 없으면 조용히 needsSetup
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/schoolIndex'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  let path: string | null = null
  try { const b = await req.json(); path = typeof b?.path === 'string' ? b.path.slice(0, 200) : null } catch { /* 본문 없음 */ }
  const { error } = await sb.from('student_visits').insert({ user_id: user.id, visit_date: kstDate(), first_path: path })
  if (!error || error.code === '23505') return NextResponse.json({ ok: true })            // 23505 = 오늘 이미 기록
  if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json({ ok: false, needsSetup: true })
  return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
}
```

- [ ] **Step 3: 비콘 작성**

```tsx
'use client'
// 앱을 열 때 하루 한 번 접속 기록 API 를 부르는 보이지 않는 컴포넌트
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitBeacon() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === '/login' || pathname === '/signup') return
    const key = `visit-${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch { /* 저장소 막힘 — 그냥 보낸다 */ }
    fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname }) }).catch(() => {})
  }, [pathname])
  return null
}
```

- [ ] **Step 4: 루트 레이아웃에 장착** — `src/app/layout.tsx` 에 import 추가하고 `<IdleTimer />` 바로 아래에 `<VisitBeacon />`.

```tsx
import VisitBeacon from '@/app/components/VisitBeacon'
// …
        <IdleTimer />
        <VisitBeacon />
```

- [ ] **Step 5: 타입·린트**

Run: `npm run check`
Expected: 오류 0.

- [ ] **Step 6: 사용자 SQL Editor 실행 요청** — `supabase/student_visits.sql` 전문을 사용자에게 보여주고 Supabase SQL Editor 실행을 요청한다(에이전트가 DDL 을 실행할 경로가 없다 — context-notes 판정표). 실행 전에도 API 는 `needsSetup` 으로 조용히 넘어간다.

- [ ] **Step 7: 커밋**

```bash
git add supabase/student_visits.sql src/app/api/visit/route.ts src/app/components/VisitBeacon.tsx src/app/layout.tsx
git commit -m "학생 접속 기록 — 하루 1행(효과 측정 기준선), 테이블 없으면 needsSetup"
```

---

### Task 2: 보유 요약 계산 SSOT (`portfolioSummary`)

자산 화면(`src/app/assets/page.tsx:411-470`)과 같은 규칙: 원가 = 매수가×수량×환율, 평가 = (시세 있으면 현재가, 없으면 매수가)×수량×환율. 시세 없는 종목은 **숨기지 않고** `priced:false` 로 표시한다(평가는 매수가로 — 자산 화면 총액과 같게).

**Files:**
- Create: `src/lib/portfolioSummary.ts`
- Test: `scripts/verify-portfolio-summary.mjs`

- [ ] **Step 1: 실패하는 검증 스크립트 작성**

```js
// 보유 요약 SSOT 검증 — 실제 lib 을 컴파일해 합계·환율·시세 실패·비중·투자 체크를 확인
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-psum`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/portfolioSummary.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const P = require2(`${OUT}/lib/portfolioSummary.js`)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }
const near = (a, b) => Math.abs(a - b) < 0.01

const H = (o) => ({ id: o.t, ticker: o.t, name: o.t, market: o.m ?? 'KR', currency: o.c ?? 'KRW', purchase_price: o.p, quantity: o.q, asset_role: o.r ?? 'SATELLITE' })
const s1 = P.summarizePortfolio(
  [H({ t: '005930', p: 60000, q: 10 }), H({ t: '360750', p: 20000, q: 10, r: 'CORE' })],
  { '005930': { currentPrice: 66000, change: 1000, changePct: 1.54 }, '360750': { currentPrice: 20000, change: 0, changePct: 0 } },
  1350)
check('원가 합계 = 600,000 + 200,000', s1.totalCostKrw === 800000)
check('평가 합계 = 660,000 + 200,000', s1.totalEvalKrw === 860000)
check('손익 = +60,000 / +7.5%', s1.pnlKrw === 60000 && near(s1.pnlPct, 7.5))
check('오늘 = +10,000 (어제 평가 850,000 기준 +1.18%)', s1.todayKrw === 10000 && near(s1.todayPct, 10000 / 850000 * 100))
check('코어 비중 = 200,000/860,000', near(s1.corePct, 200000 / 860000 * 100) && near(s1.corePct + s1.satPct, 100))
check('행은 평가금액 큰 순', s1.rows[0].ticker === '005930')

const s2 = P.summarizePortfolio([H({ t: 'NVDA', m: 'US', c: 'USD', p: 100, q: 2 })], { NVDA: { currentPrice: 110, change: 5, changePct: 4.76 } }, 1400)
check('달러 종목은 환율 곱', s2.totalEvalKrw === 110 * 2 * 1400 && s2.todayKrw === 5 * 2 * 1400)

const s3 = P.summarizePortfolio([H({ t: 'BTC', m: 'CRYPTO', p: 100000000, q: 0.01 })], { BTC: { currentPrice: 0, change: 0, changePct: 0, error: 'timeout' } }, 1350)
check('시세 실패 → priced:false, 평가는 매수가', s3.rows[0].priced === false && s3.totalEvalKrw === 1000000)
check('시세 실패 → 오늘 등락 null, 개수 1', s3.todayKrw === 0 && s3.todayPct === null && s3.unpricedCount === 1)

const s4 = P.summarizePortfolio([], {}, 1350)
check('빈 보유 → 0 · null', s4.totalEvalKrw === 0 && s4.pnlPct === null && s4.todayPct === null && s4.corePct === 0)

check('체크: 코어 42 vs 목표 60 → 코어 18%p 부족', P.rebalanceCheck(42, 60)?.kind === 'core-short' && P.rebalanceCheck(42, 60)?.gapPp === 18)
check('체크: 코어 75 vs 목표 60 → 위성 15%p 부족', P.rebalanceCheck(75, 60)?.kind === 'sat-short' && P.rebalanceCheck(75, 60)?.gapPp === 15)
check('체크: ±3%p 안 → 균형', P.rebalanceCheck(58, 60)?.kind === 'balanced')
check('체크: 목표 없음 → null', P.rebalanceCheck(58, null) === null)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (보유 요약 SSOT)')
process.exit(fail ? 1 : 0)
```

- [ ] **Step 2: 실패 확인**

Run: `node scripts/verify-portfolio-summary.mjs`
Expected: `tsc:` 오류(파일 없음) 뒤 `Cannot find module …/portfolioSummary.js` 로 종료 코드 1.

- [ ] **Step 3: lib 구현**

```ts
// 학생 홈·내 자산이 함께 쓰는 보유 요약 SSOT — 평가·손익·오늘 등락·코어/위성 비중·투자 체크
//   규칙은 자산 관리 화면(assets/page.tsx 411~470)과 같다: 평가 = (시세 없으면 매수가) × 수량 × 환율.
//   다른 점 하나 — 시세 없는 종목을 priced:false 로 밝혀 화면이 '못 가져왔어요'를 말하게 한다.
export type Market = 'US' | 'KR' | 'CRYPTO'
export type Role = 'CORE' | 'SATELLITE'

export interface HoldingInput {
  id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  purchase_price: number; quantity: number; asset_role: Role | null
}
export interface PriceInput { currentPrice: number; change: number; changePct: number; error?: string }
export interface HoldingRow {
  id: string; ticker: string; name: string; market: Market; role: Role
  priced: boolean; currentPrice: number | null; changePct: number | null
  costKrw: number; evalKrw: number; pnlKrw: number; pnlPct: number | null
  todayKrw: number | null; weightPct: number
}
export interface PortfolioSummary {
  rows: HoldingRow[]
  totalCostKrw: number; totalEvalKrw: number; pnlKrw: number; pnlPct: number | null
  todayKrw: number; todayPct: number | null
  corePct: number; satPct: number; unpricedCount: number
}

export function isPriced(p: PriceInput | null | undefined): p is PriceInput {
  return !!p && !p.error && Number.isFinite(p.currentPrice) && p.currentPrice > 0
}

export function summarizePortfolio(holdings: HoldingInput[], priceMap: Record<string, PriceInput | undefined>, usdKrw: number): PortfolioSummary {
  let totalCost = 0, totalEval = 0, today = 0, prevPriced = 0, coreEval = 0, unpriced = 0
  const rows: HoldingRow[] = holdings.map(h => {
    const fx = h.currency === 'USD' ? usdKrw : 1
    const p = priceMap[h.ticker.toUpperCase()]
    const priced = isPriced(p)
    const cost = h.purchase_price * h.quantity * fx
    const val = (priced ? p.currentPrice : h.purchase_price) * h.quantity * fx
    const todayKrw = priced ? p.change * h.quantity * fx : null
    const role: Role = h.asset_role ?? 'CORE'   // 자산 화면·추가 모달의 기본값과 같다
    totalCost += cost; totalEval += val
    if (priced) { today += todayKrw as number; prevPriced += (p.currentPrice - p.change) * h.quantity * fx } else unpriced++
    if (role === 'CORE') coreEval += val
    return {
      id: h.id, ticker: h.ticker, name: h.name, market: h.market, role, priced,
      currentPrice: priced ? p.currentPrice : null, changePct: priced ? p.changePct : null,
      costKrw: cost, evalKrw: val, pnlKrw: val - cost, pnlPct: cost > 0 ? (val - cost) / cost * 100 : null,
      todayKrw, weightPct: 0,
    }
  })
  rows.forEach(r => { r.weightPct = totalEval > 0 ? r.evalKrw / totalEval * 100 : 0 })
  rows.sort((a, b) => b.evalKrw - a.evalKrw)
  const corePct = totalEval > 0 ? coreEval / totalEval * 100 : 0
  return {
    rows, totalCostKrw: totalCost, totalEvalKrw: totalEval,
    pnlKrw: totalEval - totalCost, pnlPct: totalCost > 0 ? (totalEval - totalCost) / totalCost * 100 : null,
    todayKrw: today, todayPct: prevPriced > 0 ? today / prevPriced * 100 : null,
    corePct, satPct: totalEval > 0 ? 100 - corePct : 0, unpricedCount: unpriced,
  }
}

/** 오늘의 투자 체크 — 사실만 말하고 팔라고 하지 않는다(HOLD 원칙). ±3%p 안은 균형(스쿨 리그 진단과 같은 폭). */
export type RebalanceCheck = { kind: 'core-short' | 'sat-short'; gapPp: number } | { kind: 'balanced'; gapPp: number }
export function rebalanceCheck(corePct: number, targetCorePct: number | null): RebalanceCheck | null {
  if (targetCorePct == null || !(targetCorePct > 0)) return null
  const gap = Math.round(targetCorePct - corePct)
  if (Math.abs(targetCorePct - corePct) <= 3) return { kind: 'balanced', gapPp: Math.abs(gap) }
  return gap > 0 ? { kind: 'core-short', gapPp: gap } : { kind: 'sat-short', gapPp: -gap }
}
```

- [ ] **Step 4: 통과 확인**

Run: `node scripts/verify-portfolio-summary.mjs`
Expected: 14줄 모두 ✅, 마지막 `✅ 전부 통과 (보유 요약 SSOT)`, 종료 코드 0.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/portfolioSummary.ts scripts/verify-portfolio-summary.mjs
git commit -m "보유 요약 SSOT(portfolioSummary) — 자산 화면과 같은 평가 규칙 + 시세 실패 표시 + 투자 체크"
```

---

### Task 3: 매수·매도 쓰기 규칙 SSOT (`tradeWrite`)

기존 규칙 그대로(`AddInvestmentModal.tsx` 237~379 · `TransactionModal.tsx` 290~360): 같은 종목 추가 매수 = 가중평단(소수 둘째 자리 반올림)+수량 합산, 새 종목 = investments insert 후 거래 insert, 매도 = 실현손익 `(매도가−평단)×수량` + `avg_cost_basis`, 전량 매도면 보유 행 삭제. 스냅샷은 `/api/decision-snapshot` 결과를 모달과 같은 필드로 붙인다.

**Files:**
- Create: `src/lib/tradeWrite.ts`
- Test: `scripts/verify-trade-write.mjs`

- [ ] **Step 1: 실패하는 검증 스크립트 작성**

```js
// 매수·매도 쓰기 계획 검증 — 기존 두 모달과 같은 규칙인지(가중평단·실현손익·전량매도 삭제·과매도 거부)
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-trade`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/tradeWrite.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const T = require2(`${OUT}/lib/tradeWrite.js`)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }
const IN = { ticker: '005930', name: '삼성전자', market: 'KR', currency: 'KRW', price: 70000, quantity: 10, date: '2026-09-26', role: 'SATELLITE' }

const n = T.planBuy('u1', null, IN)
check('새 종목 → kind new', n.kind === 'new')
check('  investments insert 필드', n.insert.purchase_price === 70000 && n.insert.quantity === 10 && n.insert.asset_role === 'SATELLITE' && n.insert.lynch_category === null && n.insert.purchase_date === '2026-09-26')
check('  거래 = buy · 총액 700,000 · 메모 최초 매수', n.tx.type === 'buy' && n.tx.total_amount === 700000 && n.tx.memo === '최초 매수' && n.tx.fee === 0)

const ex = { id: 'inv1', quantity: 10, purchase_price: 60000, name: '삼성전자', asset_role: 'SATELLITE' }
const d = T.planBuy('u1', ex, IN)
check('같은 종목 → kind dca', d.kind === 'dca' && d.investmentId === 'inv1')
check('  가중평단 65,000 · 수량 20', d.update.purchase_price === 65000 && d.update.quantity === 20)
check('  거래 investment_id 연결 · 메모 추가 매수', d.tx.investment_id === 'inv1' && d.tx.memo === '추가 매수')
const odd = T.planBuy('u1', { ...ex, quantity: 3, purchase_price: 100 }, { ...IN, price: 101, quantity: 4 })
check('  평단 소수 둘째 자리 반올림', odd.update.purchase_price === Math.round((3 * 100 + 4 * 101) / 7 * 100) / 100)

const s = T.planSell('u1', ex, { ...IN, price: 66000, quantity: 4 })
check('일부 매도 → 잔여 6주 update', s.kind === 'sell' && s.after.type === 'update' && s.after.quantity === 6)
check('  실현손익 (66,000−60,000)×4 = 24,000 · 평단 기록', s.tx.realized_pnl === 24000 && s.tx.avg_cost_basis === 60000 && s.tx.type === 'sell')
const all = T.planSell('u1', ex, { ...IN, price: 50000, quantity: 10 })
check('전량 매도 → 보유 삭제 · 손실 −100,000', all.after.type === 'delete' && all.tx.realized_pnl === -100000)
const over = T.planSell('u1', ex, { ...IN, quantity: 11 })
check('보유보다 많이 팔기 → 오류', over.kind === 'error')
check('보유 없는 매도 → 오류', T.planSell('u1', null, IN).kind === 'error')
check('가격 0 → 오류', T.planBuy('u1', null, { ...IN, price: 0 }).kind === 'error')

const snap = T.snapshotOf({ peg: 1.2, growth: 15, category: 'stalwart', opMargin: 10, sector: 'IT', flow: 'IN', mfi: 55, seasonTag: 's', season: 'x', fomcStance: 'h', rateDir: 'up' }, 70000)
check('스냅샷 필드 = 모달과 같은 이름', snap.peg === 1.2 && snap.growth_rate === 15 && snap.price_at_record === 70000 && 'recorded_at' in snap && snap.rateDir === 'up')
check('스냅샷 없음 → null', T.snapshotOf(null, 70000) === null)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (매수·매도 쓰기 규칙)')
process.exit(fail ? 1 : 0)
```

- [ ] **Step 2: 실패 확인**

Run: `node scripts/verify-trade-write.mjs`
Expected: `Cannot find module …/tradeWrite.js`, 종료 코드 1.

- [ ] **Step 3: lib 구현**

```ts
// 학생 기록하기가 쓰는 매수·매도 → DB 쓰기 규칙 SSOT — 기존 두 모달(AddInvestmentModal·TransactionModal)과 같은 규칙
//   ① 같은 종목 추가 매수 = 가중평단(소수 둘째 자리) + 수량 합산  ② 새 종목 = investments insert → 거래 insert
//   ③ 매도 = 실현손익 (매도가−평단)×수량, avg_cost_basis 기록, 전량이면 보유 행 삭제
import type { SupabaseClient } from '@supabase/supabase-js'

export type Market = 'US' | 'KR' | 'CRYPTO'
export type Role = 'CORE' | 'SATELLITE'
export interface TradeInput { ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'; price: number; quantity: number; date: string; role: Role }
export interface ExistingHolding { id: string; quantity: number; purchase_price: number; name: string; asset_role: Role | null }

interface TxBase {
  user_id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  type: 'buy' | 'sell'; price: number; quantity: number; total_amount: number; fee: 0
  memo: string; transaction_date: string; realized_pnl: number | null; avg_cost_basis: number | null
}
export interface TxRow extends TxBase { investment_id: string }
export interface InvestmentInsert {
  user_id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  purchase_price: number; quantity: number; purchase_date: string; lynch_category: null; asset_role: Role
}
export type TradeError = { kind: 'error'; message: string }
export type BuyPlan = { kind: 'new'; insert: InvestmentInsert; tx: TxBase } | { kind: 'dca'; investmentId: string; update: { quantity: number; purchase_price: number }; tx: TxRow } | TradeError
export type SellPlan = { kind: 'sell'; investmentId: string; after: { type: 'delete' } | { type: 'update'; quantity: number }; tx: TxRow } | TradeError

const r2 = (n: number) => Math.round(n * 100) / 100

function invalid(i: TradeInput): TradeError | null {
  if (!i.ticker.trim()) return { kind: 'error', message: '종목을 골라 주세요.' }
  if (!(i.price > 0)) return { kind: 'error', message: '가격은 0보다 커야 해요.' }
  if (!(i.quantity > 0)) return { kind: 'error', message: '수량은 0보다 커야 해요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return { kind: 'error', message: '날짜를 확인해 주세요.' }
  return null
}

function txBase(userId: string, i: TradeInput, type: 'buy' | 'sell', memo: string): TxBase {
  return {
    user_id: userId, ticker: i.ticker.toUpperCase(), name: i.name, market: i.market, currency: i.currency,
    type, price: i.price, quantity: i.quantity, total_amount: i.price * i.quantity, fee: 0,
    memo, transaction_date: i.date, realized_pnl: null, avg_cost_basis: null,
  }
}

export function planBuy(userId: string, existing: ExistingHolding | null, i: TradeInput): BuyPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) {
    return {
      kind: 'new',
      insert: { user_id: userId, ticker: i.ticker.toUpperCase(), name: i.name, market: i.market, currency: i.currency, purchase_price: i.price, quantity: i.quantity, purchase_date: i.date, lynch_category: null, asset_role: i.role },
      tx: txBase(userId, i, 'buy', '최초 매수'),
    }
  }
  const qty = existing.quantity + i.quantity
  const avg = (existing.quantity * existing.purchase_price + i.quantity * i.price) / qty
  return { kind: 'dca', investmentId: existing.id, update: { quantity: qty, purchase_price: r2(avg) }, tx: { ...txBase(userId, i, 'buy', '추가 매수'), investment_id: existing.id } }
}

export function planSell(userId: string, existing: ExistingHolding | null, i: TradeInput): SellPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) return { kind: 'error', message: '갖고 있지 않은 종목은 팔 수 없어요.' }
  if (i.quantity > existing.quantity + 1e-9) return { kind: 'error', message: `최대 ${existing.quantity}주까지 팔 수 있어요.` }
  const remaining = existing.quantity - i.quantity
  return {
    kind: 'sell', investmentId: existing.id,
    after: remaining <= 1e-9 ? { type: 'delete' } : { type: 'update', quantity: remaining },
    tx: { ...txBase(userId, i, 'sell', '매도'), investment_id: existing.id, realized_pnl: r2((i.price - existing.purchase_price) * i.quantity), avg_cost_basis: existing.purchase_price },
  }
}

/** 거래 시점 다신호 스냅샷 — 필드 이름은 AddInvestmentModal 의 mkSnap 과 같다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotOf(sig: any, price: number) {
  if (!sig) return null
  return {
    peg: sig.peg, growth_rate: sig.growth, category: sig.category,
    price_at_record: price, recorded_at: new Date().toISOString(),
    opMargin: sig.opMargin, sector: sig.sector, flow: sig.flow, mfi: sig.mfi,
    seasonTag: sig.seasonTag, season: sig.season, fomcStance: sig.fomcStance, rateDir: sig.rateDir,
  }
}

/** 계획을 DB 에 쓴다. 실패하면 사람이 읽을 문장을 돌려준다(성공 = null). */
export async function executeTrade(sb: SupabaseClient, plan: BuyPlan | SellPlan): Promise<string | null> {
  if (plan.kind === 'error') return plan.message
  const t = 'tx' in plan ? plan.tx : null
  let sig = null
  try {
    const r = await fetch(`/api/decision-snapshot?ticker=${encodeURIComponent(t!.ticker)}&market=${t!.market}&name=${encodeURIComponent(t!.name)}`)
    if (r.ok) sig = await r.json()
  } catch { /* 스냅샷 실패해도 거래는 진행 — 모달과 같다 */ }
  const snapshot_data = snapshotOf(sig, t!.price)

  if (plan.kind === 'new') {
    const { data: created, error } = await sb.from('investments').insert(plan.insert).select('id').single()
    if (error || !created) return error?.code === '23505' ? '이미 가진 종목이에요. 새로고침 후 다시 해 주세요.' : `저장 실패: ${error?.message ?? '알 수 없음'}`
    const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, investment_id: created.id, snapshot_data })
    if (txErr) console.warn('[tradeWrite] 거래 기록 실패(보유는 저장됨):', txErr.message)
    if (plan.insert.market !== 'CRYPTO') {
      ;(async () => {
        try {
          const res = await fetch(`/api/lynch-classify?ticker=${encodeURIComponent(plan.insert.ticker)}&market=${plan.insert.market}`)
          if (!res.ok) return
          const { category, isEtf } = await res.json()
          const cat = (!isEtf && category && category !== 'na') ? category : null
          if (cat) await sb.from('investments').update({ lynch_category: cat }).eq('id', created.id)
        } catch { /* 분류 실패해도 종목은 저장됨 — 모달과 같다 */ }
      })()
    }
    return null
  }
  if (plan.kind === 'dca') {
    const { error } = await sb.from('investments').update(plan.update).eq('id', plan.investmentId)
    if (error) return `저장 실패: ${error.message}`
    const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, snapshot_data })
    if (txErr) console.warn('[tradeWrite] 거래 기록 실패(보유는 저장됨):', txErr.message)
    return null
  }
  const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, snapshot_data })
  if (txErr) return `저장 실패: ${txErr.message}`
  const { error } = plan.after.type === 'delete'
    ? await sb.from('investments').delete().eq('id', plan.investmentId)
    : await sb.from('investments').update({ quantity: plan.after.quantity }).eq('id', plan.investmentId)
  return error ? `보유 수량 반영 실패: ${error.message}` : null
}
```

- [ ] **Step 4: 통과 확인**

Run: `node scripts/verify-trade-write.mjs`
Expected: 15줄 모두 ✅, `✅ 전부 통과 (매수·매도 쓰기 규칙)`.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tradeWrite.ts scripts/verify-trade-write.mjs
git commit -m "매수·매도 쓰기 규칙 SSOT(tradeWrite) — 기존 두 모달과 같은 가중평단·실현손익·전량매도 삭제"
```

---

### Task 4: 이름으로 종목 찾기 (`stockSearch` + API)

Phase 0 실측(context-notes): 네이버 자동완성은 KR·US 를 한글·영문으로 찾지만 "타이거·코덱스" 같은 한글 브랜드와 코인은 못 찾고, 일본(TOKYO) 결과가 섞인다. 업비트 `market/all` 은 `korean_name` 을 준다.

**Files:**
- Create: `src/lib/stockSearch.ts`
- Create: `src/app/api/stock-search/route.ts`
- Test: `scripts/verify-stock-search.mjs`

- [ ] **Step 1: 실패하는 검증 스크립트 작성** (입력은 2026-09-25 실측 응답 모양 그대로)

```js
// 종목 검색 파서 검증 — 네이버 자동완성·업비트 목록 실측 모양으로 필터·별칭·병합을 확인
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-search`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/stockSearch.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const S = require2(`${OUT}/lib/stockSearch.js`)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }

check('별칭: 타이거 미국 → TIGER 미국', S.expandQuery('타이거 미국') === 'TIGER 미국')
check('별칭: 코덱스200 → KODEX200', S.expandQuery('코덱스200') === 'KODEX200')
check('별칭 없는 말은 그대로', S.expandQuery('삼성') === '삼성')

const naver = [
  { code: '005930', name: '삼성전자', typeCode: 'KOSPI', typeName: '코스피', nationCode: 'KOR', category: 'stock' },
  { code: 'NVDA', name: '엔비디아', typeCode: 'NASDAQ', typeName: '나스닥 증권거래소', nationCode: 'USA', category: 'stock' },
  { code: '4231', name: '타이거스폴리머', typeCode: 'TOKYO', typeName: '도쿄', nationCode: 'JPN', category: 'stock' },
]
const st = S.parseNaverItems(naver)
check('네이버: 한국·미국만 남김', st.length === 2 && st.every(r => r.market === 'KR' || r.market === 'US'))
check('네이버: KR 은 6자리 코드·원화', st[0].ticker === '005930' && st[0].currency === 'KRW' && st[0].exchange === '코스피')
check('네이버: US 는 달러', st[1].ticker === 'NVDA' && st[1].currency === 'USD')

const upbit = [{ market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' }, { market: 'BTC-ETH', korean_name: '이더리움', english_name: 'Ethereum' }, { market: 'KRW-ETH', korean_name: '이더리움', english_name: 'Ethereum' }]
const cr = S.matchUpbit(upbit, '비트')
check('업비트: 원화 마켓만 · 한글 이름 포함', cr.length === 1 && cr[0].ticker === 'BTC' && cr[0].market === 'CRYPTO' && cr[0].currency === 'KRW')
check('업비트: 영문·티커로도', S.matchUpbit(upbit, 'eth').length === 1 && S.matchUpbit(upbit, 'ETH')[0].ticker === 'ETH')
check('업비트: 빈 검색어 → 없음', S.matchUpbit(upbit, ' ').length === 0)

const m = S.mergeResults(st, cr, 10)
check('병합: 주식 먼저, 코인 뒤, 중복 없음', m.length === 3 && m[2].market === 'CRYPTO')
check('병합: 개수 상한', S.mergeResults(st, cr, 2).length === 2)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (종목 이름 검색)')
process.exit(fail ? 1 : 0)
```

- [ ] **Step 2: 실패 확인** — Run: `node scripts/verify-stock-search.mjs` → Expected: `Cannot find module`, 종료 코드 1.

- [ ] **Step 3: lib 구현**

```ts
// 종목 이름 검색 SSOT — 네이버 자동완성(한국·미국) + 업비트 원화 마켓(코인), 한글 ETF 브랜드 별칭
//   실측(2026-09-25): "타이거·코덱스"는 네이버가 못 찾고, 일본 종목이 섞인다 → 별칭 치환 + 국가 필터.
export type Market = 'US' | 'KR' | 'CRYPTO'
export interface SearchResult { ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'; exchange: string }

const BRAND_ALIAS: [string, string][] = [
  ['타이거', 'TIGER'], ['코덱스', 'KODEX'], ['에이스', 'ACE'], ['라이즈', 'RISE'], ['킨덱스', 'KINDEX'],
  ['하나로', 'HANARO'], ['아리랑', 'ARIRANG'], ['플러스', 'PLUS'], ['케이비스타', 'KBSTAR'], ['쏠', 'SOL'],
]
export function expandQuery(q: string): string {
  const t = q.trim()
  for (const [ko, en] of BRAND_ALIAS) if (t.startsWith(ko)) return en + t.slice(ko.length)
  return t
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseNaverItems(items: any[]): SearchResult[] {
  return (items ?? [])
    .filter(i => i?.category === 'stock' && (i.nationCode === 'KOR' || i.nationCode === 'USA') && i.code && i.name)
    .map(i => i.nationCode === 'KOR'
      ? { ticker: String(i.code), name: String(i.name), market: 'KR' as const, currency: 'KRW' as const, exchange: String(i.typeName ?? i.typeCode ?? '') }
      : { ticker: String(i.code).toUpperCase(), name: String(i.name), market: 'US' as const, currency: 'USD' as const, exchange: String(i.typeName ?? i.typeCode ?? '') })
}

export interface UpbitMarket { market: string; korean_name: string; english_name: string }
export function matchUpbit(markets: UpbitMarket[], q: string): SearchResult[] {
  const t = q.trim(); if (!t) return []
  const up = t.toUpperCase()
  return markets
    .filter(m => m.market.startsWith('KRW-'))
    .filter(m => m.korean_name.includes(t) || m.english_name.toUpperCase().includes(up) || m.market.slice(4) === up)
    .map(m => ({ ticker: m.market.slice(4), name: m.korean_name, market: 'CRYPTO' as const, currency: 'KRW' as const, exchange: '업비트' }))
}

export function mergeResults(stocks: SearchResult[], crypto: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>(); const out: SearchResult[] = []
  for (const r of [...stocks, ...crypto]) {
    const k = `${r.market}:${r.ticker}`
    if (seen.has(k)) continue
    seen.add(k); out.push(r)
    if (out.length >= limit) break
  }
  return out
}
```

- [ ] **Step 4: 통과 확인** — Run: `node scripts/verify-stock-search.mjs` → Expected: 12줄 ✅, `✅ 전부 통과 (종목 이름 검색)`.

- [ ] **Step 5: API 구현**

```ts
// 종목 이름 검색 API — ?q= 로 한국·미국 주식·ETF(네이버 자동완성)와 코인(업비트)을 함께 찾는다
import { NextResponse } from 'next/server'
import { expandQuery, parseNaverItems, matchUpbit, mergeResults, type UpbitMarket } from '@/lib/stockSearch'

export const dynamic = 'force-dynamic'
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }
let upbitCache: { at: number; list: UpbitMarket[] } | null = null   // 목록은 하루에 몇 번 안 바뀐다 — 6시간

async function upbitMarkets(): Promise<UpbitMarket[]> {
  if (upbitCache && Date.now() - upbitCache.at < 6 * 3600_000) return upbitCache.list
  const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
  if (!r.ok) return upbitCache?.list ?? []
  const list = (await r.json()) as UpbitMarket[]
  upbitCache = { at: Date.now(), list }
  return list
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ results: [] })
  const eq = expandQuery(q)
  const [naver, upbit] = await Promise.all([
    fetch(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(eq)}&target=stock`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(6000) })
      .then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    upbitMarkets().catch(() => [] as UpbitMarket[]),
  ])
  const results = mergeResults(parseNaverItems(naver.items ?? []), matchUpbit(upbit, q), 10)
  return NextResponse.json({ results, failed: !(naver.items) })
}
```

- [ ] **Step 6: 실제 호출 확인** — dev 서버(`preview_start dev`)에서 브라우저 콘솔로:

```js
await Promise.all(['삼성','타이거 미국','엔비디아','비트'].map(q => fetch('/api/stock-search?q='+encodeURIComponent(q)).then(r=>r.json()).then(j=>[q, j.results.slice(0,2).map(x=>x.ticker+':'+x.name)])))
```
Expected: 삼성 → `005930:삼성전자` · 타이거 미국 → `360750:TIGER 미국S&P500` · 엔비디아 → `NVDA:엔비디아` · 비트 → `BTC:비트코인` 포함.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/stockSearch.ts src/app/api/stock-search/route.ts scripts/verify-stock-search.mjs
git commit -m "종목 이름 검색 — 네이버 자동완성(한·미) + 업비트(코인) + 한글 ETF 브랜드 별칭"
```

---

### Task 5: 히트맵 배치 계산 (`treemap`)

**Files:**
- Create: `src/lib/treemap.ts`
- Test: `scripts/verify-treemap.mjs`

- [ ] **Step 1: 실패하는 검증 스크립트 작성**

```js
// 히트맵 배치 검증 — 칸 면적이 값에 비례하고 상자 밖으로 안 나가며, 색이 등락 규칙을 따르는지
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-treemap`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/treemap.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const M = require2(`${OUT}/lib/treemap.js`)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }

const vals = [421, 356, 192, 176, 103]
const box = { x: 0, y: 0, w: 358, h: 230 }
const rs = M.squarify(vals, box)
const total = vals.reduce((a, b) => a + b, 0)
check('칸 수 = 값 수', rs.length === vals.length)
check('면적 비례(오차 0.5%)', rs.every((r, i) => Math.abs(r.w * r.h - vals[i] / total * box.w * box.h) < box.w * box.h * 0.005))
check('상자 안', rs.every(r => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= box.w + 0.01 && r.y + r.h <= box.h + 0.01))
check('빈 입력 → 빈 배열', M.squarify([], box).length === 0 && M.squarify([0, 0], box).length === 0)
const TK = { red500: '#ef4444', blue500: '#3b82f6', flat2: '#2a2d3a' }
check('색: 시세 없음 → null', M.heatFill(null, TK) === null)
check('색: 보합(±0.1%) → 회색', M.heatFill(0.05, TK) === TK.flat2)
check('색: 상승 → 빨강 계열', M.heatFill(2.1, TK).startsWith(TK.red500))
check('색: 하락 → 파랑 계열', M.heatFill(-0.9, TK).startsWith(TK.blue500))
check('색: 클수록 진하다', M.heatFill(3, TK) !== M.heatFill(0.5, TK))
const g = M.splitGroups(420, 580, box)
check('묶음 나누기: 코어 폭 = 42%', Math.abs(g.core.w - 358 * 0.42) < 0.01 && Math.abs(g.core.w + g.sat.w - 358) < 0.01)
check('묶음 나누기: 한쪽 0 → 다른 쪽 전폭', M.splitGroups(0, 5, box).sat.w === 358 && M.splitGroups(0, 5, box).core.w === 0)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (히트맵 배치)')
process.exit(fail ? 1 : 0)
```

- [ ] **Step 2: 실패 확인** — Run: `node scripts/verify-treemap.mjs` → `Cannot find module`, 종료 코드 1.

- [ ] **Step 3: lib 구현**

```ts
// 히트맵 칸 배치(squarify)와 칸 색 규칙 — 크기 = 평가금액, 색 = 오늘 등락(한국식 빨강 상승·파랑 하락)
export interface Rect { x: number; y: number; w: number; h: number }

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0)
  const mx = Math.max(...row), mn = Math.min(...row)
  return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
}

/** values 는 큰 순으로 넣는다. 결과 칸 순서 = 입력 순서. */
export function squarify(values: number[], box: Rect): Rect[] {
  const total = values.reduce((a, b) => a + (b > 0 ? b : 0), 0)
  if (!values.length || total <= 0 || box.w <= 0 || box.h <= 0) return []
  const areas = values.map(v => (v > 0 ? v : 0) * (box.w * box.h) / total)
  const out: Rect[] = []
  let rest = { ...box }, i = 0
  while (i < areas.length) {
    const side = Math.min(rest.w, rest.h)
    const row = [areas[i]]; let j = i + 1
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) { row.push(areas[j]); j++ }
    const sum = row.reduce((a, b) => a + b, 0)
    if (rest.w >= rest.h) {
      const cw = sum / rest.h; let y = rest.y
      for (const a of row) { const h = a / cw; out.push({ x: rest.x, y, w: cw, h }); y += h }
      rest = { x: rest.x + cw, y: rest.y, w: rest.w - cw, h: rest.h }
    } else {
      const rh = sum / rest.w; let x = rest.x
      for (const a of row) { const w = a / rh; out.push({ x, y: rest.y, w, h: rh }); x += w }
      rest = { x: rest.x, y: rest.y + rh, w: rest.w, h: rest.h - rh }
    }
    i = j
  }
  return out
}

/** 코어·위성 두 묶음으로 상자를 좌우로 나눈다(폭 = 평가금액 비율) */
export function splitGroups(coreVal: number, satVal: number, box: Rect): { core: Rect; sat: Rect } {
  const t = coreVal + satVal
  const cw = t > 0 ? box.w * coreVal / t : 0
  return { core: { x: box.x, y: box.y, w: cw, h: box.h }, sat: { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h } }
}

/** 칸 색 — null 은 '시세 없음'(화면이 점선 칸으로 그린다). 알파 두 자리를 토큰 뒤에 붙인다. */
export function heatFill(changePct: number | null, tk: { red500: string; blue500: string; flat2: string }): string | null {
  if (changePct == null || !Number.isFinite(changePct)) return null
  if (Math.abs(changePct) < 0.1) return tk.flat2
  const t = Math.min(Math.abs(changePct) / 3, 1)             // 3% 이상이면 가장 진하다
  const alpha = Math.round((0.28 + 0.5 * t) * 255).toString(16).padStart(2, '0')
  return `${changePct > 0 ? tk.red500 : tk.blue500}${alpha}`
}
```

- [ ] **Step 4: 통과 확인** — Run: `node scripts/verify-treemap.mjs` → 11줄 ✅, `✅ 전부 통과 (히트맵 배치)`.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/treemap.ts scripts/verify-treemap.mjs
git commit -m "히트맵 배치(squarify)·칸 색 규칙 — 크기=평가금액, 색=오늘 등락(한국식)"
```

---

### Task 6: 학생 셸과 `/s` 경로

**Files:**
- Modify: `src/app/components/Layout/SidebarLayout.tsx:14`
- Modify: `src/middleware.ts` (`protectedPaths` 배열)
- Create: `src/app/components/student/StudentShell.tsx`
- Create: `src/app/s/layout.tsx`
- Create: `src/app/s/page.tsx`

- [ ] **Step 1: 기존 셸에서 `/s` 제외** — `SidebarLayout.tsx` 14행을 다음으로 바꾼다(`/school-league`·`/signal-report`·`/swing`·`/signup` 이 걸리지 않게 `startsWith('/s')` 를 쓰지 않는다).

```tsx
  const noLayout = NO_LAYOUT.some(p => pathname === p || pathname.startsWith(p + '?'))
    || pathname === '/s' || pathname.startsWith('/s/')   // 🎒 학생 간단 모드는 자기 셸(StudentShell)을 쓴다
```

- [ ] **Step 2: 로그인 필요 경로 추가** — `src/middleware.ts` `protectedPaths` 배열 첫 줄에 `'/s/', ` 를 넣고, `'/s'` 정확 일치는 조건에 추가한다.

```ts
  if (!user && (pathname === '/s' || protectedPaths.some(p => pathname.startsWith(p)))) {
```
그리고 배열에 `'/s/',` 추가.

- [ ] **Step 3: 학생 셸 작성**

```tsx
'use client'
// 학생 간단 모드 셸 — 폰·태블릿은 하단 탭 4개, PC(769px↑)는 왼쪽 메뉴. 기존 35개 화면은 '분석' 링크로 그대로 연다.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TK, FS, RAD, SP, FONT_STACK } from '@/lib/theme'

const TABS = [
  { href: '/s', label: '홈', icon: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5' },
  { href: '/s/assets', label: '내 자산', icon: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0' },
  { href: '/s/league', label: '리그', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
  { href: '/s/learn', label: '배우기', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5' },
]
const isActive = (pathname: string, href: string) => href === '/s' ? pathname === '/s' : pathname.startsWith(href)

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="st-shell" style={{ display: 'flex', minHeight: '100dvh', background: TK.bg1, color: TK.slate200, fontFamily: FONT_STACK }}>
      <style>{`
        @media (max-width: 768px) { .st-rail { display: none !important } .st-main { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important } }
        @media (min-width: 769px) { .st-tabs { display: none !important } }
      `}</style>
      <nav className="st-rail" aria-label="학생 메뉴" style={{ width: 220, flexShrink: 0, padding: `${SP.xl}px ${SP.lg}px`, background: TK.bg0, borderRight: `1px solid ${TK.border}`, display: 'flex', flexDirection: 'column', gap: SP.xs, position: 'sticky', top: 0, height: '100dvh', boxSizing: 'border-box' }}>
        <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, padding: `0 ${SP.sm}px ${SP.xl}px` }}>투자학교</div>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: on ? TK.card : 'transparent', color: on ? TK.slate100 : TK.slate300, fontSize: FS.body, fontWeight: on ? 700 : 500, textDecoration: 'none' }}>
              <Icon d={t.icon} size={20} />{t.label}
            </Link>
          )
        })}
        <div style={{ flexGrow: 1 }} />
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, color: TK.sub, fontSize: FS.tiny, textDecoration: 'none' }}>분석 화면 전체 보기</Link>
      </nav>
      <main className="st-main" style={{ flexGrow: 1, minWidth: 0, maxWidth: 1080, margin: '0 auto', padding: SP.lg, boxSizing: 'border-box' }}>{children}</main>
      <nav className="st-tabs" aria-label="학생 메뉴" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', height: 72, paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: TK.bg0, borderTop: `1px solid ${TK.border}` }}>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.xs, fontSize: FS.tiny, fontWeight: on ? 700 : 500, color: on ? TK.slate100 : TK.sub, textDecoration: 'none' }}>
              <Icon d={t.icon} />{t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: 레이아웃·임시 홈**

```tsx
// 학생 간단 모드 레이아웃 — 모든 /s 화면을 학생 셸로 감싼다
import StudentShell from '@/app/components/student/StudentShell'
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>
}
```

```tsx
// 학생 홈 자리 — 2단계(홈 카드들)가 들어오기 전까지 내 자산으로 보낸다
import { redirect } from 'next/navigation'
export default function StudentHome() { redirect('/s/assets') }
```

- [ ] **Step 5: 확인** — `npm run check` 오류 0. dev 서버에서 `/s` 가 `/s/assets` 로 가고(404 여도 됨 — Task 8 전), `/school-league`·`/signal-report`·`/swing` 은 기존 사이드바가 그대로인지 375px·1280px 로 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/app/components/Layout/SidebarLayout.tsx src/middleware.ts src/app/components/student/StudentShell.tsx src/app/s/layout.tsx src/app/s/page.tsx
git commit -m "학생 셸(/s) — 폰·태블릿 하단 탭 4개·PC 왼쪽 메뉴, 기존 셸과 분리"
```

---

### Task 7: 내 보유 불러오기 훅 + 히트맵 컴포넌트

**Files:**
- Create: `src/app/components/student/useMyPortfolio.ts`
- Create: `src/app/components/student/Heatmap.tsx`

- [ ] **Step 1: 훅 작성** (가져오는 열·시세·환율은 `assets/page.tsx:173-190, 255-270` 과 같은 경로)

```ts
'use client'
// 학생 화면 공용 — 내 보유·시세·환율을 불러와 portfolioSummary 로 요약한다(로딩·실패·빈 보유를 구분)
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { summarizePortfolio, type HoldingInput, type PriceInput, type PortfolioSummary } from '@/lib/portfolioSummary'

export type LoadState = 'loading' | 'ready' | 'failed' | 'unauth'
export interface MyPortfolio { state: LoadState; holdings: HoldingInput[]; summary: PortfolioSummary | null; usdKrw: number | null; targetCorePct: number | null; reload: () => void }

export function useMyPortfolio(): MyPortfolio {
  const [state, setState] = useState<LoadState>('loading')
  const [holdings, setHoldings] = useState<HoldingInput[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [usdKrw, setUsdKrw] = useState<number | null>(null)
  const [targetCorePct, setTarget] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (!cancelled) setState('unauth'); return }
      const [{ data, error }, fxRes, cfg] = await Promise.all([
        sb.from('investments').select('id,ticker,name,market,currency,purchase_price,quantity,asset_role').eq('user_id', user.id),
        fetch('/api/exchange-rate', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        sb.from('strategy_configs').select('core_pct').limit(1).maybeSingle(),
      ])
      if (error) { if (!cancelled) setState('failed'); return }
      const hs = (data ?? []) as HoldingInput[]
      const fx = typeof fxRes?.rate === 'number' && fxRes.rate > 500 ? fxRes.rate : null
      let priceMap: Record<string, PriceInput> = {}
      if (hs.length) {
        const pr = await fetch('/api/stock-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hs.map(h => ({ ticker: h.ticker, market: h.market }))) }).catch(() => null)
        if (pr?.ok) {
          const list: ({ ticker: string } & PriceInput)[] = await pr.json()
          priceMap = Object.fromEntries(list.map(p => [p.ticker.toUpperCase(), p]))
        }
      }
      if (cancelled) return
      // 환율을 못 받으면 달러 종목이 원화로 틀리게 계산된다 → 달러 보유가 있으면 실패로 밝힌다(추정 환율 금지)
      const hasUsd = hs.some(h => h.currency === 'USD')
      if (hasUsd && fx == null) { setHoldings(hs); setState('failed'); return }
      setHoldings(hs); setUsdKrw(fx)
      setTarget(cfg.data?.core_pct != null && cfg.data.core_pct > 0 ? cfg.data.core_pct : null)
      setSummary(summarizePortfolio(hs, priceMap, fx ?? 1))
      setState('ready')
    })().catch(() => { if (!cancelled) setState('failed') })
    return () => { cancelled = true }
  }, [tick])

  const reload = useCallback(() => { setState('loading'); setTick(t => t + 1) }, [])
  return { state, holdings, summary, usdKrw, targetCorePct, reload }
}
```

- [ ] **Step 2: 히트맵 작성**

```tsx
'use client'
// 내 자산 히트맵 — 코어·위성 두 묶음, 칸 크기 = 평가금액, 색 = 오늘 등락. 시세 없는 종목은 점선 칸으로 밝힌다.
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { squarify, splitGroups, heatFill, type Rect } from '@/lib/treemap'
import type { HoldingRow } from '@/lib/portfolioSummary'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

export default function Heatmap({ rows, corePct, height = 240 }: { rows: HoldingRow[]; corePct: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const top = 22
  const box: Rect = { x: 0, y: top, w, h: height - top }
  const core = rows.filter(r => r.role === 'CORE'), sat = rows.filter(r => r.role === 'SATELLITE')
  const g = splitGroups(core.reduce((a, r) => a + r.evalKrw, 0), sat.reduce((a, r) => a + r.evalKrw, 0), box)
  const tiles = [
    ...squarify(core.map(r => r.evalKrw), g.core).map((rect, i) => ({ rect, row: core[i] })),
    ...squarify(sat.map(r => r.evalKrw), g.sat).map((rect, i) => ({ rect, row: sat[i] })),
  ]
  return (
    <section aria-label="한눈에 보는 내 종목" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>한눈에 보는 내 종목</span>
        <span style={{ fontSize: FS.micro, color: TK.sub }}>크기 = 평가금액 · 색 = 오늘 등락</span>
      </div>
      <div ref={ref} style={{ position: 'relative', width: '100%', height }}>
        {g.core.w > 0 && <span style={{ position: 'absolute', left: 2, top: 0, fontSize: FS.micro, fontWeight: 700, color: TK.sky400 }}>코어 {Math.round(corePct)}%</span>}
        {g.sat.w > 0 && <span style={{ position: 'absolute', left: g.sat.x + 2, top: 0, fontSize: FS.micro, fontWeight: 700, color: TK.orange400 }}>위성 {Math.round(100 - corePct)}%</span>}
        {w > 0 && tiles.map(({ rect, row }) => {
          const fill = heatFill(row.priced ? row.changePct : null, { red500: TK.red500, blue500: TK.blue500, flat2: TK.flat2 })
          const big = rect.h > 90 && rect.w > 90
          return (
            <Link key={row.id} href={`/s/stock/${encodeURIComponent(row.ticker)}`} title={row.name}
              style={{ position: 'absolute', left: rect.x, top: rect.y, width: Math.max(rect.w - 3, 0), height: Math.max(rect.h - 3, 0), boxSizing: 'border-box', padding: SP.sm, borderRadius: RAD.xs, overflow: 'hidden', background: fill ?? TK.card, border: fill ? 'none' : `1px dashed ${TK.sub}`, color: TK.slate100, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: FS.tiny, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
              {row.priced && row.changePct != null
                ? <span style={{ fontSize: big ? FS.lg : FS.tiny, fontWeight: 800 }}>{pct(row.changePct)}</span>
                : <span style={{ fontSize: FS.micro, color: TK.sub }}>시세 못 가져옴 · 매수가로 계산</span>}
              {rect.h > 60 && <span style={{ fontSize: FS.micro, color: TK.slate300 }}>{won(row.evalKrw)}</span>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 확인** — `npm run check` 오류 0.

- [ ] **Step 4: 커밋**

```bash
git add src/app/components/student/useMyPortfolio.ts src/app/components/student/Heatmap.tsx
git commit -m "학생 내 자산 공용 훅(보유·시세·환율 → 요약) + 코어/위성 히트맵"
```

---

### Task 8: 내 자산 화면 `/s/assets`

캔버스 ② 기준. 자산 성장 차트·이달 배당은 2단계.

**Files:**
- Create: `src/app/s/assets/page.tsx`

- [ ] **Step 1: 화면 작성**

```tsx
'use client'
// 학생 내 자산 — 총자산·오늘·원금·불어난 돈 → 히트맵 → 투자 구성 → 오늘의 투자 체크 → 종목 목록 (+ 기록)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import Heatmap from '@/app/components/student/Heatmap'
import { rebalanceCheck } from '@/lib/portfolioSummary'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const signWon = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`
const upDown = (n: number | null) => n == null || Math.abs(n) < 0.05 ? TK.sub : n > 0 ? TK.red400 : TK.blue400
const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg } as const

export default function StudentAssets() {
  const { state, summary, targetCorePct, reload } = useMyPortfolio()
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>내 자산</h1>
      <Link href="/s/record" aria-label="매매 기록하기" style={{ display: 'flex', alignItems: 'center', gap: SP.xs, height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.pill, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>＋ 기록</Link>
    </div>
  )
  if (state === 'loading') return <div>{header}<p style={{ color: TK.sub, fontSize: FS.body }}>내 종목을 불러오는 중이에요…</p></div>
  if (state === 'unauth') return <div>{header}<p style={{ color: TK.sub, fontSize: FS.body }}>로그인하면 내 자산이 보여요.</p></div>
  if (state === 'failed' || !summary) return (
    <div>{header}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, color: TK.slate100 }}>내 자산을 불러오지 못했어요.</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>시세나 환율 서버가 잠시 응답하지 않았을 수 있어요.</span>
        <button type="button" onClick={reload} style={{ alignSelf: 'flex-start', height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny }}>다시 불러오기</button>
      </div>
    </div>
  )
  if (summary.rows.length === 0) return (
    <div>{header}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>아직 기록한 종목이 없어요</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>증권사에서 산 종목을 한 번 적어 두면 여기서 매일 흐름을 볼 수 있어요.</span>
        <Link href="/s/record" style={{ alignSelf: 'flex-start', height: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>첫 종목 기록하기</Link>
      </div>
    </div>
  )

  const check = rebalanceCheck(summary.corePct, targetCorePct)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xl }}>
      {header}
      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ fontSize: FS.body, color: TK.sub }}>총자산</span>
        <span style={{ fontSize: FS.h1, fontWeight: 800, color: TK.slate100 }}>{won(summary.totalEvalKrw)}</span>
        <span style={{ fontSize: FS.lg, fontWeight: 700, color: upDown(summary.todayPct) }}>오늘 {signWon(summary.todayKrw)}{summary.todayPct != null ? ` (${pct(summary.todayPct)})` : ''}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: SP.sm, paddingTop: SP.md, borderTop: `1px solid ${TK.border}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.tiny, color: TK.sub }}>넣은 돈 (원금)</span><span style={{ fontSize: FS.body, color: TK.slate300 }}>{won(summary.totalCostKrw)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.tiny, color: TK.sub }}>지금까지 불어난 돈</span><span style={{ fontSize: FS.body, fontWeight: 700, color: upDown(summary.pnlPct) }}>{signWon(summary.pnlKrw)}{summary.pnlPct != null ? ` (${pct(summary.pnlPct)})` : ''}</span></div>
        </div>
        {summary.unpricedCount > 0 && <span style={{ fontSize: FS.micro, color: TK.amber400 }}>시세를 못 가져온 종목 {summary.unpricedCount}개는 매수가로 계산했어요.</span>}
      </section>

      <Heatmap rows={summary.rows} corePct={summary.corePct} />

      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>내 투자 구성</span>{targetCorePct != null && <span style={{ fontSize: FS.tiny, color: TK.sub }}>목표 {targetCorePct} : {100 - targetCorePct}</span>}</div>
        <div style={{ display: 'flex', height: 10, borderRadius: RAD.pill, overflow: 'hidden', gap: 2 }}><div style={{ width: `${summary.corePct}%`, background: TK.sky400 }} /><div style={{ flexGrow: 1, background: TK.orange400 }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.tiny }}><span style={{ color: TK.sky400, fontWeight: 700 }}>코어 {Math.round(summary.corePct)}%</span><span style={{ color: TK.orange400, fontWeight: 700 }}>위성 {Math.round(summary.satPct)}%</span></div>
      </section>

      {check && (
        <section style={{ ...card, border: `1px solid ${TK.sky400}`, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.sky400 }}>오늘의 투자 체크</span>
          <span style={{ fontSize: FS.body, color: TK.slate100 }}>
            {check.kind === 'balanced' ? '코어·위성이 목표 비율 안에 있어요.' : check.kind === 'core-short' ? `코어가 목표보다 ${check.gapPp}%p 적어요.` : `위성이 목표보다 ${check.gapPp}%p 적어요.`}
          </span>
          {check.kind !== 'balanced' && <span style={{ fontSize: FS.tiny, color: TK.sub }}>새로 넣는 돈을 {check.kind === 'core-short' ? '코어' : '위성'} 종목에 쓰면 팔지 않고도 맞춰져요.</span>}
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, paddingBottom: SP.sm }}>내 종목</span>
        {summary.rows.map(r => (
          <Link key={r.id} href={`/s/stock/${encodeURIComponent(r.ticker)}`} style={{ display: 'flex', alignItems: 'center', gap: SP.md, minHeight: 64, borderTop: `1px solid ${TK.border}`, color: TK.slate200, textDecoration: 'none' }}>
            <div aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.tiny, fontWeight: 700, color: TK.slate300 }}>{r.name.slice(0, 1)}</div>
            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: FS.body, color: TK.slate100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, fontSize: FS.tiny, color: TK.sub }}>
                <span style={{ padding: `0 ${SP.xs + 2}px`, borderRadius: RAD.pill, background: r.role === 'CORE' ? `${TK.sky400}24` : `${TK.orange400}24`, color: r.role === 'CORE' ? TK.sky400 : TK.orange400, fontWeight: 600 }}>{r.role === 'CORE' ? '코어' : '위성'}</span>
                {r.priced && r.changePct != null ? <>오늘 <span style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</span></> : '지금 시세를 못 가져왔어요'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: FS.body, color: TK.slate100 }}>{won(r.evalKrw)}</span>
              {r.pnlPct != null && <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(r.pnlPct) }}>{pct(r.pnlPct)}</span>}
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 타입·린트** — `npm run check` 오류 0.

- [ ] **Step 3: 화면 실측** — 로그인 상태로 `/s/assets` 를 375×812 · 768×1024 · 1280×900 에서 연다. 확인할 것:
  1. 가로 넘침 0 (`document.documentElement.scrollWidth <= innerWidth`)
  2. **총자산이 `/assets` 화면 총 평가액과 같다**(같은 계정·같은 시각, 제2원칙)
  3. 히트맵 칸 수 = 보유 종목 수, 칸 클릭 → `/s/stock/<티커>`
  4. 오늘 등락 색: 상승 빨강·하락 파랑·보합 회색
  5. 보유 0 계정(학생 계정 중 미등록자 — 로그인 불가하면 빈 보유 분기는 코드 리뷰로 대체하고 그 사실을 기록)

- [ ] **Step 4: 커밋**

```bash
git add src/app/s/assets/page.tsx
git commit -m "학생 내 자산 화면 — 총자산·히트맵·투자 구성·투자 체크·종목 목록, 로딩/실패/빈 보유 구분"
```

---

### Task 9: 종목 상세 `/s/stock/[ticker]`

**Files:**
- Create: `src/app/s/stock/[ticker]/page.tsx`

- [ ] **Step 1: 화면 작성**

```tsx
'use client'
// 학생 종목 상세 — 지금 가격·오늘 등락·가격 흐름·내 보유(수량·평단·평가·손익·비중)·내 거래 기록 → 이 종목 기록하기
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'

interface Tx { id: string; type: 'buy' | 'sell'; price: number; quantity: number; transaction_date: string }
interface PricePoint { t: number; v: number }
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`
const upDown = (n: number | null) => n == null || Math.abs(n) < 0.05 ? TK.sub : n > 0 ? TK.red400 : TK.blue400
const FRAMES = [['1W', '1주'], ['1M', '1달'], ['1Y', '1년']] as const

export default function StudentStock() {
  const { ticker: raw } = useParams<{ ticker: string }>()
  const ticker = decodeURIComponent(raw).toUpperCase()
  const { state, holdings, summary } = useMyPortfolio()
  const holding = holdings.find(h => h.ticker.toUpperCase() === ticker) ?? null
  const row = summary?.rows.find(r => r.ticker.toUpperCase() === ticker) ?? null
  const [charts, setCharts] = useState<Record<string, PricePoint[]> | null>(null)
  const [frame, setFrame] = useState<'1W' | '1M' | '1Y'>('1M')
  const [txs, setTxs] = useState<Tx[] | null>(null)

  useEffect(() => {
    if (!holding) return
    let cancelled = false
    fetch('/api/stock-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ ticker: holding.ticker, market: holding.market }]) })
      .then(r => r.ok ? r.json() : null).then(j => { if (!cancelled) setCharts(j?.[0]?.charts ?? null) }).catch(() => { if (!cancelled) setCharts(null) })
    const sb = createClient()
    sb.from('transactions').select('id,type,price,quantity,transaction_date').eq('ticker', holding.ticker).order('transaction_date', { ascending: false }).limit(20)
      .then(({ data, error }) => { if (!cancelled) setTxs(error ? [] : (data as Tx[])) })
    return () => { cancelled = true }
  }, [holding?.ticker, holding?.market])  // eslint-disable-line react-hooks/exhaustive-deps

  const back = <Link href="/s/assets" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 내 자산</Link>
  if (state === 'loading') return <div>{back}<p style={{ color: TK.sub, fontSize: FS.body }}>불러오는 중이에요…</p></div>
  if (!holding || !row) return <div>{back}<p style={{ color: TK.sub, fontSize: FS.body }}>내 종목 중에 {ticker} 가 없어요.</p></div>

  const pts = charts?.[frame] ?? []
  const vals = pts.map(p => p.v)
  const min = Math.min(...vals, holding.purchase_price), max = Math.max(...vals, holding.purchase_price)
  const W = 358, H = 120, y = (v: number) => max === min ? H / 2 : H - (v - min) / (max - min) * (H - 8) - 4
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(pts.length - 1, 1) * W).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const stat = (label: string, value: string, color: string = TK.slate100) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.tiny, color: TK.sub }}>{label}</span><span style={{ fontSize: FS.lg, fontWeight: 700, color }}>{value}</span></div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 560 }}>
      {back}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md }}>
        <div aria-hidden style={{ width: 48, height: 48, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.lg, fontWeight: 700, color: TK.slate300 }}>{holding.name.slice(0, 1)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, color: TK.slate100 }}>{holding.name}</h1>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>{holding.ticker} · {row.role === 'CORE' ? '코어' : '위성'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>지금 가격</span>
        <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100 }}>{row.currentPrice != null ? (holding.currency === 'USD' ? `$${row.currentPrice.toLocaleString('en-US')}` : won(row.currentPrice)) : '시세를 못 가져왔어요'}</span>
        {row.changePct != null && <span style={{ fontSize: FS.body, fontWeight: 600, color: upDown(row.changePct) }}>오늘 {pct(row.changePct)}</span>}
      </div>
      {pts.length > 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${holding.name} 가격 흐름`}>
            <path d={`M0,${y(holding.purchase_price).toFixed(1)} H${W}`} stroke={TK.sub} strokeDasharray="3 5" />
            <path d={path} fill="none" stroke={TK.slate300} strokeWidth={2} />
          </svg>
          <span style={{ fontSize: FS.micro, color: TK.sub }}>점선 = 내 평균 매수가</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SP.xs }}>
            {FRAMES.map(([k, label]) => <button key={k} type="button" onClick={() => setFrame(k)} aria-pressed={frame === k} style={{ height: 36, borderRadius: RAD.pill, border: frame === k ? 'none' : `1px solid ${TK.border}`, background: frame === k ? TK.slate100 : 'transparent', color: frame === k ? TK.bg0 : TK.sub, fontSize: FS.tiny, fontWeight: frame === k ? 700 : 500 }}>{label}</button>)}
          </div>
        </div>
      ) : <span style={{ fontSize: FS.tiny, color: TK.sub }}>{charts === null ? '가격 흐름을 불러오는 중이거나 못 가져왔어요.' : '이 기간의 가격 기록이 없어요.'}</span>}
      <section style={{ background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.md }}>
        {stat('보유 수량', `${holding.quantity.toLocaleString('ko-KR')}${holding.market === 'CRYPTO' ? '개' : '주'}`)}
        {stat('평균 매수가', holding.currency === 'USD' ? `$${holding.purchase_price.toLocaleString('en-US')}` : won(holding.purchase_price))}
        {stat('평가금액', won(row.evalKrw))}
        {stat('평가손익', `${row.pnlKrw >= 0 ? '+' : '−'}${Math.abs(Math.round(row.pnlKrw)).toLocaleString('ko-KR')}원`, upDown(row.pnlPct))}
        {stat('수익률', row.pnlPct != null ? pct(row.pnlPct) : '—', upDown(row.pnlPct))}
        {stat('내 자산 중 비중', `${row.weightPct.toFixed(1)}%`)}
      </section>
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, paddingBottom: SP.sm }}>내 거래 기록</span>
        {txs == null ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>불러오는 중이에요…</span>
          : txs.length === 0 ? <span style={{ fontSize: FS.tiny, color: TK.sub }}>기록된 거래가 없어요.</span>
          : txs.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderTop: `1px solid ${TK.border}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.body, color: TK.slate100 }}><span style={{ color: t.type === 'buy' ? TK.red400 : TK.blue400 }}>{t.type === 'buy' ? '샀어요' : '팔았어요'}</span> {t.quantity.toLocaleString('ko-KR')}</span><span style={{ fontSize: FS.tiny, color: TK.sub }}>{t.transaction_date}</span></div>
              <span style={{ fontSize: FS.body, color: TK.slate300 }}>{holding.currency === 'USD' ? `$${t.price.toLocaleString('en-US')}` : won(t.price)}</span>
            </div>
          ))}
      </section>
      <Link href={`/research?ticker=${encodeURIComponent(holding.ticker)}`} style={{ padding: SP.lg, border: `1px solid ${TK.border}`, borderRadius: RAD.md, color: TK.slate200, fontSize: FS.body, textDecoration: 'none' }}>이 종목 더 깊이 보기 — 분석 화면에서 열려요 ›</Link>
      <Link href={`/s/record?ticker=${encodeURIComponent(holding.ticker)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: RAD.md, background: TK.blue600, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, textDecoration: 'none' }}>이 종목 매매 기록하기</Link>
    </div>
  )
}
```

- [ ] **Step 2: `/research?ticker=` 딥링크 실재 확인** — `grep -n "searchParams.get('ticker')\|useSearchParams" src/app/research/page.tsx`. 없으면 링크를 `/research` 로 바꾸고 context-notes 에 기록.

- [ ] **Step 3: 확인** — `npm run check` 0 · 375/1280px 실측: 평가금액·손익이 내 자산 목록 행과 같은지, 거래 기록 순서(최근 먼저).

- [ ] **Step 4: 커밋**

```bash
git add "src/app/s/stock/[ticker]/page.tsx"
git commit -m "학생 종목 상세 — 가격 흐름(평단 점선)·내 보유·거래 기록·이 종목 기록하기"
```

---

### Task 10: 기록하기 `/s/record`

캔버스 ③ 기준: 샀어요/팔았어요 → 내 종목 빠른 선택 또는 이름 검색 → 수량(−·+1·+10) → 매수가(지금 시세로 미리 채움, 고칠 수 있음)·날짜(오늘)·분류(자동) → 총액 요약 → 저장.

**Files:**
- Create: `src/app/s/record/page.tsx`

- [ ] **Step 1: 화면 작성**

```tsx
'use client'
// 학생 기록하기 — 3단계(종목 → 수량 → 가격·날짜 확인). 쓰기 규칙은 tradeWrite SSOT, 분류는 classifyAsset SSOT.
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { planBuy, planSell, executeTrade, type TradeInput } from '@/lib/tradeWrite'
import { classifyAsset } from '@/lib/classifyAsset'
import { bustServerCache } from '@/lib/bustCache'
import { kstDate } from '@/lib/schoolIndex'
import type { SearchResult } from '@/lib/stockSearch'

type Mode = 'buy' | 'sell'
const input = { height: 48, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: TK.bg3, border: `1px solid ${TK.border}`, color: TK.slate100, fontSize: FS.body, boxSizing: 'border-box' as const, width: '100%' }

export default function StudentRecord() {
  const router = useRouter()
  const params = useSearchParams()
  const { holdings } = useMyPortfolio()
  const [mode, setMode] = useState<Mode>('buy')
  const [picked, setPicked] = useState<SearchResult | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState('')
  const [marketPrice, setMarketPrice] = useState<number | null>(null)
  const [date, setDate] = useState(kstDate())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mine = useMemo(() => holdings.map(h => ({ ticker: h.ticker, name: h.name, market: h.market, currency: h.currency, exchange: '' }) as SearchResult), [holdings])
  const existing = picked ? holdings.find(h => h.ticker.toUpperCase() === picked.ticker.toUpperCase()) ?? null : null

  useEffect(() => {   // ?ticker= 로 들어오면 내 종목에서 골라 둔다
    const t = params.get('ticker'); if (!t || picked) return
    const m = mine.find(x => x.ticker.toUpperCase() === t.toUpperCase()); if (m) setPicked(m)
  }, [params, mine, picked])

  useEffect(() => {   // 이름 검색 — 300ms 멈추면 부른다
    if (!q.trim()) { setResults([]); return }
    const id = setTimeout(() => {
      fetch(`/api/stock-search?q=${encodeURIComponent(q)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { results: [] }).then(j => setResults(j.results ?? [])).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {   // 고른 종목의 지금 시세로 가격 칸을 미리 채운다(고칠 수 있음)
    if (!picked) return
    let cancelled = false
    setMarketPrice(null)
    fetch('/api/stock-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ ticker: picked.ticker, market: picked.market }]) })
      .then(r => r.ok ? r.json() : null).then(j => {
        const p = j?.[0]; if (cancelled) return
        if (p && !p.error && p.currentPrice > 0) { setMarketPrice(p.currentPrice); setPrice(String(p.currentPrice)) }
      }).catch(() => {})
    return () => { cancelled = true }
  }, [picked])

  const priceNum = Number(price.replace(/,/g, ''))
  const role = existing?.asset_role ?? (picked ? classifyAsset(picked.ticker, picked.name, picked.market) : 'SATELLITE')
  const total = priceNum > 0 ? priceNum * qty : 0
  const money = (n: number) => picked?.currency === 'USD' ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(n).toLocaleString('ko-KR')}원`
  const pickList = mode === 'sell' ? mine : mine

  const save = async () => {
    if (!picked) { setError('종목을 골라 주세요.'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError('로그인이 필요해요.'); setSaving(false); return }
    const inp: TradeInput = { ticker: picked.ticker, name: existing?.name ?? picked.name, market: picked.market, currency: picked.currency, price: priceNum, quantity: qty, date, role }
    const ex = existing ? { id: existing.id, quantity: existing.quantity, purchase_price: existing.purchase_price, name: existing.name, asset_role: existing.asset_role } : null
    const plan = mode === 'buy' ? planBuy(user.id, ex, inp) : planSell(user.id, ex, inp)
    const err = await executeTrade(sb, plan)
    if (err) { setError(err); setSaving(false); return }
    await bustServerCache()
    window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'student-record', mode, ticker: picked.ticker, quantity: qty } }))
    router.push('/s/assets')
  }

  const seg = (on: boolean, color: string) => ({ height: 44, borderRadius: RAD.sm, border: 'none', background: on ? color : 'transparent', color: on ? TK.bg0 : TK.sub, fontSize: FS.body, fontWeight: 700 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
        <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 700, color: TK.slate100 }}>매매 기록하기</h1>
        <Link href="/s/assets" style={{ fontSize: FS.tiny, color: TK.sub, padding: SP.md }}>닫기</Link>
      </div>
      <div role="group" aria-label="샀어요 또는 팔았어요" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm, padding: SP.xs, background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md }}>
        <button type="button" aria-pressed={mode === 'buy'} onClick={() => setMode('buy')} style={seg(mode === 'buy', TK.red400)}>샀어요</button>
        <button type="button" aria-pressed={mode === 'sell'} onClick={() => { setMode('sell'); setQ(''); setResults([]) }} style={seg(mode === 'sell', TK.blue400)}>팔았어요</button>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>1. 어떤 종목?</span>
        {pickList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.xs }}>
            {pickList.map(m => {
              const on = picked?.ticker === m.ticker
              return <button key={m.ticker} type="button" onClick={() => setPicked(m)} aria-pressed={on} style={{ height: 36, padding: `0 ${SP.md}px`, borderRadius: RAD.pill, border: `1px solid ${on ? TK.sky400 : TK.border}`, background: on ? `${TK.sky400}1f` : TK.card, color: on ? TK.slate100 : TK.slate300, fontSize: FS.tiny, fontWeight: on ? 600 : 500 }}>{m.name}</button>
            })}
          </div>
        )}
        {mode === 'buy' && (<>
          <label htmlFor="st-q" style={{ fontSize: FS.tiny, color: TK.sub }}>{pickList.length ? '내 종목에 없으면 이름으로 찾기' : '종목 이름으로 찾기'}</label>
          <input id="st-q" value={q} onChange={e => setQ(e.target.value)} placeholder="삼성, 엔비디아, TIGER 미국, 비트코인" style={input} autoComplete="off" />
          {results.length > 0 && (
            <div role="listbox" style={{ display: 'flex', flexDirection: 'column', background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.sm, overflow: 'hidden' }}>
              {results.map(r => (
                <button key={`${r.market}:${r.ticker}`} type="button" role="option" aria-selected={picked?.ticker === r.ticker} onClick={() => { setPicked(r); setQ(''); setResults([]) }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, padding: `0 ${SP.md}px`, border: 'none', borderTop: `1px solid ${TK.border}`, background: 'transparent', color: TK.slate100, fontSize: FS.body, textAlign: 'left' }}>
                  <span>{r.name}</span><span style={{ fontSize: FS.tiny, color: TK.sub }}>{r.exchange} · {r.ticker}</span>
                </button>
              ))}
            </div>
          )}
        </>)}
        {mode === 'sell' && pickList.length === 0 && <span style={{ fontSize: FS.tiny, color: TK.sub }}>팔 수 있는 종목이 없어요.</span>}
        {picked && <span style={{ fontSize: FS.tiny, color: TK.slate300 }}>고른 종목: <b>{picked.name}</b>{existing ? ` · 지금 ${existing.quantity.toLocaleString('ko-KR')} 보유` : ''}</span>}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>2. 몇 {picked?.market === 'CRYPTO' ? '개' : '주'}?</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
          <button type="button" aria-label="1 빼기" onClick={() => setQty(v => Math.max(1, v - 1))} style={{ width: 48, height: 48, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, background: TK.card, color: TK.slate200, fontSize: FS.xl }}>−</button>
          <input aria-label="수량" inputMode="decimal" value={qty} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) setQty(n) }} style={{ ...input, textAlign: 'center', fontSize: FS.xl, fontWeight: 700 }} />
          <button type="button" onClick={() => setQty(v => v + 1)} style={{ width: 48, height: 48, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, background: TK.card, color: TK.slate200, fontSize: FS.body }}>+1</button>
          <button type="button" onClick={() => setQty(v => v + 10)} style={{ width: 48, height: 48, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, background: TK.card, color: TK.slate200, fontSize: FS.body }}>+10</button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.md }}>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>3. 가격·날짜 확인</span>
        <label htmlFor="st-px" style={{ fontSize: FS.body, color: TK.sub }}>{mode === 'buy' ? '한 주 매수가' : '한 주 매도가'}{picked?.currency === 'USD' ? ' ($)' : ' (원)'}</label>
        <input id="st-px" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} style={{ ...input, fontSize: FS.lg, fontWeight: 700, border: `1px solid ${TK.sky400}` }} />
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>{marketPrice != null ? `지금 시세 ${money(marketPrice)}를 미리 넣어 뒀어요. 증권사에서 실제로 체결된 가격이 다르면 고쳐 주세요.` : picked ? '지금 시세를 못 가져왔어요. 체결된 가격을 적어 주세요.' : ''}</span>
        <label htmlFor="st-date" style={{ fontSize: FS.body, color: TK.sub }}>날짜</label>
        <input id="st-date" type="date" value={date} max={kstDate()} onChange={e => setDate(e.target.value)} style={input} />
        <span style={{ fontSize: FS.body, color: TK.slate200 }}>분류: <b>{role === 'CORE' ? '코어' : '위성'}</b> <span style={{ fontSize: FS.tiny, color: TK.sub }}>{existing ? '이미 가진 종목이라 원래 분류' : '종목 종류로 자동 분류'}</span></span>
      </section>

      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: SP.lg, background: TK.card, border: `1px solid ${TK.line1}`, borderRadius: RAD.md }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.tiny, color: TK.sub }}>{mode === 'buy' ? '총 매수 금액' : '총 매도 금액'}</span><span style={{ fontSize: FS.tiny, color: TK.sub }}>{priceNum > 0 ? `${money(priceNum)} × ${qty}` : '가격을 적으면 계산돼요'}</span></div>
        <span style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>{total > 0 ? money(total) : '—'}</span>
      </section>
      {error && <p role="alert" style={{ margin: 0, fontSize: FS.tiny, color: TK.amber400 }}>{error}</p>}
      <button type="button" onClick={save} disabled={saving} style={{ height: 56, borderRadius: RAD.md, border: 'none', background: TK.blue600, color: TK.slate100, fontSize: FS.lg, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>{saving ? '저장하는 중…' : mode === 'buy' ? '매수 기록 저장' : '매도 기록 저장'}</button>
    </div>
  )
}
```

- [ ] **Step 2: 확인** — `npm run check` 0. 쓰기 경로 실측은 **선생님 본인 계정**으로만(학생 데이터 건드리지 않음):
  1. 이미 가진 종목 1주 매수 → `/assets` 화면 수량 +1·평단이 가중평균으로 바뀌었는지, `/history` 에 거래 1행
  2. 같은 종목 1주 매도 → 수량 −1·`/history` 에 실현손익 표시
  3. 1·2 는 서로 상쇄되지만 **거래 기록 2행이 남는다** — 실행 전에 사용자에게 알리고 동의받는다(실데이터 쓰기)
  4. 375px 에서 입력칸·버튼 넘침 0, 버튼 높이 44 이상

- [ ] **Step 3: 커밋**

```bash
git add src/app/s/record/page.tsx
git commit -m "학생 기록하기 — 샀어요/팔았어요 · 내 종목 빠른 선택·이름 검색 · 시세 미리 채움 · 총액 요약 (tradeWrite SSOT)"
```

---

### Task 11: 1단계 마무리 검증·배포

- [ ] **Step 1: 검증 스크립트 4종**

Run: `node scripts/verify-portfolio-summary.mjs && node scripts/verify-trade-write.mjs && node scripts/verify-stock-search.mjs && node scripts/verify-treemap.mjs`
Expected: 네 번 모두 `✅ 전부 통과`.

- [ ] **Step 2: 빌드 검증** — Run: `npm run check:build` → 종료 코드 0.

- [ ] **Step 3: 기존 화면 회귀** — `/dashboard`·`/assets`·`/school-league`·`/signal-report`·`/swing` 이 375·1280px 에서 기존 사이드바·하단 탭 그대로인지(Task 6 의 `/s` 조건이 새지 않았는지).

- [ ] **Step 4: 기록** — `docs/student-mode/checklist.md` 해당 항목 체크, `context-notes.md` 에 실측 결과(총액 일치 여부·검색 결과·발견한 것) append.

- [ ] **Step 5: 배포** — `deploy-verify` 스킬 절차. 1단계는 **로그인 착지를 바꾸지 않으므로 학생에게 보이지 않는다**(선생님이 `/s/assets` 로 직접 확인).

---

## 자체 점검 (spec 대비)

- 확정 설계의 내 자산(총자산·오늘·원금·불어난 돈·히트맵·구성·투자 체크·종목 목록) → Task 7·8. 자산 성장 차트·이달 배당 → 2단계로 명시.
- 종목 상세(가격·오늘·흐름·보유·거래·기록하기) → Task 9.
- 기록하기(샀어요/팔았어요·빠른 선택·검색·수량·매수가 미리 채움·날짜·자동 분류·총액) → Task 10.
- 접속 기록 → Task 1(테이블은 사용자 실행).
- 탭 4개·PC 왼쪽 메뉴 → Task 6. 홈·리그·배우기 화면 → 2·3단계. 로그인 착지·모드 쿠키·PWA → 4단계.
- 타입 일관성: `HoldingInput`·`HoldingRow`·`PortfolioSummary`·`rebalanceCheck` (Task 2) ↔ Task 7·8·9 사용처 일치. `SearchResult` (Task 4) ↔ Task 10. `planBuy`/`planSell`/`executeTrade`/`TradeInput` (Task 3) ↔ Task 10. `squarify`/`splitGroups`/`heatFill` (Task 5) ↔ Task 7.
