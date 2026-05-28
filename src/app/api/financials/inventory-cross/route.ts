/**
 * GET /api/financials/inventory-cross
 *
 * 재고 vs 매출 데드크로스 센티넬 — 공식 API 연동
 *
 * [미국 주식]  Alpha Vantage API
 *   - INCOME_STATEMENT → quarterlyReports → totalRevenue
 *   - BALANCE_SHEET    → quarterlyReports → inventory
 *   - fiscalDateEnding 기준 매칭 → YoY 계산
 *
 * [한국 주식]  DART OpenAPI
 *   - corp_code 매핑 테이블 (내부 하드코딩)
 *   - fnlttSinglAcntAll.json: Q1/H1/9M/Annual 누적값 → 개별 분기 역산
 *   - account_nm '매출액' + '재고자산' 추출
 */

import { NextResponse }       from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies }            from 'next/headers';
import { getAssetType }       from '@/lib/assetClassifier';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────
export type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN';

interface QuarterPoint {
  quarter:      string;
  revenueYoY:   number;
  inventoryYoY: number;
  hasYoY:       boolean;
}

interface StockResult {
  ticker:            string;
  name:              string;
  market:            string;
  currency:          string;
  unitLabel:         string;
  signal:            CrossSignal;
  gap:               number;
  latestQuarter:     string;
  revenueYoY:        number;
  inventoryYoY:      number;
  consecutiveDanger: number;
  quarterlyHistory:  QuarterPoint[];
  lynchAlert:        string;
  dataSource:        string;
}

interface ExcludedItem { ticker: string; name: string; reason: string; }

// ──────────────────────────────────────────────────────────────
// 공통 유틸
// ──────────────────────────────────────────────────────────────

/** 문자열 또는 숫자 → 안전한 숫자 변환 */
function toNum(v: unknown): number {
  if (v === null || v === undefined || v === 'None' || v === '-') return 0;
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : Number(v);
  return isNaN(n) ? 0 : n;
}

/** Date → "YY-Q{n}" 분기 라벨 */
function toQuarterLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '?-Q?';
  const yy = String(d.getFullYear()).slice(-2);
  const m  = d.getMonth() + 1;
  const q  = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
  return `${yy}-${q}`;
}

/** YoY (%) 계산 */
function calcYoY(curr: number, prev: number): number | null {
  if (prev <= 0 || curr <= 0) return null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(1));
}

/** 시그널 판정 */
function getSignal(revYoY: number | null, invYoY: number | null): CrossSignal {
  if (revYoY === null || invYoY === null) return 'UNKNOWN';
  const gap = invYoY - revYoY;
  if (gap > 0)  return 'DANGER';
  if (gap > -5) return 'WARNING';
  return 'HEALTHY';
}

/** 연속 DANGER 분기 수 계산 */
function consecutiveDanger(history: QuarterPoint[]): number {
  let n = 0;
  for (const q of [...history].reverse()) {
    if (q.hasYoY && q.inventoryYoY > q.revenueYoY) n++;
    else break;
  }
  return n;
}

/** 린치 경보 메시지 */
function lynchMsg(signal: CrossSignal, name: string, gap: number, consec: number): string {
  const abs = Math.abs(gap).toFixed(1);
  if (signal === 'DANGER')
    return consec >= 2
      ? `"${name}의 재고가 매출보다 ${abs}%p 빠르게 쌓이는 상황이 ${consec}분기 연속. 린치는 2분기 연속 시 즉시 매도를 원칙으로 합니다."`
      : `"${name}의 재고 증가율이 매출을 ${abs}%p 앞질렀습니다. 다음 분기도 이어진다면 린치의 매도 신호입니다."`;
  if (signal === 'WARNING')
    return `"${name}는 아직 역전 전이지만 격차가 ${abs}%p로 좁혀졌습니다. 재고 동향을 집중 모니터링하세요."`;
  if (signal === 'HEALTHY')
    return `"${name}는 매출이 재고보다 건강하게 앞서고 있습니다. 린치가 선호하는 상태입니다."`;
  return `"${name}의 분기 재고·매출 데이터를 분석 중입니다."`;
}

// ──────────────────────────────────────────────────────────────
// ① 미국 주식 — Alpha Vantage API
// ──────────────────────────────────────────────────────────────

/**
 * Alpha Vantage INCOME_STATEMENT + BALANCE_SHEET 분기 데이터
 * 무료 티어: 25 calls/day, 5 calls/min
 *
 * INCOME_STATEMENT → quarterlyReports[].{ fiscalDateEnding, totalRevenue }
 * BALANCE_SHEET    → quarterlyReports[].{ fiscalDateEnding, inventory }
 */
async function fetchUSData(ticker: string): Promise<QuarterPoint[] | null> {
  const KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!KEY) {
    console.error('[AV] ALPHA_VANTAGE_API_KEY 미설정');
    return null;
  }

  const BASE = 'https://www.alphavantage.co/query';
  console.log(`[AV] ${ticker} 조회 시작`);

  try {
    // Income Statement + Balance Sheet 병렬 요청
    const [isRes, bsRes] = await Promise.allSettled([
      fetch(`${BASE}?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${KEY}`),
      fetch(`${BASE}?function=BALANCE_SHEET&symbol=${ticker}&apikey=${KEY}`),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let isData: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bsData: any = {};

    if (isRes.status === 'fulfilled' && isRes.value.ok) {
      isData = await isRes.value.json();
    } else {
      console.error(`[AV] ${ticker} Income Statement 요청 실패`);
    }
    if (bsRes.status === 'fulfilled' && bsRes.value.ok) {
      bsData = await bsRes.value.json();
    } else {
      console.error(`[AV] ${ticker} Balance Sheet 요청 실패`);
    }

    // Rate limit 감지
    if (isData?.Note || isData?.Information) {
      console.error(`[AV] ${ticker} Rate limit 감지:`, isData.Note ?? isData.Information);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isReports: any[] = isData?.quarterlyReports ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bsReports: any[] = bsData?.quarterlyReports ?? [];

    if (!isReports.length) {
      console.error(`[AV] ${ticker} quarterlyReports 없음 (심볼 오류 또는 API 제한)`);
      return null;
    }

    console.log(`[AV] ${ticker} IS=${isReports.length}분기 BS=${bsReports.length}분기`);

    // Balance Sheet를 날짜 기준 Map으로 변환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bsMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bsReports.forEach((r: any) => bsMap.set(r.fiscalDateEnding, r));

    // fiscalDateEnding 기준으로 매칭 — ±60일 허용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matched: { date: string; revenue: number; inventory: number }[] = isReports.map((is: any) => {
      const isDate = is.fiscalDateEnding;
      const isMs   = new Date(isDate).getTime();

      // 정확 매칭 우선, 없으면 ±60일 매칭
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bs: any = bsMap.get(isDate);
      if (!bs) {
        bsReports.forEach(b => {
          if (!bs && Math.abs(new Date(b.fiscalDateEnding).getTime() - isMs) < 60 * 86400_000) {
            bs = b;
          }
        });
      }

      const rev = toNum(is.totalRevenue);
      const inv = toNum(bs?.inventory ?? 0);
      console.log(`[AV] ${ticker} ${toQuarterLabel(isDate)}: rev=${(rev/1e6).toFixed(0)}M inv=${(inv/1e6).toFixed(0)}M`);
      return { date: isDate, revenue: rev, inventory: inv };
    }).filter(q => q.revenue > 0);

    // 과거 → 현재 정렬
    matched.sort((a, b) => a.date < b.date ? -1 : 1);

    if (matched.length < 5) {
      console.error(`[AV] ${ticker} 분기 데이터 부족 (${matched.length}개, 최소 5 필요)`);
      return null;
    }

    // YoY 계산: index i vs i-4 (전년 동기 분기)
    const result: QuarterPoint[] = matched.map((curr, i) => {
      if (i < 4) return { quarter: toQuarterLabel(curr.date), revenueYoY: 0, inventoryYoY: 0, hasYoY: false };
      const prev     = matched[i - 4];
      const revYoY   = calcYoY(curr.revenue,   prev.revenue);
      const invYoY   = calcYoY(curr.inventory, prev.inventory);
      return {
        quarter:      toQuarterLabel(curr.date),
        revenueYoY:   revYoY   ?? 0,
        inventoryYoY: invYoY   ?? 0,
        hasYoY:       revYoY !== null,
      };
    });

    // YoY 있는 분기만 반환, 최근 4~6개
    const withYoY = result.filter(r => r.hasYoY);
    console.log(`[AV] ${ticker} 성공 — YoY 있는 분기: ${withYoY.length}개`);
    return withYoY.slice(-6);

  } catch (err: unknown) {
    console.error(`[AV] ${ticker} 오류:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// ② 한국 주식 — DART OpenAPI
// ──────────────────────────────────────────────────────────────

/**
 * DART 종목코드(6자리) → corp_code(8자리) 매핑 테이블
 *
 * 주요 제조업/반도체/하드웨어 종목 하드코딩
 * 추가 필요 시: https://opendart.fss.or.kr → 회사검색 → corp_code 확인
 */
const DART_CORP_CODES: Record<string, string> = {
  // ── 반도체 ──────────────────────────────────────────────────
  '005930': '00126380',   // 삼성전자
  '000660': '00164779',   // SK하이닉스
  '042700': '00272001',   // 한미반도체
  '009150': '00126690',   // 삼성전기
  // ── 자동차 ──────────────────────────────────────────────────
  '005380': '00164742',   // 현대차
  '000270': '00164600',   // 기아
  '012330': '00164777',   // 현대모비스
  '011210': '00164756',   // 현대위아
  // ── 전기·전자 ────────────────────────────────────────────────
  '066570': '00401731',   // LG전자
  '006400': '00126650',   // 삼성SDI
  '051910': '00355534',   // LG화학
  '096770': '00113872',   // SK이노베이션
  '003670': '00164700',   // 포스코퓨처엠
  // ── 조선·중공업 ──────────────────────────────────────────────
  '329180': '01111570',   // 현대중공업
  '042660': '00117518',   // HD현대중공업
  '010140': '00131131',   // 삼성중공업
  '011200': '00115380',   // HMM
  // ── 소재·화학 ────────────────────────────────────────────────
  '004020': '00106496',   // 현대제철
  '005490': '00131547',   // POSCO홀딩스
  '010950': '00111972',   // S-Oil
  // ── 바이오·의료기기 ──────────────────────────────────────────
  '207940': '01426928',   // 삼성바이오로직스
  '068270': '00584045',   // 셀트리온
  '000100': '00107381',   // 유한양행
  // ── IT·통신 장비 ─────────────────────────────────────────────
  '189300': '01387805',   // 인텔리안테크
  '034020': '00115427',   // 두산에너빌리티
  '034220': '00155953',   // LG디스플레이
  // ── 소비재·유통 ──────────────────────────────────────────────
  '004990': '00131030',   // 롯데지주
  '023530': '00107638',   // 롯데쇼핑
  '028260': '00164742',   // 삼성물산
};

/** DART API에서 특정 분기 재무 데이터 조회 */
async function fetchDartPeriod(
  corpCode: string,
  bsnsYear: string,
  reprtCode: string,  // 11014=Q1, 11012=H1, 11013=9M, 11011=Annual
  key: string,
): Promise<{ revenue: number; inventory: number; prevRevenue: number; prevInventory: number } | null> {
  const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json`
            + `?crtfc_key=${key}`
            + `&corp_code=${corpCode}`
            + `&bsns_year=${bsnsYear}`
            + `&reprt_code=${reprtCode}`
            + `&fs_div=CFS`;   // CFS=연결, OFS=별도

  try {
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) { console.error(`[DART] HTTP ${res.status} for corp=${corpCode} year=${bsnsYear} reprt=${reprtCode}`); return null; }
    const data = await res.json();

    if (data.status !== '000') {
      // 000=정상, 010=미등록, 020=등록비승인, 011=기간초과 등
      if (data.status !== '013') { // 013=데이터없음 (정상 케이스)
        console.error(`[DART] status=${data.status} msg=${data.message} corp=${corpCode}`);
      }
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = data.list ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findAccount = (keywords: string[]): any | undefined =>
      list.find(item => keywords.some(kw => (item.account_nm ?? '').includes(kw)));

    const revItem = findAccount(['매출액', '수익(매출액)', '영업수익']);
    const invItem = findAccount(['재고자산']);

    const revenue      = toNum(revItem?.thstrm_amount);
    const inventory    = toNum(invItem?.thstrm_amount);
    const prevRevenue  = toNum(revItem?.frmtrm_amount);
    const prevInventory= toNum(invItem?.frmtrm_amount);

    return { revenue, inventory, prevRevenue, prevInventory };
  } catch (err) {
    console.error(`[DART] 요청 오류 corp=${corpCode}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * DART 분기 데이터 수집
 *
 * 전략: 최근 4개 분기(누적)를 순서대로 가져와
 *       thstrm_amount vs frmtrm_amount 로 전년 동기 YoY 직접 계산
 *
 * 누적 보고서 코드:
 *   11014 = Q1      (1분기 누적)
 *   11012 = H1      (반기 = Q1+Q2 누적)
 *   11013 = 9M      (3분기 = Q1+Q2+Q3 누적)
 *   11011 = Annual  (사업연도 = Q1+Q2+Q3+Q4 누적)
 */
async function fetchKRData(ticker: string): Promise<QuarterPoint[] | null> {
  const KEY = process.env.DART_API_KEY;
  if (!KEY) { console.error('[DART] DART_API_KEY 미설정'); return null; }

  const code = ticker.replace(/\.(KS|KQ)$/i, '').padStart(6, '0');
  const corpCode = DART_CORP_CODES[code];

  if (!corpCode) {
    console.error(`[DART] ${code} corp_code 매핑 없음 — DART_CORP_CODES 테이블에 추가 필요`);
    return null;
  }

  const now  = new Date();
  const year = now.getFullYear();
  const mon  = now.getMonth() + 1;   // 1~12

  // 현재 시점 기준 사용 가능한 보고서 목록 (최신 → 과거 순)
  // Q1 제출기한: 5월 중순, H1: 8월 중순, 9M: 11월 중순, Annual: 3월 말
  const periods: Array<{ year: string; code: string; label: string }> = [];

  if (mon >= 5)  periods.push({ year: String(year),   code: '11014', label: `${String(year).slice(-2)}-Q1` });
  if (mon >= 8)  periods.push({ year: String(year),   code: '11012', label: `${String(year).slice(-2)}-Q2` });
  if (mon >= 11) periods.push({ year: String(year),   code: '11013', label: `${String(year).slice(-2)}-Q3` });
  // 전년도 분기들
  periods.push({ year: String(year - 1), code: '11013', label: `${String(year-1).slice(-2)}-Q3` });
  periods.push({ year: String(year - 1), code: '11012', label: `${String(year-1).slice(-2)}-Q2` });
  periods.push({ year: String(year - 1), code: '11014', label: `${String(year-1).slice(-2)}-Q1` });

  // 최대 5개 분기만 조회 (DART 호출 최소화)
  const targetPeriods = periods.slice(0, 5);
  console.log(`[DART] ${code} 조회 periods:`, targetPeriods.map(p => p.label).join(','));

  // 병렬 조회 (5개 동시)
  const results = await Promise.allSettled(
    targetPeriods.map(p => fetchDartPeriod(corpCode, p.year, p.code, KEY))
  );

  const history: QuarterPoint[] = [];

  results.forEach((r, i) => {
    const p = targetPeriods[i];
    if (r.status === 'rejected' || !r.value) {
      console.warn(`[DART] ${code} ${p.label} 데이터 없음`);
      return;
    }
    const { revenue, inventory, prevRevenue, prevInventory } = r.value;

    // 누적 보고서의 frmtrm_amount = 전년 동기 동일 누적값 → 직접 YoY 계산 가능
    const revYoY = calcYoY(revenue,   prevRevenue);
    const invYoY = calcYoY(inventory, prevInventory);
    const hasYoY = revYoY !== null;

    console.log(`[DART] ${code} ${p.label}: rev=${revenue} inv=${inventory} revYoY=${revYoY} invYoY=${invYoY}`);

    history.push({
      quarter:      p.label,
      revenueYoY:   revYoY   ?? 0,
      inventoryYoY: invYoY   ?? 0,
      hasYoY,
    });
  });

  const withYoY = history.filter(h => h.hasYoY);
  if (withYoY.length === 0) {
    console.error(`[DART] ${code} YoY 계산 가능한 분기 없음`);
    return null;
  }

  // 과거 → 현재 정렬
  history.sort((a, b) => a.quarter < b.quarter ? -1 : 1);
  console.log(`[DART] ${code} 성공 — ${withYoY.length}분기 YoY 확보`);
  return history;
}

// ──────────────────────────────────────────────────────────────
// 비제조업 필터
// ──────────────────────────────────────────────────────────────
const NON_MFG_TICKERS = new Set([
  'PLTR','CRM','ADBE','ORCL','NOW','SNOW','WDAY','ZM','DDOG','CRWD','NET',
  'GOOGL','GOOG','META','MSFT','NFLX','UBER','LYFT','ABNB',
  'JPM','GS','MS','BAC','C','WFC','V','MA','AXP','PYPL','BRK',
  'T','VZ','TMUS','UNH','CVS',
  '055550','105560','086790','032830','030200','017670',
]);
const NON_MFG_KEYWORDS = [
  'SOFTWARE','CLOUD','INTERNET','FINANCIALS','BANCORP','INSURANCE',
  '소프트웨어','금융','보험','증권','통신',
];
function isNonMfg(ticker: string, name: string): boolean {
  if (NON_MFG_TICKERS.has(ticker.toUpperCase())) return true;
  const n = name.toUpperCase();
  return NON_MFG_KEYWORDS.some(kw => n.includes(kw));
}

// ──────────────────────────────────────────────────────────────
// GET 핸들러
// ──────────────────────────────────────────────────────────────
export async function GET() {
  const cookieStore = await cookies();

  // 1. 인증
  const sbAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (l) => l.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user }, error: authErr } = await sbAuth.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  // 2. 서비스 롤
  const { createClient } = await import('@supabase/supabase-js');
  const sbAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 3. 포트폴리오 조회
  const { data: holdings } = await sbAdmin
    .from('investments')
    .select('ticker, name, market')
    .eq('user_id', user.id);

  if (!holdings?.length) {
    return NextResponse.json({
      results: [], excludedFromAnalysis: [],
      summary: { danger:0, warning:0, healthy:0, unknown:0 },
      message: '포트폴리오에 종목이 없습니다.', source: 'empty',
    });
  }

  // 4. STOCK만 추출 + 비제조업 사전 제외
  const excluded: ExcludedItem[] = [];

  const allStocks = holdings.filter(h => {
    if (getAssetType(h.ticker, h.name, h.market ?? 'US') !== 'STOCK') {
      excluded.push({ ticker: h.ticker, name: h.name, reason: 'ETF·암호화폐·원자재는 재고 분석 대상이 아닙니다.' });
      return false;
    }
    if (isNonMfg(h.ticker, h.name)) {
      excluded.push({ ticker: h.ticker, name: h.name, reason: '소프트웨어·금융·서비스 기업은 물리적 재고가 없습니다.' });
      return false;
    }
    return true;
  });

  if (!allStocks.length) {
    return NextResponse.json({
      results: [], excludedFromAnalysis: excluded,
      summary: { danger:0, warning:0, healthy:0, unknown:0 },
      message: '재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.', source: 'empty',
    });
  }

  // 5. 병렬 데이터 수집 (개별 오류가 전체를 중단하지 않도록 allSettled)
  const fetchResults = await Promise.allSettled(
    allStocks.map(async h => {
      const isKR   = /^\d{6}$/.test(h.ticker.replace(/\.(KS|KQ)$/i, ''));
      const history = isKR ? await fetchKRData(h.ticker) : await fetchUSData(h.ticker);
      return { h, isKR, history };
    })
  );

  // 6. 결과 조립
  const results: StockResult[] = [];

  fetchResults.forEach(settled => {
    if (settled.status === 'rejected') {
      console.error('[route] 병렬 수집 오류:', settled.reason);
      return;
    }
    const { h, isKR, history } = settled.value;
    const currency  = isKR ? 'KRW' : 'USD';
    const unitLabel = isKR ? '억원' : 'M$';

    if (!history || history.length === 0) {
      results.push({
        ticker: h.ticker, name: h.name, market: h.market ?? 'US',
        currency, unitLabel,
        signal: 'UNKNOWN', gap: 0, latestQuarter: '',
        revenueYoY: 0, inventoryYoY: 0, consecutiveDanger: 0,
        quarterlyHistory: [],
        lynchAlert: isKR
          ? `"${h.name}의 DART 분기 데이터를 수집할 수 없었습니다. DART_CORP_CODES 테이블에 해당 종목이 등록되어 있는지 확인하거나, 공시 데이터가 아직 게시되지 않았을 수 있습니다."`
          : `"${h.name}의 Alpha Vantage 데이터를 수집할 수 없었습니다. API 호출 한도(25회/일) 초과 또는 심볼 오류를 확인해주세요."`,
        dataSource: isKR ? 'dart' : 'alpha_vantage',
      });
      return;
    }

    // 최신 YoY 분기 기준 시그널 계산
    const withYoY = history.filter(q => q.hasYoY);
    const latest  = withYoY[withYoY.length - 1] ?? history[history.length - 1];
    const revYoY  = latest?.revenueYoY   ?? 0;
    const invYoY  = latest?.inventoryYoY ?? 0;
    const signal  = latest?.hasYoY ? getSignal(revYoY, invYoY) : 'UNKNOWN';
    const gap     = parseFloat((invYoY - revYoY).toFixed(1));
    const consec  = consecutiveDanger(history);

    results.push({
      ticker: h.ticker, name: h.name, market: h.market ?? 'US',
      currency, unitLabel, signal, gap,
      latestQuarter:     latest?.quarter ?? '',
      revenueYoY:        parseFloat(revYoY.toFixed(1)),
      inventoryYoY:      parseFloat(invYoY.toFixed(1)),
      consecutiveDanger: consec,
      quarterlyHistory:  history,
      lynchAlert:        lynchMsg(signal, h.name, gap, consec),
      dataSource:        isKR ? 'dart' : 'alpha_vantage',
    });
  });

  // DANGER → WARNING → HEALTHY → UNKNOWN 정렬
  const ORDER: Record<CrossSignal, number> = { DANGER:0, WARNING:1, HEALTHY:2, UNKNOWN:3 };
  results.sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.gap - a.gap);

  const summary = {
    danger:  results.filter(r => r.signal === 'DANGER').length,
    warning: results.filter(r => r.signal === 'WARNING').length,
    healthy: results.filter(r => r.signal === 'HEALTHY').length,
    unknown: results.filter(r => r.signal === 'UNKNOWN').length,
  };

  return NextResponse.json({
    results,
    excludedFromAnalysis: excluded,
    summary,
    source: 'live',
    meta: {
      totalHoldings: holdings.length,
      analyzable:    allStocks.length,
      excluded:      excluded.length,
      analyzed:      results.filter(r => r.signal !== 'UNKNOWN').length,
      cacheHit:      0,
      cacheMiss:     allStocks.length,
      pipeline:      '미국:AlphaVantage / 한국:DART-OpenAPI',
    },
  });
}
