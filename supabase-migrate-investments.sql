-- ================================================================
-- 기존 investments → transactions 일괄 이전
-- 이미 transactions 테이블에 없는 종목만 삽입 (중복 방지)
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ================================================================

INSERT INTO public.transactions (
  user_id,
  investment_id,
  ticker,
  name,
  market,
  currency,
  type,
  price,
  quantity,
  total_amount,
  fee,
  memo,
  transaction_date
)
SELECT
  inv.user_id,
  inv.id                        AS investment_id,
  inv.ticker,
  inv.name,
  inv.market,
  inv.currency,
  'buy'                         AS type,
  inv.purchase_price            AS price,
  inv.quantity,
  inv.purchase_price * inv.quantity AS total_amount,
  0                             AS fee,
  '기존 포트폴리오 이전'         AS memo,
  inv.purchase_date             AS transaction_date
FROM public.investments inv
WHERE NOT EXISTS (
  -- 이미 이전된 항목은 건너뜀 (중복 방지)
  SELECT 1
  FROM public.transactions t
  WHERE t.investment_id = inv.id
    AND t.memo = '기존 포트폴리오 이전'
);

-- 결과 확인
SELECT
  t.transaction_date,
  t.name,
  t.ticker,
  t.type,
  t.price,
  t.quantity,
  t.total_amount,
  t.memo
FROM public.transactions t
ORDER BY t.transaction_date ASC;
