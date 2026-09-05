// 🖥️ 선생님 PC 로컬 러너 SSOT — Vercel 이 못 가져오는 데이터를 작업 스케줄러가 수집해 app_cache 에 넣는다.
//
// 왜 PC 에서 도나:
//   · FactSet 선행 PER — FactSet CDN 이 데이터센터 IP 를 차단(추정)해 Vercel 서버에서 직접 못 받는다.
//   · KRX 공매도       — KRX_ID/KRX_PW 가 필요한데 그 계정은 `.env.local` 전용이다(Vercel 등록 금지 — 절대 원칙).
//
// ⚠️ 2026-09-05 실사고: 두 러너가 **두 달간 한 번도 성공하지 못했는데 아무도 몰랐다.**
//    작업 스케줄러 인자가 `cmd /c "\"C:\Program Files\nodejs\node.exe\" ..."` 처럼 과잉 이스케이프돼
//    cmd 가 경로를 명령으로 못 읽었고(로그엔 그 에러만 44회), 스크립트 자체는 멀쩡했다.
//    그런데 `/api/cron-health` 는 **Vercel 크론 18개만** 감시하고 PC 러너는 목록에 없어서 초록불이었다.
//    → 그래서 이 두 키를 헬스 모니터에 넣었다(`cronHealth.ts`). 산출물 나이로 죽음을 감지한다.
//
// ⛔ 자동 복구(heal)는 불가능하다 — 서버가 선생님 PC 의 작업 스케줄러를 부를 수 없다.
//    헬스는 **보고만** 한다(`heal: null`). 브리핑 상단 경보를 보고 사람이 PC 를 확인해야 한다.
//
// ⚠️ 러너는 .mjs/.py 라 이 TS 상수를 import 하지 못한다 — 키 문자열이 러너 쪽에도 한 벌 있다.
//    키를 바꾸면 **반드시 세 곳을 함께** 고쳐라:
//      ① 여기  ② scripts/factset-forward.mjs  ③ scripts/krx-short-runner.py

/** S&P500 선행 12개월 PER (FactSet Earnings Insight PDF 파싱) — 주 1회(토 21:00 KST) 적재 */
export const FACTSET_FWD_KEY = 'factset-forward-pe'

/** KRX 공매도 — 시장 Top + 학생 보유 KR 종목 60일 추이·잔고 — 매일 20:00 KST 적재 */
export const KRX_SHORT_KEY = 'krx-short-daily'
