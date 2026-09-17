---
name: backtest-autopsy
description: Use when a backtest, screener, or signal shows a promising edge/win-rate and you are about to act on it — runs the 4-stage data-snooping autopsy (종목 분산·최다 점유율·시점 분산·이상치 제거) that has already killed several fake edges in this project. Invoke before adding any signal to scoring, recommendations, or the screener.
---

# 백테스트 해부 4단계 (가짜 엣지 부검)

**전제: 좋아 보이는 결과는 기본적으로 가짜다.** "edge +33%p, 승률 76%"가 실제로는 7종목·한 종목 49% 점유의 착시였다. 통과시키는 절차가 아니라 **기각시키는 절차**다.

## 0. 백테스트를 짤 때 (측정 전에)

- **룩어헤드 금지.** 봉 `i` 판정은 `data.slice(0, i+1)` 만 넘기고, 판정 함수 안에서 `data[i+1]` 이 닿을 여지가 없는지 본다.
- **baseline 과 비교.** 같은 유니버스 **전 봉**의 전방수익을 baseline 으로 두고 초과분(edge)만 본다. 상승장에선 아무 신호나 승률 55%다.
- **필드명은 실측.** `firedBarsAgo`·`lagAbove` 같은 **없는 필드**가 조용히 `undefined` 가 되어 신호 0건/전건이 됐다. 판정 코드 전에 객체 하나를 덤프해 키를 본다.
- **전방 구간은 둘 이상.** 엘리펀트 바는 10봉 +0.13 / 20봉 +1.89 — 하나만 봤으면 반대 결론.
- 판정 로직은 `src/lib/techSignals.ts` 를 tsc 로 컴파일해 쓴다(`scripts/backtest-swing.mjs` 방식). **재구현 금지.**

## 1~4단계 — 계산은 스크립트가 한다

```bash
node scripts/autopsy.mjs <rows.json> [--baseline base.json] [--h 10]
```

행 모양 `{ ticker, market, ym:'YYYY-MM', regime?, ret:{[h]:pct} }` · baseline `{ KR:{[h]:pct[]}, US:{...} }`. 종료코드 0 = 4관문 통과, 2 = 기각.
`backtest-swing.mjs` 는 이 함수를 직접 import 해 트랙마다 같은 판정을 찍는다 — 하네스와 스킬이 **같은 코드**다.

| 관문 | 기준 | 기각 전례 |
|---|---|---|
| ① 종목 분산 | <10종 기각 | A+E 조합 edge +33%p 가 7종목 |
| ② 최다 종목 점유 | >30% 기각 | `006800` 49% · `SPGI` 35% |
| ③ 시점 분산 | 최다 분기 >50% ⚠️ 경고 + 레짐(50일선 방향)별 성적 병기 | 정예 타점 "상승장 +2.15 / 중립 −0.7 / 하락 미발생" → 배지에 **상승 국면 전용** 명시 |
| ④ 절사 edge | 상하위 10% 잘라도 >0.1%p 남아야 | 매도 후보 3종이 0.02~0.09 로 증발 — **가장 많이 죽는 관문** |

숫자를 손으로 다시 세지 마라. 임계값의 출처·변경은 `scripts/autopsy.mjs` 머리 주석에서만 관리한다.

## 결론 쓰기 — 판단은 여기서 한다

1. **음수·반증도 남긴다.** FVG(−1.42)·ADX≥25(−0.26)는 역효과였고 `SCREEN_SETUPS` 에 그대로 있다 — "우리 표본에선 안 통했다"가 교육 자료다.
2. **없으면 없다고 한다.** 3종 전부 기각됐을 때 억지로 만들지 않고 "이 표본에는 없다"로 끝냈다.
3. **한계를 수치와 병기한다.** 표본 기간·거래비용 미반영·N기법 중 선택이라는 과최적화 여지 — UI 배지의 `note` 에도.

## 통과했다면 — 앱 반영

- ⛔ **WHAT/WHEN 분리**: 기술 신호는 6축 점수·종목 선정에 절대 넣지 않는다. 배지·근거·타이밍으로만.
- 성적은 `SCREEN_SETUPS` 의 `edge20`·`winRate`·`sample`·`note` 에. 코드에 숫자를 흩뿌리지 않는다.
- 판정이 바뀌었으면 **캐시 키를 올린다**(`deploy-verify` 2절).
