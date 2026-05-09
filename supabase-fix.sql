-- ================================================================
-- 투자학교 포트폴리오 — RLS 무한루프 + 권한 긴급 수정 v2
-- Supabase Dashboard → SQL Editor 에서 전체 실행하세요.
--
-- 수정된 내용 (v2):
--   - is_teacher() 함수가 role / is_admin 둘 다 지원
--   - profiles 서브쿼리 제거 → 무한루프 완전 차단
-- ================================================================


-- ── STEP 1: profiles 기존 RLS 정책 전부 삭제 ─────────────────────

DROP POLICY IF EXISTS "Users can view own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "profiles: 본인 조회"               ON public.profiles;
DROP POLICY IF EXISTS "profiles: 본인 수정"               ON public.profiles;
DROP POLICY IF EXISTS "profiles: teacher 전체 조회"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy"            ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"            ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy"            ON public.profiles;
DROP POLICY IF EXISTS "본인 프로필 조회"                   ON public.profiles;
DROP POLICY IF EXISTS "본인 프로필 수정"                   ON public.profiles;
DROP POLICY IF EXISTS "프로필 생성"                       ON public.profiles;


-- ── STEP 2: profiles RLS 단순하게 재생성 (서브쿼리 전혀 없음) ────

CREATE POLICY "본인 프로필 조회"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "본인 프로필 수정"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "프로필 생성"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ── STEP 3: teacher/admin 판별 함수 (role + is_admin 둘 다 지원) ─
-- SECURITY DEFINER 로 RLS 우회 → 재귀 없음

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        -- 구버전 스키마: is_admin boolean
        (is_admin = true)
        OR
        -- 신버전 스키마: role text
        (role = 'teacher')
      )
  );
$$;

-- 기존 함수 이름과의 호환성을 위해 래퍼도 생성
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_teacher_or_admin();
$$;


-- ── STEP 4: investments 기존 정책 전부 삭제 ──────────────────────

DROP POLICY IF EXISTS "investments: 본인 조회"            ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 추가"            ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 수정"            ON public.investments;
DROP POLICY IF EXISTS "investments: 본인 삭제"            ON public.investments;
DROP POLICY IF EXISTS "investments: teacher 전체 조회"    ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 조회"    ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 추가"    ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 수정"    ON public.investments;
DROP POLICY IF EXISTS "investments: student 본인 삭제"    ON public.investments;
DROP POLICY IF EXISTS "investments_policy"                ON public.investments;
DROP POLICY IF EXISTS "본인 investments 조회"             ON public.investments;
DROP POLICY IF EXISTS "본인 investments 추가"             ON public.investments;
DROP POLICY IF EXISTS "본인 investments 수정"             ON public.investments;
DROP POLICY IF EXISTS "본인 investments 삭제"             ON public.investments;


-- ── STEP 5: investments 테이블 생성 (없으면) + RLS 재설정 ─────────

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
    'cyclical', 'turnaround', 'asset_play'
  )),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 investments 조회"
  ON public.investments FOR SELECT
  USING (auth.uid() = user_id OR public.is_teacher_or_admin());

CREATE POLICY "본인 investments 추가"
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 investments 수정"
  ON public.investments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 investments 삭제"
  ON public.investments FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_investments_user_id   ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON public.investments(created_at DESC);


-- ── STEP 6: 결과 확인 ────────────────────────────────────────────

-- 6-A. 정책 목록 (재귀 서브쿼리가 없어야 함)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'investments')
ORDER BY tablename, cmd;

-- 6-B. investments 데이터 확인 (슈퍼유저 권한 → RLS 우회)
SELECT id, user_id, ticker, market, created_at
FROM public.investments
ORDER BY created_at DESC;

-- 6-C. auth.users 와 user_id 일치 여부 확인
SELECT
  i.ticker,
  i.user_id        AS inv_user_id,
  u.email,
  (i.user_id = u.id) AS matches
FROM public.investments i
JOIN auth.users u ON u.id = i.user_id;
