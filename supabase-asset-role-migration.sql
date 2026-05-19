-- ================================================================
-- investments 테이블에 asset_role 컬럼 추가
-- Supabase Dashboard → SQL Editor 에서 실행하세요.
-- ================================================================

-- 1. asset_role 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS asset_role text NOT NULL DEFAULT 'CORE'
  CHECK (asset_role IN ('CORE', 'SATELLITE'));

-- 2. 추가 확인
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'investments'
  AND column_name = 'asset_role';
