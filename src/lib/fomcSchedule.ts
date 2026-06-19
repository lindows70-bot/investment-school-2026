// FOMC 회의 일정 SSOT — fedwatch(금리확률)·fomc-decoder(회의해석) 공용. 연 1회 수동 갱신
//  출처: FRB https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
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
]
