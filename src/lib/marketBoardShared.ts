// 시장 탭 원천 공통 — 원천별 결과 모양(성공/못 가져옴)·숫자 읽기·점 줄이기·외부 GET(no-store+타임아웃)
//   ⚠️ 실패는 throw 하지 않고 { ok:false } 로 돌려준다 — 화면이 '없음'(ok 인데 빈 목록)과 '못 가져옴'(ok:false)을 가를 수 있게.

/** 원천 하나의 결과. asOf = 원천이 준 기준 시각(없으면 null — 지어내지 않는다) */
export type Part<T> =
  | { ok: true; data: T; asOf: string | null; source: string }
  | { ok: false; reason: string; source: string }

export const okPart = <T>(data: T, asOf: string | null, source: string): Part<T> => ({ ok: true, data, asOf, source })
export const failPart = <T>(reason: string, source: string): Part<T> => ({ ok: false, reason, source })

/** '1,234.5' · '+3,189' · '0.90%' · 숫자 → number. 못 읽으면 null(0 으로 메우지 않는다) */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.replace(/[,%\s]/g, '').replace(/^\+/, '')
  if (s === '' || s === '-' || /^N\/A$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 네이버 등락 코드(1 상한·2 상승·3 보합·4 하한·5 하락)로 부호를 붙인다 — 원천 값이 절댓값으로 올 때가 있어서.
 *  코드가 없거나 모르는 값이면 원천 값의 부호를 그대로 쓴다 */
export function signByCode(value: number | null, code: unknown): number | null {
  if (value == null) return null
  const c = typeof code === 'string' ? code : typeof code === 'number' ? String(code) : ''
  if (c === '1' || c === '2') return Math.abs(value)
  if (c === '4' || c === '5') return -Math.abs(value)
  if (c === '3') return 0
  return value
}

/** 시계열을 max 개 이하로 줄인다 — 일정 간격으로 고르고 마지막 점(지금 값)은 반드시 남긴다 */
export function downsample<T>(arr: T[], max: number): T[] {
  if (max < 2 || arr.length <= max) return arr.slice()
  const step = Math.ceil(arr.length / (max - 1))
  const out: T[] = []
  for (let i = 0; i < arr.length - 1; i += step) out.push(arr[i])
  out.push(arr[arr.length - 1])
  return out
}

/** 'YYYYMMDDHHmmss' 또는 'YYYYMMDD'(KST) → ISO(+09:00). 못 읽으면 null */
export function kstCompactToIso(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, se] = m
  if (h == null) return `${y}-${mo}-${d}`
  return `${y}-${mo}-${d}T${h}:${mi}:${se ?? '00'}+09:00`
}

/** 'YYYY-MM-DD' 에 days 를 더한다(달력 산술만) */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
/** 'YYYY-MM-DD' 에 months 를 더한다(말일 넘침은 JS Date 규칙 — 3/31 −1달 = 3/3) */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10)
}

export const kstYmd = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)

/** 값 목록의 최고·최저 — 같은 값이면 **가장 최근 날짜**(rows 는 날짜 오름차순이어야 한다) */
export function highLow(rows: { date: string; v: number }[]): { high: { v: number; date: string }; low: { v: number; date: string } } | null {
  if (!rows.length) return null
  let hi = rows[0], lo = rows[0]
  for (const r of rows) {
    if (r.v >= hi.v) hi = r   // >= : 같은 값이면 뒤(최근) 것으로 바꾼다
    if (r.v <= lo.v) lo = r
  }
  return { high: { v: hi.v, date: hi.date }, low: { v: lo.v, date: lo.date } }
}

export const NAVER_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://m.stock.naver.com/',
}

/** 외부 JSON GET — Next Data Cache 박제 방지(no-store) + 타임아웃. 실패 사유를 문자열로 돌려준다 */
export async function getJson(url: string, opts?: { headers?: HeadersInit; timeoutMs?: number }):
  Promise<{ ok: true; json: unknown } | { ok: false; reason: string }> {
  try {
    const r = await fetch(url, {
      headers: opts?.headers ?? NAVER_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 8000),
    })
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` }
    return { ok: true, json: await r.json() }
  } catch (e) {
    return { ok: false, reason: (e as Error)?.name === 'TimeoutError' ? '시간 초과' : `연결 실패(${(e as Error)?.message ?? 'unknown'})` }
  }
}

/** 한국 장이 도는 시간(평일 08:00~20:10 KST — NXT 애프터마켓 20:00 + 여유)이면 짧게, 아니면 길게 캐시한다.
 *  휴장일(추석 등)은 평일이어도 짧게 잡힌다 — 값이 안 바뀌니 틀린 값이 되지는 않고 호출만 조금 는다 */
export function krSessionTtlMs(nowMs: number, shortMs: number, longMs: number): number {
  const k = new Date(nowMs + 9 * 3600_000)
  const dow = k.getUTCDay()
  const hm = k.getUTCHours() * 60 + k.getUTCMinutes()
  const open = dow >= 1 && dow <= 5 && hm >= 8 * 60 && hm <= 20 * 60 + 10
  return open ? shortMs : longMs
}

/** 미국 정규장(평일 09:30~16:00 뉴욕 시각)이면 짧게, 아니면 길게. 미국 휴장일은 평일이면 짧게 잡힌다(값은 안 틀린다) */
export function usSessionTtlMs(nowMs: number, shortMs: number, longMs: number): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(nowMs))
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const wd = get('weekday'); const hm = Number(get('hour')) % 24 * 60 + Number(get('minute'))
    const open = !['Sat', 'Sun'].includes(wd) && hm >= 9 * 60 + 25 && hm <= 16 * 60 + 10
    return open ? shortMs : longMs
  } catch { return shortMs }
}

/** 응답 객체에서 { ok:false } 인 원천의 경로를 모은다('movers.KOSPI.up' 등) — 부분 실패 판정·화면 안내에 쓴다 */
export function collectFailed(v: unknown, path = ''): string[] {
  if (!v || typeof v !== 'object') return []
  if (Array.isArray(v)) return []
  const o = v as Record<string, unknown>
  if (o.ok === false && typeof o.source === 'string') return [path || '(root)']
  if (o.ok === true && typeof o.source === 'string') return []
  return Object.entries(o).flatMap(([k, x]) => collectFailed(x, path ? `${path}.${k}` : k))
}
