// 한국부동산원 R-ONE 오픈API 공용 fetcher(서버 전용, R_ONE_API_KEY)
// ⚠️ 시도 CLS 코드는 통계표마다 다름(가격 서울=500008 vs 거래량 서울=500002 — 2026-07-11 전수 실측). 테이블별 맵을 반드시 분리 사용.

export interface RoneRow { time: string; value: number; cls: string; clsId: string }

/** 통계표 데이터 조회 — CLS_ID(지역)·기간 필터. cycle 기본 MM(월), 주간 통계는 'WK'(WRTTIME=YYYYWW, 예 202628).
 *  clsId에 null을 주면 CLS 미필터(전 지역 행 — 스냅샷용, clsId 필드로 구분).
 *  ⚠️ itmId: 거래현황 테이블은 월별로 '동(호)수'(100001)와 '면적'(100002) 두 행이 섞여 옴 — 미필터 시 면적이 호수를 덮어쓰는 오염(실측 발견) */
export async function roneSeries(statblId: string, clsId: string | number | null, start: string, end: string, itmId?: string, pSize = 300, cycle: 'MM' | 'WK' = 'MM'): Promise<RoneRow[]> {
  const key = process.env.R_ONE_API_KEY
  if (!key) return []
  try {
    const clsPart = clsId == null ? '' : `&CLS_ID=${clsId}`
    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${key}&Type=json&pIndex=1&pSize=${pSize}&STATBL_ID=${statblId}&DTACYCLE_CD=${cycle}${clsPart}&START_WRTTIME=${start}&END_WRTTIME=${end}`
    // ⚠️ no-store 필수 — 같은 기간 파라미터 URL을 Next Data Cache가 박제(새 달 발행 미반영, ecos.ts와 동일 함정)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    const rows = j?.SttsApiTblData?.[1]?.row ?? []
    return rows
      .filter((x: { ITM_ID?: number | string }) => itmId == null || String(x.ITM_ID) === itmId)
      .map((x: { WRTTIME_IDTFR_ID: string; DTA_VAL: number | string; CLS_NM: string; CLS_ID: number | string }) => ({
        time: String(x.WRTTIME_IDTFR_ID), value: typeof x.DTA_VAL === 'number' ? x.DTA_VAL : parseFloat(String(x.DTA_VAL)), cls: String(x.CLS_NM).trim(), clsId: String(x.CLS_ID),
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

/** 주택시장 소비심리지수(T232543129897499, 2011-07~, MM·ITM 10001) — CLS 실측 확정
 *  ⚠️ CLS_NM이 전부 '소계'라 지역명이 행에 없음 — 2011 지방강세·2025 수도권강세 두 국면 지문으로 배정 검증(착공·준공 CLS와 동일 기법) */
export const RONE_PSY_TBL = 'T232543129897499'
export const RONE_PSY_CLS: Record<string, number> = {
  전국: 50004, 수도권: 50005, 서울: 50006, 지방: 50008,
  인천: 50007, 부산: 50009, 대구: 50010, 광주: 50011, 대전: 50012, 울산: 50013, 세종: 50014,
  강원: 50015, 충북: 50016, 충남: 50017, 전북: 50018, 전남: 50019, 경북: 50020, 경남: 50021, 제주: 50022, 경기: 50023,
}

/** (주간) 아파트 매매가격지수 T244183132827305 — DTACYCLE_CD=WK·WRTTIME=YYYYWW(202628)·ITM 10001 '지수'·2026-06 재기준=100
 *  시도 CLS 실측(주간 테이블은 CLS_NM에 실제 지역명이 옴 — 소계 아님) */
export const RONE_WEEKLY_TBL = 'T244183132827305'
export const RONE_WEEKLY_CLS: Record<string, number> = {
  전국: 50001, 수도권: 50002, 서울: 50008, 경기: 50016, 부산: 50025, 세종: 50033, 인천: 50124, 대구: 50150,
  광주: 50159, 대전: 50165, 울산: 50171, 강원: 50177, 충북: 50185, 충남: 50194, 전북: 50207, 전남: 50216, 경북: 50223, 경남: 50237, 제주: 50250,
}

/** (월) 전세가격지수_아파트 A_2024_00053 (2003-11~, MM·ITM 100001) — 2026-07-17 지문 확정
 *  판별: 서울 2022-06→2023-07 낙폭 −19.1%(KB 서울 아파트 전세 −16.0%와 동일 구간·형태, 부동산원이 낙폭 크게 잡는 특성) vs 매매 00045 −10.7%
 *  ⚠️ CLS는 매매지수(RONE_PRICE_CLS)와 완전 동일 체계 실측(전국 500001·서울 500008·경기 500009…) — 그대로 재사용 */
export const RONE_JEONSE_TBL = 'A_2024_00053'

/** 아파트 전월세 전환율 A_2024_00157 (2011-01~, MM·ITM 100001, CLS_NM 실명) — 2026-07-17 실측
 *  ⚠️ 155=종합주택·156=시군구·158=단독주택 — 2021-06 저금리기 지문(아파트 4.95 < 종합 5.76 < 단독 7.01)으로 157=아파트 확정 */
export const RONE_CONV_TBL = 'A_2024_00157'
export const RONE_CONV_CLS: Record<string, number> = {
  전국: 500001, 수도권: 500002, 지방: 500003, 서울: 500006, 부산: 500007, 대구: 500008, 인천: 500009, 광주: 500010,
  대전: 500011, 울산: 500012, 세종: 500013, 경기: 500014, 강원: 500015, 충북: 500016, 충남: 500017, 전북: 500018,
  전남: 500019, 경북: 500020, 경남: 500021, 제주: 500022,
}

/** (월) 행정구역별 아파트매매거래현황 A_2024_00554 — 시도 CLS 코드(실측 — 가격 테이블과 다름!) */
export const RONE_VOL_TBL = 'A_2024_00554'
export const RONE_VOL_CLS: Record<string, number> = {
  전국: 500001, 서울: 500002, 부산: 500003, 대구: 500004, 인천: 500005, 광주: 500006, 대전: 500007, 울산: 500008,
  세종: 500009, 경기: 500010, 강원: 500011, 충북: 500012, 충남: 500013, 전북: 500014, 전남: 500015, 경북: 500016, 경남: 500017, 제주: 500019,
}
