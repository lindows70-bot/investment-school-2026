-- ================================================================
-- investments 테이블 : lynch_category 에 'na' 값 추가
-- ETF / 암호화폐 종목을 'na'(N/A)로 일괄 업데이트
--
-- Supabase Dashboard → SQL Editor 에서 실행하세요.
-- ================================================================

-- 1. 기존 CHECK 제약 삭제 후 'na' 추가 재생성
ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_lynch_category_check;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_lynch_category_check
  CHECK (lynch_category IN (
    'slow_grower', 'stalwart', 'fast_grower',
    'cyclical',    'turnaround', 'asset_play',
    'na'          -- ETF / 암호화폐
  ));

-- 2. 암호화폐 전체 → 'na'
UPDATE public.investments
SET lynch_category = 'na'
WHERE market = 'CRYPTO';

-- 3. 알려진 한국 ETF 코드 → 'na'
UPDATE public.investments
SET lynch_category = 'na'
WHERE market = 'KR'
  AND ticker IN (
    '360750','133690','102110','449450','229200','069500',
    '091160','114800','251340','252670','305720','458730'
  );

-- 4. 알려진 미국 ETF 티커 → 'na'
UPDATE public.investments
SET lynch_category = 'na'
WHERE market = 'US'
  AND ticker IN (
    'SPY','QQQ','IWM','DIA','VTI','VOO','VEA','VWO',
    'EFA','GLD','SLV','USO','ARKK','ARKG','SOXL',
    'TQQQ','SQQQ','UVXY','TLT','HYG','LQD'
  );

-- 5. 종목명으로 ETF 판별 (TIGER, KODEX, ACE, PLUS, KBSTAR 등)
UPDATE public.investments
SET lynch_category = 'na'
WHERE lynch_category IS NULL
  AND (
    name ILIKE 'TIGER %'
    OR name ILIKE 'KODEX %'
    OR name ILIKE 'ACE %'
    OR name ILIKE 'PLUS %'
    OR name ILIKE 'KBSTAR %'
    OR name ILIKE 'HANARO %'
    OR name ILIKE 'ARIRANG %'
    OR name ILIKE '%ETF%'
  );

-- 6. 결과 확인
SELECT market, ticker, name, lynch_category
FROM public.investments
ORDER BY market, ticker;
