/**
 * GET /api/financials/inventory-cross
 *   → 포트폴리오에서 분석 가능한 종목 목록 반환
 *
 * GET /api/financials/inventory-cross?ticker=NVDA
 *   → 해당 단일 종목의 분기 재고·매출 YoY 데이터 반환
 *
 * ◆ 아키텍처 (종목별 단일 호출 방식)
 *   - 프론트엔드가 종목별로 개별 fetch → Alpha Vantage Rate Limit 우회
 *   - US 종목: Alpha Vantage INCOME_STATEMENT + BALANCE_SHEET
 *   - KR 종목: DART OpenAPI fnlttSinglAcntAll (누적 보고서)
 *   - 데이터 부족 / Rate Limit → 에러 없이 빈 배열 + 상태 메시지 반환
 */

import { NextRequest, NextResponse }  from 'next/server';
import { createServerClient }         from '@supabase/ssr';
import { cookies }                    from 'next/headers';
import { getAssetType }               from '@/lib/assetClassifier';

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
export type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN';

export interface QuarterPoint {
  quarter:      string;
  revenueYoY:   number;
  inventoryYoY: number;
  hasYoY:       boolean;
}

export interface SingleStockResult {
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
  errorMsg?:         string;  // 데이터 부족/API 제한 시 안내
}

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (v === null || v === undefined || v === 'None' || v === '-' || v === 'N/A') return 0;
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : Number(v);
  return isNaN(n) ? 0 : n;
}

function toQLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '?-Q?';
  const yy = String(d.getFullYear()).slice(-2);
  const m  = d.getMonth() + 1;
  return `${yy}-Q${m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4}`;
}

function calcYoY(curr: number, prev: number): number | null {
  if (prev <= 0 || curr <= 0) return null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(1));
}

function getSignal(rev: number | null, inv: number | null): CrossSignal {
  if (rev === null || inv === null) return 'UNKNOWN';
  const g = inv - rev;
  if (g > 0)  return 'DANGER';
  if (g > -5) return 'WARNING';
  return 'HEALTHY';
}

function consec(history: QuarterPoint[]): number {
  let n = 0;
  for (const q of [...history].reverse()) {
    if (q.hasYoY && q.inventoryYoY > q.revenueYoY) n++;
    else break;
  }
  return n;
}

function lynchMsg(sig: CrossSignal, name: string, gap: number, con: number): string {
  const a = Math.abs(gap).toFixed(1);
  if (sig === 'DANGER')
    return con >= 2
      ? `"${name}의 재고가 매출보다 ${a}%p 빠르게 쌓이는 상황이 ${con}분기 연속. 린치는 2분기 연속 시 즉시 매도를 권고합니다."`
      : `"${name}의 재고 증가율이 매출을 ${a}%p 앞질렀습니다. 다음 분기도 이어진다면 린치의 매도 신호입니다."`;
  if (sig === 'WARNING')
    return `"${name}는 아직 역전 전이지만 격차가 ${a}%p로 좁혀졌습니다. 재고 동향을 집중 모니터링하세요."`;
  if (sig === 'HEALTHY')
    return `"${name}는 매출이 재고보다 건강하게 앞서고 있습니다. 린치가 선호하는 상태입니다."`;
  return `"${name}의 분기 재고·매출 데이터를 분석 중이거나 사용 가능한 데이터가 부족합니다."`;
}

// ────────────────────────────────────────────────────────────
// DART corp_code 매핑
// ────────────────────────────────────────────────────────────
const DART_CODES: Record<string, string> = {
  '005930': '00126380',  // 삼성전자
  '000660': '00164779',  // SK하이닉스
  '189300': '01387805',  // 인텔리안테크
  '005380': '00164742',  // 현대차
  '000270': '00164600',  // 기아
  '066570': '00401731',  // LG전자
  '006400': '00126650',  // 삼성SDI
  '051910': '00355534',  // LG화학
  '207940': '01426928',  // 삼성바이오로직스
  '068270': '00584045',  // 셀트리온
  '009150': '00126690',  // 삼성전기
  '042700': '00272001',  // 한미반도체
  '005490': '00131547',  // POSCO홀딩스
  '004020': '00106496',  // 현대제철
  '329180': '01111570',  // 현대중공업
  '034220': '00155953',  // LG디스플레이
  '010140': '00131131',  // 삼성중공업
};

// ────────────────────────────────────────────────────────────
// 비제조업 감지
// ────────────────────────────────────────────────────────────
const NON_MFG = new Set([
  'PLTR','CRM','ADBE','ORCL','NOW','SNOW','WDAY','ZM','DDOG','CRWD','NET',
  'GOOGL','GOOG','META','MSFT','NFLX','UBER','LYFT','ABNB',
  'JPM','GS','MS','BAC','C','WFC','V','MA','AXP','PYPL','BRK',
  'T','VZ','TMUS','UNH','CVS',
  '055550','105560','086790','032830','030200','017670',
]);
function isNonMfg(ticker: string, name: string): boolean {
  if (NON_MFG.has(ticker.toUpperCase())) return true;
  const n = name.toUpperCase();
  return ['SOFTWARE','CLOUD','INTERNET','FINANCIALS','BANCORP','INSURANCE',
          '소프트웨어','금융','보험','증권','통신'].some(k => n.includes(k));
}

// ────────────────────────────────────────────────────────────
// ① Alpha Vantage — 미국 주식 단일 티커
// ────────────────────────────────────────────────────────────
async function fetchAV(ticker: string): Promise<{ history: QuarterPoint[]; errorMsg?: string }> {
  const KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!KEY) return { history: [], errorMsg: 'ALPHA_VANTAGE_API_KEY 미설정' };

  const base = 'https://www.alphavantage.co/query';
  console.log(`[AV] ${ticker} 요청`);

  try {
    const [isR, bsR] = await Promise.allSettled([
      fetch(`${base}?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${KEY}`, { cache: 'no-store' }),
      fetch(`${base}?function=BALANCE_SHEET&symbol=${ticker}&apikey=${KEY}`,    { cache: 'no-store' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let isData: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bsData: any = {};
    if (isR.status === 'fulfilled' && isR.value.ok) isData = await isR.value.json();
    if (bsR.status === 'fulfilled' && bsR.value.ok) bsData = await bsR.value.json();

    // Rate limit / 오류 감지
    const rateLimitMsg = isData?.Note ?? isData?.Information ?? bsData?.Note ?? bsData?.Information;
    if (rateLimitMsg) {
      const msg = String(rateLimitMsg).slice(0, 80);
      console.warn(`[AV] ${ticker} Rate Limit: ${msg}`);
      return { history: [], errorMsg: `Alpha Vantage API 호출 한도 초과 (25회/일). ${msg}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isQ: any[] = isData?.quarterlyReports ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bsQ: any[] = bsData?.quarterlyReports ?? [];

    if (isQ.length === 0) {
      const msg = `Alpha Vantage에서 ${ticker} 분기 데이터를 찾을 수 없습니다. 신규 상장 종목이거나 지원되지 않는 심볼일 수 있습니다.`;
      console.warn(`[AV] ${ticker} 데이터 없음`);
      return { history: [], errorMsg: msg };
    }

    console.log(`[AV] ${ticker} IS=${isQ.length}분기 BS=${bsQ.length}분기`);

    // Balance Sheet → dateMap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bsMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bsQ.forEach((r: any) => bsMap.set(r.fiscalDateEnding, r));

    // Income + Balance 매칭
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = isQ.map((is: any) => {
      const date = is.fiscalDateEnding as string;
      const ms   = new Date(date).getTime();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bs: any = bsMap.get(date);
      if (!bs) {
        // ±60일 매칭
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bsQ.forEach((b: any) => {
          if (!bs && Math.abs(new Date(b.fiscalDateEnding).getTime() - ms) < 60 * 86400_000) bs = b;
        });
      }
      return {
        date,
        revenue:   toNum(is.totalRevenue),
        inventory: toNum(bs?.inventory ?? 0),
      };
    })
    .filter(q => q.revenue > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1);  // 과거→현재

    if (merged.length < 2) {
      return { history: [], errorMsg: `${ticker}: 분기 데이터 ${merged.length}개 (최소 2 필요). 상장 기간이 짧은 종목일 수 있습니다.` };
    }

    // YoY 계산 (4분기 전 비교, 부족하면 건너뜀)
    const history: QuarterPoint[] = merged.map((curr, i) => {
      if (i < 4) return { quarter: toQLabel(curr.date), revenueYoY: 0, inventoryYoY: 0, hasYoY: false };
      const prev   = merged[i - 4];
      const revYoY = calcYoY(curr.revenue,   prev.revenue);
      const invYoY = calcYoY(curr.inventory, prev.inventory);
      return {
        quarter:      toQLabel(curr.date),
        revenueYoY:   revYoY   ?? 0,
        inventoryYoY: invYoY   ?? 0,
        hasYoY:       revYoY !== null,
      };
    }).filter(q => q.hasYoY);   // YoY 없는 분기 제거

    if (history.length === 0) {
      return { history: [], errorMsg: `${ticker}: 전년 동기 비교 데이터 부족 (신규 상장 또는 데이터 미제공).` };
    }

    console.log(`[AV] ${ticker} 성공 — ${history.length}분기`);
    return { history: history.slice(-6) };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AV] ${ticker} 오류:`, msg.slice(0, 200));
    return { history: [], errorMsg: `Alpha Vantage 오류: ${msg.slice(0, 100)}` };
  }
}

// ────────────────────────────────────────────────────────────
// ② DART OpenAPI — 한국 주식 단일 티커
// ────────────────────────────────────────────────────────────
async function fetchDART(ticker: string): Promise<{ history: QuarterPoint[]; errorMsg?: string }> {
  const KEY      = process.env.DART_API_KEY;
  if (!KEY) return { history: [], errorMsg: 'DART_API_KEY 미설정' };

  const code     = ticker.replace(/\.(KS|KQ)$/i, '').padStart(6, '0');
  const corpCode = DART_CODES[code];
  if (!corpCode) {
    const msg = `${code}의 DART corp_code 매핑 없음. DART_CODES 테이블 추가 필요.`;
    console.error(`[DART] ${msg}`);
    return { history: [], errorMsg: msg };
  }

  const now  = new Date();
  const year = now.getFullYear();
  const mon  = now.getMonth() + 1;

  // 현재 시점 기준으로 제출 가능한 보고서 목록 (최신→과거)
  // 보고서 제출기한: Q1(5월 중), Q2/H1(8월 중), Q3/9M(11월 중), Annual(3월 말)
  const periods = [
    ...(mon >= 5  ? [{ y: year,     r: '11014', label: `${String(year).slice(-2)}-Q1` }] : []),
    ...(mon >= 8  ? [{ y: year,     r: '11012', label: `${String(year).slice(-2)}-Q2` }] : []),
    ...(mon >= 11 ? [{ y: year,     r: '11013', label: `${String(year).slice(-2)}-Q3` }] : []),
    { y: year-1, r: '11011', label: `${String(year-1).slice(-2)}-Q4` },
    { y: year-1, r: '11013', label: `${String(year-1).slice(-2)}-Q3` },
    { y: year-1, r: '11012', label: `${String(year-1).slice(-2)}-Q2` },
    { y: year-1, r: '11014', label: `${String(year-1).slice(-2)}-Q1` },
  ].slice(0, 5);

  console.log(`[DART] ${code} 조회 periods: ${periods.map(p => p.label).join(',')}`);

  const BASE = 'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json';

  const fetches = await Promise.allSettled(
    periods.map(async p => {
      const url = `${BASE}?crtfc_key=${KEY}&corp_code=${corpCode}&bsns_year=${p.y}&reprt_code=${p.r}&fs_div=CFS`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return { label: p.label, data: null };
        const json = await res.json();
        if (json.status !== '000') return { label: p.label, data: null };
        return { label: p.label, data: json.list ?? [] };
      } catch { return { label: p.label, data: null }; }
    })
  );

  const history: QuarterPoint[] = [];

  fetches.forEach(settled => {
    if (settled.status === 'rejected' || !settled.value.data) return;
    const { label, data } = settled.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const find = (keywords: string[]) => (data as any[]).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => keywords.some(kw => (item.account_nm ?? '').includes(kw))
    );

    const revItem = find(['매출액', '수익(매출액)', '영업수익']);
    const invItem = find(['재고자산']);

    const revenue       = toNum(revItem?.thstrm_amount);
    const prevRevenue   = toNum(revItem?.frmtrm_amount);
    const inventory     = toNum(invItem?.thstrm_amount);
    const prevInventory = toNum(invItem?.frmtrm_amount);

    if (revenue === 0) { console.warn(`[DART] ${code} ${label} 매출액 없음`); return; }

    const revYoY = calcYoY(revenue,   prevRevenue);
    const invYoY = calcYoY(inventory, prevInventory);

    console.log(`[DART] ${code} ${label}: rev=${revenue} inv=${inventory} revYoY=${revYoY}`);

    history.push({
      quarter:      label,
      revenueYoY:   revYoY ?? 0,
      inventoryYoY: invYoY ?? 0,
      hasYoY:       revYoY !== null,
    });
  });

  // 과거→현재 정렬
  history.sort((a, b) => a.quarter < b.quarter ? -1 : 1);

  const withYoY = history.filter(h => h.hasYoY);
  if (withYoY.length === 0) {
    return { history, errorMsg: `${code}: DART YoY 계산 가능한 분기 없음 (공시 미제출 또는 이전년도 데이터 부족).` };
  }

  console.log(`[DART] ${code} 성공 — YoY ${withYoY.length}분기`);
  return { history };
}

// ────────────────────────────────────────────────────────────
// 단일 종목 결과 조립
// ────────────────────────────────────────────────────────────
function buildResult(
  ticker:   string,
  name:     string,
  market:   string,
  isKR:     boolean,
  history:  QuarterPoint[],
  errorMsg?: string,
): SingleStockResult {
  const currency  = isKR ? 'KRW' : 'USD';
  const unitLabel = isKR ? '억원' : 'M$';
  const withYoY   = history.filter(q => q.hasYoY);
  const latest    = withYoY[withYoY.length - 1];
  const revYoY    = latest?.revenueYoY   ?? 0;
  const invYoY    = latest?.inventoryYoY ?? 0;
  const signal    = latest?.hasYoY ? getSignal(revYoY, invYoY) : 'UNKNOWN';
  const gap       = parseFloat((invYoY - revYoY).toFixed(1));
  const con       = consec(history);

  return {
    ticker, name, market, currency, unitLabel, signal, gap,
    latestQuarter:     latest?.quarter ?? '',
    revenueYoY:        parseFloat(revYoY.toFixed(1)),
    inventoryYoY:      parseFloat(invYoY.toFixed(1)),
    consecutiveDanger: con,
    quarterlyHistory:  history,
    lynchAlert:        errorMsg
      ? `"${name}: ${errorMsg}"`
      : lynchMsg(signal, name, gap, con),
    dataSource: isKR ? 'dart' : 'alpha_vantage',
    errorMsg,
  };
}

// ────────────────────────────────────────────────────────────
// 인증 헬퍼
// ────────────────────────────────────────────────────────────
async function getAuthUser() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (l) => l.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user }, error } = await sb.auth.getUser();
  return error ? null : user;
}

async function getAdminClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ════════════════════════════════════════════════════════════
// GET 핸들러
// ════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get('ticker')?.trim().toUpperCase();

  // ── 모드 A: 종목 목록만 반환 (ticker 없음) ──────────────────
  if (!ticker) {
    const sb = await getAdminClient();
    const { data: holdings } = await sb
      .from('investments')
      .select('ticker, name, market')
      .eq('user_id', user.id);

    if (!holdings?.length) {
      return NextResponse.json({ stocks: [], excluded: [] });
    }

    const excluded: { ticker: string; name: string; reason: string }[] = [];
    const stocks: { ticker: string; name: string; market: string; isKR: boolean }[] = [];

    holdings.forEach(h => {
      if (getAssetType(h.ticker, h.name, h.market ?? 'US') !== 'STOCK') {
        excluded.push({ ticker: h.ticker, name: h.name, reason: 'ETF·암호화폐·원자재는 재고 분석 제외' });
        return;
      }
      if (isNonMfg(h.ticker, h.name)) {
        excluded.push({ ticker: h.ticker, name: h.name, reason: '소프트웨어·금융·서비스 기업은 물리적 재고 없음' });
        return;
      }
      const isKR = /^\d{6}$/.test(h.ticker.replace(/\.(KS|KQ)$/i, ''));
      stocks.push({ ticker: h.ticker, name: h.name, market: h.market ?? 'US', isKR });
    });

    return NextResponse.json({ stocks, excluded });
  }

  // ── 모드 B: 단일 종목 데이터 반환 ──────────────────────────
  const sb = await getAdminClient();
  const { data: holdings } = await sb
    .from('investments')
    .select('ticker, name, market')
    .eq('user_id', user.id);

  // 포트폴리오에서 해당 종목 찾기
  const holding = (holdings ?? []).find(
    h => h.ticker.toUpperCase() === ticker
  );

  if (!holding) {
    return NextResponse.json({ error: `포트폴리오에 ${ticker} 없음` }, { status: 404 });
  }

  const isKR = /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''));

  let history: QuarterPoint[] = [];
  let errorMsg: string | undefined;

  if (isKR) {
    const r = await fetchDART(ticker);
    history  = r.history;
    errorMsg = r.errorMsg;
  } else {
    const r = await fetchAV(ticker);
    history  = r.history;
    errorMsg = r.errorMsg;
  }

  const result = buildResult(ticker, holding.name, holding.market ?? 'US', isKR, history, errorMsg);
  return NextResponse.json(result);
}
