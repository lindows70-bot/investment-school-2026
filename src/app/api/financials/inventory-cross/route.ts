import { NextResponse }    from 'next/server';
import yahooFinance        from 'yahoo-finance2';
import axios               from 'axios';
import * as cheerio        from 'cheerio';
import { createServerClient } from '@supabase/ssr';
import { cookies }            from 'next/headers';
import { getAssetType }       from '@/lib/assetClassifier';

// ──────────────────────────────────────────────────────────────
// 공통 유틸
// ──────────────────────────────────────────────────────────────

/** Yahoo Finance는 숫자 또는 { raw, fmt } 객체로 반환 — 양쪽 모두 안전 추출 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeGetNumber(field: any): number {
  if (field === null || field === undefined) return 0;
  if (typeof field === 'number') return field;
  if (typeof field === 'object' && typeof field.raw === 'number') return field.raw;
  return 0;
}

/** 날짜 → "24-Q3" 포맷 */
function formatQuarter(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '?-Q?';
  const yy = String(d.getFullYear()).slice(-2);
  const m  = d.getMonth() + 1;
  const q  = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
  return `${yy}-${q}`;
}

/** 한국 숫자 문자열 → 억원 정수 */
function parseKrNumber(text: string): number {
  const n = parseFloat(text.replace(/[,\s]/g, '').trim());
  return isNaN(n) ? 0 : n;
}

// ──────────────────────────────────────────────────────────────
// 타입 정의
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
// ① 미국 주식 수집 엔진 (yahoo-finance2 quoteSummary)
// ──────────────────────────────────────────────────────────────
async function fetchUSStockData(ticker: string): Promise<QuarterPoint[] | null> {
  try {
    console.log(`[US] ${ticker} 조회 시작`);

    // ★ yahooFinance는 class — 반드시 인스턴스 생성 후 호출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (yahooFinance as any)({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

    // ★ quoteSummary balanceSheetHistoryQuarterly는 Nov 2024부터 inventory 필드 공급 중단
    //   → fundamentalsTimeSeries 'balance-sheet' 사용 (inventory 존재하는 항목만 필터)
    //   → fundamentalsTimeSeries 'financials'    사용 (totalRevenue)
    const since = new Date(Date.now() - 3 * 365 * 86400_000).toISOString().slice(0, 10);

    const [balResult, finResult] = await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yf.fundamentalsTimeSeries(ticker, { module: 'balance-sheet', period1: since }) as Promise<any[]>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yf.fundamentalsTimeSeries(ticker, { module: 'financials',    period1: since }) as Promise<any[]>,
    ]);

    if (finResult.status === 'rejected') {
      console.error(`[US] ${ticker} financials 오류:`, finResult.reason?.message);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balArr: any[] = balResult.status === 'fulfilled'
      ? (Array.isArray(balResult.value) ? balResult.value : Object.values(balResult.value as object))
      : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finRaw = (finResult as PromiseFulfilledResult<any>).value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finArr: any[] = Array.isArray(finRaw) ? finRaw : Object.values(finRaw as object);

    if (!finArr.length) {
      console.error(`[US] ${ticker} financials 빈 배열`);
      return null;
    }

    // ★ balance-sheet에서 inventory가 실제로 있는 항목만 사용
    //   (일부 분기는 inventory 필드 자체가 없음 — undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balWithInv = balArr.filter((b: any) => b.inventory != null && Number(b.inventory) > 0);
    console.log(`[US] ${ticker} balance-sheet 전체=${balArr.length} / inventory있는항목=${balWithInv.length}`);

    // balance-sheet를 날짜 기준 정렬
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balSorted = [...balWithInv].sort((a: any, b: any) => {
      const da = a.date instanceof Date ? a.date.getTime() : new Date(String(a.date ?? '')).getTime();
      const db = b.date instanceof Date ? b.date.getTime() : new Date(String(b.date ?? '')).getTime();
      return da - db;
    });

    // financials 과거→현재 정렬
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finSorted = [...finArr].sort((a: any, b: any) => {
      const da = a.date instanceof Date ? a.date.getTime() : new Date(String(a.date ?? '')).getTime();
      const db = b.date instanceof Date ? b.date.getTime() : new Date(String(b.date ?? '')).getTime();
      return da - db;
    });

    // financials 기준으로 balance-sheet 날짜 매칭 (±60일)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combined: { date: Date; revenue: number; inventory: number }[] = finSorted.map((fin: any, idx: number) => {
      const finMs = fin.date instanceof Date ? fin.date.getTime() : new Date(String(fin.date ?? '')).getTime();
      // 1차: ±60일 매칭  2차: 동일 인덱스 fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let matchB = balSorted.find((b: any) => {
        const bMs = b.date instanceof Date ? b.date.getTime() : new Date(String(b.date ?? '')).getTime();
        return Math.abs(bMs - finMs) < 60 * 86400_000;
      });
      if (!matchB && balSorted[idx]) matchB = balSorted[idx];

      const rev = safeGetNumber(fin.totalRevenue);
      const inv = matchB ? safeGetNumber(matchB.inventory) : 0;
      const d   = fin.date instanceof Date ? fin.date : new Date(String(fin.date ?? ''));

      console.log(`[US] ${ticker} ${formatQuarter(d)}: rev=${(rev/1e6).toFixed(0)}M inv=${(inv/1e6).toFixed(0)}M`);
      return { date: d, revenue: rev, inventory: inv };
    }).filter(q => q.revenue > 0);

    if (combined.length < 2) {
      console.error(`[US] ${ticker} 유효 분기 부족 (${combined.length}개)`);
      return null;
    }

    // YoY 계산 — 4분기 전과 비교 (동일 계절 분기)
    const result: QuarterPoint[] = combined.map((curr, idx) => {
      let revYoY = 0, invYoY = 0, hasYoY = false;

      if (idx >= 4) {
        const prev = combined[idx - 4];
        if (prev.revenue   > 0) { revYoY = ((curr.revenue   - prev.revenue)   / prev.revenue)   * 100; hasYoY = true; }
        if (prev.inventory > 0) { invYoY = ((curr.inventory - prev.inventory) / prev.inventory) * 100; }
      }

      return {
        quarter:      formatQuarter(curr.date),
        revenueYoY:   parseFloat(revYoY.toFixed(1)),
        inventoryYoY: parseFloat(invYoY.toFixed(1)),
        hasYoY,
      };
    });

    console.log(`[US] ${ticker} 성공 — 총 ${result.length}분기, YoY 있는 분기: ${result.filter(r=>r.hasYoY).length}개`);
    return result.slice(-8);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[US] ${ticker} 오류:`, msg.slice(0, 200));
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// ② 한국 주식 수집 엔진 (WiseReport HTML 스크래핑)
// ──────────────────────────────────────────────────────────────
async function fetchKRStockData(ticker: string): Promise<QuarterPoint[] | null> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '').padStart(6, '0');
  const url  = `https://navercomp.wisereport.co.kr/v2/company/cF1001.aspx?cmp_cd=${code}&fin_Gubun=MAIN&frq=1`;

  console.log(`[KR] ${code} 조회: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer':         'https://navercomp.wisereport.co.kr/',
      },
      timeout:       10_000,
      responseType:  'arraybuffer',    // EUC-KR 대응
    });

    // EUC-KR 디코딩
    let html: string;
    try { html = new TextDecoder('euc-kr').decode(response.data); }
    catch { html = new TextDecoder('utf-8').decode(response.data); }

    const $ = cheerio.load(html);

    // ── 분기 헤더 추출 ─────────────────────────────────────
    const quarters: string[] = [];
    $('tr').each((_, tr) => {
      $(tr).find('th, td').each((__, cell) => {
        const text = $(cell).text().trim();
        if (/^\d{4}\/\d{2}$/.test(text)) {
          const [yr, mo] = text.split('/');
          const m = parseInt(mo, 10);
          const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
          const label = `${yr.slice(-2)}-${q}`;
          if (!quarters.includes(label)) quarters.push(label);
        }
      });
    });
    console.log(`[KR] ${code} 분기 헤더 ${quarters.length}개:`, quarters);

    if (quarters.length < 2) {
      // HTML 앞 500자 로깅 (디버깅)
      console.error(`[KR] ${code} 분기 헤더 부족. HTML 앞 500자:`, html.replace(/\s+/g, ' ').slice(0, 500));
      return null;
    }

    // ── 행 데이터 추출 ─────────────────────────────────────
    const revenues:    number[] = [];
    const inventories: number[] = [];

    $('tr').each((_, tr) => {
      const cells    = $(tr).find('th, td');
      const rowLabel = cells.first().text().trim().replace(/\s+/g, '');

      if (rowLabel.includes('매출액') && revenues.length === 0) {
        cells.each((idx, cell) => {
          if (idx > 0) {
            const n = parseKrNumber($(cell).text());
            revenues.push(n);
          }
        });
        console.log(`[KR] ${code} 매출액 ${revenues.length}개: [${revenues.slice(0,5).join(',')}]`);
      }

      if ((rowLabel.includes('재고자산') || rowLabel.includes('재고')) && inventories.length === 0) {
        cells.each((idx, cell) => {
          if (idx > 0) {
            const n = parseKrNumber($(cell).text());
            inventories.push(n);
          }
        });
        console.log(`[KR] ${code} 재고자산 ${inventories.length}개: [${inventories.slice(0,5).join(',')}]`);
      }
    });

    if (revenues.length < 2) {
      console.error(`[KR] ${code} 매출액 행 미발견 (${revenues.length}개)`);
      return null;
    }

    // ── YoY 계산 ────────────────────────────────────────────
    const count  = Math.min(quarters.length, revenues.length, 8);
    const result: QuarterPoint[] = [];

    for (let i = 0; i < count; i++) {
      const rev = revenues[i]    ?? 0;
      const inv = inventories[i] ?? 0;
      let revYoY = 0, invYoY = 0, hasYoY = false;

      if (i >= 4) {
        const pRev = revenues[i - 4]    ?? 0;
        const pInv = inventories[i - 4] ?? 0;
        if (pRev > 0) { revYoY = ((rev - pRev) / pRev) * 100; hasYoY = true; }
        if (pInv > 0) { invYoY = ((inv - pInv) / pInv) * 100; }
      }

      result.push({
        quarter:      quarters[i],
        revenueYoY:   parseFloat(revYoY.toFixed(1)),
        inventoryYoY: parseFloat(invYoY.toFixed(1)),
        hasYoY,
      });
    }

    console.log(`[KR] ${code} 성공 — ${result.length}분기`);
    return result.slice(-8);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[KR] ${code} 오류:`, msg.slice(0, 200));
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// 시그널 계산
// ──────────────────────────────────────────────────────────────
function calcSignal(revYoY: number, invYoY: number): CrossSignal {
  const gap = invYoY - revYoY;
  if (gap > 0)   return 'DANGER';
  if (gap > -5)  return 'WARNING';
  return 'HEALTHY';
}

function countConsecutiveDanger(history: QuarterPoint[]): number {
  let n = 0;
  for (const q of [...history].reverse()) {
    if (q.hasYoY && q.inventoryYoY > q.revenueYoY) n++;
    else break;
  }
  return n;
}

function buildLynchAlert(signal: CrossSignal, name: string, gap: number, consec: number): string {
  const abs = Math.abs(gap).toFixed(1);
  if (signal === 'DANGER') {
    return consec >= 2
      ? `"${name}의 재고가 매출보다 ${abs}%p 빠르게 쌓이는 상황이 ${consec}분기 연속 지속 중. 린치는 2분기 연속 역전 시 즉시 매도를 원칙으로 합니다."`
      : `"${name}의 재고 증가율이 매출을 ${abs}%p 앞질렀습니다. 다음 분기도 이어진다면 린치의 매도 신호입니다."`;
  }
  if (signal === 'WARNING') return `"${name}는 아직 역전되지 않았지만 격차가 ${abs}%p로 좁혀졌습니다. 재고 동향을 집중 모니터링하세요."`;
  if (signal === 'HEALTHY') return `"${name}는 매출이 재고보다 건강하게 앞서고 있습니다. 린치가 선호하는 상태입니다."`;
  return `"${name}의 분기 재고·매출 데이터를 분석 중입니다."`;
}

// ──────────────────────────────────────────────────────────────
// 비제조업 필터 (소프트웨어·금융·서비스)
// ──────────────────────────────────────────────────────────────
const NO_INVENTORY_TICKERS = new Set([
  'PLTR','CRM','ADBE','ORCL','NOW','SNOW','WDAY','ZM','DDOG','CRWD','NET',
  'GOOGL','GOOG','META','MSFT','NFLX','UBER','LYFT','ABNB',
  'JPM','GS','MS','BAC','C','WFC','V','MA','AXP','PYPL',
  'BRK','T','VZ','TMUS','UNH','CVS',
  '055550','105560','086790','032830','030200','017670',
]);
const NO_INVENTORY_KEYWORDS = [
  'SOFTWARE','CLOUD','INTERNET','FINANCIALS','BANCORP','INSURANCE',
  '소프트웨어','금융','보험','증권','통신',
];

function isNonInventory(ticker: string, name: string): boolean {
  if (NO_INVENTORY_TICKERS.has(ticker.toUpperCase())) return true;
  const n = name.toUpperCase();
  return NO_INVENTORY_KEYWORDS.some(kw => n.includes(kw));
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
        setAll:  (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
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

  // STOCK만 (ETF·CRYPTO·COMMODITY 제외)
  const stocks    = holdings.filter(h => getAssetType(h.ticker, h.name, h.market ?? 'US') === 'STOCK');
  const excluded: ExcludedItem[] = holdings
    .filter(h => getAssetType(h.ticker, h.name, h.market ?? 'US') !== 'STOCK')
    .map(h => ({ ticker: h.ticker, name: h.name, reason: 'ETF·암호화폐·원자재는 재고 분석 대상이 아닙니다.' }));

  // 비제조업 사전 제외
  const analyzeList = stocks.filter(h => !isNonInventory(h.ticker, h.name));
  stocks.filter(h => isNonInventory(h.ticker, h.name)).forEach(h =>
    excluded.push({ ticker: h.ticker, name: h.name, reason: '소프트웨어·금융·서비스 기업은 물리적 재고가 없습니다.' })
  );

  if (!analyzeList.length) {
    return NextResponse.json({
      results: [], excludedFromAnalysis: excluded,
      summary: { danger:0, warning:0, healthy:0, unknown:0 },
      message: '재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.', source: 'empty',
    });
  }

  // 4. 병렬 데이터 수집 (개별 에러가 전체를 중단시키지 않도록 allSettled)
  const fetchSettled = await Promise.allSettled(
    analyzeList.map(async h => {
      const isKR      = /^\d{6}$/.test(h.ticker.replace(/\.(KS|KQ)$/i, ''));
      const history   = isKR
        ? await fetchKRStockData(h.ticker)
        : await fetchUSStockData(h.ticker);
      return { h, history };
    })
  );

  // 5. 결과 조립
  const results: StockResult[] = [];

  fetchSettled.forEach(settled => {
    if (settled.status === 'rejected') {
      console.error('[route] 병렬 수집 실패:', settled.reason);
      return;
    }
    const { h, history } = settled.value;
    const currency  = /^\d{6}/.test(h.ticker) ? 'KRW' : 'USD';
    const unitLabel = currency === 'KRW' ? '억원' : 'M$';
    const isKR      = currency === 'KRW';

    if (!history || history.length === 0) {
      // 데이터 없음 → UNKNOWN으로 리스트에 포함 (제외 아님)
      results.push({
        ticker: h.ticker, name: h.name, market: h.market ?? 'US',
        currency, unitLabel,
        signal: 'UNKNOWN', gap: 0, latestQuarter: '',
        revenueYoY: 0, inventoryYoY: 0,
        consecutiveDanger: 0, quarterlyHistory: [],
        lynchAlert: `"${h.name}의 분기 재고·매출 데이터를 수집할 수 없었습니다. ${isKR ? 'WiseReport' : 'Yahoo Finance'} 응답을 확인해주세요."`,
        dataSource: isKR ? 'wisereport' : 'yahoo',
      });
      return;
    }

    // 데이터 있는 분기만 필터 (revenue > 0)
    const validHistory = history.filter(q => q.revenueYoY !== 0 || q.inventoryYoY !== 0 || q.hasYoY);
    const latest       = validHistory[validHistory.length - 1] ?? history[history.length - 1];
    const revYoY       = latest?.revenueYoY   ?? 0;
    const invYoY       = latest?.inventoryYoY ?? 0;
    const signal       = latest?.hasYoY ? calcSignal(revYoY, invYoY) : 'UNKNOWN';
    const gap          = parseFloat((invYoY - revYoY).toFixed(1));
    const consec       = countConsecutiveDanger(history);

    results.push({
      ticker: h.ticker, name: h.name, market: h.market ?? 'US',
      currency, unitLabel, signal, gap,
      latestQuarter:     latest?.quarter     ?? '',
      revenueYoY:        parseFloat(revYoY.toFixed(1)),
      inventoryYoY:      parseFloat(invYoY.toFixed(1)),
      consecutiveDanger: consec,
      quarterlyHistory:  history,
      lynchAlert:        buildLynchAlert(signal, h.name, gap, consec),
      dataSource:        isKR ? 'wisereport' : 'yahoo',
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
    // ★ 프론트엔드 ApiResponse.meta 스키마와 1:1 매칭
    //   { totalHoldings, analyzable, excluded, analyzed, cacheHit, cacheMiss, pipeline? }
    meta: {
      totalHoldings: holdings.length,
      analyzable:    analyzeList.length,
      excluded:      excluded.length,
      analyzed:      results.filter(r => r.signal !== 'UNKNOWN').length,
      cacheHit:      0,   // 현재 캐시 없는 실시간 수집 방식
      cacheMiss:     analyzeList.length,
      pipeline:      '미국:yahoo-finance2 / 한국:WiseReport',
    },
  });
}
