# 🔍 Codex 리뷰 요청서 — 린치 판정 로직 묶음(2026-10-01 ~ 10-04)

> **언제**: Codex 쿨다운이 풀린 뒤(`.audit/codex-cooldown.json` · 2026-10-03 기준 `Oct 11th, 2026 11:01 PM`). `.audit/latest.md` 배너가 ⏳ 가 아닌지 먼저 본다.
> **왜 따로 보내나**: 9/30 이후 커밋이 108건이다. 야간 감사는 한도 배려로 **최신 12건만** 보내므로(`REVIEW_CAP`), 아래 판정 로직 커밋 23건 대부분이 '미리뷰'로 남는다. 브랜치 통째 리뷰(`review --scope branch`)는 9/5·9/13 처럼 월 한도를 다시 태운다.
> **어떻게**: diff 를 보내지 않고, Codex 가 **지정한 파일을 직접 읽는 읽기 전용 task** 로 보낸다(아래 명령). 결과는 **재현으로 확인한 뒤에만** 채택한다(CLAUDE.md — 다른 에이전트도 틀린다).

```powershell
$c = 'C:/Users/lindo/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs'
node $c task --effort high (Get-Content -Raw docs/reviews/2026-10-11-codex-judgment-logic.prompt.md)
```

`--write` 는 주지 않는다(읽기 전용). 답이 오면 이 문서 아래 '결과' 절에 P1/P2 와 재현 여부를 적는다.

## 리뷰 대상 — 무엇이 바뀌었나

| 묶음 | 파일 · 함수 | 바뀐 것 | 커밋 |
|---|---|---|---|
| ① 적정가 SSOT | `src/lib/lynchAnalysis.ts` `lynchFairValue` | 세 화면이 따로 쓰던 EPS·배수표를 한 함수로 · 이익 급증이면 분류 기본 배수 · 경기순환주 정점(`peak`) · 이유 문장 `holdNote`(급증 우선) / `peakNote`(정점 전용) | db0daf83 · 58e2bfb6 · 9aeffd7e |
| ② 급증 가드 SSOT | `src/lib/pegBaseEffect.ts` | `isPegBaseEffect(peg<0.3 & growth>100%)` · 라벨 | 55a121c4 |
| ③ 결산 EPS 최고치 | `src/lib/fyEps.ts` · `src/app/api/stock-info/route.ts` | 재무 API 격자에서 확정 연도(E 제외 · 0=자료 없음 제외 · 적자 포함 · 3개 미만 null) · app_cache 7일 · KR 은 못 받으면 네이버 3년 폴백 · US 신설 | 1820835d |
| ④ 재무 API 과거 연도 | `src/app/api/financials/route.ts` | DART 직전 해 기준 · 옛 보고서 EPS 체인 비율 · 네이버 우선 + DART 는 빈 해만 중위 비율(`kMed`·편차 15%)로 환산 · 계정 매칭 정규식 · US `fundamentalsTimeSeries` 폴백 | de67d8c4 · 49a2dcb8 · fd2c2b3b · 9d3fb1b1 · 02a8345a · 7f183ec8 |
| ⑤ 국내 PER·EPS·PBR 기준 | `src/app/api/stock-info/route.ts` · `src/lib/naverIntegration.ts` | 직전 결산 행 → 최근 4분기(TTM) · `peBasis`·`epsBasis` | d92bd704 · 1ed7f383 |
| ⑥ 가치 축 정점 가드 | `src/lib/macroPhaseScreener.ts` `screenOne` · `src/lib/axisSnapshot.ts` | 싸 보이는 경기순환주만 `/api/stock-info` 자기 호출 → `lynchFairValue().peak` → PEG·이익수익률·린치 점수 중립 · `pegPeak`/`peakNote` 를 유니버스에 실음 | af7c251e · 9aeffd7e |
| ⑦ 종합 판정 | `src/app/api/research-verdict/route.ts` | 유니버스 플래그 읽기 · 정점이면 '매수 적합' 결격(점수 그대로) · 유니버스 밖 경기순환주는 같은 함수로 직접 판정 · 분류 고정표 먼저 · `?refresh=1` | 0b5e88c2 · 8680a39d · (이 요청서와 같은 커밋) |
| ⑧ 트레이서 현재 EPS | `src/app/api/lynch-earnings-tracer/route.ts` | 결산 EPS → 종목 정보 TTM · 캐시 v2 | e00e824a |
| ⑨ 스마트머니 소급 감시 | `src/lib/usSmartHistory.ts` · `scripts/verify-usm-no-backdate.mjs` | 적립일 `addedAt` · 감시를 적립일 기준으로(전엔 캐시 갱신일 기준이라 거짓 빨강) | 89c0af24 |
| ⑩ 단단한 손 현금 축 (10-04 추가) | `src/lib/firmHands.ts` `moneyAxis` · `buildAction` | 현금 0 = 미등록(현금 카드 `CashPositionCard` 와 같은 기준) · 미등록이면 행동 문장이 '실탄 보유'를 전제하지 않음 | d0af4ef3 |
| ⑪ 조회 실패 ≠ 보유 0 (10-04 추가) | `src/app/assets/page.tsx` · `src/app/dashboard/page.tsx` · API 7곳(`day-movers`·`cash-position`·`event-calendar`·`fx-attribution`·`timing-watch`·`news-catalyst`·`firm-hands`) · 리밸런싱 위젯 | investments 조회 오류를 빈 목록으로 계산하지 않고 실패 상태/500 · 시세 0건이면 리밸런싱 위젯 숨김 | 626db111 · 13c7051e |
| ⑫ 신선도 배지 '현재 최신' (10-04 추가) | `src/lib/dataFreshness.ts` `freshness` | 통상 지연 이내(fresh)면 'YYYY-MM 데이터 · 현재 최신', 밀리면 'N개월 전' | 2ebe9391 |

## 내가 확신하지 못하는 곳 — 질문

1. **회계연도 이름표 어긋남(③)** — US 는 `fundamentalsTimeSeries` 의 회계연도 **종료 연도**를 연도 키로 쓴다(NVDA FY2025 = 2025-01 종료 → '2025'). 정점 판정은 TTM EPS 와 이 '결산 최고치'를 비교한다. 회계연도가 1월에 끝나는 종목에서 TTM 이 사실상 같은 기간을 다시 세어 정점이 잘못 켜지거나 꺼질 수 있는가?
2. **정점 판정의 EPS 와 적정가 EPS 가 다르다(①)** — `peak` 는 `rawEps > fy.max` 로 원값을 쓰고, 적정가는 `sanitizeEps` 를 거친 값을 쓴다. 이상값 보정이 걸리는 종목에서 두 결론이 서로 모순될 수 있는가?
3. **사전 필터가 판정 범위를 바꾼다(⑥)** — 스크리너는 PEG 점수 > 0.5 또는 이익수익률 점수 > 0.45 인 경기순환주만 정점을 본다. 국내 종목은 야후 `trailingPE` 가 없어(실측 6종 전부) 이익수익률 점수가 늘 0.4 이고, 야후 `pegRatio` 가 없으면 PEG 점수도 0.4 → **판정 자체를 안 한다**. 실측: LS ELECTRIC(010120)은 정점인데 `pegPeak:false`(가치 축 19 라 모순은 없음). 이 필터가 '비싸 보이니 바꿀 값 없음'이라는 의도대로만 작동하는가, 아니면 싸 보이는 국내 정점 종목을 놓치는 경로가 있는가?
4. **DART 환산(④)** — 네이버와 DART 가 겹치는 해들의 비율 중위값(`kMed`)으로 빈 해를 환산하고, 비율 편차가 15% 를 넘으면 빈 칸으로 둔다. 겹치는 해가 1~2개뿐일 때 중위값이 우연에 기대는가? 액면분할이 겹치는 기간 **안에서** 일어나면?
5. **급증·정점 순서(①⑦)** — 둘 다 걸리면 `holdNote` 는 급증 문장, `peakNote` 는 정점 문장. 종합 판정 cons 는 둘 다 싣는다. 배수는 급증 쪽(분류 기본값)으로 정한다. 이 순서가 어느 화면에서 서로 다른 말을 하게 만드는 경우가 있는가?
6. **자기 호출(③⑥⑦)** — `/api/stock-info` → `/api/financials`, 스크리너 → `/api/stock-info`, 종합 판정 → `/api/stock-info`. 순환은 없다(재무 API 는 아무것도 부르지 않는다). 콜드 캐시에서 스크리너(동시성 8 · maxDuration 300초)가 종목 정보를 다수 부를 때 타임아웃이 결과를 조용히 바꾸는 경로가 있는가(실패 = 가드 없음으로 떨어진다)?
7. **결격 게이트(⑦)** — 정점이면 점수는 그대로 두고 판정만 '조건부·신중'. 통합추천은 같은 종목을 점수 순위로 올린다(배지만 경고). 두 화면이 같은 종목을 '추천 상위' vs '매수 적합 아님'으로 동시에 말하는 것이 학생에게 모순으로 읽히는가 — 설계로서 맞는가?
8. **'현재 최신'은 원천을 보지 않은 주장이다(⑫)** — fresh 는 `lagMonths <= typicalLagM` 만 본다. 원천이 새 달을 낸 직후 앱 캐시가 아직 옛 달이면 그 사이 한 달 전 값에 '현재 최신'이 붙는다(예: CLI 9월치 10월 중순 발표). 이 창이 실제로 얼마나 되는지(각 통계를 부르는 캐시 TTL), 그리고 '현재 최신' 대신 다른 표현이 맞는지.
9. **현금 0 = 미등록(⑩)** — 현금을 정말 0원으로 등록한 학생도 '미등록'이 된다(카드와 같은 기준이라 일관성은 있음). `updatedAt`(행 존재)로 가르는 게 맞는가? 그러면 현금 카드의 `has` 기준도 같이 바꿔야 한다.

## 결과

_(쿨다운 뒤 기록 — P1/P2 · 재현 여부 · 채택/기각과 이유)_
