// 한국부동산원 R-ONE 오픈API 공용 fetcher(서버 전용, R_ONE_API_KEY)
// ⚠️ 시도 CLS 코드는 통계표마다 다름(가격 서울=500008 vs 거래량 서울=500002 — 2026-07-11 전수 실측). 테이블별 맵을 반드시 분리 사용.

export interface RoneRow { time: string; value: number; cls: string }

/** 통계표 데이터 조회 — CLS_ID(지역)·기간 필터. DTACYCLE_CD=MM(월).
 *  ⚠️ itmId: 거래현황 테이블은 월별로 '동(호)수'(100001)와 '면적'(100002) 두 행이 섞여 옴 — 미필터 시 면적이 호수를 덮어쓰는 오염(실측 발견) */
export async function roneSeries(statblId: string, clsId: string | number, start: string, end: string, itmId?: string, pSize = 300): Promise<RoneRow[]> {
  const key = process.env.R_ONE_API_KEY
  if (!key) return []
  try {
    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${key}&Type=json&pIndex=1&pSize=${pSize}&STATBL_ID=${statblId}&DTACYCLE_CD=MM&CLS_ID=${clsId}&START_WRTTIME=${start}&END_WRTTIME=${end}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return []
    const j = await r.json()
    const rows = j?.SttsApiTblData?.[1]?.row ?? []
    return rows
      .filter((x: { ITM_ID?: number | string }) => itmId == null || String(x.ITM_ID) === itmId)
      .map((x: { WRTTIME_IDTFR_ID: string; DTA_VAL: number | string; CLS_NM: string }) => ({
        time: String(x.WRTTIME_IDTFR_ID), value: typeof x.DTA_VAL === 'number' ? x.DTA_VAL : parseFloat(String(x.DTA_VAL)), cls: String(x.CLS_NM).trim(),
      }))
      .filter((x: RoneRow) => isFinite(x.value))
      .sort((a: RoneRow, b: RoneRow) => a.time.localeCompare(b.time))
  } catch { return [] }
}

/** 거래현황 '동(호)수' 항목 ID(실측) */
export const RONE_VOL_ITM = '100001'

/** (월) 매매가격지수_아파트 A_2024_00045 — 시도 CLS 코드(실측) */
export const RONE_PRICE_TBL = 'A_2024_00045'
export const RONE_PRICE_CLS: Record<string, number> = {
  전국: 500001, 서울: 500008, 경기: 500009, 인천: 500010, 부산: 500011, 대구: 500012, 광주: 500013, 대전: 500014,
  울산: 500015, 세종: 500016, 강원: 500017, 충북: 500018, 충남: 500019, 전북: 500020, 전남: 500021, 경북: 500022, 경남: 500023, 제주: 500024,
}
/** 주택착공(T233033129823134)·주택준공(T237273130004614) — 시도 CLS 코드(2026-07-16 실측: 전국=시도합 검산·세종 2011 결측·대구 2021호황/2025침체 지문 일치)
 *  ⚠️ CLS_NM은 '총계/소계'뿐이라 지역명이 행에 없음 — 이 맵이 유일한 지역 식별자. ITM 10001(착공실적/사용검사실적) */
export const RONE_START_TBL = 'T233033129823134'
export const RONE_COMP_TBL = 'T237273130004614'
export const RONE_SUPPLY_ITM = '10001'
export const RONE_SUPPLY_CLS: Record<string, number> = {
  전국: 50019, 서울: 50046, 인천: 50073, 경기: 50100, 부산: 50127, 대구: 50154, 광주: 50181, 대전: 50208,
  울산: 50235, 세종: 50262, 강원: 50289, 충북: 50316, 충남: 50343, 전북: 50370, 전남: 50397, 경북: 50424, 경남: 50451, 제주: 50478,
}

/** (월) 행정구역별 아파트매매거래현황 A_2024_00554 — 시도 CLS 코드(실측 — 가격 테이블과 다름!) */
export const RONE_VOL_TBL = 'A_2024_00554'
export const RONE_VOL_CLS: Record<string, number> = {
  전국: 500001, 서울: 500002, 부산: 500003, 대구: 500004, 인천: 500005, 광주: 500006, 대전: 500007, 울산: 500008,
  세종: 500009, 경기: 500010, 강원: 500011, 충북: 500012, 충남: 500013, 전북: 500014, 전남: 500015, 경북: 500016, 경남: 500017, 제주: 500019,
}
