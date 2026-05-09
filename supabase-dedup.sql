-- ================================================================
-- investments 테이블 중복 데이터 확인 및 제거
-- Supabase Dashboard → SQL Editor 에서 실행하세요.
-- ================================================================

-- 1. 중복 확인 (같은 user + ticker 조합이 2개 이상인 것)
SELECT
  user_id,
  ticker,
  name,
  COUNT(*)        AS duplicate_count,
  MIN(created_at) AS first_added,
  MAX(created_at) AS last_added
FROM public.investments
GROUP BY user_id, ticker, name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;


-- 2. 중복 제거 (각 user+ticker 조합에서 가장 오래된 행 1개만 남김)
--    실행 전 위의 SELECT로 확인 후 진행하세요.
DELETE FROM public.investments
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, ticker) id
  FROM public.investments
  ORDER BY user_id, ticker, created_at ASC
);


-- 3. 삭제 후 확인
SELECT ticker, name, market, purchase_price, quantity, created_at
FROM public.investments
ORDER BY created_at DESC;
