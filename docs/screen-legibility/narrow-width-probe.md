# 📱 좁은 폭 실측 탐지기 — 넘침 · 세로 한 글자 · 잘림 (2026-10-03)

> 로그인 브라우저(Claude 브라우저 창)에서 `javascript_tool` 로 붙여 넣어 쓴다.
> 2026-10-03 하루에 대시보드 50탭 + 대시보드 밖 44화면을 이걸로 돌려 **17곳**을 고쳤다(기록 `docs/history/2026-10.md`).
> 다음 세션이 탐지기를 다시 만들지 않게, 그리고 **같은 측정 함정에 다시 빠지지 않게** 남긴다.

## 왜 폭 측정만으로는 안 되나

| 결함 | 가로 넘침 측정 | 이 탐지기 |
|---|---|---|
| 요소가 본문 오른쪽 밖으로 나감 | ✅ 잡힘 | ✅ |
| 칸이 좁아 글자가 **한 글자씩 세로로** 찍힘('저성장주' 10×66px) | ❌ 넘침 0 | ✅ `V:` |
| `overflow:hidden` 조상이 잘라서 안 보임 | ❌ 넘침 0 으로 숨음 | ✅ `C:` |
| 스크롤 래퍼 안의 정상 가로 스크롤 표 | ⚠️ 거짓 양성 | 제외 |

세로 글자 17건 중 **폭 측정이 잡은 것은 0건**이었다. 처음엔 스크린샷에서 우연히 봤다.

## 탐지기 (페이지 전체 · `main` 기준)

```js
// 결과 문자열에 반드시 폭(w)을 찍는다 — 뷰포트 에뮬레이션은 턴이 바뀌면 풀린다(아래 함정 ①)
window.__probe = (rootSel) => {
  const root = (rootSel && document.querySelector(rootSel)) || document.querySelector('main') || document.body
  const main = document.querySelector('main') || document.body
  const lim = main.getBoundingClientRect().right + 1
  // 조상 중 하나라도 가로 스크롤/숨김이면 '넘침'이 아니다 — 부모 한 칸만 보면 표 안 thead/tr 이 거짓 양성(함정 ②)
  const scrollAncestor = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return 'scroll'; if (ox === 'hidden') return 'hidden' } return null }
  const over = [], vert = [], clip = []
  for (const e of root.querySelectorAll('*')) {
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const anc = scrollAncestor(e)
    if (r.right > lim && anc === null) over.push(e)
    else if (r.right > lim && anc === 'hidden') clip.push(e)   // 숨김 조상이 자른 것 — 넘침 0 으로 보이지만 잘려 있다
    if (e.children.length) continue
    const t = (e.innerText || '').trim()
    if (t.length < 3) continue
    const cs = getComputedStyle(e)
    const fs = parseFloat(cs.fontSize) || 12
    const lh = parseFloat(cs.lineHeight) || fs * 1.4
    const lines = r.height / lh
    if (lines >= 3 && t.length / lines < 2.2 && r.width < fs * 2.6) vert.push(`${t.slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    else if (cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2) clip.push(e)
  }
  const tag = (e) => `${e.tagName}:${(e.innerText || '').slice(0, 16).replace(/\n/g, ' ')}`
  return `${location.pathname} w${innerWidth} page${document.documentElement.scrollWidth - document.documentElement.clientWidth}`
    + ` over${over.length} vert${vert.length} clip${clip.length}`
    + (over.length ? ` | O ${over.slice(0, 3).map(tag).join(' / ')}` : '')
    + (vert.length ? ` | V ${vert.slice(0, 4).join(' / ')}` : '')
    + (clip.length ? ` | C ${clip.slice(0, 3).map(tag).join(' / ')}` : '')
}
window.__probe()
```

## 대시보드 탭 순회

탭은 메뉴 라벨(`span`)을 눌러 연다. 데이터가 무거운 탭은 6~9초 기다린다. 탭 뿌리는 `#tab-<key>`.

```js
window.__tabs = async (pairs) => {   // [['AI 멘토 족집게','mentor'], …]
  const out = []
  for (const [label, key] of pairs) {
    const el = [...document.querySelectorAll('span')].find(e => e.innerText && e.innerText.trim() === label)
    if (!el) { out.push(`${key} ERR no menu`); continue }
    ;(el.closest('button') || el).click()
    await new Promise(r => setTimeout(r, 7000))
    out.push(`${key} ${window.__probe(`#tab-${key}`)}`)
  }
  return out
}
```

탭 키·라벨 목록은 `src/app/dashboard/page.tsx` 에서 뽑는다(`key: '…', … label: '…'`). 리서치 탭은 `main button` 중 라벨 포함으로 찾는다.

## 탐지기를 믿기 전에 — 모의 회귀로 검증

고친 화면을 **브라우저 안에서만** 옛 상태로 되돌려 검출되는지 본다(배포 없음).

```js
const g = [...document.querySelectorAll('#tab-mentor div')].find(d => d.children.length === 6 && getComputedStyle(d).display === 'grid')
const orig = g.style.gridTemplateColumns
g.style.gridTemplateColumns = 'repeat(3,1fr)'   // 고치기 전 값
const bad = window.__probe('#tab-mentor')         // 2026-10-03: vert4 검출
g.style.gridTemplateColumns = orig
window.__probe('#tab-mentor')                     // vert0 으로 돌아와야 한다
```

**이 문서의 코드 그대로 검증한 결과(2026-10-03 · 프로덕션 375)**

| 모의 회귀 | 되돌린 것 | 검출 | 원복 뒤 |
|---|---|---|---|
| AI 멘토 분류 카드 | `gridTemplateColumns` → `repeat(3,1fr)` | `vert4`(저성장주 10×66 …) | 0 |
| 주간 리포트 포트폴리오 표 | 표 `minWidth` 제거 | `vert3`(매수기회 10×72 …) | 0 |
| 코인 랩(가로 스크롤 표 있음) | — | 거짓 양성 0 | — |

## 측정 함정 — 실제로 빠졌던 것

1. **뷰포트 에뮬레이션은 턴이 바뀌면 풀린다.** 재측정이 데스크톱 폭에서 돌아 전부 0 이 나왔다. 결과에 `w${innerWidth}` 를 항상 찍고, 측정 배치 첫 동작으로 `resize_window` 를 다시 건다.
2. **부모 한 칸만 보고 '스크롤 안이니 제외'하면 양쪽으로 틀린다.** 표 안 `thead/tr` 은 부모가 `table` 이라 거짓 양성(369px·295px)이 되고, `overflow:hidden` 조상이 자른 글자는 0 으로 숨는다. 조상 전부를 보고, 숨김 조상은 '잘림'으로 따로 센다.
3. **`overflowX:auto` 래퍼가 있어도 표에 최소 폭이 없으면 스크롤 대신 눌린다.** Fed Watch 스트레스 테스터·주간 리포트가 이 모양이었다(코인 랩 표는 `minWidth:640` 이 있어 멀쩡했다). 표를 래퍼로 감쌀 땐 `minWidth` 를 같이 준다.
4. **인쇄·PDF 용 HTML 문자열과 화면 JSX 는 다른 코드다.** 주간 리포트는 `<style>` 블록(PDF)을 고쳤는데 화면은 별도 JSX 표라 그대로였다. 고친 뒤 **배포본에서 다시 재야** 드러난다.
5. **같은 패턴의 이웃을 같이 본다.** 분석 화면 분류 배지는 린치 표에만 `nowrap` 이 있고 바로 아래 리밸런싱 표엔 없었다(8월에 한쪽만 고쳤다).
6. **큰 결함이 작은 결함을 가린다.** 리서치 탭 6건을 고치자 그 아래 2단 격자(`1fr 280px`, 왼쪽 칸 45px)의 세로 종목명이 드러났다. 고친 뒤 한 번 더 돈다.

## 도구 쪽 메모

- **붙여 넣을 때 문장 끝에 세미콜론을 둬라.** 다음 줄이 `(` 로 시작하면 앞 줄의 함수 호출로 붙는다 — `window.__probe('#x')` 다음 줄 `({ bad, back })` 가 `__probe(...)({…})` 로 읽혀 'Cannot access before initialization' 이 났다.
- `javascript_tool` 은 45초에서 끊긴다 — 탭 7초 대기 기준 한 호출에 탭 4~5개까지.
- `browser_batch` 는 한 번에 **25동작**까지. 화면이 많으면 `tabs_create` 로 탭 2~3개를 열어 병렬로(새 탭은 `navigate` 먼저 — 빈 탭에 `resize_window` 는 실패한다).
- 학생 종목 화면은 보유 종목이 아니면 `?m=KR` 처럼 시장을 줘야 열린다.
- 로그인은 사용자가 한다(비밀번호 입력 금지). 세션은 자주 풀린다 — `location.pathname === '/login'` 이면 멈추고 요청.
- 고칠 때 자주 쓴 처방: 격자 `repeat(auto-fit, minmax(min(100%, Npx), 1fr))` · 기존 `.m-1col`(≤900px 1단) · 라벨 `whiteSpace:nowrap` · 행 `flexWrap:'wrap'` · 표 `minWidth` · 탭 바 `overflowX:'auto'` + 버튼 `flexShrink:0`.
- ⛔ 고칠 때 JSX 주석을 `return (` 괄호나 삼항식 괄호 **안쪽**(표현식 위치)에 넣지 마라 — 오늘 두 번 파싱 에러를 냈다. style 객체 안 JS 주석으로.

## 2026-10-04 보강 — 820 폭 · 페이지 이동 · 잘림 판정

- **820 을 꼭 재라.** 768 은 모바일 분기(`m-*` · 하단 탭)가 켜져 본문이 736px 인데, 769~900 은 왼쪽 메뉴가 남아 본문이 **500px** 이고 모바일 분기도 꺼져 있다. 10/4 결함 7건 중 6건이 820 에서만 나왔다.
- **768 은 768.4 일 수 있다**(화면 배율 1.11). `innerWidth` 는 768 로 반올림돼 같아 보인다 — `matchMedia('not all and (min-width: 769px)').matches` 를 함께 찍어라(결과 문자열의 `mqM/mqD`).
- **잘림(C) 판정은 '조상이 실제로 자르는가'로.** 숨김 조상을 만나도 그 조상의 오른쪽 끝이 요소보다 바깥이면 자른 게 아니다 — 가로 스크롤 표 안에서 화면 밖으로 나간 진행 바·SVG 가 조상 숨김 상자 덕에 '잘림'으로 수십 건 잡혔다(테마·섹터 17탭 전부 거짓 양성).
- **전체 페이지 이동(`navigate`)마다 `window` 함수가 사라진다** — 탐지기 문자열을 `localStorage.__P` 에 한 번 넣고 각 화면에서 `eval(localStorage.getItem('__P'))` 로 부르면 배치당 12화면까지 돈다.
- **결과가 전부 0 이면 탐지기를 먼저 의심하라** — 화면에 3열 60px 격자·1400px 상자를 심어 `over1 vert3` 이 나오는지 보고 지운다.

## 2026-10-04 보강 2 — 하위 탭 자동 순회

- 같은 부모 아래 **버튼이 3개 이상(자식의 70%↑)** 이면 탭 묶음으로 보고 하나씩 눌러 탐지기를 돌린다. 동작어(저장·삭제·매수·매도·추가·수정·로그아웃·확인·취소·공유·다운로드…)가 든 버튼·폼 안 버튼은 제외, 관리자 화면은 돌리지 않는다.
- **버튼은 요소가 아니라 글자로 들고 다녀라** — 누를 때마다 목록을 다시 그리는 화면(구루 포트폴리오)은 잡아 둔 요소가 사라진다. 누르기 직전에 글자로 다시 찾고, 로딩 중엔 버튼이 잠깐 없어지니 몇 번 기다린다.
- 한 호출 45초 제한 — 큐를 `window` 에 두고 34초마다 끊어 이어 부른다. 앞 탭 콘텐츠 안에 있던 묶음은 탭을 바꾸면 사라진다('gone') — 한 단계 깊이만 본다.
- **브라우저 창이 닫혔다 열리면 로그인과 `localStorage.__P` 가 함께 사라진다** — 결과가 `null` 이면 탐지기부터 다시 넣어라.
- Tailwind `md:`/`sm:` 은 화면 폭 기준이라 **왼쪽 메뉴 폭을 모른다** — 3열 이상 전환은 `lg:` 로.
