-- ================================================================
-- profiles 테이블 role 컬럼 추가 및 설정
-- Supabase Dashboard → SQL Editor 에서 실행하세요.
-- ================================================================

-- 1. role 컬럼이 없으면 추가 (이미 있으면 무시)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'teacher'));

-- 2. full_name 컬럼도 없으면 추가 (이미 있으면 무시)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- 3. 현재 상태 확인
SELECT id, email, full_name, role, created_at
FROM public.profiles
ORDER BY created_at;

-- 4. teacher 계정 지정 (아래 이메일을 실제 선생님 이메일로 변경 후 실행)
-- UPDATE public.profiles SET role = 'teacher' WHERE email = 'teacher@example.com';

-- 5. 트리거 업데이트 — 새 가입 시 role 자동 설정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        role      = COALESCE(profiles.role, 'student');
  RETURN NEW;
END;
$$;
