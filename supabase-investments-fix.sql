-- ================================================================
-- investments 테이블 수정 스크립트
-- Supabase Dashboard → SQL Editor 에서 전체 실행하세요.
--
-- 아래 내용을 순서대로 처리합니다:
--   1. 현재 상태 진단 (SELECT 결과를 확인하세요)
--   2. investments 테이블 없으면 생성
--   3. RLS 정책 재설정
--   4. 기존 데이터 user_id 확인
-- ================================================================


-- ── STEP 1: 진단 ────────────────────────────────────────────────
-- 실행 후 결과를 확인하세요.

-- 1-A. investments 테이블이 존재하는지 확인
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('investments', 'holdings', 'profiles');

-- 1-B. 현재 RLS 정책 확인
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'investments';

-- 1-C. investments 테이블의 모든 데이터 확인 (슈퍼유저 권한)
SELECT id, user_id, ticker, name, market, created_at
FROM public.investments
LIMIT 20;

-- 1-D. auth.users 와 비교
SELECT
  i.id AS inv_id,
  i.user_id,
  i.ticker,
  u.email,
  (i.user_id = u.id) AS user_id_matches
FROM public.investments i
LEFT JOIN auth.users u ON u.id = i.user_id
LIMIT 20;


-- ── STEP 2: investments 테이블이 없으면 생성 ─────────────────────

CREATE TABLE IF NOT EXISTS public.investments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker         text        NOT NULL,
  name           text        NOT NULL,
  market         text        NOT NULL CHECK (market IN ('US', 'KR', 'CRYPTO')),
  currency       text        NOT NULL CHECK (currency IN ('USD', 'KRW')),
  purchase_price numeric(20, 4) NOT NULL CHECK (purchase_price > 0),
  quantity       numeric(20, 8) NOT NULL CHECK (quantity > 0),
  purchase_date  date        NOT NULL,
  lynch_category text        CHECK (lynch_category IN (
    'slow_grower', 'stalwart', 'fast_grower',
    'cyclical',    'turnaround', 'asset_play'
  )),
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ── STEP 3: RLS 활성화 및 정책 재설정 ────────────────────────────

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (중복 방지)
DROP POLICY IF EXISTS "investments: 본인 조회"    ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 추가"    ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 수정"    ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 삭제"    ON public.investments;
DROP POLICY IF EXISTS "investments: teacher 전체 조회" ON public.investments;
-- 혹시 다른 이름으로 만들어진 정책도 삭제
DROP POLICY IF EXISTS "investments: student 본인 조회" ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 추가" ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 수정" ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 삭제" ON public.investments;

-- SELECT: 본인 데이터만 조회
CREATE POLICY "investments: 본인 조회"
  ON public.investments FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인 user_id로만 추가
CREATE POLICY "investments: 본인 추가"
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 데이터만 수정
CREATE POLICY "investments: 본인 수정"
  ON public.investments FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: 본인 데이터만 삭제
CREATE POLICY "investments: 본인 삭제"
  ON public.investments FOR DELETE
  USING (auth.uid() = user_id);

-- teacher/admin: 전체 조회 (profiles 테이블에 role 컬럼이 있는 경우)
CREATE POLICY "investments: teacher 전체 조회"
  ON public.investments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'teacher' OR is_admin = true)
    )
  );


-- ── STEP 4: 인덱스 ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_investments_user_id
  ON public.investments(user_id);

CREATE INDEX IF NOT EXISTS idx_investments_created_at
  ON public.investments(created_at DESC);


-- ── STEP 5: 수정 후 확인 ─────────────────────────────────────────
-- 이 쿼리의 결과가 보이면 RLS가 올바르게 작동하는 것입니다.

SELECT id, ticker, name, market, created_at
FROM public.investments
ORDER BY created_at DESC
LIMIT 10;
