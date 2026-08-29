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

/** 이벤트 종류별 뉴스 쿼리 — [질의, 언어, 건수]. 회의는 성명서·점도표까지, 연설은 연설 자체를 판다. */
export const EVENT_QUERIES: Record<FedEventKind, [string, 'ko' | 'en', number][]> = {
  fomc: [
    ['FOMC statement rate decision when:14d', 'en', 8],
    ['Federal Reserve Chair press conference remarks when:14d', 'en', 7],
    ['Fed dot plot projections rate path when:21d', 'en', 5],
    ['FOMC 연준 기준금리 결정 기자회견 when:14d', 'ko', 7],
  ],
  jacksonhole: [
    ['Fed Chair Jackson Hole speech when:7d', 'en', 8],
    ['Jackson Hole symposium Fed inflation rate path when:7d', 'en', 7],
    ['Jackson Hole speech market reaction bonds when:7d', 'en', 5],
    ['잭슨홀 연준 의장 연설 when:7d', 'ko', 7],
  ],
  testimony: [
    ['Fed Chair congressional testimony when:7d', 'en', 8],
    ['Federal Reserve semiannual monetary policy report testimony when:7d', 'en', 7],
    ['연준 의장 의회 증언 when:7d', 'ko', 7],
  ],
}

/** 이 자리에서 금리가 결정되는가 — 연설·증언은 결정이 없다(가짜 결정 생성 방지). */
export const HAS_RATE_DECISION: Record<FedEventKind, boolean> = {
  fomc: true, jacksonhole: false, testimony: false,
}

/** 발언이 나온 자리의 이름 — 프롬프트·화면 문구 SSOT */
export const VENUE_KO: Record<FedEventKind, string> = {
  fomc: '기자회견', jacksonhole: '잭슨홀 기조연설', testimony: '의회 증언',
}
