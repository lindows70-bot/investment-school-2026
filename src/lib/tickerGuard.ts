// 종목 코드·시장·이름 입력 검사 SSOT — 아무 문자열이나 캐시 키·AI 프롬프트로 들어가 DB 행이 끝없이 쌓이는 것을 막는다
//
//   왜(2026-10-05 보안 점검): 리서치 리포트·거장 위원회·실적 요약이 검사 없는 ticker 로 캐시 행을 만들고 Gemini 를 불렀다.
//   반복 호출이면 Gemini 한도 소진 + app_cache 가 2026-09-26 처럼 DB 500 MB 를 넘길 수 있었다.
//   허용 모양: 미국 'AAPL'·'BRK-B'·'BRK.B'·'0700.HK', 한국 '005930'·'0091P0'(영문·숫자로 시작, 영문·숫자·점·하이픈 15자 이내).

const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

/** 대문자로 정리한 티커, 모양이 아니면 null */
export function cleanTicker(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().toUpperCase()
  return TICKER_RE.test(t) ? t : null
}

/** 주식 시장 코드 — 'US' · 'KR' 만 */
export function cleanMarket(raw: string | null | undefined): 'US' | 'KR' | null {
  const m = String(raw ?? 'US').trim().toUpperCase()
  return m === 'US' || m === 'KR' ? m : null
}

/** 화면이 넘겨준 종목 이름 — AI 프롬프트에 들어가므로 길이를 자르고 꺾쇠·제어문자를 뺀다(없으면 fallback) */
export function cleanName(raw: string | null | undefined, fallback: string): string {
  // eslint-disable-next-line no-control-regex
  const s = String(raw ?? '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 60)
  return s || fallback
}
