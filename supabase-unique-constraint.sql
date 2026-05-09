-- ================================================================
-- investments 테이블 중복 완전 차단
-- Supabase Dashboard → SQL Editor 에서 순서대로 실행하세요.
-- ================================================================

-- STEP 1: 기존 중복 데이터 정리 (UNIQUE 제약 추가 전 필수)
--   같은 user_id + ticker 조합에서 created_at 가장 오래된 1개만 남김

DELETE FROM public.investments
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, ticker) id
  FROM public.investments
  ORDER BY user_id, ticker, created_at ASC
);

-- STEP 2: 정리된 데이터 확인
SELECT user_id, ticker, name, created_at
FROM public.investments
ORDER BY user_id, ticker, created_at;

-- STEP 3: UNIQUE 제약 추가
--   이후 동일 user_id + ticker 조합 insert 시 DB가 자동 거부 (에러코드 23505)
ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_user_ticker_unique;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_ticker_unique
  UNIQUE (user_id, ticker);

-- STEP 4: 제약 확인
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.investments'::regclass
  AND contype = 'u';
