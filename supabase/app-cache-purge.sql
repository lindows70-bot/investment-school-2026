-- app_cache 정리 — 옛 버전 캐시(A)와 허용 목록의 보존 기간을 넘긴 행(B)을 지운다. 사용자가 SQL Editor 에서 직접 실행한다
--
-- 📏 근거: 2026-09-26 실측(PostgREST key·updated_at 만 읽음) — app_cache 35,982행.
--    A = 코드 어디에도 없는 옛 버전 접두어 339개(16,278행) + 옛 macro 유니버스/AI 픽 키 19개
--    B = src/lib/cachePurge.ts PURGE_RULES 의 보존 기간을 넘긴 행 약 15,913행(실행 시점 now() 기준이라 조금 달라진다)
--    ⛔ 이 파일은 읽기 전용 실측으로 만들었고 실행한 적이 없다. 판단 근거는 커밋 메시지·보고서 참고.
--
-- ⚠️ 실행 방법
--   ① 맨 위 미리보기(select)부터 돌려 숫자를 확인한다.
--   ② delete 는 **한 문장씩 선택해서** 실행한다 — SQL Editor 는 스크립트 전체를 한 트랜잭션으로 감싸므로 통째로 돌리면 타임아웃·롤백 위험.
--   ③ 'limit' 이 붙은 delete 는 결과가 0 rows 가 될 때까지 같은 문장을 반복한다.
--   ④ "cannot execute DELETE in a read-only transaction" 이 나면 그 문장 바로 앞에 set transaction read write; 를 붙여 함께 실행.
--   ⑤ 지운 공간은 재사용될 뿐 디스크가 바로 줄지는 않는다 — 대시보드 크기를 줄이려면 맨 아래 선택 단계(vacuum full)를 참고.
--   ⛔ 디스크가 거의 찬 상태(80%↑)에서는 delete 하지 마라(WAL 이 남은 공간을 먹는다 — 2026-09-26 2차 사고). 지금은 116 MB / 500 MB.

-- ════════════════════════════════════════════════════════════════════
-- 0. 미리보기 (읽기만)
-- ════════════════════════════════════════════════════════════════════

-- 0-1. 전체 크기
select count(*) as rows, pg_size_pretty(pg_total_relation_size('public.app_cache')) as app_cache_size,
       pg_size_pretty(pg_database_size(current_database())) as db_size
from public.app_cache;

-- 0-2. A(옛 버전) 접두어별 행 수 — 실측 합계 16,278 + 개별 키 19
select split_part(split_part(key, ':', 1), '|', 1) as prefix, count(*) as rows, max(updated_at) as newest
from public.app_cache
where split_part(split_part(key, ':', 1), '|', 1) in (
  'jarvis-metrics-v10',
  'jarvis-metrics-v11',
  'jarvis-metrics-v12',
  'jarvis-metrics-v13',
  'jarvis-metrics-v14',
  'jarvis-metrics-v15',
  'jarvis-metrics-v16',
  'jarvis-metrics-v4',
  'jarvis-metrics-v5',
  'jarvis-metrics-v6',
  'jarvis-metrics-v7',
  'jarvis-metrics-v8',
  'jarvis-metrics-v9',
  'money-flow-v1',
  'money-flow-v2',
  'money-flow-v3',
  'money-flow-v4',
  'money-flow-v5',
  'money-flow-v6',
  'canon-fund',
  'true-fcf-v1',
  'masters-brief-v1',
  'masters-brief-v10',
  'masters-brief-v11',
  'masters-brief-v12',
  'masters-brief-v13',
  'masters-brief-v2',
  'masters-brief-v3',
  'masters-brief-v4',
  'masters-brief-v5',
  'masters-brief-v6',
  'masters-brief-v7',
  'masters-brief-v8',
  'masters-brief-v9',
  'research-verdict-v1',
  'research-verdict-v10',
  'research-verdict-v11',
  'research-verdict-v12',
  'research-verdict-v13',
  'research-verdict-v14',
  'research-verdict-v15',
  'research-verdict-v16',
  'research-verdict-v17',
  'research-verdict-v18',
  'research-verdict-v19',
  'research-verdict-v2',
  'research-verdict-v20',
  'research-verdict-v21',
  'research-verdict-v22',
  'research-verdict-v23',
  'research-verdict-v24',
  'research-verdict-v3',
  'research-verdict-v4',
  'research-verdict-v5',
  'research-verdict-v6',
  'research-verdict-v7',
  'research-verdict-v8',
  'research-verdict-v9',
  'div-explorer',
  'div-explorer-v2',
  'div-explorer-v3',
  'div-explorer-v4',
  'div-explorer-v5',
  'div-explorer-v6',
  'div-explorer-v7',
  'div-explorer-v8',
  'kr-earnings-v1',
  'kr-earnings-v2',
  'kr-earnings-v3',
  'kr-earnings-v4',
  'news-catalyst',
  'news-catalyst-v2',
  'news-catalyst-v3',
  'news-catalyst-v4',
  'news-catalyst-v5',
  'news-catalyst-v6',
  'stock-profile-v1',
  'stock-profile-v2',
  'stock-profile-v3',
  'stock-profile-v4',
  'sector-v1',
  'sector-v2',
  'market-catalyst-v1',
  'market-catalyst-v2',
  'market-catalyst-v3',
  'law-admrul-purpose-v1',
  'law-admrul-purpose-v2',
  'law-admrul-purpose-v3',
  'etf-comp-v1',
  'etf-comp-v2',
  'etf-comp-v3',
  'etf-comp-v4',
  'quant-builder-v1',
  'quant-builder-v2',
  'quant-builder-v3',
  'quant-builder-v4',
  'quant-builder-v5',
  'quant-builder-v6',
  'quant-builder-v7',
  'quant-builder-v7+v52',
  'quant-builder-v8+v52',
  'quant-builder-v8+v53',
  'quant-builder-v8+v54',
  'quant-builder-v8+v55',
  'quant-builder-v8+v56',
  'quant-builder-v8+v61',
  'fomc-decoder-v1',
  'fomc-decoder-v2',
  'fomc-decoder-v3',
  'fomc-decoder-v4',
  'fomc-decoder-v5',
  'fomc-decoder-v6',
  'fomc-decoder-v7',
  'fomc-decoder-v8',
  'global-top10-v1',
  'global-top10-v2',
  'sector-rotation-v1',
  'sector-rotation-v10',
  'sector-rotation-v11',
  'sector-rotation-v12',
  'sector-rotation-v13',
  'sector-rotation-v14',
  'sector-rotation-v2',
  'sector-rotation-v3',
  'sector-rotation-v4',
  'sector-rotation-v5',
  'sector-rotation-v6dbg',
  'sector-rotation-v7',
  'sector-rotation-v8',
  'sector-rotation-v9',
  'swing-radar-v1',
  'swing-radar-v10',
  'swing-radar-v11',
  'swing-radar-v12',
  'swing-radar-v13',
  'swing-radar-v14',
  'swing-radar-v2',
  'swing-radar-v3',
  'swing-radar-v4',
  'swing-radar-v5',
  'swing-radar-v6',
  'swing-radar-v7',
  'swing-radar-v8',
  'swing-radar-v9',
  'tech-screener-v1',
  'tech-screener-v2',
  'tech-screener-v3',
  'rtms-rent-v1',
  'rtms-trade-v1',
  'market-flow-kr-v1',
  'market-flow-kr-v2',
  'market-flow-kr-v3',
  'market-flow-kr-v4',
  'market-flow-kr-v5',
  'market-flow-kr-v6',
  'market-flow-kr-v7',
  'market-flow-kr-v8',
  'market-flow-kr-v9',
  'hi52-radar-v1',
  'hi52-radar-v2',
  'market-breadth-v1',
  'signal-report-v1',
  'signal-report-v10',
  'signal-report-v11',
  'signal-report-v12',
  'signal-report-v2',
  'signal-report-v3',
  'signal-report-v4',
  'signal-report-v5',
  'signal-report-v6',
  'signal-report-v7',
  'signal-report-v8',
  'signal-report-v9',
  'roe-trend-v1',
  'tenbagger-v1',
  'tenbagger-v2',
  'tenbagger-v3',
  'tenbagger-v4',
  'win-lose-v1',
  'win-lose-v2',
  'win-lose-v3',
  'win-lose-v4',
  'win-lose-v5',
  'win-lose-v6',
  'win-lose-v7',
  'win-lose-v8',
  'mkt-investor-v1',
  'mkt-investor-v2',
  'mkt-investor-v3',
  'weekly-report-common-v1',
  'weekly-report-common-v10',
  'weekly-report-common-v11',
  'weekly-report-common-v3',
  'weekly-report-common-v4',
  'weekly-report-common-v5',
  'weekly-report-common-v6',
  'weekly-report-common-v7',
  'weekly-report-common-v8',
  'weekly-report-common-v9',
  'coin-lab-v1',
  'coin-lab-v10',
  'coin-lab-v11',
  'coin-lab-v12',
  'coin-lab-v13',
  'coin-lab-v14',
  'coin-lab-v15',
  'coin-lab-v16',
  'coin-lab-v17',
  'coin-lab-v18',
  'coin-lab-v19',
  'coin-lab-v2',
  'coin-lab-v3',
  'coin-lab-v4',
  'coin-lab-v5',
  'coin-lab-v6',
  'coin-lab-v7',
  'coin-lab-v8',
  'coin-lab-v9',
  'bonds-v1',
  'bonds-v2',
  'bonds-v3',
  'bonds-v4',
  'bonds-v5',
  'bonds-v6',
  'bonds-v7',
  'research-report-v1',
  'research-report-v2',
  'research-report-v3',
  'marks-cycle-v1',
  'marks-cycle-v2',
  'marks-cycle-v3',
  'ultra-dividend-v1',
  'ultra-dividend-v2',
  'ultra-dividend-v3',
  'masters-committee-v1',
  'masters-committee-v11',
  'masters-committee-v7',
  'crypto-demand-v1',
  'crisis-radar-v1',
  'crisis-radar-v2',
  'crisis-radar-v3',
  'crisis-radar-v4',
  'crisis-radar-v6',
  'crisis-radar-v7',
  'crisis-radar-v8',
  'dividend-portfolio-v1',
  'law-doc-v1',
  'law-doc-v2',
  're-policy-v1',
  're-policy-v2',
  're-policy-v3',
  're-policy-v4',
  're-policy-v5',
  'earnings-report-v1',
  'guru-portfolio-v1',
  'guru-portfolio-v2',
  'guru-portfolio-v3',
  'guru-portfolio-v4',
  'guru-portfolio-v5',
  'quantum-sector-v1',
  'quantum-sector-v2',
  'quantum-sector-v3',
  'quantum-sector-v4',
  'quantum-sector-v5',
  'crypto-regulation-v1',
  'etf-flow-v1',
  'etf-flow-v2',
  're-redevelop-v1',
  're-redevelop-v2',
  'yield-curve-v1',
  'yield-curve-v2',
  'yield-curve-v3',
  'altcoins-v1',
  'altcoins-v2',
  'altcoins-v3',
  'altcoins-v4',
  'dalio-cycle-v1',
  'dalio-cycle-v2',
  'dalio-cycle-v3',
  'dalio-cycle-v4',
  'stablecoin-v1',
  'stablecoin-v2',
  'stablecoin-v3',
  'stablecoin-v4',
  're-tax-v1',
  're-tax-v2',
  'ipo-cycle-v1',
  'ipo-cycle-v2',
  'ipo-cycle-v3',
  'kr-earnings-index-v2',
  'kr-earnings-index-v3',
  'kr-earnings-index-v4',
  're-honeycomb-v1',
  're-honeycomb-v2',
  're-honeycomb-v3',
  'satellite-scores-v1',
  'satellite-scores-v2',
  'satellite-scores-v3',
  'crypto-candles-v1',
  'elliott-wave-edu-v1',
  'portfolio-xray-v4',
  'ai-rebalance-v33',
  'ai-rebalance-v41',
  'crypto-stocks-v1',
  'crypto-stocks-v2',
  'fed-charts-v1',
  'fed-charts-v2',
  'fed-dual-mandate-v1',
  'fed-dual-mandate-v2',
  'hq-briefing-v11',
  'hq-briefing-v12',
  'index-flow-v1',
  'index-flow-v2',
  'macro-phase-data-v2',
  'macro-phase-data-v3',
  're-gauge-v1',
  're-gauge-v2',
  're-supply-v1',
  're-supply-v2',
  'season-navigator-v11',
  'season-navigator-v8',
  'season-sector-v1',
  'season-sector-v2',
  'shadow-13f-funds-v2',
  'shadow-13f-funds-v3',
  'unified-reco-v19',
  'unified-reco-v35',
  'asset-rank-v1',
  'blackrock-13f-v1',
  'candle-pattern-v1',
  'cme-cot-v1',
  'correlation-radar-v1',
  'country-vol-v1',
  'covered-call-xray-v1',
  'global-cycle-v1',
  'guru-13f-history',
  'law-admrul-v1',
  'leverage-radar-v1',
  're-market-v1'
)
group by 1 order by 2 desc;

select count(*) as old_single_keys from public.app_cache where key in ('macro-ai-picks:weekly', 'macro-ai-picks:weekly:v2', 'macro-ai-picks:weekly:v3', 'macro-screened-universe:v1', 'macro-screened-universe:v10', 'macro-screened-universe:v11', 'macro-screened-universe:v12', 'macro-screened-universe:v13', 'macro-screened-universe:v14', 'macro-screened-universe:v15', 'macro-screened-universe:v16', 'macro-screened-universe:v2', 'macro-screened-universe:v3', 'macro-screened-universe:v4', 'macro-screened-universe:v5', 'macro-screened-universe:v6', 'macro-screened-universe:v7', 'macro-screened-universe:v8', 'macro-screened-universe:v9');

-- 0-3. B(보존 기간 초과) 규칙별 지울 행 수 — 실측 합계 약 15,913
with rules(prefix, keep_days) as (values
  ('jarvis-metrics-v17', 3),
  ('money-flow-v7', 3),
  ('jarvis-brief-v6', 3),
  ('news-catalyst-v7', 3),
  ('kr-intraday-v1', 3),
  ('dilution-v1', 3),
  ('masters-committee-v14', 3),
  ('masters-brief-v14', 3),
  ('mf-timeline-v1', 3),
  ('short-int-v1', 3),
  ('stock-profile-v5', 3),
  ('research-verdict-v25', 3),
  ('research-report-v4', 3),
  ('crypto-candles-v2', 3),
  ('sector-v3', 3),
  ('market-flow-kr-v10', 10),
  ('sector-rotation-v15', 10),
  ('win-lose-v9', 10),
  ('market-breadth-v2', 10),
  ('covered-call-xray-v2', 10),
  ('tech-screener-v4', 10),
  ('hi52-radar-v3', 10),
  ('yield-curve-v4', 10),
  ('market-catalyst-v4', 10),
  ('cme-cot-v2', 10),
  ('crypto-funding-v1', 10),
  ('crypto-regulation-v2', 10),
  ('stablecoin-v5', 10),
  ('country-vol-v2', 10),
  ('us-liquidity-v1', 10),
  ('analyst-rerating-v1', 10),
  ('insider-market-v1', 10),
  ('usm-grade-v1', 10),
  ('asset-rank-v2', 10),
  ('swing-radar-v15', 10),
  ('signal-report-v13', 10),
  ('weekly-report-common-v12', 10),
  ('correlation-radar-v2', 10),
  ('rot-scorecard-v1', 10),
  ('fomc-decoder-v9', 10),
  ('ghost-discovery-v1', 10),
  ('re-policy-v6', 10),
  ('re-tax-v3', 10),
  ('re-redevelop-v3', 10),
  ('global-top10-v3', 10),
  ('index-flow-v3', 10),
  ('marks-cycle-v4', 10),
  ('mkt-investor-v4', 10),
  ('etf-flow-v3', 10),
  ('core-reco-run-v1', 10),
  ('swing-cron-run-v1', 10),
  ('etf-snap-run-v1', 10),
  ('insider-scan-run-v1', 10),
  ('portfolio-xray-v5', 3),
  ('cash-position-v1', 3),
  ('event-calendar-v2', 3),
  ('exit-plan-v8', 3),
  ('season-navigator-v15', 3),
  ('short-interest-v1', 3),
  ('ai-rebalance-v52+v64', 3),
  ('hq-briefing-v18+v64', 3),
  ('unified-reco-v64', 3),
  ('quant-builder-v8+v64', 3),
  ('guidance-snap', 40),
  ('etf-snap-v1', 401),
  ('insider-day-v1', 401),
  ('rtms-rent-v2', 31)
)
select r.prefix, r.keep_days, count(c.key) as to_delete
from rules r
left join public.app_cache c on starts_with(c.key, r.prefix || ':') and c.updated_at < now() - make_interval(days => r.keep_days)
group by 1, 2 order by 3 desc;

-- ════════════════════════════════════════════════════════════════════
-- A. 옛 버전 — 이제 어디서도 읽지 않는다(git grep 전수: src·scripts·supabase 에 접두어 리터럴 0건)
--    ⛔ 넣지 않은 것: btc-etf-v*(scripts/seed-btc-etf-lastgood.mjs 가 like 'btc-etf-v%' 로 옛 일자 문서를 읽어 시드를 만든다)
--                  oecd-cli-*-v2 · unified-reco-v64 · ai-rebalance-v52+v64 · quant-builder-v8+v64(현재 버전 — 템플릿으로 만든 키라 리터럴 grep 에 안 걸린다)
-- ════════════════════════════════════════════════════════════════════

-- A-1. jarvis-metrics 옛 버전 13종 · 실측 10,999행 → 0 rows 까지 반복(약 4회)
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('jarvis-metrics-v10', 'jarvis-metrics-v11', 'jarvis-metrics-v12', 'jarvis-metrics-v13', 'jarvis-metrics-v14', 'jarvis-metrics-v15', 'jarvis-metrics-v16', 'jarvis-metrics-v4', 'jarvis-metrics-v5', 'jarvis-metrics-v6', 'jarvis-metrics-v7', 'jarvis-metrics-v8', 'jarvis-metrics-v9')
  limit 3000);

-- A-2. money-flow 옛 버전 6종 · 실측 1,548행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('money-flow-v1', 'money-flow-v2', 'money-flow-v3', 'money-flow-v4', 'money-flow-v5', 'money-flow-v6')
  limit 3000);

-- A-3. canon-fund 옛 버전 1종 · 실측 666행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('canon-fund')
  limit 3000);

-- A-4. true-fcf 옛 버전 1종 · 실측 656행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('true-fcf-v1')
  limit 3000);

-- A-5. masters-brief 옛 버전 13종 · 실측 309행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('masters-brief-v1', 'masters-brief-v10', 'masters-brief-v11', 'masters-brief-v12', 'masters-brief-v13', 'masters-brief-v2', 'masters-brief-v3', 'masters-brief-v4', 'masters-brief-v5', 'masters-brief-v6', 'masters-brief-v7', 'masters-brief-v8', 'masters-brief-v9')
  limit 3000);

-- A-6. research-verdict 옛 버전 24종 · 실측 276행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('research-verdict-v1', 'research-verdict-v10', 'research-verdict-v11', 'research-verdict-v12', 'research-verdict-v13', 'research-verdict-v14', 'research-verdict-v15', 'research-verdict-v16', 'research-verdict-v17', 'research-verdict-v18', 'research-verdict-v19', 'research-verdict-v2', 'research-verdict-v20', 'research-verdict-v21', 'research-verdict-v22', 'research-verdict-v23', 'research-verdict-v24', 'research-verdict-v3', 'research-verdict-v4', 'research-verdict-v5', 'research-verdict-v6', 'research-verdict-v7', 'research-verdict-v8', 'research-verdict-v9')
  limit 3000);

-- A-7. div-explorer 옛 버전 8종 · 실측 187행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('div-explorer', 'div-explorer-v2', 'div-explorer-v3', 'div-explorer-v4', 'div-explorer-v5', 'div-explorer-v6', 'div-explorer-v7', 'div-explorer-v8')
  limit 3000);

-- A-8. kr-earnings 옛 버전 4종 · 실측 153행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('kr-earnings-v1', 'kr-earnings-v2', 'kr-earnings-v3', 'kr-earnings-v4')
  limit 3000);

-- A-9. news-catalyst 옛 버전 6종 · 실측 125행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('news-catalyst', 'news-catalyst-v2', 'news-catalyst-v3', 'news-catalyst-v4', 'news-catalyst-v5', 'news-catalyst-v6')
  limit 3000);

-- A-10. stock-profile 옛 버전 4종 · 실측 120행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('stock-profile-v1', 'stock-profile-v2', 'stock-profile-v3', 'stock-profile-v4')
  limit 3000);

-- A-11. sector 옛 버전 2종 · 실측 98행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('sector-v1', 'sector-v2')
  limit 3000);

-- A-12. market-catalyst 옛 버전 3종 · 실측 71행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('market-catalyst-v1', 'market-catalyst-v2', 'market-catalyst-v3')
  limit 3000);

-- A-13. law-admrul-purpose 옛 버전 3종 · 실측 69행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('law-admrul-purpose-v1', 'law-admrul-purpose-v2', 'law-admrul-purpose-v3')
  limit 3000);

-- A-14. etf-comp 옛 버전 4종 · 실측 68행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('etf-comp-v1', 'etf-comp-v2', 'etf-comp-v3', 'etf-comp-v4')
  limit 3000);

-- A-15. quant-builder 옛 버전 14종 · 실측 66행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('quant-builder-v1', 'quant-builder-v2', 'quant-builder-v3', 'quant-builder-v4', 'quant-builder-v5', 'quant-builder-v6', 'quant-builder-v7', 'quant-builder-v7+v52', 'quant-builder-v8+v52', 'quant-builder-v8+v53', 'quant-builder-v8+v54', 'quant-builder-v8+v55', 'quant-builder-v8+v56', 'quant-builder-v8+v61')
  limit 3000);

-- A-16. fomc-decoder 옛 버전 8종 · 실측 65행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('fomc-decoder-v1', 'fomc-decoder-v2', 'fomc-decoder-v3', 'fomc-decoder-v4', 'fomc-decoder-v5', 'fomc-decoder-v6', 'fomc-decoder-v7', 'fomc-decoder-v8')
  limit 3000);

-- A-17. global-top10 옛 버전 2종 · 실측 60행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('global-top10-v1', 'global-top10-v2')
  limit 3000);

-- A-18. sector-rotation 옛 버전 14종 · 실측 55행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('sector-rotation-v1', 'sector-rotation-v10', 'sector-rotation-v11', 'sector-rotation-v12', 'sector-rotation-v13', 'sector-rotation-v14', 'sector-rotation-v2', 'sector-rotation-v3', 'sector-rotation-v4', 'sector-rotation-v5', 'sector-rotation-v6dbg', 'sector-rotation-v7', 'sector-rotation-v8', 'sector-rotation-v9')
  limit 3000);

-- A-19. swing-radar 옛 버전 14종 · 실측 51행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('swing-radar-v1', 'swing-radar-v10', 'swing-radar-v11', 'swing-radar-v12', 'swing-radar-v13', 'swing-radar-v14', 'swing-radar-v2', 'swing-radar-v3', 'swing-radar-v4', 'swing-radar-v5', 'swing-radar-v6', 'swing-radar-v7', 'swing-radar-v8', 'swing-radar-v9')
  limit 3000);

-- A-20. tech-screener 옛 버전 3종 · 실측 50행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('tech-screener-v1', 'tech-screener-v2', 'tech-screener-v3')
  limit 3000);

-- A-21. rtms-rent 옛 버전 1종 · 실측 48행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('rtms-rent-v1')
  limit 3000);

-- A-22. rtms-trade 옛 버전 1종 · 실측 48행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('rtms-trade-v1')
  limit 3000);

-- A-23. market-flow-kr 옛 버전 9종 · 실측 47행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('market-flow-kr-v1', 'market-flow-kr-v2', 'market-flow-kr-v3', 'market-flow-kr-v4', 'market-flow-kr-v5', 'market-flow-kr-v6', 'market-flow-kr-v7', 'market-flow-kr-v8', 'market-flow-kr-v9')
  limit 3000);

-- A-24. hi52-radar 옛 버전 2종 · 실측 45행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('hi52-radar-v1', 'hi52-radar-v2')
  limit 3000);

-- A-25. market-breadth 옛 버전 1종 · 실측 42행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in ('market-breadth-v1')
  limit 3000);

-- A-26. 그 밖의 옛 버전 178종(60개 기능) · 실측 356행
delete from public.app_cache where key in (
  select key from public.app_cache
  where split_part(split_part(key, ':', 1), '|', 1) in (
    'signal-report-v1',
    'signal-report-v10',
    'signal-report-v11',
    'signal-report-v12',
    'signal-report-v2',
    'signal-report-v3',
    'signal-report-v4',
    'signal-report-v5',
    'signal-report-v6',
    'signal-report-v7',
    'signal-report-v8',
    'signal-report-v9',
    'roe-trend-v1',
    'tenbagger-v1',
    'tenbagger-v2',
    'tenbagger-v3',
    'tenbagger-v4',
    'win-lose-v1',
    'win-lose-v2',
    'win-lose-v3',
    'win-lose-v4',
    'win-lose-v5',
    'win-lose-v6',
    'win-lose-v7',
    'win-lose-v8',
    'mkt-investor-v1',
    'mkt-investor-v2',
    'mkt-investor-v3',
    'weekly-report-common-v1',
    'weekly-report-common-v10',
    'weekly-report-common-v11',
    'weekly-report-common-v3',
    'weekly-report-common-v4',
    'weekly-report-common-v5',
    'weekly-report-common-v6',
    'weekly-report-common-v7',
    'weekly-report-common-v8',
    'weekly-report-common-v9',
    'coin-lab-v1',
    'coin-lab-v10',
    'coin-lab-v11',
    'coin-lab-v12',
    'coin-lab-v13',
    'coin-lab-v14',
    'coin-lab-v15',
    'coin-lab-v16',
    'coin-lab-v17',
    'coin-lab-v18',
    'coin-lab-v19',
    'coin-lab-v2',
    'coin-lab-v3',
    'coin-lab-v4',
    'coin-lab-v5',
    'coin-lab-v6',
    'coin-lab-v7',
    'coin-lab-v8',
    'coin-lab-v9',
    'bonds-v1',
    'bonds-v2',
    'bonds-v3',
    'bonds-v4',
    'bonds-v5',
    'bonds-v6',
    'bonds-v7',
    'research-report-v1',
    'research-report-v2',
    'research-report-v3',
    'marks-cycle-v1',
    'marks-cycle-v2',
    'marks-cycle-v3',
    'ultra-dividend-v1',
    'ultra-dividend-v2',
    'ultra-dividend-v3',
    'masters-committee-v1',
    'masters-committee-v11',
    'masters-committee-v7',
    'crypto-demand-v1',
    'crisis-radar-v1',
    'crisis-radar-v2',
    'crisis-radar-v3',
    'crisis-radar-v4',
    'crisis-radar-v6',
    'crisis-radar-v7',
    'crisis-radar-v8',
    'dividend-portfolio-v1',
    'law-doc-v1',
    'law-doc-v2',
    're-policy-v1',
    're-policy-v2',
    're-policy-v3',
    're-policy-v4',
    're-policy-v5',
    'earnings-report-v1',
    'guru-portfolio-v1',
    'guru-portfolio-v2',
    'guru-portfolio-v3',
    'guru-portfolio-v4',
    'guru-portfolio-v5',
    'quantum-sector-v1',
    'quantum-sector-v2',
    'quantum-sector-v3',
    'quantum-sector-v4',
    'quantum-sector-v5',
    'crypto-regulation-v1',
    'etf-flow-v1',
    'etf-flow-v2',
    're-redevelop-v1',
    're-redevelop-v2',
    'yield-curve-v1',
    'yield-curve-v2',
    'yield-curve-v3',
    'altcoins-v1',
    'altcoins-v2',
    'altcoins-v3',
    'altcoins-v4',
    'dalio-cycle-v1',
    'dalio-cycle-v2',
    'dalio-cycle-v3',
    'dalio-cycle-v4',
    'stablecoin-v1',
    'stablecoin-v2',
    'stablecoin-v3',
    'stablecoin-v4',
    're-tax-v1',
    're-tax-v2',
    'ipo-cycle-v1',
    'ipo-cycle-v2',
    'ipo-cycle-v3',
    'kr-earnings-index-v2',
    'kr-earnings-index-v3',
    'kr-earnings-index-v4',
    're-honeycomb-v1',
    're-honeycomb-v2',
    're-honeycomb-v3',
    'satellite-scores-v1',
    'satellite-scores-v2',
    'satellite-scores-v3',
    'crypto-candles-v1',
    'elliott-wave-edu-v1',
    'portfolio-xray-v4',
    'ai-rebalance-v33',
    'ai-rebalance-v41',
    'crypto-stocks-v1',
    'crypto-stocks-v2',
    'fed-charts-v1',
    'fed-charts-v2',
    'fed-dual-mandate-v1',
    'fed-dual-mandate-v2',
    'hq-briefing-v11',
    'hq-briefing-v12',
    'index-flow-v1',
    'index-flow-v2',
    'macro-phase-data-v2',
    'macro-phase-data-v3',
    're-gauge-v1',
    're-gauge-v2',
    're-supply-v1',
    're-supply-v2',
    'season-navigator-v11',
    'season-navigator-v8',
    'season-sector-v1',
    'season-sector-v2',
    'shadow-13f-funds-v2',
    'shadow-13f-funds-v3',
    'unified-reco-v19',
    'unified-reco-v35',
    'asset-rank-v1',
    'blackrock-13f-v1',
    'candle-pattern-v1',
    'cme-cot-v1',
    'correlation-radar-v1',
    'country-vol-v1',
    'covered-call-xray-v1',
    'global-cycle-v1',
    'guru-13f-history',
    'law-admrul-v1',
    'leverage-radar-v1',
    're-market-v1'
  )
  limit 3000);

-- A-27. 옛 개별 키 19개 — 현재는 macro-screened-universe:v17 · macro-ai-picks:weekly:v5 · macro-ai-picks:phase
delete from public.app_cache where key in ('macro-ai-picks:weekly', 'macro-ai-picks:weekly:v2', 'macro-ai-picks:weekly:v3', 'macro-screened-universe:v1', 'macro-screened-universe:v10', 'macro-screened-universe:v11', 'macro-screened-universe:v12', 'macro-screened-universe:v13', 'macro-screened-universe:v14', 'macro-screened-universe:v15', 'macro-screened-universe:v16', 'macro-screened-universe:v2', 'macro-screened-universe:v3', 'macro-screened-universe:v4', 'macro-screened-universe:v5', 'macro-screened-universe:v6', 'macro-screened-universe:v7', 'macro-screened-universe:v8', 'macro-screened-universe:v9');

-- ════════════════════════════════════════════════════════════════════
-- B. 보존 기간 초과 — src/lib/cachePurge.ts PURGE_RULES 와 같은 규칙(크론이 매일 하는 일을 한 번에)
--    keep_days 는 그 접두어를 읽는 모든 getCache 의 maxAge 보다 길다 → 이보다 오래된 행은 어차피 읽히지 않는다.
--    배포 전에 실행해도 안전하다(지금 배포된 코드도 같은 TTL 로 읽는다).
-- ════════════════════════════════════════════════════════════════════

-- B-1. jarvis-metrics-v17 · 3일 초과 · 실측 약 5,399행 → 0 rows 까지 반복(약 2회)
delete from public.app_cache where key in (
  select key from public.app_cache
  where starts_with(key, 'jarvis-metrics-v17:') and updated_at < now() - interval '3 days'
  limit 3000);

-- B-2. money-flow-v7 · 3일 초과 · 실측 약 3,174행 → 0 rows 까지 반복(약 2회)
delete from public.app_cache where key in (
  select key from public.app_cache
  where starts_with(key, 'money-flow-v7:') and updated_at < now() - interval '3 days'
  limit 3000);

-- B-3. jarvis-brief-v6 · 3일 초과 · 실측 약 2,788행
delete from public.app_cache where key in (
  select key from public.app_cache
  where starts_with(key, 'jarvis-brief-v6:') and updated_at < now() - interval '3 days'
  limit 3000);

-- B-4. sector-v3 · 3일 초과 · 실측 약 1,144행
delete from public.app_cache where key in (
  select key from public.app_cache
  where starts_with(key, 'sector-v3:') and updated_at < now() - interval '3 days'
  limit 3000);

-- B-5. 나머지 규칙 63개 · 실측 약 3,408행(rtms-rent-v2 558행이 가장 무겁다 — 행당 약 120 KB) → 0 rows 까지 반복
with rules(prefix, keep_days) as (values
  ('news-catalyst-v7', 3),
  ('kr-intraday-v1', 3),
  ('dilution-v1', 3),
  ('masters-committee-v14', 3),
  ('masters-brief-v14', 3),
  ('mf-timeline-v1', 3),
  ('short-int-v1', 3),
  ('stock-profile-v5', 3),
  ('research-verdict-v25', 3),
  ('research-report-v4', 3),
  ('crypto-candles-v2', 3),
  ('market-flow-kr-v10', 10),
  ('sector-rotation-v15', 10),
  ('win-lose-v9', 10),
  ('market-breadth-v2', 10),
  ('covered-call-xray-v2', 10),
  ('tech-screener-v4', 10),
  ('hi52-radar-v3', 10),
  ('yield-curve-v4', 10),
  ('market-catalyst-v4', 10),
  ('cme-cot-v2', 10),
  ('crypto-funding-v1', 10),
  ('crypto-regulation-v2', 10),
  ('stablecoin-v5', 10),
  ('country-vol-v2', 10),
  ('us-liquidity-v1', 10),
  ('analyst-rerating-v1', 10),
  ('insider-market-v1', 10),
  ('usm-grade-v1', 10),
  ('asset-rank-v2', 10),
  ('swing-radar-v15', 10),
  ('signal-report-v13', 10),
  ('weekly-report-common-v12', 10),
  ('correlation-radar-v2', 10),
  ('rot-scorecard-v1', 10),
  ('fomc-decoder-v9', 10),
  ('ghost-discovery-v1', 10),
  ('re-policy-v6', 10),
  ('re-tax-v3', 10),
  ('re-redevelop-v3', 10),
  ('global-top10-v3', 10),
  ('index-flow-v3', 10),
  ('marks-cycle-v4', 10),
  ('mkt-investor-v4', 10),
  ('etf-flow-v3', 10),
  ('core-reco-run-v1', 10),
  ('swing-cron-run-v1', 10),
  ('etf-snap-run-v1', 10),
  ('insider-scan-run-v1', 10),
  ('portfolio-xray-v5', 3),
  ('cash-position-v1', 3),
  ('event-calendar-v2', 3),
  ('exit-plan-v8', 3),
  ('season-navigator-v15', 3),
  ('short-interest-v1', 3),
  ('ai-rebalance-v52+v64', 3),
  ('hq-briefing-v18+v64', 3),
  ('unified-reco-v64', 3),
  ('quant-builder-v8+v64', 3),
  ('guidance-snap', 40),
  ('etf-snap-v1', 401),
  ('insider-day-v1', 401),
  ('rtms-rent-v2', 31)
)
delete from public.app_cache where key in (
  select c.key from public.app_cache c
  join rules r on starts_with(c.key, r.prefix || ':') and c.updated_at < now() - make_interval(days => r.keep_days)
  limit 1000);

-- ════════════════════════════════════════════════════════════════════
-- C. (선택) 디스크 반환 — delete 한 공간은 재사용만 되고 대시보드 크기는 그대로다.
--    vacuum full 은 테이블을 새로 써서 공간을 돌려준다(남은 데이터만큼 여유 공간 필요 · 도는 동안 app_cache 잠김 → 앱 캐시 조회가 잠시 멈춘다).
--    이 문장만 단독으로 실행한다(트랜잭션 안에서는 못 돈다). 한가한 시간에.
-- ════════════════════════════════════════════════════════════════════
-- vacuum full public.app_cache;
