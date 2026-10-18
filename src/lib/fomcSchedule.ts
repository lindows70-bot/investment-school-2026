// FOMC 회의 일정 SSOT — fedwatch(금리확률)·fomc-decoder(회의해석) 공용. 연 1회 수동 갱신
//  출처: FRB https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm (2027년 8회 · 2026-10-18 확인 — 각 회의일은 직전 회의에서 확정되는 잠정 일정)
//  ⚠️ 표가 비면 매크로 스크리너가 금리 방향을 '동결'로 거짓 표시하고 디코더가 이후 뉴스를 마지막 회의 것으로 라벨링한다 —
//     scripts/verify-fomc-schedule.mjs(야간 불변식)가 '앞으로 남은 회의 2개 미만'이면 빨강을 띄운다. 그때 다음 해를 적는다.
export interface FomcMeeting {
  label: string
  month: number
  year:  number
  date:  string   // YYYY-MM-DD (성명서 발표일)
}

export const FOMC_SCHEDULE: FomcMeeting[] = [
  { label: "Jun '26", month: 6,  year: 2026, date: '2026-06-17' },
  { label: "Jul '26", month: 7,  year: 2026, date: '2026-07-29' },
  { label: "Sep '26", month: 9,  year: 2026, date: '2026-09-16' },
  { label: "Oct '26", month: 10, year: 2026, date: '2026-10-28' },
  { label: "Dec '26", month: 12, year: 2026, date: '2026-12-09' },
  { label: "Jan '27", month: 1,  year: 2027, date: '2027-01-27' },
  { label: "Mar '27", month: 3,  year: 2027, date: '2027-03-17' },
  { label: "Apr '27", month: 4,  year: 2027, date: '2027-04-28' },
  { label: "Jun '27", month: 6,  year: 2027, date: '2027-06-09' },
  { label: "Jul '27", month: 7,  year: 2027, date: '2027-07-28' },
  { label: "Sep '27", month: 9,  year: 2027, date: '2027-09-15' },
  { label: "Oct '27", month: 10, year: 2027, date: '2027-10-27' },
  { label: "Dec '27", month: 12, year: 2027, date: '2027-12-08' },
]
