// 🏛️ '연준 의장이 말하는 자리' SSOT — 정례 FOMC 외의 시장 이벤트(잭슨홀·의회증언)를 디코더 앵커로 쓴다
//
//  왜 별도 파일인가: `FOMC_SCHEDULE`(fomcSchedule.ts)은 **fedwatch 금리확률과 공유하는 SSOT** 라
//  거기에 비회의 이벤트를 섞으면 금리확률 계산의 '다음 회의'가 오염된다. 앵커만 확장한다.
//
//  ⚠️ 정적 참조 데이터(연 1회 수동 갱신) — 제1원칙의 예외이므로 **출처를 남긴다**.
//  출처: 캔자스시티 연은 잭슨홀 심포지엄. 2026년 회차는 08-27 개막, **의장 기조연설 08-28**
//        (실측 2026-08-29: Reuters "As Jackson Hole conference kicks off" 08-27 ·
//         PBS/WSJ/NBC 워시 연설 보도 pubDate 08-28T13~21Z 집중).
export type FedEventKind = 'fomc' | 'jacksonhole' | 'testimony'

export interface FedEvent {
  kind: FedEventKind
  label: string    // 카드 배지 — "잭슨홀 '26"
  date: string     // 의장이 말한 날(현지) YYYY-MM-DD
  title: string    // 카드 부제 — "잭슨홀 심포지엄 · 의장 기조연설"
}

/** FOMC 정례회의가 아닌 연준 이벤트. 날짜 오름차순 유지. */
export const FED_EVENTS: FedEvent[] = [
  { kind: 'jacksonhole', label: "잭슨홀 '26", date: '2026-08-28', title: '잭슨홀 심포지엄 · 의장 기조연설' },
]

/** 이벤트 종류별 뉴스 쿼리 — [질의(when: 없음), 언어, 건수].
 *
 *  ⛔ **`when:` 을 상수로 박지 마라.** 앵커 이벤트가 며칠 전이냐에 따라 창이 달라져야 한다.
 *     상수 `14d` 로 두었다가 31일 전 회의에 어젯밤 잭슨홀 기사가 붙었고(2026-08-29 실사고),
 *     `7d` 로 바꿔도 9/5 이후엔 잭슨홀 기사가 창 밖으로 나가 **같은 버그가 반대로 재발**한다.
 *     창은 `newsWindowDays(daysSince)` 가 앵커에서 역산한다. */
export const EVENT_QUERIES: Record<FedEventKind, [string, 'ko' | 'en', number][]> = {
  fomc: [
    ['FOMC statement rate decision', 'en', 8],
    ['Federal Reserve Chair press conference remarks', 'en', 7],
    ['Fed dot plot projections rate path', 'en', 5],
    ['FOMC 연준 기준금리 결정 기자회견', 'ko', 7],
  ],
  jacksonhole: [
    ['Fed Chair Jackson Hole speech', 'en', 8],
    ['Jackson Hole symposium Fed inflation rate path', 'en', 7],
    ['Jackson Hole speech market reaction bonds', 'en', 5],
    ['잭슨홀 연준 의장 연설', 'ko', 7],
  ],
  testimony: [
    ['Fed Chair congressional testimony', 'en', 8],
    ['Federal Reserve semiannual monetary policy report testimony', 'en', 7],
    ['연준 의장 의회 증언', 'ko', 7],
  ],
}

/** 뉴스 창(일) — **앵커 이벤트를 반드시 포함**하도록 경과일에서 역산(+2일 여유). 3~35일로 클램프. */
export const newsWindowDays = (daysSince: number) => Math.min(35, Math.max(3, daysSince + 2))

/** 이 이벤트를 실제로 다룬 기사인지 가리는 표식 — 없으면 그 자리의 해석이라고 말할 수 없다.
 *  fomc 는 회의가 그 날 확실히 열렸으므로 표식 검사를 하지 않는다(null). */
export const MUST_MATCH: Record<FedEventKind, RegExp | null> = {
  fomc: null,
  jacksonhole: /jackson hole|잭슨홀/i,
  testimony: /testimony|testif|의회 ?증언|증언/i,
}

/** 표식이 이 건수 미만이면 그 이벤트 해석을 포기하고 직전 FOMC 회의로 되돌린다. */
export const MIN_MATCHES = 2

/** 이 자리에서 금리가 결정되는가 — 연설·증언은 결정이 없다(가짜 결정 생성 방지). */
export const HAS_RATE_DECISION: Record<FedEventKind, boolean> = {
  fomc: true, jacksonhole: false, testimony: false,
}

/** 발언이 나온 자리의 이름 — 프롬프트·화면 문구 SSOT */
export const VENUE_KO: Record<FedEventKind, string> = {
  fomc: '기자회견', jacksonhole: '잭슨홀 기조연설', testimony: '의회 증언',
}
