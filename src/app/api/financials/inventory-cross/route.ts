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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await (yahooFinance as any).quoteSummary(ticker, {
      modules: ['balanceSheetHistoryQuarterly', 'incomeStatementHistoryQuarterly'],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bsStatements: any[] = summary?.balanceSheetHistoryQuarterly?.balanceSheetStatements  ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStatements: any[] = summary?.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];

    // 날짜별 매핑 (손익 + 재무상태표 병합)
    const dataMap: Record<string, { revenue: number; inventory: number; date: Date }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isStatements.forEach((stmt: any) => {
      const key = new Date(stmt.endDate).toISOString().slice(0, 10);
      if (!dataMap[key]) dataMap[key] = { revenue: 0, inventory: 0, date: new Date(stmt.endDate) };
      dataMap[key].revenue = safeGetNumber(stmt.totalRevenue);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bsStatements.forEach((stmt: any) => {
      const key = new Date(stmt.endDate).toISOString().slice(0, 10);
      if (!dataMap[key]) dataMap[key] = { revenue: 0, inventory: 0, date: new Date(stmt.endDate) };
      dataMap[key].inventory = safeGetNumber(stmt.inventory);
    });

    // 과거 → 현재 정렬
    const sorted = Object.values(dataMap).sort((a, b) => a.date.getTime() - b.date.getTime());

    if (sorted.length < 2) {
      console.error(`[US] ${ticker} 데이터 부족 (${sorted.length}개)`);
      return null;
    }

    console.log(`[US] ${ticker} 분기 ${sorted.length}개 취득`);
    sorted.forEach((d, i) =>
      console.log(`  Q${i}: ${formatQuarter(d.date)} rev=${d.revenue.toLocaleString()} inv=${d.inventory.toLocaleString()}`)
    );

    // YoY 계산 — 4분기 전과 비교 (동일 계절 분기)
    const result: QuarterPoint[] = sorted.map((curr, idx) => {
      const label = formatQuarter(curr.date);
      let revYoY = 0, invYoY = 0, hasYoY = false;

      if (idx >= 4) {
        const prev = sorted[idx - 4];   // 정확한 전년 동기
        if (prev.revenue   > 0) { revYoY = ((curr.revenue   - prev.revenue)   / prev.revenue)   * 100; hasYoY = true; }
        if (prev.inventory > 0) { invYoY = ((curr.inventory - prev.inventory) / prev.inventory) * 100; }
      }

      return {
        quarter:      label,
        revenueYoY:   parseFloat(revYoY.toFixed(1)),
        inventoryYoY: parseFloat(invYoY.toFixed(1)),
        hasYoY,
      };
    });

    // 최근 4~8개 분기 반환 (차트에 표시할 분량)
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
    meta: {
      totalHoldings: holdings.length,
      analyzable:    analyzeList.length,
      excluded:      excluded.length,
      analyzed:      results.filter(r => r.signal !== 'UNKNOWN').length,
      pipeline:      '미국:yahoo-finance2(quoteSummary) / 한국:WiseReport-스크래핑',
      updatedAt:     new Date().toISOString(),
    },
  });
}
